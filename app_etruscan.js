const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config({ path: './.env.local' });
const app = express();
const projectName = process.env.PROJECT || 'default';

/* To test: http://localhost:8098/viewer/?q=1 */

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
                                   .replace(/PLACEHOLDER_DESCRIPTION/g, metadata.description ?? 'Unknown')
                                   .replace(/PLACEHOLDER_POINTS_OPTIMIZED/g, metadata.points_optimized ?? 'Unknown')
                                   .replace(/PLACEHOLDER_POINTS_FULL/g, metadata.points_full_resolution ?? 'Unknown')

  
        res.send(modifiedHtml);
      });
    } catch (error) {
      console.error('Error fetching data from API:', error);
      res.status(500).send('Internal Server Error');
    }
  });
  

app.use('/viewer/modules/pointcloud', express.static(path.join(__dirname, 'viewer', 'modules', 'pointcloud')));
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
