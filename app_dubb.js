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

app.get('/', (req, res) => {
  const queryName = req.query.q;
  
  if (queryName) {
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
  } else {
    const homePath = path.join(__dirname, 'projects', projectName, 'home.html');
    res.sendFile(homePath);
  }
});


app.get('/modules/pointcloud/pointcloud.html', async (req, res) => {
  const fullQuery = req.query.q;
  const queryName = fullQuery ? fullQuery.split('/')[0] : '';
  const apiUrl = `${config.panel}${queryName}`;
  try {
    const apiResponse = await axios.get(apiUrl);
    const position = apiResponse.data.results[0]?.camera_position;
    const direction = apiResponse.data.results[0]?.look_at;
    const urlPublic = apiResponse.data.results[0]?.url_public; 

    fs.readFile(path.join(__dirname, 'modules', 'pointcloud', 'pointcloud.html'), 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading the file:', err);
        return res.status(500).send('Internal Server Error');
      }
      let modifiedData = data;
      const positionStr = position ? position.join(',') : '';
      const directionStr = direction ? direction.join(',') : '';
      
      modifiedData = modifiedData.replace(/PLACEHOLDER_URL_PUBLIC/g, urlPublic || 'default-url');
      modifiedData = modifiedData.replace(/'PLACEHOLDER_POSITION'/g, `[${positionStr}]`);
      modifiedData = modifiedData.replace(/'PLACEHOLDER_DIRECTION'/g, `[${directionStr}]`);
      modifiedData = modifiedData.replace(/'PLACEHOLDER_DISPLAY_ANNOTATIONS'/g, config.displayAnnotations);
      res.send(modifiedData);
    });
  } catch (error) {
    console.error('Error fetching data from API:', error);
    res.status(500).send('Internal Server Error');
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

const PORT = 8096;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
