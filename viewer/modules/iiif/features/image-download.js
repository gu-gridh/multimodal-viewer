export function createImageDownload({ viewer, tileSources, getAnnotationShapes }) {
    const panel = document.getElementById('download-resolution');
    const options = document.getElementById('download-resolution-options');
    const title = document.getElementById('download-resolution-title');
    const cancel = document.getElementById('download-resolution-cancel');
    const cropOption = document.getElementById('download-crop-option');
    const crop = document.getElementById('download-crop');
    const spinner = document.getElementById('download-spinner');
    let busy = false;

    function chooseResolution(zenodoUrl) {
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
                    if (scale === 1 && !crop.checked && zenodoUrl) {
                        window.open(zenodoUrl, '_blank', 'noopener,noreferrer');
                        close(null);
                        return;
                    }
                    close(scale);
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

    function captureRegion() {
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
            query: new URLSearchParams(window.location.search).get('q'),
            service: Array.isArray(tileSources) ? tileSources[page] : tileSources,
            page,
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
            title.textContent = 'Loading download options…';
            spinner.hidden = false;
            cropOption.hidden = true;
            options.replaceChildren();
            cancel.textContent = 'Cancel';
            cancel.onclick = () => { controller.abort(); panel.hidden = true; };
            panel.hidden = true;
            const sourceResponse = await fetch('/viewer/modules/iiif/download-region', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...captureRegion(), scale: 1, crop: false, sourceOnly: true }),
                signal: controller.signal
            });
            const source = await sourceResponse.json();
            if (!sourceResponse.ok) throw new Error(source.error || 'Could not load download options.');
            const zenodoUrl = source.zenodoUrl ? new URL(source.zenodoUrl) : null;
            if (zenodoUrl && (zenodoUrl.protocol !== 'https:' || zenodoUrl.hostname !== 'zenodo.org')) throw new Error('Invalid Zenodo link.');
            spinner.hidden = true;
            const scale = await chooseResolution(zenodoUrl?.href);
            if (scale === null) return;
            const request = captureRegion();
            title.textContent = 'Preparing image…';
            spinner.hidden = false;
            cropOption.hidden = true;
            options.replaceChildren();
            cancel.onclick = () => { controller.abort(); panel.hidden = true; };
            panel.hidden = false;
            const response = await fetch('/viewer/modules/iiif/download-region', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...request, scale, crop: crop.checked }),
                signal: controller.signal
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || 'Could not download this image region.');
            }
            if (response.headers.get('Content-Type')?.includes('application/json')) {
                const { zenodoUrl } = await response.json();
                const url = new URL(zenodoUrl);
                if (url.protocol !== 'https:' || url.hostname !== 'zenodo.org') throw new Error('Invalid Zenodo link.');
                const link = document.createElement('a');
                link.href = url.href;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.textContent = 'Open Zenodo in a new tab';
                title.textContent = 'High resolution on Zenodo';
                options.replaceChildren(link);
                cancel.textContent = 'Close';
                cancel.onclick = () => { panel.hidden = true; };
                return;
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
