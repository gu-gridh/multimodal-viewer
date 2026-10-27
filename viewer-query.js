const validQuery = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} ._-]*(?:\/(?:orthophoto|topography|mesh|texturedmesh|rti|pointcloud|panorama|images|image|photo|iiif|visualisation|metadata|metadata-compact|[0-9]+))?$/u;

module.exports = function validateViewerQuery(req, res, next) {
  const { q, annotationId } = req.query;
  if (q !== undefined && (typeof q !== 'string' || q.length > 200 || !validQuery.test(q))) {
    return res.status(400).type('text').send('Invalid q parameter');
  }
  if (annotationId !== undefined && (typeof annotationId !== 'string' || !/^[0-9]{1,20}$/.test(annotationId))) {
    return res.status(400).type('text').send('Invalid parameter');
  }
  next();
};
