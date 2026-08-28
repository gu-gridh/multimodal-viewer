export function createAnnotationInteractions({
    anno,
    annotationEditorUrl,
    displayInscriptions,
    getCurrentImageSize,
    initialAnnotationId,
    isPlaceholder,
    loadAnnotationsPromise,
    viewer
}) {
    let annotationClicked = false;
    let currentAnnotationId = initialAnnotationId;
    let currentAnnotationTool = 'rect';
    let pendingAnnotationId = null;

    const lineToolButton = document.getElementById('multiline-annotate-button');
    if (lineToolButton.style.display !== 'none' && OpenSeadragon.Annotorious.PolylineTool) {
        anno.addDrawingTool(OpenSeadragon.Annotorious.PolylineTool);
    }

    const pointToolButton = document.getElementById('point-annotate-button');
    if (pointToolButton.style.display !== 'none' && OpenSeadragon.Annotorious.PointTool) {
        anno.addDrawingTool(OpenSeadragon.Annotorious.PointTool);
    }

    function updateInstructions(tool = currentAnnotationTool) {
        currentAnnotationTool = tool;
        const translationKey = tool === 'line'
            ? 'annotate-instructions-line'
            : tool === 'point'
                ? 'annotate-instructions-point'
                : tool === 'polygon' ? 'annotate-instructions-polygon' : 'annotate-instructions';
        document.getElementById('9').innerHTML = i18next.t(translationKey);
    }

    function resetPendingSelection() {
        document.getElementById('savePopup').style.display = 'none';

        if (pendingAnnotationId) {
            anno.removeAnnotation(pendingAnnotationId);
            pendingAnnotationId = null;
        }
    }

    function startDrawing(tool, drawingTool = tool) {
        resetPendingSelection();
        updateInstructions(tool);
        anno.setDrawingTool(drawingTool);
        anno.setDrawingEnabled(true);
        $('#instructions').show();
    }

    function openAnnotationById(annotationId) {
        if (!displayInscriptions) {
            return;
        }

        loadAnnotationsPromise.then(() => {
            const annotation = anno.getAnnotationById(annotationId);

            if (annotation) {
                anno.selectAnnotation(annotationId);
                anno.fitBounds(annotationId, {
                    immediately: false,
                    padding: 200
                });
                window.parent.postMessage({
                    type: 'annotationLoaded',
                    value: annotationId
                }, '*');
            } else {
                console.error('Annotation not found:', annotationId);
            }
        });
    }

    function copyIIIFRegion(annotation) {
        const fragmentSelector = annotation.target.selector.value;
        const [x, y, width, height] = fragmentSelector.replace('xywh=pixel:', '').split(',').map(Number);
        const imageX = Math.round(x);
        const imageY = Math.round(y);
        const regionWidth = Math.round(width);
        const regionHeight = Math.round(height);
        const imageWidth = viewer.source.width;
        const imageHeight = viewer.source.height;
        const percentageRegion = `pct:${((imageX / imageWidth) * 100).toFixed(2)},${((imageY / imageHeight) * 100).toFixed(2)},${((regionWidth / imageWidth) * 100).toFixed(2)},${((regionHeight / imageHeight) * 100).toFixed(2)}`;

        navigator.clipboard.writeText(percentageRegion).then(() => {
            console.log('IIIF region copied to clipboard:', `${imageX},${imageY},${regionWidth},${regionHeight}`);
        }).catch(error => {
            console.error('Failed to copy IIIF region to clipboard:', error);
        });
    }

    function copySvgShape(annotation) {
        const selectorValue = annotation?.target?.selector?.value || '';
        const shapeMatch = selectorValue.match(/<(polygon|polyline)[^>]*points="([^"]+)"/i);
        const imageSize = getCurrentImageSize();

        if (!shapeMatch) {
            console.error('SVG shape selector not found:', selectorValue);
            return;
        }

        if (!imageSize) {
            console.error('Image size not available');
            return;
        }

        const normalizedPoints = shapeMatch[2]
            .trim()
            .split(/\s+/)
            .map(point => {
                const [x, y] = point.split(',');
                return `${Number((Number(x) / imageSize.width).toFixed(8))},${Number((Number(y) / imageSize.height).toFixed(8))}`;
            })
            .join(' ');
        const shape = shapeMatch[1].toLowerCase();
        const pointAttribute = selectorValue.includes('data-point="true"') ? ' data-point="true"' : '';
        const shapeSvg = `<svg><${shape}${pointAttribute} points="${normalizedPoints}" /></svg>`;

        navigator.clipboard.writeText(shapeSvg).then(() => {
            console.log(`${shape} copied to clipboard:`, shapeSvg);
        }).catch(error => console.error(error));
    }

    anno.on('createSelection', async function (selection) {
        selection.body = [{
            type: 'TextualBody',
            purpose: 'tagging',
            value: 'MyTag'
        }];
        await anno.updateSelected(selection);
        anno.saveSelected();
    });

    anno.on('createAnnotation', function (annotation) {
        pendingAnnotationId = annotation.id;
        document.getElementById('savePopup').style.display = 'block';
        document.getElementById('instructions').style.display = 'none';

        document.getElementById('saveYes').onclick = function () {
            const selectorValue = annotation?.target?.selector?.value || '';
            if (selectorValue.includes('<polygon') || selectorValue.includes('<polyline')) {
                copySvgShape(annotation);
            } else {
                copyIIIFRegion(annotation);
            }

            anno.removeAnnotation(annotation.id);
            pendingAnnotationId = null;
            if (annotationEditorUrl && !isPlaceholder(annotationEditorUrl)) {
                window.open(annotationEditorUrl, '_blank');
            }
            document.getElementById('savePopup').style.display = 'none';
        };

        document.getElementById('saveNo').onclick = function () {
            anno.removeAnnotation(annotation.id);
            pendingAnnotationId = null;
            document.getElementById('savePopup').style.display = 'none';
        };
    });

    anno.on('clickAnnotation', function (annotation) {
        annotationClicked = true;
        currentAnnotationId = annotation.id;
        anno.selectAnnotation(annotation.id);
        anno.fitBounds(annotation.id, {
            immediately: false,
            padding: 200
        });
        window.parent.postMessage({
            type: 'annotationClick',
            value: annotation.id
        }, '*');
    });

    anno.on('cancelSelected', function () {
        currentAnnotationId = null;
    });

    let isDragging = false;
    let startX;
    let startY;

    viewer.addHandler('canvas-press', function (event) {
        isDragging = false;
        startX = event.position.x;
        startY = event.position.y;
    });

    viewer.addHandler('canvas-drag', function (event) {
        if (Math.abs(event.position.x - startX) > 1 || Math.abs(event.position.y - startY) > 1) {
            isDragging = true;
        }
    });

    viewer.addHandler('canvas-click', function () {
        if (isDragging) {
            return;
        }
        if (annotationClicked) {
            annotationClicked = false;
            return;
        }

        window.parent.postMessage({
            type: 'annotationClick',
            value: null
        }, '*');
        currentAnnotationId = null;
    });

    if (currentAnnotationId) {
        loadAnnotationsPromise.then(annotations => {
            if (annotations.length > 0) {
                openAnnotationById(currentAnnotationId);
            }
        });
    }

    return {
        resetPendingSelection,
        startDrawing,
        updateInstructions
    };
}
