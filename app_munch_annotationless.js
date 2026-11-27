const express = require('express');
const axios = require('axios');
const { load } = require('cheerio');
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { enableCoordinateTool } = require('./viewer/projects/munch/config');
const { renderModule } = require('./scripts/render-module');
const { imageDownloadData } = require('./scripts/image-download-config');
const { registerIIIFDownload } = require('./scripts/iiif-download');

const app = express();
const projectPath = path.join(__dirname, 'viewer', 'projects', 'munch');
const api = 'https://munch.dh.gu.se/api/';
const imageApi = api + 'painting-images/';
const photoTiles = 'https://data.dh.gu.se/munch/static/munch/iiif/SolenMedium-v3.dzi';

app.use(require('./viewer-query'));
registerIIIFDownload(app, 'munch');

function route(url, handler) {
  app.get(url, (req, res, next) => handler(req, res).catch(next));
}

async function readTemplate(file) {
  const $ = load(await fs.promises.readFile(path.join(projectPath, file), 'utf8'));
  $('[data-annotation-only]').remove();
  return $.html();
}

async function results(url) {
  const { data } = await axios.get(url);
  return data.results || [];
}

async function getPainting(title) {
  const [painting] = await results(`${api}panel/?title=${encodeURIComponent(title)}&depth=2`);
  return painting || {};
}

route('/viewer/modules/iiif/iiif.html', async (req, res) => {
  const [title, type] = (req.query.q || '').split('/');
  const isPhoto = type === 'photo' || type === 'iiif';
  if (!title || !type) return res.status(400).send('Query parameter is missing or incorrect');
  if (!isPhoto && type !== 'topography') return res.status(400).send('Invalid type specified in query');

  const [painting, images] = await Promise.all([
    getPainting(title).catch(() => ({})),
    results(`${imageApi}?panel=${encodeURIComponent(title)}`).catch(error => {
      if (!isPhoto) throw error;
      console.error('Could not load photo download metadata:', error.message);
      return [];
    })
  ]);
  const selected = isPhoto
    ? [images.find(image => image.image_type === 'orthophoto' && /\/[^/]*Medium[^/]*$/i.test(image.file))]
    : images.filter(image => image.image_type === 'topographical').sort((a, b) => a.sort_order - b.sort_order);
  if (!selected.length) return res.status(404).send('No attached topography images found.');

  const coordinateWidth = Number(painting.width) || 0;
  const coordinateHeight = Number(painting.height) || 0;
  await renderModule(res, 'iiif', {
    tileSources: isPhoto ? photoTiles : selected.map(image => `${image.iiif_file}/info.json`),
    sequenceEnabled: selected.length > 1,
    disableAnnotations: true,
    downloads: imageDownloadData(imageApi, selected),
    coordinateWidth,
    coordinateHeight,
    coordinateUnit: 'cm',
    coordinateToolEnabled: Boolean(enableCoordinateTool && coordinateWidth && coordinateHeight)
  });
});

route('/viewer/modules/mesh/mesh.html', async (req, res) => {
  const [title] = (req.query.q || '').split('/');
  if (!title) return res.status(400).send('Query parameter is missing');

  const meshes = await results(`${api}meshes/?panel=${encodeURIComponent(title)}`);
  const mesh = meshes.find(item => item.published !== false);
  if (!mesh?.mesh_url) return res.status(404).send('No mesh found');

  const numberOr = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };
  const cameraStartPan = [mesh.start_position_panX, mesh.start_position_panY, mesh.start_position_panZ]
    .map(value => numberOr(value));
  const baseModelPhi = numberOr(mesh.start_position_phi);
  const baseModelTheta = numberOr(mesh.start_position_theta);
  const baseModelRotation = numberOr(mesh.start_position_rotation);
  const hasStartPosition = [
    ...cameraStartPan, baseModelPhi, baseModelTheta, baseModelRotation, numberOr(mesh.start_position_zoom)
  ].some(value => value !== 0);
  const cameraStartDistance = hasStartPosition ? numberOr(mesh.start_position_zoom, 1.5) : 1.5;

  await renderModule(res, 'mesh', {
    meshUrl: mesh.mesh_url,
    baseModelPhi,
    baseModelTheta,
    baseModelRotation,
    cameraStartPan,
    cameraStartDistance,
    cameraStartState: [0, 0, ...cameraStartPan, cameraStartDistance],
    downloadUrl: mesh.mesh_url
  });
});

route('/viewer/projects/munch/documents', async (req, res) => {
  if (!req.query.q) return res.status(400).json({ error: 'query parameter missing' });
  res.json(await results(`${api}documents/?panel=${encodeURIComponent(req.query.q)}`));
});

route('/viewer/projects/munch/metadata/metadata.html', async (req, res) => {
  const [title] = (req.query.q || '').split('/');
  if (!title) return res.status(400).send('Query parameter is missing');

  const [html, painting] = await Promise.all([readTemplate('metadata/metadata.html'), getPainting(title)]);
  const { width, height } = painting;
  const fields = {
    TITLE: painting.title,
    ARTIST: painting.artist?.name,
    YEAR: painting.creation_year,
    DIMENSIONS: width && height ? `${Number(width)} cm x ${Number(height)} cm` : '',
    TECHNIQUE: (painting.techniques || []).map(item => item.name).join(', '),
    SUPPORT: (painting.materials || []).map(item => item.name).join(', '),
    DESCRIPTION: painting.description
  };
  res.send(html.replace(/PLACEHOLDER_([A-Z_]+)/g, (_, field) => fields[field] ?? ''));
});

route('/viewer/projects/munch/footer.html', async (req, res) => {
  res.send(await readTemplate('footer.html'));
});

route(['/', '/viewer/'], async (req, res) => {
  if (!req.query.q) return res.redirect('/viewer/?q=solen/photo');

  const envPath = path.join(projectPath, '.env');
  const analytics = fs.existsSync(envPath) ? dotenv.parse(await fs.promises.readFile(envPath)) : {};
  const html = await readTemplate('index.html');
  res.send(html
    .replace(/MATOMO_URL_PLACEHOLDER/g, () => analytics.MATOMO_URL || '')
    .replace(/MATOMO_ID_PLACEHOLDER/g, () => analytics.MATOMO_ID || ''));
});

for (const directory of ['modules/mesh', 'modules/pointcloud', 'modules/iiif', 'shared', 'locales', 'libs', 'projects/munch/metadata']) {
  app.use(`/viewer/${directory}`, express.static(path.join(__dirname, 'viewer', directory)));
}

const port = 8101;
app.listen(port, () => console.log(`Munch without annotations is running on port ${port}`));
