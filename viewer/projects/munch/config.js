module.exports = {
  //Node.js server file started for the munch project
  serverEntry: 'app_munch.js',

  //if IIIF annotations are displayed
  enableIIIFAnnotations: true,
  //if annotations are requested in pages
  enablePagedAnnotationLoading: true,
  //if selecting an annotation focuses the corresponding region
  enableAnnotationFocus: true,
  //if users can download the currently filtered annotations
  enableFilteredAnnotationDownload: true,
  //if polygon annotation drawing is available
  enablePolygonTool: true,
  //if line annotation drawing is available
  enableLineTool: true,
  //if point annotation drawing is available
  enablePointTool: true,
  //if the physical coordinate measurement tool is available
  enableCoordinateTool: true
};
