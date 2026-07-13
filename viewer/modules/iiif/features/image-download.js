export function createImageDownload({
    viewer,
    tileSources,
    downloadSourceString,
    project,
    creator,
    locationIds,
    imageIds,
    filteredAnnotationDownloadEnabled,
    getActiveAnnotationFilters,
    isPlaceholder
}) {
    const panel = document.getElementById('download-resolution');
    const options = document.getElementById('download-resolution-options');
    const title = document.getElementById('download-resolution-title');
    const cancel = document.getElementById('download-resolution-cancel');

    function chooseResolution() {
        const resolutions = [
            { scale: 1, label: 'Full resolution' },
            { scale: 0.5, label: 'Half resolution' },
            { scale: 0.25, label: 'Quarter resolution' }
        ];

        return new Promise(resolve => {
            const close = value => {
                panel.hidden = true;
                resolve(value);
            };
            options.replaceChildren(...resolutions.map(resolution => {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = resolution.label;
                button.onclick = () => close(resolution.scale);
                return button;
            }));
            title.textContent = 'Choose download resolution:';
            cancel.textContent = 'Cancel';
            cancel.onclick = () => close(null);
            panel.hidden = false;
        });
    }

    function getIIIFUrl(pageIndex, scale) {
        const sources = Array.isArray(tileSources) ? tileSources : [tileSources];
        const infoUrl = sources[pageIndex] || sources[0];
        const maxSize = Math.round(Math.max(viewer.source.width, viewer.source.height) * scale);
        return `${infoUrl.replace(/\/info\.json(?:\?.*)?$/, '')}/full/!${maxSize},${maxSize}/0/default.jpg`;
    }

    function showError() {
        title.textContent = 'Could not download image';
        options.replaceChildren();
        cancel.textContent = 'Close';
        cancel.onclick = () => { panel.hidden = true; };
        panel.hidden = false;
    }

    function parse(value, fallback) {
        return isPlaceholder(value) ? fallback : JSON.parse(value);
    }

    document.getElementById('download').addEventListener('click', async event => {
        event.preventDefault();

        try {
            const downloadSources = parse(downloadSourceString, []);
            const creators = parse(creator, [['Unknown Creator']]);
            const locationIdArray = parse(locationIds, ['Unknown Location']);
            const imgIdArray = parse(imageIds, [0]);
            const pageIndex = viewer.currentPage();
            const scale = await chooseResolution();
            if (scale === null) return;

            let imageUrl = Array.isArray(downloadSources) ? downloadSources[pageIndex] : downloadSources;
            if (filteredAnnotationDownloadEnabled) {
                const url = new URL(imageUrl, window.location.origin);
                Object.entries(getActiveAnnotationFilters()).forEach(([key, value]) => {
                    if (value && value !== 'all') {
                        url.searchParams.set(key === 'tag' ? 'tags' : key, value);
                    }
                });
                url.searchParams.set('scale', scale);
                imageUrl = url.toString();
            } else {
                imageUrl = getIIIFUrl(pageIndex, scale);
            }

            const response = await fetch(imageUrl);
            if (!response.ok) throw new Error(`Download failed: ${response.status}`);
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const creatorName = creators[0][0].replace(/,\s*/g, '_');
            const filename = project.toLowerCase() === 'shfa'
                ? `${creatorName}_${locationIdArray[0]}_SHFAid${imgIdArray[pageIndex]}.jpg`
                : `image_${pageIndex + 1}.jpg`;
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            URL.revokeObjectURL(objectUrl);
            link.remove();
        } catch (error) {
            console.error('Could not download the image', error);
            showError();
        }
    });
}
