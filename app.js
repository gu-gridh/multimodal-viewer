const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const app = express();

/*
Sample URLs for testing:
http://localhost:8094/ directs to the Home view
http://localhost:8094/pointcloud/?q=2 directs to the Pointcloud Viewer where q is the id of the pointcloud
http://localhost:8094/mesh/?q=1 directs to the 3dhop Viewer
http://localhost:8094/relight/?q=1 directs to the Relight Viewer
http://localhost:8094/iiif/?q=125560 directs to the IIIF Viewer
*/

//for index.html paths like: /relight/relight.html?q=1
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
      apiUrl = `https://diana.dh.gu.se/api/etruscantombs/object3dhop/?id=${queryName}`;
    } else if (type === 'relight') {
      apiUrl = `https://diana.dh.gu.se/api/etruscantombs/object3dhop/?id=${queryName}`; //to fix
    } else if (type === 'iiif') {
      apiUrl = `https://diana.dh.gu.se/api/shfa/image/?id=${queryName}`; //to fix
    } 
    else {
      return res.status(400).send('Invalid model type');
    }

    try {
      const apiResponse = await axios.get(apiUrl);
  
      if(apiResponse.data.results && apiResponse.data.results.length > 0) {
  
      const modelData = apiResponse.data.results[0];
  
      fs.readFile(path.join(__dirname, type, file), 'utf8', (err, data) => {
        if (err) {
          console.error('Error reading the file:', err);
          res.status(500).send('Internal Server Error');
          return;
        }
  
        // Replacing placeholders with actual data fetched from API
        let modifiedData = data;
        if (type === 'pointcloud') {
          modifiedData = modifiedData.replace(/PLACEHOLDER_TITLE/g, JSON.stringify(modelData.title || ''));
          modifiedData = modifiedData.replace(/PLACEHOLDER_CAMERA_POSITION/g, JSON.stringify(modelData.camera_position) || '[]');
          modifiedData = modifiedData.replace(/PLACEHOLDER_LOOK_AT/g, JSON.stringify(modelData.look_at) || '[]');
          modifiedData = modifiedData.replace(/PLACEHOLDER_URL_PUBLIC/g, modelData.url_public);
        }
        else if (type === 'mesh') {
          modifiedData = modifiedData.replace(/PLACEHOLDER_TITLE/g, JSON.stringify(modelData.title || ''));
          modifiedData = modifiedData.replace(/PLACEHOLDER_URL_PUBLIC/g, JSON.stringify(modelData.url_public || ''));
          modifiedData = modifiedData.replace(/PLACEHOLDER_STARTPHI/g, JSON.stringify(modelData.start_angle[0] || ''));
          modifiedData = modifiedData.replace(/PLACEHOLDER_STARTTHETA/g, JSON.stringify(modelData.start_angle[1] || ''));
          modifiedData = modifiedData.replace(/PLACEHOLDER_STARTDISTANCE/g, JSON.stringify(modelData.start_distance || ''));
          modifiedData = modifiedData.replace(/PLACEHOLDER_STARTPAN/g, JSON.stringify(modelData.start_pan || ''));
          modifiedData = modifiedData.replace(/PLACEHOLDER_MINMAXPHI/g, JSON.stringify(modelData.min_max_phi || ''));
          modifiedData = modifiedData.replace(/PLACEHOLDER_MINMAXTHETA/g, JSON.stringify(modelData.min_max_theta || ''));
          modifiedData = modifiedData.replace(/PLACEHOLDER_TRACKBALLSTART/g, JSON.stringify(modelData.trackball_start || ''));
        }
        else if (type === 'relight') {
          modifiedData = modifiedData.replace(/PLACEHOLDER_TITLE/g, JSON.stringify(modelData.title || ''));
        }
        else if (type === 'iiif') {
          modifiedData = modifiedData.replace(/PLACEHOLDER_TITLE/g, JSON.stringify(modelData.title || ''));
          modifiedData = modifiedData.replace(/'PLACEHOLDER_IIIF_IMAGE_URL'/g, `"${modelData.iiif_file}/info.json"`);
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
app.get('/:type', async (req, res) => {
  const queryName = req.query.q; // Fetch the 'q' parameter
  const modelType = req.params.type; // "pointcloud" or "mesh" or "relight"


  let apiUrl = '';
  console.log(modelType)

  // Set the API URL based on the modelType
  if (modelType === 'pointcloud') {
    apiUrl = `https://diana.dh.gu.se/api/etruscantombs/objectpointcloud/?id=${queryName}`;
  } else if (modelType === 'mesh') {
    apiUrl = `https://diana.dh.gu.se/api/etruscantombs/object3dhop/?id=${queryName}`;
  } 
  else if (modelType === 'relight') {
    apiUrl = `https://diana.dh.gu.se/api/etruscantombs/object3dhop/?id=${queryName}`; //to fix
  }
  else if (modelType === 'iiif') {
    apiUrl = `https://diana.dh.gu.se/api/shfa/image/?id=${queryName}`; //to fix
  }
  else {
    res.status(400).send('Invalid model type');
    return;
  }

  try {
    const apiResponse = await axios.get(apiUrl);

    if(apiResponse.data.results && apiResponse.data.results.length > 0) {

    const modelData = apiResponse.data.results[0];

    fs.readFile(path.join(__dirname, modelType, `${modelType}.html`), 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading the file:', err);
        res.status(500).send('Internal Server Error');
        return;
      }

      // Replacing placeholders with actual data fetched from API
      let modifiedData = data;
      if (modelType === 'pointcloud') {
        modifiedData = modifiedData.replace(/PLACEHOLDER_TITLE/g, JSON.stringify(modelData.title || ''));
        modifiedData = modifiedData.replace(/PLACEHOLDER_CAMERA_POSITION/g, JSON.stringify(modelData.camera_position) || '[]');
        modifiedData = modifiedData.replace(/PLACEHOLDER_LOOK_AT/g, JSON.stringify(modelData.look_at) || '[]');
        modifiedData = modifiedData.replace(/PLACEHOLDER_URL_PUBLIC/g, modelData.url_public);
      }
      else if (modelType === 'mesh') {
        modifiedData = modifiedData.replace(/PLACEHOLDER_TITLE/g, JSON.stringify(modelData.title || ''));
        modifiedData = modifiedData.replace(/PLACEHOLDER_URL_PUBLIC/g, JSON.stringify(modelData.url_public || ''));
        modifiedData = modifiedData.replace(/PLACEHOLDER_STARTPHI/g, JSON.stringify(modelData.start_angle[0] || ''));
        modifiedData = modifiedData.replace(/PLACEHOLDER_STARTTHETA/g, JSON.stringify(modelData.start_angle[1] || ''));
        modifiedData = modifiedData.replace(/PLACEHOLDER_STARTDISTANCE/g, JSON.stringify(modelData.start_distance || ''));
        modifiedData = modifiedData.replace(/PLACEHOLDER_STARTPAN/g, JSON.stringify(modelData.start_pan || ''));
        modifiedData = modifiedData.replace(/PLACEHOLDER_MINMAXPHI/g, JSON.stringify(modelData.min_max_phi || ''));
        modifiedData = modifiedData.replace(/PLACEHOLDER_MINMAXTHETA/g, JSON.stringify(modelData.min_max_theta || ''));
        modifiedData = modifiedData.replace(/PLACEHOLDER_TRACKBALLSTART/g, JSON.stringify(modelData.trackball_start || ''));
      }
      else if (modelType === 'relight') {
        modifiedData = modifiedData.replace(/PLACEHOLDER_TITLE/g, JSON.stringify(modelData.title || ''));
      }
      else if (modelType === 'iiif') {
        modifiedData = modifiedData.replace(/PLACEHOLDER_TITLE/g, JSON.stringify(modelData.title || ''));
        modifiedData = modifiedData.replace(/'PLACEHOLDER_IIIF_IMAGE_URL'/g, `"${modelData.iiif_file}/info.json"`);
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
});

// Fallback route to serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '/index.html'));
});

const PORT = 8094;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
