export function initCoordinateTool({ height, unit = '', viewer, width }) {
    if (!viewer || !width || !height) {
        return;
    }

    const row = document.getElementById('coordinate-row');
    const button = document.getElementById('coordinate-toggle');
    if (!row || !button) {
        return;
    }

    let enabled = false;
    button.style.display = 'flex';

    button.addEventListener('click', function () {
        enabled = !enabled;
        row.style.display = enabled ? 'block' : 'none';
    });

    viewer.canvas.addEventListener('mousemove', function (event) {
        if (!enabled) {
            return;
        }

        const imageSize = viewer.world.getItemAt(0)?.getContentSize();
        if (!imageSize) {
            return;
        }

        const mouse = OpenSeadragon
            .getMousePosition(event)
            .minus(OpenSeadragon.getElementPosition(viewer.canvas));
        const viewportPoint = viewer.viewport.pointFromPixel(mouse);
        const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);
        const x = clamp((imagePoint.x / imageSize.x) * width, width);
        const y = clamp(((imageSize.y - imagePoint.y) / imageSize.y) * height, height);

        const suffix = unit ? ` ${unit}` : '';
        row.textContent = `${x.toFixed(0)}${suffix}  ||  ${y.toFixed(0)}${suffix}`;
    });
}

function clamp(value, max) {
    return Math.max(0, Math.min(max, value));
}
