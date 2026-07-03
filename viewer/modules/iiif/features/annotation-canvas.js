export function createAnnotationCanvasRenderer({ anno, getAnnotationsVisible, viewer }) {
    let annotationCanvas = null;
    let annotationCanvasOverlayAdded = false;
    let canvasAnnotationMode = false;
    let annotationInteractionMessageTimeout = null;

    function getAnnotationCanvas() {
        if (annotationCanvas) {
            return annotationCanvas;
        }

        annotationCanvas = document.createElement('canvas');
        annotationCanvas.id = 'annotation-canvas';
        annotationCanvas.style.display = 'none';
        return annotationCanvas;
    }

    function getAnnotationInteractionMessage() {
        return document.getElementById('annotation-interaction-message');
    }

    function setCanvasAnnotationVisible(visible) {
        if (annotationCanvas) {
            annotationCanvas.style.display = visible ? 'block' : 'none';
        }

        const message = getAnnotationInteractionMessage();
        clearTimeout(annotationInteractionMessageTimeout);

        if (visible) {
            message.style.display = 'block';
            message.style.opacity = '1';
            annotationInteractionMessageTimeout = setTimeout(function () {
                message.style.opacity = '0';
            }, 10000);
        } else {
            message.style.display = 'none';
            message.style.opacity = '0';
        }
    }

    function clearCanvasAnnotations() {
        canvasAnnotationMode = false;
        setCanvasAnnotationVisible(false);

        if (annotationCanvas) {
            const context = annotationCanvas.getContext('2d');
            context.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
        }
    }

    function getAnnotationColor(annotation) {
        return annotation?.body?.category?.color ||
            annotation?.body?.categories?.[0]?.color ||
            annotation?.body?.category_detail?.[0]?.color ||
            annotation?.category_detail?.[0]?.color ||
            '#ff0000';
    }

    function getAnnotationSelectorValue(annotation) {
        return annotation?.target?.selector?.value || '';
    }

    function getImageOverlayBounds(imageSize) {
        if (viewer.viewport.imageToViewportRectangle) {
            return viewer.viewport.imageToViewportRectangle(0, 0, imageSize.width, imageSize.height);
        }

        return new OpenSeadragon.Rect(0, 0, 1, imageSize.height / imageSize.width);
    }

    function drawCanvasAnnotations(annotations, imageSize, resetCanvas = true) {
        const canvas = getAnnotationCanvas();
        const maxCanvasSide = 2048;
        const canvasScale = resetCanvas
            ? Math.min(1, maxCanvasSide / Math.max(imageSize.width, imageSize.height))
            : canvas.width / imageSize.width;
        const width = Math.max(1, Math.round(imageSize.width * canvasScale));
        const height = Math.max(1, Math.round(imageSize.height * canvasScale));
        const context = canvas.getContext('2d');

        if (resetCanvas) {
            canvas.width = width;
            canvas.height = height;
            context.clearRect(0, 0, width, height);

            if (!annotationCanvasOverlayAdded) {
                viewer.addOverlay({
                    element: canvas,
                    location: getImageOverlayBounds(imageSize),
                    rotationMode: OpenSeadragon.OverlayRotationMode.EXACT
                });
                annotationCanvasOverlayAdded = true;
            } else {
                viewer.updateOverlay(canvas, getImageOverlayBounds(imageSize));
            }
        }

        annotations.forEach(annotation => {
            const selectorValue = getAnnotationSelectorValue(annotation);
            const pointsValue = selectorValue.match(/points="([^"]+)"/)?.[1];

            if (!pointsValue) {
                const rectValue = selectorValue.match(/xywh=pixel:([^"]+)/)?.[1];
                if (!rectValue) {
                    return;
                }

                const [x, y, width, height] = rectValue.split(',').map(Number);
                if (![x, y, width, height].every(Number.isFinite)) {
                    return;
                }

                context.strokeStyle = getAnnotationColor(annotation);
                context.lineWidth = 3;
                context.strokeRect(x * canvasScale, y * canvasScale, width * canvasScale, height * canvasScale);
                return;
            }

            const points = pointsValue.trim().split(/\s+/).map(point => {
                const [x, y] = point.split(',').map(Number);
                return Number.isFinite(x) && Number.isFinite(y)
                    ? { x: x * canvasScale, y: y * canvasScale }
                    : null;
            }).filter(Boolean);

            if (points.length === 1) {
                context.beginPath();
                context.arc(points[0].x, points[0].y, 5, 0, Math.PI * 2);
                context.strokeStyle = getAnnotationColor(annotation);
                context.lineWidth = 3;
                context.stroke();
                return;
            }

            if (points.length < 2) {
                return;
            }

            const isPolyline = selectorValue.includes('<polyline');
            context.beginPath();
            context.moveTo(points[0].x, points[0].y);
            points.slice(1).forEach(point => context.lineTo(point.x, point.y));

            if (!isPolyline) {
                context.closePath();
            }

            context.strokeStyle = getAnnotationColor(annotation);
            context.lineWidth = 3;
            context.lineJoin = 'round';
            context.lineCap = 'round';
            context.stroke();
        });

        canvasAnnotationMode = true;
        anno.setVisible(false);
        setCanvasAnnotationVisible(getAnnotationsVisible());
    }

    return {
        clearCanvasAnnotations,
        drawCanvasAnnotations,
        isCanvasAnnotationMode: () => canvasAnnotationMode,
        setCanvasAnnotationVisible
    };
}
