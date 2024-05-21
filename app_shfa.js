const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const dotenv = require('dotenv'); 

dotenv.config({ path: './.env.local' });
const app = express();
const projectName = process.env.PROJECT || 'default';

const configPath = path.join(__dirname, 'projects', projectName, 'config.json');
let config;
try {
    config = require(configPath);
} catch (error) {
    console.error(`Failed to load config for project ${projectName}:`, error);
    process.exit(1);
}

// app.get('/modules/openlime/openlime.html', async (req, res) => {
//   const fullQuery = req.query.q;
//   const queryName = fullQuery ? fullQuery.split('/')[0] : '';
//   // Fetch RTI image data from the API
//   const apiUrl = `${config.panel}${queryName}`;
//   try {
//     const apiResponse = await axios.get(apiUrl);
//     const rtiImages = apiResponse.data.features[0].properties.attached_RTI;

//     fs.readFile(path.join(__dirname, 'modules', 'openlime', 'openlime.html'), 'utf8', (err, htmlData) => {
//       if (err) {
//         console.error('Error reading the file:', err);
//         return res.status(500).send('Internal Server Error');
//       }
//       const initialRTIUrl = rtiImages.length > 0 ? rtiImages[0].url : '';

//       const dropdownHtml = rtiImages.map(rti => 
//         `<option value="${rti.url}">RTI ${rti.id}</option>`
//       ).join('');
      
//       let modifiedHtml = htmlData.replace("PLACEHOLDER_RTI", initialRTIUrl);
//       modifiedHtml = modifiedHtml.replace('<!-- PLACEHOLDER_FOR_BUTTONS -->', 
//         `<select id="rtiImageDropdown" onchange="updateRTIImage(this.value)">
//           ${dropdownHtml}
//         </select>`);      
//       res.send(modifiedHtml);
//     });
//   } catch (error) {
//     console.error('Error fetching data from API:', error);
//     res.status(500).send('Internal Server Error');
//   }
// });

