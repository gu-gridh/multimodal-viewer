export function createImageDownload({ viewer, tileSources, downloads, getAnnotationShapes }) {
    const panel = document.getElementById('download-resolution');
    const options = document.getElementById('download-resolution-options');
    const title = document.getElementById('download-resolution-title');
    const cancel = document.getElementById('download-resolution-cancel');
    const cropOption = document.getElementById('download-crop-option');
    const crop = document.getElementById('download-crop');
    const spinner = document.getElementById('download-spinner');
    let busy = false;

    function chooseResolution() {
        return new Promise(resolve => {
            const close = value => { panel.hidden = true; resolve(value); };
            const resolutions = [
                { scale: 1, label: 'High resolution' },
                { scale: 0.5, label: 'Medium resolution' },
                { scale: 0.25, label: 'Low resolution' }
            ];
            options.replaceChildren(...resolutions.map(({ scale, label }) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = label;
                button.onclick = () => {
                    const image = downloads?.images?.[viewer.currentPage()];
                    const cropped = crop.checked;
                    const zenodoUrl = image?.zenodoUrl;
                    if (scale === 1 && !cropped && zenodoUrl) {
                        window.open(zenodoUrl, '_blank', 'noopener,noreferrer');
                        close(null);
                        return;
                    }
                    close({ scale, image, cropped });
                };
                return button;
            }));
            title.textContent = 'Download image';
            cropOption.hidden = false;
            cancel.textContent = 'Cancel';
            cancel.onclick = () => close(null);
            panel.hidden = false;
        });
    }

    function captureRegion(image) {
        const item = viewer.world.getItemAt(0);
        if (!item) throw new Error('Wait for the image to load.');
        const size = item.getContentSize();
        const width = viewer.container.clientWidth;
        const height = viewer.container.clientHeight;
        const flipped = viewer.viewport.getFlip();
        const viewport = [[0, 0], [width, 0], [width, height], [0, height]].map(([x, y]) => {
            const point = viewer.viewport.viewerElementToImageCoordinates(new OpenSeadragon.Point(flipped ? width - x : x, y));
            return { x: point.x / size.x, y: point.y / size.y };
        });
        const page = viewer.currentPage();
        return {
            service: image?.service || (Array.isArray(tileSources) ? tileSources[page] : tileSources),
            viewport,
            viewWidth: width,
            rotation: viewer.viewport.getRotation(true),
            flipped,
            shapes: getAnnotationShapes().map(shape => ({
                color: shape.color,
                closed: shape.closed,
                points: shape.points.map(point => ({ x: point.x / size.x, y: point.y / size.y }))
            }))
        };
    }

    document.getElementById('download').addEventListener('click', async event => {
        event.preventDefault();
        if (busy) return;
        busy = true;
        try {
            const controller = new AbortController();
            const selection = await chooseResolution();
            if (!selection) return;
            const { scale, image, cropped } = selection;
            if (!cropped && image?.id == null) throw new Error('No download image ID is available.');
            const endpoint = cropped ? '/viewer/modules/iiif/download-region' : downloads.endpoint;
            const request = cropped
                ? { ...captureRegion(image), scale, crop: true }
                : { api: image.api, id: image.id, quality: { 1: 1, 0.5: 2, 0.25: 3 }[scale] };
            if (!cropped && !endpoint) {
                console.log('Image download POST payload:', JSON.stringify(request, null, 2));
                return;
            }
            title.textContent = 'Preparing image…';
            spinner.hidden = false;
            cropOption.hidden = true;
            options.replaceChildren();
            cancel.onclick = () => { controller.abort(); panel.hidden = true; };
            panel.hidden = false;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request),
                signal: controller.signal
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || 'Could not download this image.');
            }
            const objectUrl = URL.createObjectURL(await response.blob());
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || 'image.jpg';
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
            panel.hidden = true;
        } catch (error) {
            if (error.name === 'AbortError') return;
            console.error('Could not export image region', error);
            title.textContent = error.message;
            cropOption.hidden = true;
            options.replaceChildren();
            cancel.textContent = 'Close';
            cancel.onclick = () => { panel.hidden = true; };
            panel.hidden = false;
        } finally {
            spinner.hidden = true;
            busy = false;
        }
    });
}
