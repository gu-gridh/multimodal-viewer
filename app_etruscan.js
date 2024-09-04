const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config({ path: './.env.local' });
const app = express();
const projectName = process.env.PROJECT || 'default';

/* To test: http://localhost:8098/viewer/?q=2683/orthophoto or http://localhost:8098/viewer/?q=1/pointcloud */

const configPath = path.join(__dirname, 'viewer', 'projects', projectName, 'config.json');
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
    const apiUrl = `${config.panel}${queryName}`;
    try {
      const apiResponse = await axios.get(apiUrl);
      const result = apiResponse.data.results[0]; 
      const position = result?.camera_position; 
      const direction = result?.look_at; 
      const url = result?.url_public;
      
      fs.readFile(path.join(__dirname, 'viewer', 'modules', 'pointcloud', 'pointcloud.html'), 'utf8', (err, data) => {
        if (err) {
          console.error('Error reading the file:', err);
          return res.status(500).send('Internal Server Error');
        }
        let modifiedData = data;
        const positionStr = position ? position.join(',') : '';
        const directionStr = direction ? direction.join(',') : '';
        
        modifiedData = modifiedData.replace(/PLACEHOLDER_URL_PUBLIC/g, `${url}`);
        modifiedData = modifiedData.replace(/'PLACEHOLDER_POSITION'/g, `[${positionStr}]`);
        modifiedData = modifiedData.replace(/'PLACEHOLDER_DIRECTION'/g, `[${directionStr}]`);
        modifiedData = modifiedData.replace(/'PLACEHOLDER_DISPLAY_ANNOTATIONS'/g, config.displayAnnotations);
        modifiedData = modifiedData.replace(/'PLACEHOLDER_POINTCLOUD_ANNOTATIONS'/g, `'${config.pointcoudAnnotations}'`);
        res.send(modifiedData);
      });
    } catch (error) {
      console.error('Error fetching data from API:', error);
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

  if (viewerType === 'pointcloud') {
      apiUrl = `${config.panel}${queryName}`;
  } else if (viewerType === 'orthophoto') {
      apiUrl = `https://diana.dh.gu.se/api/etruscantombs/image/${queryName}/?depth=1`;
  } else {
      return res.status(400).send('Invalid viewer type');
  }

  try {
      const apiResponse = await axios.get(apiUrl);

      if (!apiResponse || !apiResponse.data) {
          return res.status(404).send('Data not found');
      }

      let metadata;

      if (viewerType === 'pointcloud') {
          metadata = apiResponse.data.results?.[0];
      } else if (viewerType === 'orthophoto') {
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

          if (viewerType === 'pointcloud') {
              modifiedHtml = htmlData.replace(/PLACEHOLDER_TITLE/g, metadata.title ?? 'Unknown')
                                     .replace(/PLACEHOLDER_DESCRIPTION/g, metadata.description ?? 'Unknown')
                                     .replace(/PLACEHOLDER_POINTS_OPTIMIZED/g, metadata.points_optimized ?? 'Unknown')
                                     .replace(/PLACEHOLDER_POINTS_FULL/g, metadata.points_full_resolution ?? 'Unknown');
          } else if (viewerType === 'orthophoto') {
              modifiedHtml = htmlData.replace(/PLACEHOLDER_TITLE/g, 'Tomb ' + metadata.tomb.name ?? 'Unknown Tomb')
                                     .replace(/PLACEHOLDER_DESCRIPTION/g, metadata.tomb.description ?? 'No description available')
                                     .replace(/PLACEHOLDER_TYPE/g, metadata.type_of_image?.[0]?.text ?? 'Unknown type')
                                     .replace(/PLACEHOLDER_CREATOR/g, `${metadata.author.firstname} ${metadata.author.lastname}` ?? 'Unknown Creator')
                                     .replace(/PLACEHOLDER_DATE/g, `${metadata.date}` ?? 'Unknown Date')
                                     .replace(/PLACEHOLDER_IMAGE_URL/g, metadata.iiif_file ?? '')
                                     .replace(/PLACEHOLDER_DOWNLOAD_URL/g, metadata.file ?? '');
          }

          //remove blocks with empty placeholders
          modifiedHtml = modifiedHtml.replace(/<div[^>]*>\s*<div[^>]*>[^<]+:<\/div>\s*<\/div>/g, '')
          .replace(/<div[^>]*>\s*<div[^>]*>Type:<\/div>\s*<span[^>]*>PLACEHOLDER_TYPE<\/span>\s*<\/div>/g, '')
          .replace(/<div[^>]*>\s*<div[^>]*>Creator:<\/div>\s*<span[^>]*>PLACEHOLDER_CREATOR<\/span>\s*<\/div>/g, '')
          .replace(/<div[^>]*>\s*<div[^>]*>Date:<\/div>\s*<span[^>]*>PLACEHOLDER_DATE<\/span>\s*<\/div>/g, '')
          .replace(/<div[^>]*>\s*<div[^>]*>Points \(optimized\):<\/div>\s*<span[^>]*>PLACEHOLDER_POINTS_OPTIMIZED<\/span>\s*<\/div>/g, '')
          .replace(/<div[^>]*>\s*<div[^>]*>Points \(high quality\):<\/div>\s*<span[^>]*>PLACEHOLDER_POINTS_FULL<\/span>\s*<\/div>/g, '')
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
                               .replace(/'PLACEHOLDER_DOWNLOAD_PATH'/g, JSON.stringify(downloadFilePath)) 
                               .replace(/'PLACEHOLDER_INSCRIPTION_URL'/g, JSON.stringify(`${config.inscriptionUrl}`));
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

app.use('/viewer/modules/pointcloud', express.static(path.join(__dirname, 'viewer', 'modules', 'pointcloud')));
app.use('/viewer/modules/iiif', express.static(path.join(__dirname, 'viewer', 'modules', 'iiif')));
app.use('/viewer/shared', express.static(path.join(__dirname, 'viewer', 'shared')));
app.use('/viewer/projects', express.static(path.join(__dirname, 'viewer', 'projects')));
app.use('/viewer/locales', express.static(path.join(__dirname, 'viewer', 'locales')));
app.use('/viewer/libs', express.static(path.join(__dirname, 'viewer', 'libs')));

// Fallback route, serve index.html
app.get('*', (req, res) => {
  const queryName = req.query.q;
  const queryId = queryName ? queryName.split('/')[0] : '';

  if (!queryName) {
    const indexPath = path.join(__dirname, 'index.html');
    return res.sendFile(indexPath);
  }

  const indexPath = path.join(__dirname, 'viewer', 'projects', projectName, 'index.html');

  fs.readFile(indexPath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading the file:', err);
      return res.status(500).send('Internal Server Error');
    }

    let modifiedData = data
    .replace(/PLACEHOLDER_QUERY/g, queryName)
    res.send(modifiedData);
  });
});

const PORT = 8098;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
