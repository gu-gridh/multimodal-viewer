const imageDownloadUrl = 'https://image-download.dh.gu.se/process-image';

function imageDownloadData(api, images, annotationApi = '') {
  return {
    endpoint: imageDownloadUrl,
    annotationApi,
    images: images.map(image => ({
      api, id: image?.id ?? null, zenodoUrl: image?.zenodo_url || null,
      service: image?.iiif_file?.startsWith('https://') ? image.iiif_file : null
    }))
  };
}

module.exports = { imageDownloadData };
