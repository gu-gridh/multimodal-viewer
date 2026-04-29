import { createViewer } from './main.js';

const dynamicOptions = window.MODEL_VIEWER_OPTIONS ?? {};

const options = {
    containerId: 'viewer',
    loadingScreenId: 'loading-screen',

    //rendering
    antialias: true,
    pixelRatioCap: Infinity,

    //lights
    background: null,
    hemisphereLight: { skyColor: 0xffffff, groundColor: 0x444444, intensity: 1.5 },
    directionalLight: { color: 0xffffff, intensity: 2, position: [3, 5, 4] },

    //model
    modelUrl: dynamicOptions.modelUrl,
    initialRotation: [0, 0, 0],
    recenterModel: true,

    //camera
    fov: 45,
    near: 0.1,
    far: 1000,
    cameraPosition: [0, 0, 1],

    autoRotate: true,
};

export const viewer = createViewer(options);
