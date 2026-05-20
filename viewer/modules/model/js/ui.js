import { viewer } from './viewer.js';

const $ = (id) => document.getElementById(id);

const THREE = viewer.three;
const ROT_STEP = THREE.MathUtils.degToRad(0.8);
const ROT_NUDGE = ROT_STEP * 10;
const ZOOM_IN = 1.01;
const ZOOM_OUT = 1.01;

function hold(el, step) {
    let intervalId = null;
    let didHold = false;

    const start = () => {
        if (intervalId) {
            return;
        }
        didHold = false;
        intervalId = window.setInterval(() => {
            didHold = true;
            step();
        }, 16);
    };

    const stop = () => {
        if (!intervalId) {
            return;
        }
        window.clearInterval(intervalId);
        intervalId = null;
    };

    el?.addEventListener('mousedown', start);
    el?.addEventListener('click', (event) => {
        if (didHold) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, true);
    window.addEventListener('mouseup', stop);
    window.addEventListener('mouseleave', stop);
    el?.addEventListener('touchstart', (event) => {
        event.preventDefault();
        start();
    }, { passive: false });
    window.addEventListener('touchend', stop);
    window.addEventListener('touchcancel', stop);

    return {
        click: (stepOnce) => el?.addEventListener('click', () => {
            if (!didHold) {
                stepOnce();
            }
        })
    };
}

$('fit')?.addEventListener('click', () => viewer.fitToView());
$('ZoomIn')?.addEventListener('click', () => viewer.zoomIn(ZOOM_IN));
$('ZoomOut')?.addEventListener('click', () => viewer.zoomOut(ZOOM_OUT));

$('auto')?.addEventListener('click', (event) => {
    if (viewer.getFirstPersonEnabled()) {
        viewer.toggleFirstPerson(false);
        $('firstPerson')?.classList.remove('first-person-active');
        $('firstPersonControlButtons')?.classList.remove('first-person-controls-visible');
    }

    const enabled = viewer.toggleAuto();
    event.currentTarget.classList.toggle('auto-rotate-active', enabled);
});

$('wire')?.addEventListener('click', (event) => {
    const enabled = viewer.toggleWireframe();
    event.currentTarget.classList.toggle('wireframe-active', enabled);
});

$('grid')?.addEventListener('click', (event) => {
    const enabled = viewer.toggleGrid();
    event.currentTarget.classList.toggle('grid-active', enabled);
});

function stopAutoRotate() {
    viewer.toggleAuto(false);
    $('auto')?.classList.remove('auto-rotate-active');
}

function leaveFirstPerson() {
    if (!viewer.getFirstPersonEnabled()) {
        return;
    }

    viewer.toggleFirstPerson(false);
    $('firstPerson')?.classList.remove('first-person-active');
    $('firstPersonControlButtons')?.classList.remove('first-person-controls-visible');
}

$('firstPerson')?.addEventListener('click', (event) => {
    const enabled = viewer.toggleFirstPerson();
    event.currentTarget.classList.toggle('first-person-active', enabled);
    $('firstPersonControlButtons')?.classList.toggle('first-person-controls-visible', enabled);

    if (enabled) {
        $('auto')?.classList.remove('auto-rotate-active');
    }
});

function bindMovementButton(id, direction) {
    const button = $(id);
    if (!button) {
        return;
    }

    const start = (event) => {
        event.preventDefault();
        viewer.setFirstPersonMovement(direction, true);
    };

    const stop = (event) => {
        event.preventDefault();
        viewer.setFirstPersonMovement(direction, false);
    };

    button.addEventListener('mousedown', start);
    button.addEventListener('mouseup', stop);
    button.addEventListener('mouseleave', stop);
    button.addEventListener('touchstart', start, { passive: false });
    button.addEventListener('touchend', stop);
    button.addEventListener('touchcancel', stop);
}

bindMovementButton('moveForward', 'forward');
bindMovementButton('moveBackward', 'backward');
bindMovementButton('moveLeft', 'left');
bindMovementButton('moveRight', 'right');

hold($('rotL'), () => {
    leaveFirstPerson();
    stopAutoRotate();
    viewer.rotateLeft(ROT_STEP);
}).click(() => {
    leaveFirstPerson();
    stopAutoRotate();
    viewer.rotateLeft(ROT_NUDGE);
});
hold($('rotR'), () => {
    leaveFirstPerson();
    stopAutoRotate();
    viewer.rotateRight(ROT_STEP);
}).click(() => {
    leaveFirstPerson();
    stopAutoRotate();
    viewer.rotateRight(ROT_NUDGE);
});
