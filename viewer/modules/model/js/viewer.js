import { createViewer } from './main.js';

const dynamicOptions = window.MODEL_VIEWER_OPTIONS ?? {};

const options = {
    containerId: 'viewer',
    loadingScreenId: 'loading-screen',

    //rendering
    antialias: true,
    pixelRatioCap: Infinity,

    //lights
    background: 0x2d2d2d,
    hemisphereLight: { skyColor: 0xffffff, groundColor: 0x444444, intensity: 0.8 },
    directionalLight: { color: 0xffffff, intensity: 1.0, position: [3, 5, 4] },

    // Scene settings
    fog: { color: 0x2d2d2d, near: 2, far: 50 },

    //model
    modelUrl: dynamicOptions.modelUrl,
    initialRotation: [0, 0, 0],
    recenterModel: true,

    //camera
    fov: 45,
    near: 0.1,
    far: 1000,
    cameraPosition: dynamicOptions.cameraPosition,
    lookAt: dynamicOptions.lookAt,

    autoRotate: true,
    firstPersonMovementSpeed: 1.0,
};

export const viewer = createViewer(options);