app.get('/modules/iiif/iiifSequence.html', async (req, res) => {  
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

      const topographyImagesIiif = modelData[0].properties.attached_topography.map(topography => `${basePathIiif}${topography.iiif_file}/info.json`);
      
      const htmlContent = fs.readFileSync(path.join(__dirname,  'modules', 'iiif', 'iiifSequence.html'), 'utf8');
      let updatedHtmlContent = htmlContent.replace('PLACEHOLDER_IIIF_IMAGE_URLS', JSON.stringify(topographyImagesIiif));

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

app.get('/projects/:projectName/metadata/metadata.html', async (req, res) => {
  const { projectName } = req.params;
  const fullQuery = req.query.q;
  const queryName = fullQuery ? fullQuery.split('/')[0] : '';

  if (!queryName) {
      return res.status(400).send('Query parameter is missing');
  }

  const apiUrl = `${config.metadata}${queryName}`;

  try {
      const apiResponse = await axios.get(apiUrl);
      if (!apiResponse || !apiResponse.data || !apiResponse.data.results) {
          return res.status(404).send('Data not found');
      }

      const metadata = apiResponse.data.results[0];
      if (!metadata) {
          return res.status(404).send('Data not found or malformed');
      }

      const title = metadata.text || 'Unknown';

      const metadataPath = path.join(__dirname, 'projects', projectName, 'metadata', 'metadata.html');

      fs.readFile(metadataPath, 'utf8', (err, htmlData) => {
          if (err) {
              console.error('Error reading the file:', err);
              return res.status(500).send('Internal Server Error');
          }

          //extracting data
          const shfaData = metadata.shfa_3d_data ? metadata.shfa_3d_data[0] : {};
          const site = shfaData.site || {};
          const institution = shfaData.institution || {};
          const geology = shfaData.geology || {};
          const creators = shfaData.creators || [];
          const keywords = shfaData.keywords || [];
          const datings = shfaData.datings || [];
          const three_d_mesh = shfaData.three_d_mesh || {};
          const image = shfaData.image || {};

          const siteName = site.raa_id || 'Unknown';
          const institutionName = institution.name || 'Unknown';
          const creatorNames = creators.map(creator => creator.name).join(', ') || 'Unknown';
          const keywordTexts = keywords.map(keyword => keyword.text).join(', ') || 'Unknown';
          const datingTexts = datings.map(dating => dating.text).join(', ') || 'Unknown';
          const geologyType = geology.type || 'Unknown';

          const numVertices = three_d_mesh.num_vertices || 'Unknown';
          const numFaces = three_d_mesh.num_faces || 'Unknown';
          const numPhotos = three_d_mesh.num_photos || 'Unknown';
          const dimensions = three_d_mesh.dimensions ? three_d_mesh.dimensions.join(', ') : 'Unknown';
          const method = three_d_mesh.method || 'Unknown';
          const weather = three_d_mesh.weather ? three_d_mesh.weather.join(', ') : 'Unknown';

          const cameraLens = image.camera_lens || 'Unknown';
          const cameraModel = image.camera_model || 'Unknown';

          //replacing placeholders
          let modifiedHtml = htmlData
              .replace(/PLACEHOLDER_TITLE/g, title)
              .replace(/PLACEHOLDER_SITE/g, siteName)
              .replace(/PLACEHOLDER_DATE/g, shfaData.date)
              .replace(/PLACEHOLDER_CREATOR/g, creatorNames)
              .replace(/PLACEHOLDER_INSTITUTION/g, institutionName)
              .replace(/PLACEHOLDER_KEYWORDS/g, keywordTexts)
              .replace(/PLACEHOLDER_DATINGS/g, datingTexts)
              .replace(/PLACEHOLDER_GEOLOGY/g, geologyType)
              .replace(/PLACEHOLDER_NUM_VERTICES/g, numVertices)
              .replace(/PLACEHOLDER_NUM_FACES/g, numFaces)
              .replace(/PLACEHOLDER_NUM_PHOTOS/g, numPhotos)
              .replace(/PLACEHOLDER_DIMENSIONS/g, dimensions)
              .replace(/PLACEHOLDER_METHOD/g, method)
              .replace(/PLACEHOLDER_WEATHER/g, weather)
              .replace(/PLACEHOLDER_CAMERA_LENS/g, cameraLens)
              .replace(/PLACEHOLDER_CAMERA_MODEL/g, cameraModel);

          res.send(modifiedHtml);
      });
  } catch (error) {
      console.error('Error fetching data from API:', error);
      res.status(500).send('Internal Server Error');
  }
});

// 3dhop Route
app.get('/modules/3dhop/3dhop.html', async (req, res) => {
  const fullQuery = req.query.q;
  const queryName = fullQuery ? fullQuery.split('/')[0] : '';
  if (!queryName) {
      return res.status(400).send('Query parameter is missing');
  }

  const apiUrl = `${config.panel}${queryName}`;

  try {
      const apiResponse = await axios.get(apiUrl);
      if (!apiResponse || !apiResponse.data || !apiResponse.data.results) {
          return res.status(404).send('Data not found');
      }

      const shfaData = apiResponse.data.results[0].shfa_3d_data;
      if (!shfaData || !shfaData.length) {
          return res.status(404).send('No shfa_3d_data found');
      }

      const modelData = shfaData[0];
      if (!modelData.three_d_mesh || !modelData.three_d_mesh.mesh_url) {
          return res.status(404).send('No three_d_mesh or mesh_url found');
      }

      fs.readFile(path.join(__dirname, 'modules', '3dhop', '3dhop.html'), 'utf8', (err, data) => {
          if (err) {
              console.error('Error reading the file:', err);
              return res.status(500).send('Internal Server Error');
          }

          let modifiedData = data.replace(/PLACEHOLDER_MESH/g, JSON.stringify(modelData.three_d_mesh.mesh_url));
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

app.get('/modules/iiif/iiif.html', async (req, res) => { 
  const fullQuery = req.query.q;
  const queryName = fullQuery ? fullQuery.split('/')[0] : '';
  if (!queryName) {
    return res.status(400).send('Query parameter is missing');
  }

  const apiUrl = `${config.panel}${queryName}`;
  try {
    const apiResponse = await axios.get(apiUrl);
    const modelData = apiResponse.data.features;

    fs.readFile(path.join(__dirname, 'modules', 'iiif', 'iiif.html'), 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading the file:', err);
        return res.status(500).send('Internal Server Error');
      }

      const basePath = `${config.basePath}`;
      const iiifFilePath = modelData?.[0]?.properties?.attached_photograph?.[0]?.iiif_file;
      const fullPath = `"${basePath}${iiifFilePath}/info.json"`;
      let modifiedData = data.replace(/'PLACEHOLDER_IIIF_IMAGE_URL'/g, fullPath || '');

      res.send(modifiedData);
    });
  } catch (error) {
    console.error('Error fetching data from API:', error);
    return res.status(500).send('Internal Server Error');
  }
});

app.use('/modules/3dhop', express.static(path.join(__dirname, 'modules', '3dhop')));
app.use('/modules/pointcloud', express.static(path.join(__dirname, 'modules', 'pointcloud')));
app.use('/modules/openlime', express.static(path.join(__dirname, 'modules', 'openlime')));
app.use('/modules/iiif', express.static(path.join(__dirname, 'modules', 'iiif')));
app.use('/shared', express.static(path.join(__dirname, 'shared')));
app.use('/projects', express.static(path.join(__dirname, 'projects')));
app.use('/locales', express.static(path.join(__dirname, 'locales')));
app.use('/libs', express.static(path.join(__dirname, 'libs')));

// Fallback route, serve index.html
app.get('*', (req, res) => {
  const queryName = req.query.q;

  if (!queryName) {
    const indexPath = path.join(__dirname, 'index.html');
    return res.sendFile(indexPath);
  }

  const indexPath = path.join(__dirname, 'projects', projectName, 'index.html');

  fs.readFile(indexPath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading the file:', err);
      return res.status(500).send('Internal Server Error');
    }
    
    let modifiedData = data
    .replace(/PLACEHOLDER_QUERY/g, queryName)
    .replace('PLACEHOLDER_BACKBUTTON', config.backButton)
    res.send(modifiedData);
  });
});

const PORT = 8095;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
