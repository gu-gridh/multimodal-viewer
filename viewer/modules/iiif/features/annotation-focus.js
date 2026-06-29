export function initAnnotationFocus() {
    const style = document.createElement('style');
    style.textContent = `
        .annotation-focus .openseadragon-canvas img,
        .annotation-focus .openseadragon-canvas canvas {
            filter: grayscale(1) brightness(0.45);
        }

        .annotation-focus-button {
            background: url('/viewer/shared/interface/contrast.svg');
            background-size: 80%;
            background-repeat: no-repeat;
            background-position: center;
            margin-top: 5px;
            opacity: 0.7;
        }

        .annotation-focus-active {
            opacity: 1;
        }
    `;
    document.head.append(style);

    const annotationButton = document.getElementById('clear-annotations');
    const viewerElement = document.getElementById('openseadragon');
    if (!annotationButton || !viewerElement) {
        return;
    }

    const button = document.createElement('div');
    button.id = 'annotation-focus';
    button.className = 'annotation-focus-button NavButton';
    button.title = 'Toggle annotation focus';

    button.addEventListener('click', () => {
        const active = viewerElement.classList.toggle('annotation-focus');
        button.classList.toggle('annotation-focus-active', active);
    });

    annotationButton.insertAdjacentElement('afterend', button);
}
