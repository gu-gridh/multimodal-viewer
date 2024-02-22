const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const app = express();

/*
Sample URLs for testing:
http://localhost:8094/ Home
http://localhost:8094/?q=118-02 panel with Mesh/RTI
http://localhost:8094/?q=120-20 panel with IIIF
*/

app.get('/relight/relight.html', async (req, res) => {
  const queryName = req.query.q;
  // Fetch RTI image data from the API
  const apiUrl = `https://saintsophia.dh.gu.se/api/inscriptions/geojson/panel/?title=${queryName}`;
  try {
    const apiResponse = await axios.get(apiUrl);
    const rtiImages = apiResponse.data.features[0].properties.attached_RTI;

    fs.readFile(path.join(__dirname, 'relight', 'relight.html'), 'utf8', (err, htmlData) => {
      if (err) {
        console.error('Error reading the file:', err);
        return res.status(500).send('Internal Server Error');
      }
      const initialRTIUrl = rtiImages.length > 0 ? rtiImages[0].url : '';

      const dropdownHtml = rtiImages.map(rti => 
        `<option value="${rti.url}">RTI ${rti.id}</option>`
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

//for other index.html paths like /pointcloud/pointcloud.html
app.use('/:type/:file', async (req, res, next) => {
  const { type, file } = req.params;
  const queryName = req.query.q;

  if (!queryName) {
    next(); // No query parameter, proceed to static serving
  } else {
    // Define the API URL based on the type and queryName
    let apiUrl;
    if (type === 'pointcloud') {
      apiUrl = `https://diana.dh.gu.se/api/etruscantombs/objectpointcloud/?id=${queryName}`;
    } else if (type === 'mesh') {
      apiUrl = `https://saintsophia.dh.gu.se/api/inscriptions/geojson/panel/?title=${queryName}`;
    } else if (type === 'iiif') {
      apiUrl = `https://saintsophia.dh.gu.se/api/inscriptions/geojson/panel/?title=${queryName}`;
    } 
    else {
      return res.status(400).send('Invalid model type');
    }

    try {
      const apiResponse = await axios.get(apiUrl);
  
      if (apiResponse) {

      const modelData = apiResponse.data.features;
                  
      fs.readFile(path.join(__dirname, type, file), 'utf8', (err, data) => {
        if (err) {
          console.error('Error reading the file:', err);
          res.status(500).send('Internal Server Error');
          return;
        }
  
        // Replacing placeholders with actual data fetched from API
        let modifiedData = data;
        if (type === 'pointcloud') {
          modifiedData = modifiedData.replace(/PLACEHOLDER_URL_PUBLIC/g, 'https://data.dh.gu.se/saintsophia/pointcloud/cloud.js');
        }
        else if (type === 'mesh') {
          // modifiedData = modifiedData.replace(/PLACEHOLDER_TITLE/g, JSON.stringify(modelData.title || ''));
          modifiedData = modifiedData.replace(/PLACEHOLDER_MESH/g, JSON.stringify(modelData?.[0]?.properties?.attached_3Dmesh?.[0]?.url || ''));
          // modifiedData = modifiedData.replace(/PLACEHOLDER_STARTPHI/g, JSON.stringify(45.0));
          // modifiedData = modifiedData.replace(/PLACEHOLDER_STARTTHETA/g, JSON.stringify(20.0));
          // modifiedData = modifiedData.replace(/PLACEHOLDER_STARTDISTANCE/g, JSON.stringify(3.5));
          modifiedData = modifiedData.replace(/PLACEHOLDER_STARTPAN/g, JSON.stringify([0.0,0.0,0.0]));
          modifiedData = modifiedData.replace(/PLACEHOLDER_MINMAXPHI/g, JSON.stringify([-180.0,180.0]));
          modifiedData = modifiedData.replace(/PLACEHOLDER_MINMAXTHETA/g, JSON.stringify([-180.0,180.0]));
          modifiedData = modifiedData.replace(/PLACEHOLDER_TRACKBALLSTART/g, JSON.stringify([45.0,20.0,0.0,0.0,0.0,1.5]));
        }
        else if (type === 'iiif') {
          const basePath = "https://img.dh.gu.se/saintsophia/static/";
          const iiifFilePath = modelData?.[0]?.properties?.attached_photograph?.[0]?.iiif_file;
          const fullPath = `"${basePath}${iiifFilePath}/info.json"`;
          modifiedData = modifiedData.replace(/'PLACEHOLDER_IIIF_IMAGE_URL'/g, fullPath || '');
          modifiedData = modifiedData.replace(/PLACEHOLDER_TITLE/g, '');
        }
        res.send(modifiedData);
      });
    }
    else {
      console.error('No results found in API response.');
      res.status(404).send('Not Found');
      return;
      }
    } catch (error) {
      console.error('Error fetching data from API:', error);
      res.status(500).send('Internal Server Error');
    }

  }
});

app.use('/mesh', express.static(path.join(__dirname, 'mesh')));
app.use('/pointcloud', express.static(path.join(__dirname, 'pointcloud')));
app.use('/relight', express.static(path.join(__dirname, 'relight')));
app.use('/iiif', express.static(path.join(__dirname, 'iiif')));
app.use('/styles', express.static(path.join(__dirname, 'styles')));
app.use('/metadata', express.static(path.join(__dirname, 'metadata')));

// Router to handle incoming modelId
// app.get('/:type', async (req, res) => {
//   const queryName = req.query.q; // Fetch the 'q' parameter
//   const modelType = req.params.type; // "pointcloud" or "mesh" or "relight"


//   let apiUrl = '';
//   console.log(modelType)

//   // Set the API URL based on the modelType
//   if (modelType === 'pointcloud') {
//     apiUrl = `https://diana.dh.gu.se/api/etruscantombs/objectpointcloud/?id=${queryName}`;
//   } else if (modelType === 'mesh') {
//     apiUrl = `https://saintsophia.dh.gu.se/api/inscriptions/geojson/panel/?title=${queryName}`;
//   } 
//   else if (modelType === 'relight') {
//     apiUrl = `https://saintsophia.dh.gu.se/api/inscriptions/geojson/panel/?title=${queryName}`; //to fix
//   }
//   else if (modelType === 'iiif') {
//     apiUrl = `https://saintsophia.dh.gu.se/api/inscriptions/geojson/panel/?title=${queryName}`; //to fix
//   }
//   else {
//     res.status(400).send('Invalid model type');
//     return;
//   }

//   try {
//     const apiResponse = await axios.get(apiUrl);

//     if (apiResponse.data.features && apiResponse.data.features.length > 0) {
  
//       const modelData = apiResponse.data.features;
//       console.log(modelData.properties.attached_photograph.iiif_file)

//     fs.readFile(path.join(__dirname, modelType, `${modelType}.html`), 'utf8', (err, data) => {
//       if (err) {
//         console.error('Error reading the file:', err);
//         res.status(500).send('Internal Server Error');
//         return;
//       }

//       // Replacing placeholders with actual data fetched from API
//       let modifiedData = data;
//       if (modelType === 'pointcloud') {
//         modifiedData = modifiedData.replace(/PLACEHOLDER_URL_PUBLIC/g, 'https://data.dh.gu.se/saintsophia/pointcloud/cloud.js');
//       }
//       else if (modelType === 'mesh') {
//         modifiedData = modifiedData.replace(/PLACEHOLDER_MESH/g, JSON.stringify(modelData?.[0]?.properties?.attached_3Dmesh?.[0]?.url || ''));
//         modifiedData = modifiedData.replace(/PLACEHOLDER_STARTPHI/g, JSON.stringify(45.0));
//         modifiedData = modifiedData.replace(/PLACEHOLDER_STARTTHETA/g, JSON.stringify(20.0));
//         modifiedData = modifiedData.replace(/PLACEHOLDER_STARTDISTANCE/g, JSON.stringify(10.5));
//         modifiedData = modifiedData.replace(/PLACEHOLDER_STARTPAN/g, JSON.stringify(0.0,0.0,0.0));
//         modifiedData = modifiedData.replace(/PLACEHOLDER_MINMAXPHI/g, JSON.stringify(-180.0,180.0));
//         modifiedData = modifiedData.replace(/PLACEHOLDER_MINMAXTHETA/g, JSON.stringify(-180.0,180.0));
//         modifiedData = modifiedData.replace(/PLACEHOLDER_TRACKBALLSTART/g, JSON.stringify(45.0,20.0,0.0,0.0,0.0,1.5));
//       }
//       else if (modelType === 'relight') {
//         modifiedData = modifiedData.replace(/PLACEHOLDER_RTI/g, JSON.stringify(modelData?.[0]?.properties?.attached_RTI?.[0]?.url || ''));
//       }
//       else if (modelType === 'iiif') {
//         console.log('Request received for iiif.html with query:');

//       }
//       res.send(modifiedData);
//     });
//   }
//   else {
//     console.error('No results found in API response.');
//     res.status(404).send('Not Found');
//     return;
//     }
//   } catch (error) {
//     console.error('Error fetching data from API:', error);
//     res.status(500).send('Internal Server Error');
//   }
// });

app.get('/', (req, res) => {
  const queryName = req.query.q || 'default';

  fs.readFile(path.join(__dirname, 'index.html'), 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading the file:', err);
      return res.status(500).send('Internal Server Error');
    }
    
    let modifiedData = data
      .replace(/PLACEHOLDER_IIIF/g, queryName)
      .replace(/PLACEHOLDER_MESH/g, queryName)
      .replace(/PLACEHOLDER_RTI/g, queryName);
    res.send(modifiedData);
  });
});


// Fallback route to serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '/index.html'));
});

const PORT = 8094;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
