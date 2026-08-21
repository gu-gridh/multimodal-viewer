const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config({ path: './.env.local' });
const app = express();
const projectName = process.env.PROJECT || 'default';
const contentApiBaseUrl = 'https://diana.dh.gu.se/api/etruscantombs/objectpointcloud/?id=';
const backButtonBaseUrl = 'https://etruscan.dh.gu.se/';

/* To test: http://localhost:8094/viewer/?q=2683/image or http://localhost:8094/viewer/?q=1/pointcloud or http://localhost:8094/viewer/?q=1/texturedmesh */

function formatPeople(people) {
  const peopleList = Array.isArray(people) ? people : [people];
  return peopleList
    .filter(Boolean)
    .map(person => `${person.firstname ?? ''} ${person.lastname ?? ''}`.trim())
    .filter(Boolean)
    .join(', ');
}

const configPath = path.join(__dirname, 'viewer', 'projects', projectName, 'config.js');
let config;
try {
  config = require(configPath);
} catch (error) {
  console.error(`Failed to load config for project ${projectName}:`, error);
  process.exit(1);
}

app.get('/viewer/modules/pointcloud/pointcloud.html', async (req, res) => {
  const fullQuery = req.query.q;
  const queryName = fullQuery ? fullQuery.split('/')[0] : '';
  const apiUrl = `${contentApiBaseUrl}${queryName}`;
  try {
    const apiResponse = await axios.get(apiUrl);
    const result = apiResponse.data.results?.[0];
    const position = result?.camera_position;
    const direction = result?.look_at;
    const url = result?.url_public;

    fs.readFile(path.join(__dirname, 'viewer', 'modules', 'pointcloud', 'pointcloud.html'), 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading the file:', err);
        return res.status(500).send('Internal Server Error');
      }
      let modifiedData = data;
      const positionStr = Array.isArray(position) ? position.join(',') : '';
      const directionStr = Array.isArray(direction) ? direction.join(',') : '';

      modifiedData = modifiedData.replace(/PLACEHOLDER_URL_PUBLIC/g, `${url}`);
      modifiedData = modifiedData.replace(/'PLACEHOLDER_POSITION'/g, `[${positionStr}]`);
      modifiedData = modifiedData.replace(/'PLACEHOLDER_DIRECTION'/g, `[${directionStr}]`);
      modifiedData = modifiedData.replace(/'PLACEHOLDER_DISPLAY_ANNOTATIONS'/g, Boolean(config.enablePointCloudAnnotations));
      modifiedData = modifiedData.replace(/'PLACEHOLDER_POINTCLOUD_ANNOTATIONS'/g, `'${config.pointCloudAnnotationsUrl || ''}'`);
      res.send(modifiedData);
    });
  } catch (error) {
    console.error('Error fetching data from API:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/viewer/modules/texturedmesh/texturedmesh.html', async (req, res) => {
  const fullQuery = req.query.q;
  const queryName = fullQuery ? fullQuery.split('/')[0] : '';

  if (!queryName) {
    return res.status(400).send('Query parameter is missing');
  }

  const apiUrl = `https://diana.dh.gu.se/api/etruscantombs/objecttexturedmesh/?id=${queryName}&depth=2`;

  try {
    const apiResponse = await axios.get(apiUrl);
    const texturedMeshData = apiResponse.data.results?.[0];

    if (!texturedMeshData?.url_public) {
      return res.status(404).send('No textured mesh');
    }

    fs.readFile(path.join(__dirname, 'viewer', 'modules', 'texturedmesh', 'texturedmesh.html'), 'utf8', (err, data) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Internal Server Error');
      }

      const texturedMeshTitle = texturedMeshData.title || texturedMeshData.tomb?.[0]?.name || 'Textured mesh';
      const modifiedData = data
        .replace(/'PLACEHOLDER_TEXTUREDMESH_URL'/g, JSON.stringify(texturedMeshData.url_public))
        .replace(/'PLACEHOLDER_TEXTUREDMESH_TITLE'/g, JSON.stringify(texturedMeshTitle))
        .replace(/'PLACEHOLDER_TEXTUREDMESH_DOWNLOAD_URL'/g, JSON.stringify(texturedMeshData.url_download || ''))
        .replace(/'PLACEHOLDER_CAMERA_POSITION'/g, JSON.stringify(texturedMeshData.camera_position || null))
        .replace(/'PLACEHOLDER_LOOK_AT'/g, JSON.stringify(texturedMeshData.look_at || null));

      res.send(modifiedData);
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/viewer/projects/:projectName/metadata/metadata.html', async (req, res) => {
  const { projectName } = req.params;
  const fullQuery = req.query.q;
  const querySegments = fullQuery ? fullQuery.split('/') : [];

  if (querySegments.length < 2) {
    return res.status(400).send('Query parameter is missing or incomplete');
  }

  const queryName = querySegments[0];
  const viewerType = querySegments[1];

  let apiUrl;

  if (viewerType === 'pointcloud' || viewerType === 'panorama') {
    apiUrl = `${contentApiBaseUrl}${queryName}&depth=2`;
  } else if (viewerType === 'texturedmesh') {
    apiUrl = `https://diana.dh.gu.se/api/etruscantombs/objecttexturedmesh/?id=${queryName}&depth=2`;
  } else if (viewerType === 'image') {
    apiUrl = `https://diana.dh.gu.se/api/etruscantombs/image/${queryName}/?depth=2`;
  } else {
    return res.status(400).send('Invalid viewer type');
  }

  try {
    const apiResponse = await axios.get(apiUrl);

    if (!apiResponse || !apiResponse.data) {
      return res.status(404).send('Data not found');
    }

    let metadata;

    if (viewerType === 'pointcloud' || viewerType === 'texturedmesh' || viewerType === 'panorama') {
      metadata = apiResponse.data.results?.[0];
    } else if (viewerType === 'image') {
      metadata = apiResponse.data;
    }

    if (!metadata) {
      return res.status(404).send('Data not found or malformed');
    }

    const metadataPath = path.join(__dirname, 'viewer', 'projects', projectName, 'metadata', 'metadata.html');

    fs.readFile(metadataPath, 'utf8', (err, htmlData) => {
      if (err) {
        console.error('Error reading the file:', err);
        return res.status(500).send('Internal Server Error');
      }

      let modifiedHtml;

      if (viewerType === 'pointcloud' || viewerType === 'texturedmesh' || viewerType === 'panorama') {
        modifiedHtml = htmlData.replace(/PLACEHOLDER_TITLE/g,
          metadata.tomb?.[0]?.dataset?.short_name && metadata.tomb?.[0]?.name
            ? `${metadata.tomb?.[0]?.dataset?.short_name ?? ''} - ${metadata.tomb?.[0]?.name ?? ''}`
            : 'Unknown')
          .replace(/PLACEHOLDER_DESCRIPTION/g, metadata.description ?? 'Unknown')
          .replace(/PLACEHOLDER_TOMB_DESCRIPTION/g, metadata.tomb?.[0]?.description ?? metadata.preview_image?.tomb?.description ?? '')
          .replace(/PLACEHOLDER_DATASET/g, metadata.tomb?.[0]?.dataset?.short_name ?? '')

        if (viewerType === 'pointcloud' || viewerType === 'panorama') {
          modifiedHtml = modifiedHtml
            .replace(/PLACEHOLDER_POINTS_OPTIMIZED/g, metadata.points_optimized ?? 'Unknown')
            .replace(/PLACEHOLDER_POINTS_FULL/g, metadata.points_full_resolution ?? 'Unknown')
            .replace(/PLACEHOLDER_CREATOR/g, formatPeople(metadata.author) || 'Unknown')
            .replace(/PLACEHOLDER_TECHNIQUE/g, metadata.technique?.text ?? 'Unknown')
            .replace(/PLACEHOLDER_DATE/g, metadata.date ?? 'Unknown Date');
        } else if (viewerType === 'texturedmesh') {
          modifiedHtml = modifiedHtml
            .replace(/PLACEHOLDER_TECHNIQUE/g, metadata.technique?.text ?? 'Unknown')
            .replace(/PLACEHOLDER_POLYGONS/g, metadata.polygons ?? 'Unknown')
            .replace(/PLACEHOLDER_DATE/g, metadata.date ?? 'Unknown Date')
            .replace(/PLACEHOLDER_CREATOR/g, formatPeople(metadata.author) || 'Unknown');
        }
      } else if (viewerType === 'image') {
        modifiedHtml = htmlData.replace(/PLACEHOLDER_TITLE/g,
          metadata.tomb?.dataset?.short_name && metadata.tomb?.name
            ? `${metadata.tomb?.dataset?.short_name ?? ''} ${metadata.tomb?.name ?? ''}`
            : 'Unknown')
          .replace(/PLACEHOLDER_TOMB_DESCRIPTION/g, metadata.tomb?.description ?? '')
          .replace(/PLACEHOLDER_TYPE/g, metadata.type_of_image?.[0]?.text ?? 'Unknown type')
          .replace(/PLACEHOLDER_CREATOR/g, formatPeople(metadata.author) || 'Unknown')
          .replace(/PLACEHOLDER_DATE/g, metadata.date ?? 'Unknown Date')
          .replace(/PLACEHOLDER_IMAGE_URL/g, metadata.iiif_file ?? '')
          .replace(/PLACEHOLDER_DOWNLOAD_URL/g, metadata.file ?? '')
          .replace(/PLACEHOLDER_DATASET/g, metadata.tomb?.dataset?.short_name ?? '');
      }

      //remove blocks with empty placeholders
      modifiedHtml = modifiedHtml.replace(/PLACEHOLDER_SOURCE_DOWNLOAD/g, metadata.url_source ? `href="${metadata.url_source}" target="_self"` : 'hidden')
        .replace(/<div[^>]*>\s*<div[^>]*>[^<]+:<\/div>\s*<\/div>/g, '')
        .replace(/<div[^>]*>\s*<div[^>]*>Type:<\/div>\s*<span[^>]*>PLACEHOLDER_TYPE<\/span>\s*<\/div>/g, '')
        .replace(/<div[^>]*class=["']metadata-description["'][^>]*>\s*<div[^>]*class=["']label["'][^>]*>Description<\/div>\s*<div>\s*<p>\s*<\/p>\s*<\/div>\s*<\/div>/g, '')
        .replace(/<div[^>]*>\s*<div[^>]*>Date:<\/div>\s*<span[^>]*>PLACEHOLDER_DATE<\/span>\s*<\/div>/g, '')
        .replace(/<div[^>]*>\s*<div[^>]*>Points \(optimized\):<\/div>\s*<span[^>]*>PLACEHOLDER_POINTS_OPTIMIZED<\/span>\s*<\/div>/g, '')
        .replace(/<div[^>]*>\s*<div[^>]*>Points:<\/div>\s*<span[^>]*>PLACEHOLDER_POINTS_FULL<\/span>\s*<\/div>/g, '')
        .replace(/<div[^>]*>\s*<div[^>]*>Technique:<\/div>\s*<span[^>]*>PLACEHOLDER_TECHNIQUE<\/span>\s*<\/div>/g, '')
        .replace(/<div[^>]*>\s*<div[^>]*>Polygons:<\/div>\s*<span[^>]*>PLACEHOLDER_POLYGONS<\/span>\s*<\/div>/g, '')
        .replace(/<p[^>]*>PLACEHOLDER_DESCRIPTION<\/p>/g, '');
      res.send(modifiedHtml);
    });
  } catch (error) {
    console.error('Error fetching data from API:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/viewer/modules/iiif/iiif.html', async (req, res) => {
  const fullQuery = req.query.q;
  const queryName = fullQuery ? fullQuery.split('/')[0] : '';

  if (!queryName) {
    return res.status(400).send('Query parameter is missing');
  }

  const apiUrl = `https://diana.dh.gu.se/api/etruscantombs/image/${queryName}/?depth=1`;

  try {
    const apiResponse = await axios.get(apiUrl);
    const imageData = apiResponse.data;
    if (imageData && imageData.iiif_file) {
      fs.readFile(path.join(__dirname, 'viewer', 'modules', 'iiif', 'iiif.html'), 'utf8', (err, data) => {
        if (err) {
          console.error('Error reading the file:', err);
          return res.status(500).send('Internal Server Error');
        }

        const iiifFilePath = imageData.iiif_file;
        const downloadFile = imageData.file;
        const fullPath = `"${iiifFilePath}/info.json"`;
        const downloadFilePath = `"${downloadFile}"`;

        let modifiedData = data.replace(/'PLACEHOLDER_IIIF_IMAGE_URL'/g, fullPath || '')
          .replace('PLACEHOLDER_PROJECT', JSON.stringify(config.projectName))
          .replace(/'PLACEHOLDER_FILE_NAME'/g, JSON.stringify(config.sharedImageFileName))
          .replace(/'PLACEHOLDER_DOWNLOAD_PATH'/g, JSON.stringify(downloadFilePath))
          .replace(/'PLACEHOLDER_INSCRIPTION_URL'/g, JSON.stringify(config.inscriptionAdminUrl || ''))
          .replace(/'PLACEHOLDER_IIIF_ANNOTATIONS'/g, Boolean(config.enableIIIFAnnotations))
          .replace(/'PLACEHOLDER_DISPLAY_IIIF_ANNOTATIONS'/g, config.enableIIIFAnnotations ? 'flex' : 'none')
          .replace(/'PLACEHOLDER_DISPLAY_RECTANGLE_TOOL'/g, config.enableRectangleTool ? 'flex' : 'none')
          .replace(/'PLACEHOLDER_DISPLAY_POLYGON_TOOL'/g, config.enablePolygonTool ? 'flex' : 'none')
          .replace(/'PLACEHOLDER_DISPLAY_LINE_TOOL'/g, config.enableLineTool ? 'flex' : 'none')
          .replace(/'PLACEHOLDER_DISPLAY_POINT_TOOL'/g, config.enablePointTool ? 'flex' : 'none')
          .replace(/'PLACEHOLDER_FILTERED_ANNOTATION_DOWNLOAD'/g, Boolean(config.enableFilteredAnnotationDownload))
          .replace(/'PLACEHOLDER_SEQUENCE_SHOW'/g, 'none')
          .replace(/'PLACEHOLDER_SEQUENCE_ENABLE'/g, false);
        res.send(modifiedData);
      });
    } else {
      res.status(404).send('No IIIF image found.');
    }
  } catch (error) {
    console.error('Error fetching data from API:', error);
    return res.status(500).send('Internal Server Error');
  }
});

app.get('/viewer/modules/panorama/panorama.html', (req, res) => {
  fs.readFile(path.join(__dirname, 'viewer', 'modules', 'panorama', 'panorama.html'), 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Internal Server Error');
    }

    const panoramaConfig = {
      hfov: 100,
      type: 'multires',
      multiRes: {
        basePath: '/viewer/projects/etruscan/panorama-289',
        path: '/%l/%s%y_%x',
        fallbackPath: '/fallback/%s',
        extension: 'jpg',
        tileResolution: 512,
        maxLevel: 5,
        cubeResolution: 6456
      }
    };
    res.send(data.replace(/'PLACEHOLDER_PANORAMA_CONFIG'/g, JSON.stringify(panoramaConfig)));
  });
});

app.use('/viewer/modules/pointcloud', express.static(path.join(__dirname, 'viewer', 'modules', 'pointcloud')));
app.use('/viewer/modules/texturedmesh', express.static(path.join(__dirname, 'viewer', 'modules', 'texturedmesh')));
app.use('/viewer/modules/iiif', express.static(path.join(__dirname, 'viewer', 'modules', 'iiif')));
app.use('/viewer/modules/panorama', express.static(path.join(__dirname, 'viewer', 'modules', 'panorama')));
app.use('/viewer/shared', express.static(path.join(__dirname, 'viewer', 'shared')));
app.use('/viewer/projects', express.static(path.join(__dirname, 'viewer', 'projects')));
app.use('/viewer/locales', express.static(path.join(__dirname, 'viewer', 'locales')));
app.use('/viewer/libs', express.static(path.join(__dirname, 'viewer', 'libs')));

// Fallback route, serve index.html
app.get('*', async (req, res) => {
  const queryName = req.query.q;
  const querySegments = queryName ? queryName.split('/') : [];

  if (!queryName || querySegments.length < 2) {
    const indexPath = path.join(__dirname, 'index.html');
    return res.sendFile(indexPath);
  }

  const queryId = querySegments[0];
  const viewerType = querySegments[1];
  let apiUrl;

  //fetch the backbutton data from the appropriate API
  if (viewerType === 'pointcloud' || viewerType === 'panorama') {
    apiUrl = `${contentApiBaseUrl}${queryId}&depth=2`;
  } else if (viewerType === 'texturedmesh') {
    apiUrl = `https://diana.dh.gu.se/api/etruscantombs/objecttexturedmesh/?id=${queryId}&depth=2`;
  } else if (viewerType === 'image') {
    apiUrl = `https://diana.dh.gu.se/api/etruscantombs/image/${queryId}/?depth=2`;
  } else {
    return res.status(400).send('Invalid viewer type');
  }

  try {
    const apiResponse = await axios.get(apiUrl);

    if (!apiResponse || !apiResponse.data) {
      return res.status(404).send('Data not found');
    }

    let metadata;
    let backButtonValue = '';

    if (viewerType === 'pointcloud' || viewerType === 'texturedmesh' || viewerType === 'panorama') {
      metadata = apiResponse.data?.results?.[0];
      if (metadata && metadata.tomb && metadata.tomb[0]) {
        const tomb = metadata.tomb[0];
        if (tomb.dataset && tomb.name) {
          const shortName = (tomb.dataset?.short_name ?? '').replace(/ /g, '_');
          const tombName = (tomb.name ?? '').replace(/ /g, '_');
          backButtonValue = `${shortName}_${tombName}`;
        }
      }
    } else if (viewerType === 'image') {
      const metadata = apiResponse.data;
      if (metadata && metadata.tomb) {
        const tombName = (metadata.tomb?.name ?? '').replace(/ /g, '_');
        const datasetShortName = (metadata.tomb.dataset?.short_name ?? '').replace(/ /g, '_');
        backButtonValue = `${datasetShortName}_${tombName}`;
      } else {
        backButtonValue = '';
      }
    }

    const backButtonUrl = `${backButtonBaseUrl}${backButtonValue}`;

    const indexPath = path.join(__dirname, 'viewer', 'projects', projectName, 'index.html');
    fs.readFile(indexPath, 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading the file:', err);
        return res.status(500).send('Internal Server Error');
      }

      let modifiedData = data
        .replace(/PLACEHOLDER_QUERY/g, queryName)
        .replace('PLACEHOLDER_BACKBUTTON', backButtonUrl);

      res.send(modifiedData);
    });
  } catch (error) {
    console.error('Error fetching data from API:', error);
    return res.status(500).send('Internal Server Error');
  }
});

const PORT = 8094;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
