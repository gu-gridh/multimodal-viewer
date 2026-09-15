const imageDownloadUrl = '';

function imageDownloadConfig(api, images, annotationApi = '') {
  return JSON.stringify({
    endpoint: imageDownloadUrl,
    annotationApi,
    images: images.map(image => ({
      api, id: image?.id ?? null, zenodoUrl: image?.zenodo_url || null,
      service: image?.iiif_file?.startsWith('https://') ? image.iiif_file : null
    }))
  }).replace(/</g, '\\u003c');
}

module.exports = { imageDownloadConfig };
