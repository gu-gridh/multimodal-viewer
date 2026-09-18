export function createAnnotationCanvasRenderer({ annotationCanvasThreshold, anno, getAnnotationsVisible, viewer }) {
    let annotationCanvas = null;
    let canvasAnnotationMode = false;
    let annotationInteractionMessageTimeout = null;
    let annotationShapes = [];

    function getAnnotationCanvas() {
        if (annotationCanvas) {
            return annotationCanvas;
        }

        annotationCanvas = document.createElement('canvas');
        annotationCanvas.id = 'annotation-canvas';
        annotationCanvas.style.cssText = 'display:none;position:absolute;inset:0;pointer-events:none;z-index:2;';
        viewer.container.appendChild(annotationCanvas);
        return annotationCanvas;
    }

    function getAnnotationInteractionMessage() {
        return document.getElementById('annotation-interaction-message');
    }

    function setAnnotationInteractionMessageText() {
        const message = getAnnotationInteractionMessage();
        if (message) {
            message.textContent = `Narrow your search to less than ${annotationCanvasThreshold} annotations to interact with them.`;
        }
    }

    function setCanvasAnnotationVisible(visible) {
        if (annotationCanvas) {
            annotationCanvas.style.display = visible ? 'block' : 'none';
        }

        const message = getAnnotationInteractionMessage();
        clearTimeout(annotationInteractionMessageTimeout);

        if (visible && message) {
            message.style.display = 'block';
            message.style.opacity = '1';
            annotationInteractionMessageTimeout = setTimeout(function () {
                message.style.opacity = '0';
            }, 10000);
        } else if (message) {
            message.style.display = 'none';
            message.style.opacity = '0';
        }
    }

    function clearCanvasAnnotations() {
        canvasAnnotationMode = false;
        annotationShapes = [];
        setCanvasAnnotationVisible(false);

        if (annotationCanvas) {
            annotationCanvas.width = 1;
            annotationCanvas.height = 1;
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

    function parseAnnotation(annotation) {
        const selectorValue = getAnnotationSelectorValue(annotation);
        const pointsValue = selectorValue.match(/points="([^"]+)"/)?.[1];
        let points;

        if (pointsValue) {
            points = pointsValue.trim().split(/\s+/).map(point => {
                const [x, y] = point.split(',').map(Number);
                return { x, y };
            }).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
        } else {
            const fragment = selectorValue.match(/^xywh=(pixel|percent):(.+)$/);
            const rect = fragment?.[2].split(',').map(Number);
            if (!rect || rect.length !== 4 || !rect.every(Number.isFinite)) {
                return null;
            }
            let [x, y, width, height] = rect;
            if (fragment[1] === 'percent') {
                const size = viewer.world.getItemAt(0)?.getContentSize();
                if (!size) return null;
                x *= size.x / 100;
                y *= size.y / 100;
                width *= size.x / 100;
                height *= size.y / 100;
            }
            points = [
                { x, y },
                { x: x + width, y },
                { x: x + width, y: y + height },
                { x, y: y + height }
            ];
        }

        if (!points.length) {
            return null;
        }

        const rectangle = !pointsValue;
        return {
            points,
            color: rectangle ? '#ffffff' : getAnnotationColor(annotation),
            dotted: rectangle,
            closed: !selectorValue.includes('<polyline')
        };
    }

    function redrawCanvasAnnotations() {
        if (!canvasAnnotationMode || !annotationCanvas) {
            return;
        }

        const width = viewer.container.clientWidth;
        const height = viewer.container.clientHeight;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const backingWidth = Math.max(1, Math.round(width * pixelRatio));
        const backingHeight = Math.max(1, Math.round(height * pixelRatio));

        if (annotationCanvas.width !== backingWidth || annotationCanvas.height !== backingHeight) {
            annotationCanvas.width = backingWidth;
            annotationCanvas.height = backingHeight;
            annotationCanvas.style.width = `${width}px`;
            annotationCanvas.style.height = `${height}px`;
        }

        const context = annotationCanvas.getContext('2d');
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.clearRect(0, 0, width, height);
        context.lineWidth = 1.5;
        context.lineJoin = 'round';
        context.lineCap = 'round';

        annotationShapes.forEach(shape => {
            const points = shape.points.map(point => viewer.viewport.imageToViewerElementCoordinates(
                new OpenSeadragon.Point(point.x, point.y)
            ));
            context.beginPath();

            if (points.length === 1) {
                context.arc(points[0].x, points[0].y, 5, 0, Math.PI * 2);
            } else {
                context.moveTo(points[0].x, points[0].y);
                points.slice(1).forEach(point => context.lineTo(point.x, point.y));
                if (shape.closed) {
                    context.closePath();
                }
            }

            context.strokeStyle = shape.color;
            context.lineCap = shape.dotted ? 'butt' : 'round';
            context.setLineDash(shape.dotted ? [1, 1] : []);
            context.stroke();
        });
    }

    function drawCanvasAnnotations(annotations, imageSize, resetCanvas = true) {
        getAnnotationCanvas();
        const shapes = annotations.map(parseAnnotation).filter(Boolean);
        annotationShapes = resetCanvas ? shapes : annotationShapes.concat(shapes);
        canvasAnnotationMode = true;
        setCanvasAnnotationVisible(getAnnotationsVisible());
        redrawCanvasAnnotations();
    }

    viewer.addHandler('animation', redrawCanvasAnnotations);
    viewer.addHandler('animation-finish', redrawCanvasAnnotations);
    viewer.addHandler('resize', redrawCanvasAnnotations);
    viewer.addHandler('rotate', redrawCanvasAnnotations);
    setAnnotationInteractionMessageText();

    return {
        clearCanvasAnnotations,
        drawCanvasAnnotations,
        isCanvasAnnotationMode: () => canvasAnnotationMode,
        getAnnotationShapes: () => canvasAnnotationMode
            ? annotationShapes
            : anno.getAnnotations().map(parseAnnotation).filter(Boolean),
        setCanvasAnnotationVisible
    };
}
