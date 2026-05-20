import * as THREE from '/viewer/modules/pointcloud/libs/three.js/build/three.module.js';
import { GLTFLoader } from '/viewer/modules/pointcloud/libs/three.js/loaders/GLTFLoader.js';
import { FirstPersonControls } from './FirstPersonControls.js';
import { OrbitControls } from './OrbitControls.js';

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
        cameraPosition = null,
        lookAt = null,
        hemisphereLight = { skyColor: 0xffffff, groundColor: 0x444444, intensity: 1.0 },
        directionalLight = { color: 0xffffff, intensity: 1.0, position: [3, 5, 4] },
        modelUrl = null,
        autoRotate = true,
        autoRotateStep = 0.001,
        grid = false,
        fitPadding = 1.2,
        minZoomScale = 0.15,
        maxZoomScale = 5,
        firstPersonMovementSpeed = 1.0,
        firstPersonLookSpeed = 0.002,
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
    camera.position.set(...(cameraPosition || [0, 0, 1]));

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

    const floorGrid = new THREE.GridHelper(10, 100, 0x444444, 0x222222);
    floorGrid.material.transparent = true;
    floorGrid.material.opacity = 0.6;
    floorGrid.visible = grid;
    scene.add(floorGrid);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = autoRotateStep / (2 * Math.PI / 60 / 60);
    const target = controls.target;

    let root = null;
    let modelSize = 1;
    let autoRotateEnabled = autoRotate;
    let wireframeEnabled = false;
    let gridEnabled = grid;
    let firstPersonEnabled = false;
    const clock = new THREE.Clock();
    const firstPersonControls = new FirstPersonControls(camera, renderer.domElement);
    firstPersonControls.enabled = false;
    firstPersonControls.disconnect();
    firstPersonControls.movementSpeed = firstPersonMovementSpeed;
    firstPersonControls.lookSpeed = firstPersonLookSpeed;

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
        const delta = clock.getDelta();
        if (firstPersonEnabled) {
            firstPersonControls.update(delta);
        } else {
            controls.update();
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
        controls.update();
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

    function resize() {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
        render();
    }

    function clearFirstPersonInput() {
        firstPersonControls.reset();
    }

    function syncOrbitTargetToCamera() {
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);

        target.copy(camera.position).addScaledVector(direction, modelSize || 1);
        controls.update();
    }

    function setFirstPersonControls(enabled) {
        if (firstPersonEnabled === enabled) {
            return firstPersonEnabled;
        }

        firstPersonEnabled = enabled;
        firstPersonControls.enabled = enabled;
        controls.enabled = !enabled;
        clearFirstPersonInput();

        if (enabled) {
            autoRotateEnabled = false;
            controls.autoRotate = false;
            firstPersonControls.connect(renderer.domElement);
            renderer.domElement.focus();
        } else {
            firstPersonControls.disconnect();
            syncOrbitTargetToCamera();
        }

        return firstPersonEnabled;
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
            const floorBox = new THREE.Box3().setFromObject(root);
            const floorSize = floorBox.getSize(new THREE.Vector3());
            floorGrid.position.y = floorBox.min.y;
            floorGrid.scale.setScalar(Math.max(floorSize.x, floorSize.z, 10) / 10 * 8);
            controls.minDistance = modelSize * minZoomScale;
            controls.maxDistance = modelSize * maxZoomScale;
            setWireframe(wireframeEnabled);
            if (cameraPosition && lookAt) {
                camera.position.set(...cameraPosition);
                target.set(...lookAt);
                camera.lookAt(target);
                controls.update();
            } else {
                fitToView();
            }
            animate();
        }, undefined, (error) => {
            console.error(error);
        });
    }

    window.addEventListener('resize', resize);
    loadModel(modelUrl);

    return {
        three: THREE,
        scene,
        camera,
        controls,
        renderer,
        getRoot: () => root,
        fitToView,
        frameObject: fitToView,
        zoomIn: (factor = 1.01) => controls.dollyIn(factor),
        zoomOut: (factor = 1.01) => controls.dollyOut(factor),
        rotateLeft: (radians) => controls.rotateLeft(radians),
        rotateRight: (radians) => controls.rotateLeft(-radians),
        toggleAuto: (enabled = !autoRotateEnabled) => {
            autoRotateEnabled = enabled;
            controls.autoRotate = autoRotateEnabled;
            return autoRotateEnabled;
        },
        toggleWireframe: (enabled = !wireframeEnabled) => {
            setWireframe(enabled);
            return wireframeEnabled;
        },
        toggleGrid: (enabled = !gridEnabled) => {
            gridEnabled = enabled;
            floorGrid.visible = gridEnabled;
            return gridEnabled;
        },
        toggleFirstPerson: (enabled = !firstPersonEnabled) => setFirstPersonControls(enabled),
        getFirstPersonEnabled: () => firstPersonEnabled,
        setFirstPersonMovement: (direction, active) => {
            const propertyByDirection = {
                forward: 'moveForward',
                backward: 'moveBackward',
                left: 'moveLeft',
                right: 'moveRight',
                up: 'moveUp',
                down: 'moveDown'
            };
            const property = propertyByDirection[direction];
            if (property) {
                firstPersonControls[property] = active;
            }
        },
        dispose: () => {
            window.removeEventListener('resize', resize);
            controls.dispose();
            firstPersonControls.dispose();
            renderer.dispose();
        },
    };
}
