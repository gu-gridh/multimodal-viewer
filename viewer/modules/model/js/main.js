import * as THREE from '/viewer/modules/pointcloud/libs/three.js/build/three.module.js';
import { GLTFLoader } from '/viewer/modules/pointcloud/libs/three.js/loaders/GLTFLoader.js';

export function createViewer(opts = {}) {
    const {
        containerId = 'viewer',
        loadingScreenId = 'loading-screen',
        antialias = true,
        pixelRatioCap = Infinity,
        background = null,
        fov = 45,
        near = 0.1,
        far = 1000,
        cameraPosition = [0, 0, 1],
        hemisphereLight = { skyColor: 0xffffff, groundColor: 0x444444, intensity: 1.5 },
        directionalLight = { color: 0xffffff, intensity: 2, position: [3, 5, 4] },
        modelUrl = null,
        autoRotate = true,
        autoRotateStep = 0.001,
        fitPadding = 1.2,
        minZoomScale = 0.15,
        maxZoomScale = 5,
        dragRotationSpeed = 0.01,
        initialRotation = [0, 0, 0],
        recenterModel = true,
    } = opts;

    const container = document.getElementById(containerId);
    if (!container) {
        throw new Error(`Model viewer container not found!`);
    }

    const scene = new THREE.Scene();
    if (background !== null) {
        scene.background = new THREE.Color(background);
    }

    const camera = new THREE.PerspectiveCamera(
        fov,
        container.clientWidth / container.clientHeight,
        near,
        far
    );
    camera.position.set(...cameraPosition);

    const renderer = new THREE.WebGLRenderer({ antialias });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap));
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);

    if (hemisphereLight) {
        scene.add(new THREE.HemisphereLight(
            hemisphereLight.skyColor ?? 0xffffff,
            hemisphereLight.groundColor ?? 0x444444,
            hemisphereLight.intensity ?? 1.5
        ));
    }

    if (directionalLight) {
        const light = new THREE.DirectionalLight(
            directionalLight.color ?? 0xffffff,
            directionalLight.intensity ?? 2
        );
        light.position.set(...(directionalLight.position ?? [3, 5, 4]));
        scene.add(light);
    }

    const target = new THREE.Vector3(0, 0, 0);
    let root = null;
    let modelSize = 1;
    let autoRotateEnabled = autoRotate;
    let wireframeEnabled = false;
    let pointerDown = false;
    let lastPointer = { x: 0, y: 0 };

    const loadingManager = new THREE.LoadingManager(() => {
        const loadingScreen = document.getElementById(loadingScreenId);
        loadingScreen?.classList.add('fade-out');
        loadingScreen?.addEventListener('transitionend', onTransitionEnd, { once: true });
    });

    function onTransitionEnd(event) {
        event.target.remove();
    }

    function render() {
        renderer.render(scene, camera);
    }

    function animate() {
        requestAnimationFrame(animate);
        if (autoRotateEnabled) {
            rotateY(autoRotateStep);
        }
        render();
    }

    function fitToView(obj = root) {
        if (!obj) {
            return;
        }

        obj.updateWorldMatrix(true, true);

        const box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (!Number.isFinite(maxDim) || maxDim === 0) {
            return;
        }

        const fitHeightDistance = maxDim / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
        const fitWidthDistance = fitHeightDistance / camera.aspect;
        const distance = Math.max(fitHeightDistance, fitWidthDistance) * fitPadding;

        target.copy(center);
        camera.position.copy(center).add(new THREE.Vector3(0, maxDim * 0.25, distance));
        camera.near = Math.max(distance / 100, 0.01);
        camera.far = Math.max(distance * 100, 1000);
        camera.updateProjectionMatrix();
        camera.lookAt(target);
    }

    function zoomBy(scale) {
        const offset = camera.position.clone().sub(target);
        const nextDistance = THREE.MathUtils.clamp(
            offset.length() * scale,
            modelSize * minZoomScale,
            modelSize * maxZoomScale
        );

        offset.setLength(nextDistance);
        camera.position.copy(target).add(offset);
        camera.lookAt(target);
    }

    function rotateY(radians) {
        if (root) {
            root.rotation.y += radians;
        }
    }

    function rotateX(radians) {
        if (root) {
            root.rotation.x += radians;
        }
    }

    function setWireframe(enabled) {
        wireframeEnabled = enabled;

        if (!root) {
            return;
        }

        root.traverse((node) => {
            if (!node.isMesh) {
                return;
            }

            if (!node.userData.originalMaterial) {
                node.userData.originalMaterial = node.material;
            }

            if (wireframeEnabled) {
                const wireframeMaterial = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    wireframe: true,
                    side: THREE.DoubleSide
                });

                node.material = Array.isArray(node.userData.originalMaterial)
                    ? node.userData.originalMaterial.map(() => wireframeMaterial.clone())
                    : wireframeMaterial;
            } else {
                node.material = node.userData.originalMaterial;
            }
        });
    }

    function bindPointerControls() {
        renderer.domElement.addEventListener('pointerdown', (event) => {
            pointerDown = true;
            lastPointer = { x: event.clientX, y: event.clientY };
            renderer.domElement.setPointerCapture(event.pointerId);
        });

        renderer.domElement.addEventListener('pointermove', (event) => {
            if (!pointerDown || !root) {
                return;
            }

            const dx = event.clientX - lastPointer.x;
            const dy = event.clientY - lastPointer.y;
            rotateY(dx * dragRotationSpeed);
            rotateX(dy * dragRotationSpeed);
            lastPointer = { x: event.clientX, y: event.clientY };
        });

        renderer.domElement.addEventListener('pointerup', (event) => {
            pointerDown = false;
            renderer.domElement.releasePointerCapture(event.pointerId);
        });

        renderer.domElement.addEventListener('wheel', (event) => {
            event.preventDefault();
            zoomBy(event.deltaY < 0 ? 0.9 : 1.1);
        }, { passive: false });
    }

    function resize() {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
        render();
    }

    function loadModel(url) {
        if (!url) {
            animate();
            return;
        }

        new GLTFLoader(loadingManager).load(url, (gltf) => {
            root = gltf.scene;
            root.rotation.set(
                THREE.MathUtils.degToRad(initialRotation[0] ?? 0),
                THREE.MathUtils.degToRad(initialRotation[1] ?? 0),
                THREE.MathUtils.degToRad(initialRotation[2] ?? 0)
            );
            scene.add(root);

            const box = new THREE.Box3().setFromObject(root);
            const size = box.getSize(new THREE.Vector3()).length();
            const center = box.getCenter(new THREE.Vector3());

            modelSize = size || 1;
            if (recenterModel) {
                root.position.sub(center);
            }
            setWireframe(wireframeEnabled);
            fitToView();
            animate();
        }, undefined, (error) => {
            console.error(error);
        });
    }

    bindPointerControls();
    window.addEventListener('resize', resize);
    loadModel(modelUrl);

    return {
        three: THREE,
        scene,
        camera,
        renderer,
        getRoot: () => root,
        fitToView,
        frameObject: fitToView,
        zoomBy,
        zoomIn: (scale = 0.85) => zoomBy(scale),
        zoomOut: (scale = 1.15) => zoomBy(scale),
        rotateY,
        rotateLeft: rotateY,
        rotateRight: (radians) => rotateY(-radians),
        toggleAuto: (enabled = !autoRotateEnabled) => {
            autoRotateEnabled = enabled;
            return autoRotateEnabled;
        },
        toggleWireframe: (enabled = !wireframeEnabled) => {
            setWireframe(enabled);
            return wireframeEnabled;
        },
        dispose: () => {
            window.removeEventListener('resize', resize);
            renderer.dispose();
        },
    };
}
