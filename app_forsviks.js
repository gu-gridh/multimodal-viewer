const express = require('express');
const path = require('path');
const { renderModule } = require('./scripts/render-module');
const axios = require('axios');
require('dotenv').config({ path: './.env.local' });
const { temporarySources: sources } = require('./viewer/projects/forsviks/config');
const app = express();
app.use(require('./viewer-query'));

app.get('/viewer/modules/pointcloud/pointcloud.html', async (req, res, next) => {
  try {
    const { data } = await axios.get(sources.pointcloudPanel);
    const panel = data.features?.[0]?.properties;
    await renderModule(res, 'pointcloud', {
      pointCloudUrl: sources.pointcloud,
      cameraPosition: panel?.spatial_position || [],
      lookAt: panel?.spatial_direction || [],
      annotationsUrl: ''
    });
  } catch (error) { next(error); }
});

app.get('/viewer/modules/texturedmesh/texturedmesh.html', async (req, res, next) => {
  try {
    const { data } = await axios.get(sources.texturedmesh);
    const mesh = data.results?.[0];
    if (!mesh?.url_public) return res.status(404).send('No model found');
    await renderModule(res, 'texturedmesh', {
      texturedMeshUrl: mesh.url_public,
      title: mesh.title || 'Mesh',
      downloadUrl: mesh.url_download || '',
      cameraPosition: mesh.camera_position || null,
      lookAt: mesh.look_at || null
    });
  } catch (error) { next(error); }
});

app.get('/viewer/modules/panorama/panorama.html', async (req, res, next) => {
  try {
    const { data } = await axios.get(sources.panorama);
    const panoramas = (data.results || []).filter(item => item.url_public).map(item => ({
      id: String(item.id),
      title: item.title || 'Panorama',
      urlPublic: item.url_public,
      downloadUrl: item.url_download || '',
      startPos: item.start_position || [0, 0, 100],
      northOffset: item.north_offset == null ? null : Number(item.north_offset)
    }));
    if (!panoramas.length) return res.status(404).send('No panorama found');
    await renderModule(res, 'panorama', {
      panoramas,
      initialScene: panoramas.find(item => item.id === req.query.id)?.id || panoramas[0].id
    });
  } catch (error) { next(error); }
});

app.get(['/', '/viewer', '/viewer/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'viewer/projects/forsviks/index.html'));
});
app.use('/viewer', express.static(path.join(__dirname, 'viewer')));
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).send('Unable to load viewer data');
});

const PORT = process.env.PORT || 8100;
app.listen(PORT, () => console.log(`Forsviks is running on port ${PORT}`));
