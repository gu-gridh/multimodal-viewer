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
  const apiUrl = `${config.panel}${queryName}&depth=2`;
  try {
    const apiResponse = await axios.get(apiUrl);

    if (!apiResponse || !apiResponse.data || !apiResponse.data.results) {
      return res.status(404).send('Data not found');
    }

    const modelData = apiResponse.data.results;

    //check for the presence of colour_images
    if (modelData.length > 0 && modelData[0].colour_images) {

      //Extract all IIIF image URLs from colour_images
      const iiifImageUrls = modelData[0].colour_images.map(image => `${image.iiif_file}/info.json`);
      const htmlContent = fs.readFileSync(path.join(__dirname, 'modules', 'iiif', 'iiifSequence.html'), 'utf8');
      let updatedHtmlContent = htmlContent.replace('PLACEHOLDER_IIIF_IMAGE_URLS', JSON.stringify(iiifImageUrls))
                                          .replace('PLACEHOLDER_DOWNLOAD_PATH', config.downloadPath);
      res.send(updatedHtmlContent);
    } else {
      console.log('No colour images found.');
      res.send('No colour images found.');
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

  const apiUrl = `${config.metadata}${queryName}&depth=3`;

  try {
      const apiResponse = await axios.get(apiUrl);
      if (!apiResponse || !apiResponse.data || !apiResponse.data.results) {
          return res.status(404).send('Data not found');
      }

      const metadata = apiResponse.data.results[0];
      if (!metadata) {
          return res.status(404).send('Data not found or malformed');
      }

      const shfaData = metadata.shfa_3d_data ? metadata.shfa_3d_data[0] : {};
      const site = shfaData.site || {};
      const institution = shfaData.institution || {};
      const geology = shfaData.geology || {};
      const creators = shfaData.creators || [];
      const datings = shfaData.datings || [];
      const three_d_mesh = shfaData.three_d_mesh || {};
      const image = shfaData.image || {};

      //group keywords by category
      const categories = {};
      if (shfaData.keywords) {  //check if keywords exist before iterating
          shfaData.keywords.forEach(keyword => {
              const categorySV = keyword.category || 'Uncategorized';
              const categoryEN = keyword.category_translation || 'Uncategorized';
              if (!categories[categorySV]) {
                  categories[categorySV] = { sv: [], en: [], categoryEN, categorySV };
              }
              categories[categorySV].sv.push(keyword.text);
              categories[categorySV].en.push(keyword.english_translation);
          });
      }

      //convert grouped keywords to HTML with inline styles
      const formatKeywords = (categories, lang) => {
          return Object.entries(categories).map(([category, keywords]) => {
              const categoryLabel = lang === 'sv' ? keywords.categorySV : keywords.categoryEN;
              const keywordList = keywords[lang].join(', ');
              return `<div style="margin-bottom: 15px;">
                          <span style="color: #fff; font-weight: 600; font-size: 120%;">${categoryLabel}:</span> <span style="display: inline; color: rgb(200, 225, 250) !important; font-weight: 400; font-size: 120%;">${keywordList}</span>
                      </div>`;
          }).join('');
      };

      const keywordTextsSV = formatKeywords(categories, 'sv');
      const keywordTextsEN = formatKeywords(categories, 'en');

      const metadataPath = path.join(__dirname, 'projects', projectName, 'metadata', 'metadata.html');

      fs.readFile(metadataPath, 'utf8', (err, htmlData) => {
          if (err) {
              console.error('Error reading the file:', err);
              return res.status(500).send('Internal Server Error');
          }

          //replacing placeholders
          let modifiedHtml = htmlData
            .replace(/PLACEHOLDER_TITLE/g, site?.raa_id || 'Unknown')
            .replace(/PLACEHOLDER_KEYWORDS_SV/g, keywordTextsSV)
            .replace(/PLACEHOLDER_KEYWORDS_EN/g, keywordTextsEN)
            .replace(/PLACEHOLDER_SITE/g, site?.raa_id || 'Unknown')
            .replace(/PLACEHOLDER_DATE/g, shfaData?.date || 'Unknown')
            .replace(/PLACEHOLDER_CREATOR/g, creators.map(creator => creator?.name).join(', ') || 'Unknown')
            .replace(/PLACEHOLDER_INSTITUTION/g, institution?.name || 'Unknown')
            .replace(/PLACEHOLDER_DATINGS/g, datings.map(dating => dating?.text).join(', ') || 'Unknown')
            .replace(/PLACEHOLDER_GEOLOGY/g, geology?.type || 'Unknown')
            .replace(/PLACEHOLDER_NUM_VERTICES/g, three_d_mesh?.num_vertices || 'Unknown')
            .replace(/PLACEHOLDER_NUM_FACES/g, three_d_mesh?.num_faces || 'Unknown')
            .replace(/PLACEHOLDER_NUM_PHOTOS/g, three_d_mesh?.num_photos || 'Unknown')
            .replace(/PLACEHOLDER_DIMENSIONS/g, three_d_mesh.dimensions ? three_d_mesh.dimensions.join(', ') : 'Unknown')
            .replace(/PLACEHOLDER_METHOD/g, three_d_mesh.method?.text || 'Unknown')
            .replace(/PLACEHOLDER_WEATHER/g, three_d_mesh.weather?.map(w => w?.text).join(', ') || 'Unknown')
            .replace(/PLACEHOLDER_CAMERA_LENS/g, image.camera_lens?.name || 'Unknown')
            .replace(/PLACEHOLDER_CAMERA_MODEL/g, image.camera_model?.name || 'Unknown');
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

  const apiUrl = `${config.panel}${queryName}&depth=2`;

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

      const meshUrl = modelData.three_d_mesh.mesh_url;
      const qualityUrl = modelData.three_d_mesh.quality_url || '';

      fs.readFile(path.join(__dirname, 'modules', '3dhop', '3dhop.html'), 'utf8', (err, data) => {
          if (err) {
              console.error('Error reading the file:', err);
              return res.status(500).send('Internal Server Error');
          }

          let modifiedData = data.replace(/PLACEHOLDER_MESH/g, JSON.stringify(meshUrl))
                                  .replace(/PLACEHOLDER_SECOND_MESH/g, JSON.stringify(qualityUrl))
                                  .replace(/PLACEHOLDER_STARTPHI/g, 0.0)
                                  .replace(/PLACEHOLDER_STARTTHETA/g, 0.0)
                                  .replace(/PLACEHOLDER_STARTDISTANCE/g, 1.5)
                                  .replace(/PLACEHOLDER_STARTPAN/g, JSON.stringify([0.0, 0.0, 0.0]))
                                  .replace(/PLACEHOLDER_MINMAXPHI/g, JSON.stringify([-180.0, 180.0]))
                                  .replace(/PLACEHOLDER_MINMAXTHETA/g, JSON.stringify([-180.0, 180.0]))
                                  .replace(/PLACEHOLDER_TRACKBALLSTART/g, JSON.stringify([0.0, 0.0, 0.0, 0.0, 0.0, 1.5]));

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
