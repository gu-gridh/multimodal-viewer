import { viewer } from './viewer.js';

const $ = (id) => document.getElementById(id);

const ROT_STEP = 0.04;
const ROT_NUDGE = Math.PI / 2;
const ZOOM_IN = 0.85;
const ZOOM_OUT = 1.15;

function hold(el, step) {
    let intervalId = null;

    const start = () => {
        if (intervalId) {
            return;
        }
        step();
        intervalId = window.setInterval(step, 30);
    };

    const stop = () => {
        if (!intervalId) {
            return;
        }
        window.clearInterval(intervalId);
        intervalId = null;
    };

    el?.addEventListener('mousedown', start);
    window.addEventListener('mouseup', stop);
    window.addEventListener('mouseleave', stop);
    el?.addEventListener('touchstart', (event) => {
        event.preventDefault();
        start();
    }, { passive: false });
    window.addEventListener('touchend', stop);
    window.addEventListener('touchcancel', stop);
}

$('fit')?.addEventListener('click', () => viewer.fitToView());
$('ZoomIn')?.addEventListener('click', () => viewer.zoomIn(ZOOM_IN));
$('ZoomOut')?.addEventListener('click', () => viewer.zoomOut(ZOOM_OUT));

$('auto')?.addEventListener('click', (event) => {
    const enabled = viewer.toggleAuto();
    event.currentTarget.classList.toggle('auto-rotate-active', enabled);
});

$('wire')?.addEventListener('click', (event) => {
    const enabled = viewer.toggleWireframe();
    event.currentTarget.classList.toggle('wireframe-active', enabled);
});

$('rotL')?.addEventListener('dblclick', () => viewer.rotateLeft(ROT_NUDGE));
$('rotR')?.addEventListener('dblclick', () => viewer.rotateRight(ROT_NUDGE));
hold($('rotL'), () => viewer.rotateLeft(ROT_STEP));
hold($('rotR'), () => viewer.rotateRight(ROT_STEP));
