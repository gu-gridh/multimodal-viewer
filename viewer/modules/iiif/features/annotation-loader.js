export function createAnnotationLoader({
    anno,
    annotationCanvasThreshold,
    annotationPath,
    clearCanvasAnnotations,
    displayInscriptions,
    drawCanvasAnnotations,
    getAnnotationsVisible,
    isPlaceholder,
    pagedAnnotationLoadingEnabled,
    viewer
}) {
    let activeAnnotationFilters = {};
    let annotationRequestId = 0;
    const annotationPageCache = new Map();
    const annotationPageCacheMaxEntries = 50;

    function getAnnotationUrl(filters, page) {
        if (!displayInscriptions || !annotationPath || isPlaceholder(annotationPath)) {
            return '';
        }

        const url = new URL(annotationPath, window.location.origin);
        Object.entries(filters || {}).forEach(([key, value]) => {
            if (value && value !== 'all') {
                url.searchParams.set(key === 'tag' ? 'tags' : key, value);
            }
        });

        if (page) {
            url.searchParams.set('page', page);
        }

        return url.toString();
    }

    function getCurrentImageSize() {
        const tiledImage = viewer.world && viewer.world.getItemAt(0);
        const contentSize = tiledImage && tiledImage.getContentSize();
        const width = Number(contentSize?.x || viewer.source?.width || viewer.source?.dimensions?.x);
        const height = Number(contentSize?.y || viewer.source?.height || viewer.source?.dimensions?.y);

        return Number.isFinite(width) && Number.isFinite(height)
            ? { width, height }
            : null;
    }

    function waitForCurrentImageSize() {
        const imageSize = getCurrentImageSize();
        if (imageSize) {
            return Promise.resolve(imageSize);
        }

        return new Promise(function (resolve) {
            viewer.addOnceHandler('open', function () {
                resolve(getCurrentImageSize());
            });
        });
    }

    function scaleNormalizedSvgSelector(selectorValue, imageSize) {
        if (!selectorValue || !imageSize) {
            return selectorValue;
        }

        return selectorValue.replace(/points="([^"]+)"/g, function (match, pointsValue) {
            const points = pointsValue.trim().split(/\s+/).map(function (point) {
                const coordinates = point.split(',').map(Number);
                return { x: coordinates[0], y: coordinates[1] };
            });
            const isNormalized = points.every(function (point) {
                return Number.isFinite(point.x) && Number.isFinite(point.y) &&
                    Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1;
            });

            if (!isNormalized) {
                return match;
            }

            const scaledPoints = points.map(function (point) {
                return `${Number((point.x * imageSize.width).toFixed(2))},${Number((point.y * imageSize.height).toFixed(2))}`;
            }).join(' ');

            return `points="${scaledPoints}"`;
        });
    }

    function scaleAnnotationToImage(annotation, imageSize) {
        const selectorValue = annotation?.target?.selector?.value;
        if (!selectorValue) {
            return annotation;
        }

        const scaledAnnotation = JSON.parse(JSON.stringify(annotation));
        scaledAnnotation.target.selector.value = scaleNormalizedSvgSelector(selectorValue, imageSize);
        return scaledAnnotation;
    }

    function setAnnotationPageCache(key, value) {
        annotationPageCache.set(key, value);

        if (annotationPageCache.size > annotationPageCacheMaxEntries) {
            annotationPageCache.delete(annotationPageCache.keys().next().value);
        }
    }

    function getAnnotationCacheKey(annotationUrl, imageSize) {
        return `${annotationUrl}|${imageSize?.width || 0}x${imageSize?.height || 0}`;
    }

    async function loadAnnotationPage(pageUrl, imageSize) {
        const cacheKey = getAnnotationCacheKey(pageUrl, imageSize);

        if (annotationPageCache.has(cacheKey)) {
            return annotationPageCache.get(cacheKey);
        }

        const response = await fetch(pageUrl);
        const data = await response.json();
        const results = Array.isArray(data) ? data : data.results || [];
        const pageData = {
            count: Array.isArray(data) ? results.length : data.count || results.length,
            nextPage: Array.isArray(data) ? null : data.nextPage,
            page: Array.isArray(data) ? null : data.page,
            annotations: results.map(annotation => scaleAnnotationToImage(annotation, imageSize))
        };

        setAnnotationPageCache(cacheKey, pageData);
        return pageData;
    }

    function yieldToBrowser() {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    async function loadAllAnnotations(filters, requestId, imageSize) {
        const annotationUrl = getAnnotationUrl(filters);
        const pageData = await loadAnnotationPage(annotationUrl, imageSize);
        const annotations = pageData.annotations;

        if (requestId === annotationRequestId) {
            clearCanvasAnnotations();
            anno.setAnnotations(annotations);
            anno.setVisible(getAnnotationsVisible());
        }

        return annotations;
    }

    async function loadPagedAnnotations(filters, requestId, imageSize) {
        let nextPage = 1;
        const scaledAnnotations = [];
        const loadedPages = new Set();
        let useCanvasAnnotations = false;

        while (nextPage && requestId === annotationRequestId) {
            if (loadedPages.has(nextPage)) {
                console.error('Same annotation page:', nextPage);
                break;
            }

            loadedPages.add(nextPage);
            const pageUrl = getAnnotationUrl(filters, nextPage);
            const pageData = await loadAnnotationPage(pageUrl, imageSize);
            const isFirstPage = loadedPages.size === 1;
            useCanvasAnnotations = pageData.count > annotationCanvasThreshold;
            scaledAnnotations.push(...pageData.annotations);
            nextPage = pageData.nextPage;

            if (requestId === annotationRequestId && useCanvasAnnotations && isFirstPage) {
                anno.setAnnotations([]);
                anno.setVisible(false);
                drawCanvasAnnotations(pageData.annotations, imageSize, true);
            } else if (requestId === annotationRequestId && useCanvasAnnotations) {
                drawCanvasAnnotations(pageData.annotations, imageSize, false);
            } else if (requestId === annotationRequestId && isFirstPage) {
                clearCanvasAnnotations();
                anno.setAnnotations(scaledAnnotations.slice());
                anno.setVisible(getAnnotationsVisible());
            }

            await yieldToBrowser();
        }

        if (requestId === annotationRequestId && !useCanvasAnnotations && loadedPages.size > 1) {
            clearCanvasAnnotations();
            anno.setAnnotations(scaledAnnotations.slice());
            anno.setVisible(getAnnotationsVisible());
        }

        return scaledAnnotations;
    }

    async function loadCurrentAnnotations(filters = activeAnnotationFilters) {
        activeAnnotationFilters = filters || {};
        const annotationUrl = getAnnotationUrl(activeAnnotationFilters);

        if (!annotationUrl) {
            return [];
        }

        const requestId = ++annotationRequestId;
        clearCanvasAnnotations();
        const imageSize = await waitForCurrentImageSize();
        return pagedAnnotationLoadingEnabled
            ? loadPagedAnnotations(activeAnnotationFilters, requestId, imageSize)
            : loadAllAnnotations(activeAnnotationFilters, requestId, imageSize);
    }

    function cancelAnnotationLoad() {
        annotationRequestId++;
    }

    return {
        cancelAnnotationLoad,
        getActiveAnnotationFilters: () => activeAnnotationFilters,
        getAnnotationUrl,
        getCurrentImageSize,
        loadCurrentAnnotations
    };
}
