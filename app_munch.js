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
    const { data } = await axios.get(`${config.panel}${queryName}`);
    const modelData = data.features;

    if (!modelData || modelData.length === 0) {
      return res.status(404).send('No data available.');
    }

    const htmlContent = fs.readFileSync(
      path.join(__dirname, 'viewer', 'modules', 'iiif', 'iiif.html'),
      'utf8'
    );
    const annotationPath = config.annotationPath ? `${config.annotationPath}${queryName}` : '';
    const basePathIiif = `${config.basePath}`;
    const basePathDownload = `${config.downloadPath}`;

    if (queryType === 'iiif' || queryType === 'photo') {
      const photo = modelData?.[0]?.properties?.attached_photograph?.[0];

      if (!photo?.iiif_file) {
        return res.status(404).send('No attached photograph found.');
      }

      const iiifUrl = `"${basePathIiif}${photo.iiif_file}/info.json"`;
      const downloadUrl = `"${basePathDownload}${photo.file || ''}"`;

      const updatedHtmlContent = htmlContent
        .replace(/'PLACEHOLDER_IIIF_IMAGE_URL'/g, iiifUrl)
        .replace(/'PLACEHOLDER_DOWNLOAD_PATH'/g, JSON.stringify(downloadUrl))
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
      const sortedTopography = (modelData?.[0]?.properties?.attached_topography || []).sort((a, b) => {
        const order = ['blended', 'texture', 'normal'];
        const getOrder = (file) => order.findIndex(keyword => file.includes(keyword));
        return getOrder(a.file) - getOrder(b.file);
      });

      if (!sortedTopography.length) {
        return res.status(404).send('No attached topography images found.');
      }

      const topographyImagesIiif = sortedTopography.map(topography => `${basePathIiif}${topography.iiif_file}/info.json`);
      const topographyImagesJpg = sortedTopography.map(topography => `${basePathDownload}${topography.file}`);

      const updatedHtmlContent = htmlContent
        .replace(/'PLACEHOLDER_IIIF_IMAGE_URL'/g, JSON.stringify(topographyImagesIiif))
        .replace(/'PLACEHOLDER_DOWNLOAD_PATH'/g, JSON.stringify(topographyImagesJpg))
        .replace(/'PLACEHOLDER_ANNOTATION_PATH'/g, JSON.stringify(annotationPath))
        .replace(/'PLACEHOLDER_INSCRIPTION_URL'/g, JSON.stringify(config.inscriptionUrl || ''))
        .replace(/'PLACEHOLDER_IIIF_ANNOTATIONS'/g, config.displayIIIFAnnotations)
        .replace(/'PLACEHOLDER_DISPLAY_IIIF_ANNOTATIONS'/g, config.displayIIIFAnnotations ? 'flex' : 'none')
        .replace(/'PLACEHOLDER_DISPLAY_POLYGON_TOOL'/g, config.displayPolygonTool ? 'flex' : 'none')
        .replace(/'PLACEHOLDER_SEQUENCE_SHOW'/g, 'flex')
        .replace(/'PLACEHOLDER_SEQUENCE_ENABLE'/g, true)
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
    const { data } = await axios.get(`${config.panel}${queryName}`);
    const mesh = data.features?.[0]?.properties?.attached_3Dmesh?.[0] || {};

    if (!mesh.url) {
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
        .replace(/PLACEHOLDER_MESH/g, JSON.stringify(mesh.url))
        .replace(/PLACEHOLDER_SECOND_MESH/g, JSON.stringify(''))
        .replace(/PLACEHOLDER_BASEMODELPHI/g, JSON.stringify(baseModelPhi))
        .replace(/PLACEHOLDER_BASEMODELTHETA/g, JSON.stringify(baseModelTheta))
        .replace(/PLACEHOLDER_CAMERASTARTDISTANCE/g, JSON.stringify(cameraStartDistance))
        .replace(/PLACEHOLDER_CAMERASTARTPAN/g, JSON.stringify(cameraStartPan))
        .replace(/PLACEHOLDER_MINMAXPHI/g, JSON.stringify([-180.0, 180.0]))
        .replace(/PLACEHOLDER_MINMAXTHETA/g, JSON.stringify([-180.0, 180.0]))
        .replace(/PLACEHOLDER_CAMERASTARTSTATE/g, JSON.stringify(cameraStartState))
        .replace(/PLACEHOLDER_BASEMODELROTATION/g, JSON.stringify(baseModelRotation));

      const isDownloadable = mesh.is_downloadable && mesh.url_for_download;
      const $ = cheerio.load(modified);
      if (isDownloadable) {
        $('#download').attr('href', mesh.url_for_download);
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

  const metadataPath = path.join(__dirname, 'viewer', 'projects', projectName, 'metadata', 'metadata.html');

  try {
    const [apiResponse, htmlData] = await Promise.all([
      axios.get(`${config.metadata}${queryName}&depth=1`),
      fs.promises.readFile(metadataPath, 'utf8')
    ]);

    const metadata = apiResponse.data?.results?.[0];
    if (!metadata) {
      return res.status(404).send('No metadata found');
    }

    const $ = cheerio.load(htmlData);
    const documentation = Array.isArray(metadata.documentation) && metadata.documentation.length > 0
      ? metadata.documentation.map(item => item?.observation).filter(Boolean).join(', ')
      : 'Unknown';

    $('#panel-title').text(metadata.title || queryName);
    res.send($.html());
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
