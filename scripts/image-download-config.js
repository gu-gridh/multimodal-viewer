const imageDownloadUrl = '';

function imageDownloadConfig(api, images) {
  return JSON.stringify({
    endpoint: imageDownloadUrl,
    images: images.map(image => ({
      api, id: image?.id ?? null, zenodoUrl: image?.zenodo_url || null
    }))
  }).replace(/</g, '\\u003c');
}

module.exports = { imageDownloadConfig };
