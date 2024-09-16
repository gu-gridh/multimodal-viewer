const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const dotenv = require('dotenv'); 

dotenv.config({ path: './.env.local' });
const app = express();
const projectName = process.env.PROJECT || 'default';

const configPath = path.join(__dirname, 'viewer', 'projects', projectName, 'config.json');
let config;
try {
    config = require(configPath);
} catch (error) {
    console.error(`Failed to load config for project ${projectName}:`, error);
    process.exit(1);
}

app.get('/viewer/modules/rti/rti.html', async (req, res) => {
  const fullQuery = req.query.q;
  const queryName = fullQuery ? fullQuery.split('/')[0] : '';
  // Fetch RTI image data from the API
  const apiUrl = `${config.panel}${queryName}`;
  try {
    const apiResponse = await axios.get(apiUrl);
    const rtiImages = apiResponse.data.features[0].properties.attached_RTI;

    fs.readFile(path.join(__dirname, 'viewer', 'modules', 'rti', 'rti.html'), 'utf8', (err, htmlData) => {
      if (err) {
        console.error('Error reading the file:', err);
        return res.status(500).send('Internal Server Error');
      }
      const initialRTIUrl = rtiImages.length > 0 ? rtiImages[0].url : '';

      const dropdownHtml = rtiImages.map(rti => 
        `<option value="${rti.url}">${rti.title}</option>`
      ).join('');
      
      let modifiedHtml = htmlData.replace("PLACEHOLDER_RTI", initialRTIUrl);
      modifiedHtml = modifiedHtml.replace('<!-- PLACEHOLDER_FOR_BUTTONS -->', 
        `<select id="rtiImageDropdown" onchange="updateRTIImage(this.value)">
          ${dropdownHtml}
        </select>`);      
      res.send(modifiedHtml);
    });
  } catch (error) {
    console.error('Error fetching data from API:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/viewer/modules/pointcloud/pointcloud.html', async (req, res) => {
  const fullQuery = req.query.q;
  const queryName = fullQuery ? fullQuery.split('/')[0] : '';
  const apiUrl = `${config.panel}${queryName}`;
  try {
    const apiResponse = await axios.get(apiUrl);
    const position = apiResponse.data.features[0]?.properties.spatial_position;
    const direction = apiResponse.data.features[0]?.properties.spatial_direction;
    
    fs.readFile(path.join(__dirname, 'viewer', 'modules', 'pointcloud', 'pointcloud.html'), 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading the file:', err);
        return res.status(500).send('Internal Server Error');
      }
      let modifiedData = data;
      const positionStr = position ? position.join(',') : '';
      const directionStr = direction ? direction.join(',') : '';
      
      modifiedData = modifiedData.replace(/PLACEHOLDER_URL_PUBLIC/g, `${config.pointcloud}`);
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

app.get('/viewer/modules/iiif/iiifSequence.html', async (req, res) => {  
  const fullQuery = req.query.q;
  const queryName = fullQuery ? fullQuery.split('/')[0] : '';
  if (!queryName) {
    return res.status(400).send('Query parameter is missing');
  }
  const apiUrl = `${config.panel}${queryName}`;
  try {
    const apiResponse = await axios.get(apiUrl);

    if (!apiResponse || !apiResponse.data || !apiResponse.data.features) {
      return res.status(404).send('Data not found');
    }

    const modelData = apiResponse.data.features;

    if (modelData.length > 0 && modelData[0].properties.attached_topography) {
      const basePathIiif = `${config.basePath}`;
      const basePathDownload = `${config.downloadPath}`;
      const topographyImagesIiif = modelData[0].properties.attached_topography.map(topography => `${basePathIiif}${topography.iiif_file}/info.json`);
      const topographyImagesJpg = modelData[0].properties.attached_topography.map(topography => `${basePathDownload}${topography.file}`);
      const htmlContent = fs.readFileSync(path.join(__dirname, 'viewer',  'modules', 'iiif', 'iiifSequence.html'), 'utf8');
      let updatedHtmlContent = htmlContent.replace('PLACEHOLDER_IIIF_IMAGE_URLS', JSON.stringify(topographyImagesIiif))
                                          .replace('PLACEHOLDER_DOWNLOAD_PATH', JSON.stringify(topographyImagesJpg))
                                          .replace('PLACEHOLDER_PROJECT', JSON.stringify(config.project));
      res.send(updatedHtmlContent);
    } else {
      console.log('No attached topography images found.');
      res.send('No attached topography images found.');
    }
  } catch (error) {
    console.error('Error fetching data from API:', error);
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

  const apiUrl = `${config.metadata}${queryName}&depth=1`;
  try {
    const apiResponse = await axios.get(apiUrl);
    if (!apiResponse || !apiResponse.data || !apiResponse.data.results) {
      return res.status(404).send('Data not found');
    }

    const metadata = apiResponse.data.results?.[0];
    if (!metadata) {
      return res.status(404).send('Data not found or malformed');
    }

    const metadataPath = path.join(__dirname, 'viewer', 'projects', projectName, 'metadata', 'metadata.html');

    fs.readFile(metadataPath, 'utf8', (err, htmlData) => {
      if (err) {
        console.error('Error reading the file:', err);
        return res.status(500).send('Internal Server Error');
      }

      let modifiedHtml = htmlData.replace(/PLACEHOLDER_TITLE/g, metadata.title ?? 'Unknown')
                                 .replace(/PLACEHOLDER_ROOM/g, metadata.room ?? 'Unknown')
                                 .replace(/PLACEHOLDER_INSCRIPTIONS/g, metadata.number_of_inscriptions ?? 'Unknown')
                                 .replace(/PLACEHOLDER_LANGUAGES/g, metadata.number_of_languages ?? 'Unknown')
                                 .replace(/PLACEHOLDER_DOCUMENTATION_EN/g, metadata.documentation.map(doc => doc.observation).join(' '))
                                 .replace(/PLACEHOLDER_DOCUMENTATION_UK/g, metadata.documentation.map(doc => doc.text_ukr).join(' '))

      res.send(modifiedHtml);
    });
  } catch (error) {
    console.error('Error fetching data from API:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/viewer/modules/mesh/mesh.html', async (req, res) => {
  const fullQuery = req.query.q;
  const queryName = fullQuery ? fullQuery.split('/')[0] : '';
  if (!queryName) {
    return res.status(400).send('Query parameter is missing');
  }

  const apiUrl = `${config.panel}${queryName}`;
  try {
    const apiResponse = await axios.get(apiUrl);
    const modelData = apiResponse.data.features;

    fs.readFile(path.join(__dirname, 'viewer', 'modules', 'mesh', 'mesh.html'), 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading the file:', err);
        return res.status(500).send('Internal Server Error');
      }

      let modifiedData = data.replace(/PLACEHOLDER_MESH/g, JSON.stringify(modelData?.[0]?.properties?.attached_3Dmesh?.[0]?.url || ''));
      modifiedData = modifiedData .replace(/PLACEHOLDER_SECOND_MESH/g, JSON.stringify(''))
      modifiedData = modifiedData.replace(/PLACEHOLDER_STARTPHI/g, JSON.stringify(0.0));
      modifiedData = modifiedData.replace(/PLACEHOLDER_STARTTHETA/g, JSON.stringify(0.0));
      modifiedData = modifiedData.replace(/PLACEHOLDER_STARTDISTANCE/g, JSON.stringify(1.5));
      modifiedData = modifiedData.replace(/PLACEHOLDER_STARTPAN/g, JSON.stringify([0.0, 0.0, 0.0]));
      modifiedData = modifiedData.replace(/PLACEHOLDER_MINMAXPHI/g, JSON.stringify([-180.0, 180.0]));
      modifiedData = modifiedData.replace(/PLACEHOLDER_MINMAXTHETA/g, JSON.stringify([-180.0, 180.0]));
      modifiedData = modifiedData.replace(/PLACEHOLDER_TRACKBALLSTART/g, JSON.stringify([0.0, 0.0, 0.0, 0.0, 0.0, 1.5]));

      res.send(modifiedData);
    });
  } catch (error) {
    console.error('Error fetching data from API:', error);
    return res.status(500).send('Internal Server Error');
  }
});

app.get('/viewer/modules/iiif/iiif.html', async (req, res) => { 
  const fullQuery = req.query.q;
  const queryName = fullQuery ? fullQuery.split('/')[0] : '';
  if (!queryName) {
    return res.status(400).send('Query parameter is missing');
  }

  const apiUrl = `${config.panel}${queryName}`;
  try {
    const apiResponse = await axios.get(apiUrl);
    const modelData = apiResponse.data.features;

    if (modelData.length > 0 && modelData[0].properties.attached_photograph) {
      fs.readFile(path.join(__dirname, 'viewer', 'modules', 'iiif', 'iiif.html'), 'utf8', (err, data) => {
        if (err) {
          console.error('Error reading the file:', err);
          return res.status(500).send('Internal Server Error');
        }
        const basePath = `${config.basePath}`;
        const basePathDownload = `${config.downloadPath}`;
        const iiifFilePath = modelData?.[0]?.properties?.attached_photograph?.[0]?.iiif_file;
        const downloadFile = modelData?.[0]?.properties?.attached_photograph?.[0]?.file;
        const annotationPath = `${config.annotationPath}`;
        const fullPath = `"${basePath}${iiifFilePath}/info.json"`;
        const downloadFilePath = `"${basePathDownload}${downloadFile}"`;
        let modifiedData = data.replace(/'PLACEHOLDER_IIIF_IMAGE_URL'/g, fullPath || '')
                               .replace(/'PLACEHOLDER_FILE_NAME'/g, JSON.stringify(config.fileNameUsedWhenSharingIIIF)) 
                               .replace(/'PLACEHOLDER_DOWNLOAD_PATH'/g, JSON.stringify(downloadFilePath)) 
                               .replace(/'PLACEHOLDER_ANNOTATION_PATH'/g,  JSON.stringify(`${annotationPath}${queryName}`))
                               .replace(/'PLACEHOLDER_INSCRIPTION_URL'/g, JSON.stringify(`${config.inscriptionUrl}`))
                               .replace(/'PLACEHOLDER_IIIF_ANNOTATIONS'/g, config.displayIIIFAnnotations)
                               .replace(/'PLACEHOLDER_DISPLAY_IIIF_ANNOTATIONS'/g, config.displayIIIFAnnotations ? 'flex' : 'none');
        res.send(modifiedData);
      });
    } else {
      console.log('No attached topography images found.');
      res.send('No attached topography images found.');
    }
  } catch (error) {
    console.error('Error fetching data from API:', error);
    return res.status(500).send('Internal Server Error');
  }
});

app.use('/viewer/modules/mesh', express.static(path.join(__dirname, 'viewer', 'modules', 'mesh')));
app.use('/viewer/modules/pointcloud', express.static(path.join(__dirname, 'viewer', 'modules', 'pointcloud')));
app.use('/viewer/modules/rti', express.static(path.join(__dirname, 'viewer', 'modules', 'rti')));
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
    .replace(/PLACEHOLDER_ID/g, queryId)
    .replace('PLACEHOLDER_BACKBUTTON', config.backButton)
    res.send(modifiedData);
  });
});

const PORT = 8095;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
