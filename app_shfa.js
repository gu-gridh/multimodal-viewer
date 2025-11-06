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

app.get('/viewer/modules/iiif/iiif.html', async (req, res) => {
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
    if (modelData.length > 0 && modelData[0].colour_images && modelData[0].shfa_3d_data) {

      //Extract all IIIF image URLs from colour_images
      const creators = modelData[0].shfa_3d_data.map(data => data.creators.map(creator => creator.name));
      const locationID = modelData[0].shfa_3d_data.map(data => data.site.lamning_id || data.site.raa_id || data.site.placename);
      const imageIDs = modelData[0].colour_images.map(image => image.id);
      const iiifImageUrls = modelData[0].colour_images.map(image => `${image.iiif_file}/info.json`);
      const downloadableFiles = modelData[0].colour_images.map(image => image.file);
      const htmlContent = fs.readFileSync(path.join(__dirname, 'viewer', 'modules', 'iiif', 'iiif.html'), 'utf8');
      let updatedHtmlContent = htmlContent
        .replace(/'PLACEHOLDER_IIIF_IMAGE_URL'/g, JSON.stringify(iiifImageUrls))
        .replace('PLACEHOLDER_DOWNLOAD_PATH', JSON.stringify(downloadableFiles))
        .replace('PLACEHOLDER_PROJECT', JSON.stringify(config.project))
        .replace('PLACEHOLDER_CREATORS', JSON.stringify(creators))
        .replace('PLACEHOLDER_LOCATION_ID', JSON.stringify(locationID))
        .replace('PLACEHOLDER_IMAGE_IDS', JSON.stringify(imageIDs))
        .replace(/'PLACEHOLDER_DISPLAY_IIIF_ANNOTATIONS'/g, 'none')
        .replace(/'PLACEHOLDER_IIIF_ANNOTATIONS'/g, false)
        .replace(/'PLACEHOLDER_SEQUENCE_SHOW'/g, 'flex')
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

app.get('/viewer/projects/:projectName/metadata/metadata.html', async (req, res) => {
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
    const isInternational = shfaData.site?.internationl_site;
    const meshDate = shfaData.date ? shfaData.date.substr(0, 7) : 'Unknown';

    let title = `${site?.lamning_id || site?.raa_id}  |  ${site?.raa_id || site?.placename}`;
    if (!isInternational && !site?.raa_id) {
      title = `${site?.lamning_id || site?.raa_id}  |  ${site?.placename}`;
    }
    if (!isInternational && site?.lamning_id && site?.raa_id) {
      title = `${site?.lamning_id || site?.raa_id}  |  ${site?.raa_id || site?.placename}`;
    } else {
      title = site?.placename;
    }

    const date = new Date();
    const options = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    let acc_date = date.toLocaleString('en-GB', options);

    let formattedPeopleSV = 'Unknown';
    let formattedPeopleEN = 'Unknown';
    try {
      formattedPeopleSV = new Intl.ListFormat('sv', { style: 'long', type: 'conjunction' }).format(creators.map(creator => creator?.name));
      formattedPeopleEN = new Intl.ListFormat('en-GB', { style: 'long', type: 'conjunction' }).format(creators.map(creator => creator?.name));
    } catch (error) {
      console.error('Error formatting creators:', error);
    }

    const referenceSV = `${formattedPeopleSV || 'Unknown'}, ${shfaData?.date ? shfaData.date.substr(0, 4) : 'Unknown'}. Mesh av ${site?.lamning_id || site?.placename}, SHFA, åtkomst ${acc_date} på https://shfa.dh.gu.se/viewer/?q=${queryName}/mesh`;
    const referenceEN = `${formattedPeopleEN || 'Unknown'}, ${shfaData?.date ? shfaData.date.substr(0, 4) : 'Unknown'}. Mesh of ${site?.lamning_id || site?.placename}, SHFA, accessed ${acc_date} at https://shfa.dh.gu.se/viewer/?q=${queryName}/mesh`;

    const imgMetadata = metadata.colour_images.map(image => image.subtype?.english_translation);
    const tvtVis = imgMetadata.findIndex((img) => img.includes('|'));
    const dfVis = imgMetadata.findIndex((img) => img.includes('Digital Frottage'));

    let tvtCreator = 'Unknown';
    let tvtYear = 'Unknown';
    if (tvtVis != -1) {
      try {
        tvtCreator = metadata.colour_images[tvtVis].people.map(creator => creator?.name).join('<br>');
        tvtYear = metadata.colour_images[tvtVis].year;
      } catch (error) {
        console.error('Error processing TVT image data:', error);
      }
    }

    let dfCreator = 'Unknown';
    let dfYear = 'Unknown';
    if (dfVis != -1) {
      try {
        dfCreator = metadata.colour_images[dfVis].people.map(creator => creator?.name).join('<br>');
        dfYear = metadata.colour_images[dfVis].year;
      } catch (error) {
        console.error('Error processing DF image data:', error);
      }
    }

    let displaySfmFields = 'name="sfm-field" style="display:none"'
    if (three_d_mesh.method?.text !== 'Laserscanning') { displaySfmFields = 'name="sfm-field" style="display:visible"' }

    let displayDfFields = 'name="df-field" style="display:none"'
    if (imgMetadata.includes('Digital Frottage')) { displayDfFields = 'name="df-field" style="display:visible"' }

    let displayQualityFields = 'name="quality-field" style="display: none'
    if (three_d_mesh.quality_url !== null) { displayQualityFields = 'name="quality-field" style="display: visible' }

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
    };
    if (shfaData.datings) {
      shfaData.datings.forEach(dating => {
        const categorySV = 'Datering';
        const categoryEN = 'Dating';
        if (!categories[categorySV]) {
          categories[categorySV] = { sv: [], en: [], categoryEN, categorySV }
        }
        categories[categorySV].sv.push(dating.text);
        categories[categorySV].en.push(dating.english_translation)
      });
    };

    //convert grouped keywords to HTML with inline styles
    const formatKeywords = (categories, lang) => {
      const sortedCategories = lang === 'sv' ? Object.values(categories).sort((a, b) => a.categorySV.localeCompare(b.categorySV)) : Object.values(categories).sort((a, b) => a.categoryEN.localeCompare(b.categoryEN));

      return Object.entries(sortedCategories).map(([category, keywords]) => {
        const categoryLabel = lang === 'sv' ? keywords.categorySV : keywords.categoryEN;
        const keywordList = keywords[lang].sort((a, b) => { return a.localeCompare(b) }).join(', ');
        return `<div style="margin-bottom: 15px;">
                          <span style="color: #fff; font-weight: 600; font-size: 120%;">${categoryLabel}:</span> <span style="display: inline; color: rgb(200, 225, 250) !important; font-weight: 400; font-size: 120%;">${keywordList}</span>
                      </div>`;
      }).join('');
    };

    const keywordTextsSV = formatKeywords(categories, 'sv');
    const keywordTextsEN = formatKeywords(categories, 'en');

    const metadataPath = path.join(__dirname, 'viewer', 'projects', projectName, 'metadata', 'metadata.html');

    fs.readFile(metadataPath, 'utf8', (err, htmlData) => {
      if (err) {
        console.error('Error reading the file:', err);
        return res.status(500).send('Internal Server Error');
      }

      //replacing placeholders
      let modifiedHtml = htmlData
        .replace(/PLACEHOLDER_TITLE/g, title)
        .replace(/PLACEHOLDER_KEYWORDS_SV/g, keywordTextsSV)
        .replace(/PLACEHOLDER_KEYWORDS_EN/g, keywordTextsEN)
        .replace(/PLACEHOLDER_SITE/g, site?.raa_id || site?.lamning_id || site?.placename || 'Unknown')
        .replace(/PLACEHOLDER_DATE/g, meshDate)
        .replace(/PLACEHOLDER_CREATOR/g, creators.map(creator => creator?.name).join(', ') || 'Unknown')
        .replace(/PLACEHOLDER_INSTITUTION/g, institution?.name || 'Unknown')
        // .replace(/PLACEHOLDER_DATINGS/g, datings.map(dating => dating?.text).join(', ') || 'Unknown')
        .replace(/PLACEHOLDER_GEOLOGY_SV/g, geology?.type == 'Null:okänt' ? geology?.description : geology?.type || 'Okänd')
        .replace(/PLACEHOLDER_GEOLOGY_EN/g, geology?.type_translation == 'Null: unknown' ? geology?.description_translation : geology?.type_translation || 'Unknown')
        .replace(/PLACEHOLDER_NUM_VERTICES/g, three_d_mesh?.num_vertices || 'Unknown')
        .replace(/PLACEHOLDER_NUM_FACES/g, three_d_mesh?.num_faces || 'Unknown')
        .replace(/PLACEHOLDER_NUM_PHOTOS/g, three_d_mesh?.num_photos || 'Unknown')
        .replace(/PLACEHOLDER_DIMENSIONS/g, three_d_mesh.dimensions ? three_d_mesh.dimensions.join(', ') : 'Unknown')
        .replace(/PLACEHOLDER_METHOD_SV/g, three_d_mesh.method?.text || 'Unknown')
        .replace(/PLACEHOLDER_METHOD_EN/g, three_d_mesh.method?.english_translation || 'Unknown')
        .replace(/PLACEHOLDER_WEATHER_SV/g, three_d_mesh.weather?.map(w => w?.text).join(', ') || 'Unknown')
        .replace(/PLACEHOLDER_WEATHER_EN/g, three_d_mesh.weather?.map(w => w?.english_translation).join(', ') || 'Unknown')
        .replace(/PLACEHOLDER_CAMERA_LENS/g, image?.camera_lens?.name || 'Unknown')
        .replace(/PLACEHOLDER_CAMERA_MODEL/g, image?.camera_model?.name || 'Unknown')
        .replace(/PLACEHOLDER_35MM/g, image?.mm35_equivalent || 'Unknown')
        .replace(/name="sfm-field" style="display:none"/g, displaySfmFields)
        .replace(/name="df-field" style="display:none"/g, displayDfFields)
        .replace(/name="quality-field" style="display: none/g, displayQualityFields)
        .replace(/PLACEHOLDER_TVT_CREATOR/g, tvtCreator)
        .replace(/PLACEHOLDER_TVT_DATE/g, tvtYear)
        .replace(/PLACEHOLDER_DF_CREATOR/g, dfCreator || 'Unknown')
        .replace(/PLACEHOLDER_DF_DATE/g, dfYear || 'Unknown')
        .replace(/PLACEHOLDER_REFERENCE_SV/g, referenceSV)
        .replace(/PLACEHOLDER_REFERENCE_EN/g, referenceEN);


      res.send(modifiedHtml);
    });
  } catch (error) {
    console.error('Error fetching data from API:', error);
    res.status(500).send('Internal Server Error');
  }
});

// mesh Route
app.get('/viewer/modules/mesh/mesh.html', async (req, res) => {
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

    fs.readFile(path.join(__dirname, 'viewer', 'modules', 'mesh', 'mesh.html'), 'utf8', (err, data) => {
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

app.use('/viewer/modules/mesh', express.static(path.join(__dirname, 'viewer', 'modules', 'mesh')));
app.use('/viewer/modules/pointcloud', express.static(path.join(__dirname, 'viewer', 'modules', 'pointcloud')));
app.use('/viewer/modules/openlime', express.static(path.join(__dirname, 'viewer', 'modules', 'openlime')));
app.use('/viewer/modules/iiif', express.static(path.join(__dirname, 'viewer', 'modules', 'iiif')));
app.use('/viewer/shared', express.static(path.join(__dirname, 'viewer', 'shared')));
app.use('/viewer/projects', express.static(path.join(__dirname, 'viewer', 'projects')));
app.use('/viewer/locales', express.static(path.join(__dirname, 'viewer', 'locales')));
app.use('/viewer/libs', express.static(path.join(__dirname, 'viewer', 'libs')));

// Fallback route, serve index.html
app.get('*', (req, res) => {
  const queryName = req.query.q;

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

const PORT = 8097;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});