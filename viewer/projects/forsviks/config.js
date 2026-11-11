module.exports = {
  serverEntry: 'app_forsviks.js',
  temporarySources: {
    pointcloudPanel: 'https://saintsophia.dh.gu.se/api/inscriptions/geojson/panel/?title=120-19c',
    pointcloud: 'https://data.dh.gu.se/saintsophia/pointcloud/cloud.js',
    image: 'https://diana.dh.gu.se/api/etruscantombs/image/?tomb=17&depth=3&limit=500',
    texturedmesh: 'https://diana.dh.gu.se/api/etruscantombs/objecttexturedmesh/?id=17&depth=2',
    panorama: 'https://diana.dh.gu.se/api/etruscantombs/panorama/?id=2'
  }
};
