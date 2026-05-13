const express = require('express');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const dotenv = require('dotenv');
const app = express();
const projectName = process.env.PROJECT || 'default';

dotenv.config({ path: './.env.local' });

const configPath = path.join(__dirname, 'viewer', 'projects', projectName, 'config.json');
let config;
try {
  config = require(configPath);
} catch (error) {
  console.error(`failed to load config for project ${projectName}:`, error);
  process.exit(1);
}

app.get('/viewer/modules/iiif/iiif.html', async (req, res) => {
  const fullQuery = req.query.q;
  const queryName = fullQuery ? fullQuery.split('/')[0] : '';
  const queryType = fullQuery ? fullQuery.split('/')[1] : '';

  if (!queryName || !queryType) {
    return res.status(400).send('Query parameter is missing or incorrect');
  }

  try {
    const encodedQueryName = encodeURIComponent(queryName);
    const { data } = await axios.get(`https://munch.dh.gu.se/api/painting-images/?panel=${encodedQueryName}`);
    const images = data.results;

    if (!images || images.length === 0) {
      return res.status(404).send('No data available.');
    }

    const htmlContent = fs.readFileSync(
      path.join(__dirname, 'viewer', 'modules', 'iiif', 'iiif.html'),
      'utf8'
    );
    const annotationPath = config.annotationPath ? `${config.annotationPath}${queryName}` : '';

    if (queryType === 'iiif' || queryType === 'photo') {
      const photo = images.find(image => image.image_type === 'orthophoto');

      if (!photo?.file) {
        return res.status(404).send('No attached photograph found.');
      }

      const tileSource = { type: 'image', url: photo.file };

      const updatedHtmlContent = htmlContent
        .replace(/'PLACEHOLDER_IIIF_IMAGE_URL'/g, JSON.stringify(tileSource))
        .replace(/'PLACEHOLDER_DOWNLOAD_PATH'/g, JSON.stringify([]))
        .replace(/'PLACEHOLDER_ANNOTATION_PATH'/g, JSON.stringify(annotationPath))
        .replace(/'PLACEHOLDER_INSCRIPTION_URL'/g, JSON.stringify(config.inscriptionUrl || ''))
        .replace(/'PLACEHOLDER_IIIF_ANNOTATIONS'/g, config.displayIIIFAnnotations)
        .replace(/'PLACEHOLDER_DISPLAY_IIIF_ANNOTATIONS'/g, config.displayIIIFAnnotations ? 'flex' : 'none')
        .replace(/'PLACEHOLDER_DISPLAY_POLYGON_TOOL'/g, config.displayPolygonTool ? 'flex' : 'none')
        .replace(/'PLACEHOLDER_SEQUENCE_SHOW'/g, 'none')
        .replace(/'PLACEHOLDER_SEQUENCE_ENABLE'/g, false)
        .replace('PLACEHOLDER_PROJECT', JSON.stringify(config.project));

      return res.send(updatedHtmlContent);
    }

    if (queryType === 'topography') {
      const sortedTopography = images
        .filter(image => image.image_type === 'topographical')
        .sort((a, b) => a.sort_order - b.sort_order);

      if (!sortedTopography.length) {
        return res.status(404).send('No attached topography images found.');
      }

      const topographyTileSources = sortedTopography.map(topography => ({ type: 'image', url: topography.file }));

      const updatedHtmlContent = htmlContent
        .replace(/'PLACEHOLDER_IIIF_IMAGE_URL'/g, JSON.stringify(topographyTileSources))
        .replace(/'PLACEHOLDER_DOWNLOAD_PATH'/g, JSON.stringify([]))
        .replace(/'PLACEHOLDER_ANNOTATION_PATH'/g, JSON.stringify(annotationPath))
        .replace(/'PLACEHOLDER_INSCRIPTION_URL'/g, JSON.stringify(config.inscriptionUrl || ''))
        .replace(/'PLACEHOLDER_IIIF_ANNOTATIONS'/g, config.displayIIIFAnnotations)
        .replace(/'PLACEHOLDER_DISPLAY_IIIF_ANNOTATIONS'/g, config.displayIIIFAnnotations ? 'flex' : 'none')
        .replace(/'PLACEHOLDER_DISPLAY_POLYGON_TOOL'/g, config.displayPolygonTool ? 'flex' : 'none')
        .replace(/'PLACEHOLDER_SEQUENCE_SHOW'/g, topographyTileSources.length > 1 ? 'flex' : 'none')
        .replace(/'PLACEHOLDER_SEQUENCE_ENABLE'/g, topographyTileSources.length > 1)
        .replace('PLACEHOLDER_PROJECT', JSON.stringify(config.project));

      return res.send(updatedHtmlContent);
    }

    return res.status(400).send('Invalid type specified in query');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/viewer/modules/mesh/mesh.html', async (req, res) => {
  const fullQuery = req.query.q;
  const queryName = fullQuery ? fullQuery.split('/')[0] : '';

  if (!queryName) {
    return res.status(400).send('Query parameter is missing');
  }

  try {
    const encodedQueryName = encodeURIComponent(queryName);
    const { data } = await axios.get(`https://munch.dh.gu.se/api/meshes/?panel=${encodedQueryName}`);
    const mesh = (data.results || []).find(item => item.published !== false) || {};

    if (!mesh.mesh_file) {
      return res.status(404).send('No mesh found');
    }

    const parseStartValue = (value, fallback = 0.0) => {
      const numericValue = Number(value);
      return Number.isFinite(numericValue) ? numericValue : fallback;
    };

    const hasApiStartPosition = [
      mesh.start_position_phi,
      mesh.start_position_theta,
      mesh.start_position_panX,
      mesh.start_position_panY,
      mesh.start_position_panZ,
      mesh.start_position_zoom,
      mesh.start_position_rotation
    ].some(value => {
      const numericValue = Number(value);
      return Number.isFinite(numericValue) && numericValue !== 0.0;
    });

    const baseModelPhi = hasApiStartPosition ? parseStartValue(mesh.start_position_phi) : 0.0;
    const baseModelTheta = hasApiStartPosition ? parseStartValue(mesh.start_position_theta) : 0.0;
    const cameraStartPan = hasApiStartPosition
      ? [
        parseStartValue(mesh.start_position_panX),
        parseStartValue(mesh.start_position_panY),
        parseStartValue(mesh.start_position_panZ)
      ]
      : [0.0, 0.0, 0.0];
    const cameraStartDistance = hasApiStartPosition ? parseStartValue(mesh.start_position_zoom, 1.5) : 1.5;
    const baseModelRotation = hasApiStartPosition ? parseStartValue(mesh.start_position_rotation) : 0.0;
    const cameraStartState = [0.0, 0.0, cameraStartPan[0], cameraStartPan[1], cameraStartPan[2], cameraStartDistance];

    fs.readFile(path.join(__dirname, 'viewer', 'modules', 'mesh', 'mesh.html'), 'utf8', (err, html) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Internal Server Error');
      }

      let modified = html
        .replace(/PLACEHOLDER_MESH/g, JSON.stringify(mesh.mesh_file))
        .replace(/PLACEHOLDER_SECOND_MESH/g, JSON.stringify(''))
        .replace(/PLACEHOLDER_BASEMODELPHI/g, JSON.stringify(baseModelPhi))
        .replace(/PLACEHOLDER_BASEMODELTHETA/g, JSON.stringify(baseModelTheta))
        .replace(/PLACEHOLDER_CAMERASTARTDISTANCE/g, JSON.stringify(cameraStartDistance))
        .replace(/PLACEHOLDER_CAMERASTARTPAN/g, JSON.stringify(cameraStartPan))
        .replace(/PLACEHOLDER_MINMAXPHI/g, JSON.stringify([-180.0, 180.0]))
        .replace(/PLACEHOLDER_MINMAXTHETA/g, JSON.stringify([-180.0, 180.0]))
        .replace(/PLACEHOLDER_CAMERASTARTSTATE/g, JSON.stringify(cameraStartState))
        .replace(/PLACEHOLDER_BASEMODELROTATION/g, JSON.stringify(baseModelRotation));

      const isDownloadable = Boolean(mesh.mesh_file);
      const $ = cheerio.load(modified);
      if (isDownloadable) {
        $('#download').attr('href', mesh.mesh_file);
        $('#download .download-button').removeClass('deactivated');
      } else {
        $('#download').removeAttr('href');
        $('#download .download-button').addClass('deactivated');
      }

      res.send($.html());
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/viewer/projects/:projectName/metadata/metadata.html', async (req, res) => {
  const { projectName } = req.params;
  const fullQuery = req.query.q;
  const queryName = fullQuery ? fullQuery.split('/')[0] : '';

  if (!queryName) {
    return res.status(400).send('Query parameter is missing');
  }

  const encodedQueryName = encodeURIComponent(queryName);
  const metadataPath = path.join(__dirname, 'viewer', 'projects', projectName, 'metadata', 'metadata.html');

  try {
    const [htmlData, panel, categories, tags, years] = await Promise.all([
      fs.promises.readFile(metadataPath, 'utf8'),
      axios.get(`https://munch.dh.gu.se/api/panel/?title=${encodedQueryName}&depth=2`),
      axios.get(`https://munch.dh.gu.se/api/annotation-categories/?panel=${encodedQueryName}`),
      axios.get(`https://munch.dh.gu.se/api/tags/?panel=${encodedQueryName}`),
      axios.get(`https://munch.dh.gu.se/api/years/?panel=${encodedQueryName}`)
    ]);
    const painting = panel.data.results[0] || {};
    const formatDimensions = (width, height) => {
      if (!width || !height) {
        return '';
      }

      return `${Number(width)} cm x ${Number(height)} cm`;
    };
    const artist = painting.artist?.name || '';
    const dimensions = formatDimensions(painting.width, painting.height);
    const techniques = (painting.techniques || []).map(technique => technique.name).join(', ');
    const materials = (painting.materials || []).map(material => material.name).join(', ');
    const yearFilters = years.data.results
      .map(year => `<button class="filter-button" type="button" data-filter-value="${year.id}">${year.year}</button>`)
      .join('');
    const categoryFilters = categories.data.results
      .map(category => `<button class="filter-button" type="button" data-filter-value="${category.id}"><span class="filter-swatch" style="background-color: ${category.color};"></span>${category.name}</button>`)
      .join('');
    const tagFilters = tags.data.results
      .map(tag => `<button class="filter-button" type="button" data-filter-value="${tag.id}">${tag.text}</button>`)
      .join('');
    const modifiedHtml = htmlData
      .replace('PLACEHOLDER_TITLE', painting.title || '')
      .replace('PLACEHOLDER_ARTIST', artist)
      .replace('PLACEHOLDER_YEAR', painting.creation_year || '')
      .replace('PLACEHOLDER_DIMENSIONS', dimensions)
      .replace('PLACEHOLDER_TECHNIQUE', techniques)
      .replace('PLACEHOLDER_SUPPORT', materials)
      .replace('PLACEHOLDER_DESCRIPTION', painting.description || '')
      .replace('PLACEHOLDER_YEAR_FILTERS', yearFilters)
      .replace('PLACEHOLDER_CATEGORY_FILTERS', categoryFilters)
      .replace('PLACEHOLDER_TAG_FILTERS', tagFilters);

    res.send(modifiedHtml);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

app.use('/viewer/modules/mesh', express.static(path.join(__dirname, 'viewer', 'modules', 'mesh')));
app.use('/viewer/modules/pointcloud', express.static(path.join(__dirname, 'viewer', 'modules', 'pointcloud')));
app.use('/viewer/modules/iiif', express.static(path.join(__dirname, 'viewer', 'modules', 'iiif')));
app.use('/viewer/shared', express.static(path.join(__dirname, 'viewer', 'shared')));
app.use('/viewer/projects', express.static(path.join(__dirname, 'viewer', 'projects')));
app.use('/viewer/locales', express.static(path.join(__dirname, 'viewer', 'locales')));
app.use('/viewer/libs', express.static(path.join(__dirname, 'viewer', 'libs')));

app.get('*', (req, res) => {
  const queryName = req.query.q;

  if (!queryName) {
    return res.sendFile(path.join(__dirname, 'index.html'));
  }

  const projectPath = path.join(__dirname, 'viewer', 'projects', projectName);
  const indexPath = path.join(projectPath, 'index.html');
  const envPath = path.join(projectPath, '.env');

  let matomoUrl = '';
  let matomoId = '';
  if (fs.existsSync(envPath)) {
    const projectEnv = dotenv.parse(fs.readFileSync(envPath));
    matomoUrl = projectEnv.MATOMO_URL || '';
    matomoId = projectEnv.MATOMO_ID || '';
  }

  fs.readFile(indexPath, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Internal Server Error');
    }

    const modifiedData = data
      .replace(/PLACEHOLDER_QUERY/g, queryName)
      .replace(/MATOMO_URL_PLACEHOLDER/g, matomoUrl)
      .replace(/MATOMO_ID_PLACEHOLDER/g, matomoId);

    res.send(modifiedData);
  });
});

const PORT = 8098;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
