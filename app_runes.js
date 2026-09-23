const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config({ path: './.env.local' });

const app = express();
const projectName = process.env.PROJECT || 'runes';
const projectPath = path.join(__dirname, 'viewer', 'projects', projectName);
const port = 8099;

app.get('/viewer/modules/texturedmesh/texturedmesh.html', async (req, res) => {
  const queryName = req.query.q?.split('/')[0] || '1';

  try {
    const apiUrl = `https://runes.dh.gu.se/api/metadata/${encodeURIComponent(queryName)}/`;
    const apiResponse = await axios.get(apiUrl);
    const texturedMeshData = apiResponse.data;

    if (!texturedMeshData) {
      return res.status(404).send('No textured mesh');
    }

    const templatePath = path.join(__dirname, 'viewer', 'modules', 'texturedmesh', 'texturedmesh.html');
    fs.readFile(templatePath, 'utf8', (error, data) => {
      if (error) {
        console.error(error);
        return res.status(500).send('Internal Server Error');
      }

      const title = texturedMeshData.name || 'Textured mesh';
      res.send(data
        .replace(/'PLACEHOLDER_TEXTUREDMESH_URL'/g, JSON.stringify(texturedMeshData.mesh_url_public))
        .replace(/'PLACEHOLDER_TEXTUREDMESH_TITLE'/g, JSON.stringify(title))
        .replace(/'PLACEHOLDER_TEXTUREDMESH_DOWNLOAD_URL'/g, JSON.stringify(texturedMeshData.mesh_url_download || ''))
        .replace(/'PLACEHOLDER_CAMERA_POSITION'/g, JSON.stringify(texturedMeshData.camera_position || null))
        .replace(/'PLACEHOLDER_LOOK_AT'/g, JSON.stringify(texturedMeshData.look_at || null)));
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/viewer/modules/panorama/panorama.html', (req, res) => {
  const templatePath = path.join(__dirname, 'viewer', 'modules', 'panorama', 'panorama.html');
  fs.readFile(templatePath, 'utf8', (error, data) => {
    if (error) {
      console.error(error);
      return res.status(500).send('Internal Server Error');
    }

    const panoramaConfig = {
      panoramas: [
        { id: 'panorama-1', title: 'Panorama 1', startPos: [0, 0, 100], urlPublic: 'https://data.dh.gu.se/runes/panorama/og_189/' },
        { id: 'panorama-2', title: 'Panorama 2', startPos: [90, -10, 70], urlPublic: 'https://data.dh.gu.se/runes/panorama/og_137/' }
      ]
    };
    res.send(data.replace(/'PLACEHOLDER_PANORAMA_CONFIG'/g, JSON.stringify(panoramaConfig)));
  });
});

app.get('/viewer/projects/runes/metadata/metadata.html', async (req, res) => {
  try {
    const apiResponse = await axios.get('https://diana.dh.gu.se/api/etruscantombs/image/2870/?depth=2');
    const templatePath = path.join(projectPath, 'metadata', 'metadata.html');
    const template = await fs.promises.readFile(templatePath, 'utf8');
    const iiifUrl = `${apiResponse.data.iiif_file}/info.json`;

    res.send(template.replace(/'PLACEHOLDER_IIIF_IMAGE_URL'/g, JSON.stringify(iiifUrl)));
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/viewer/modules/iiif/iiif.html', async (req, res) => {
    const placeId = req.query.q?.split('/')[0];

    if (!placeId) {
        return res.status(400).send('Place ID is required');
    }

    try {
        const apiResponse = await axios.get(
            `https://runes.dh.gu.se/api/image/?place=${encodeURIComponent(placeId)}`
        );

        console.log('IMAGE API RESPONSE:', apiResponse.data);

        const images = Array.isArray(apiResponse.data)
            ? apiResponse.data
            : apiResponse.data.results || [];

        const iiifUrls = images
            .filter(image => image.iiif_file)
            .map(image => `${image.iiif_file}/info.json`);

        if (iiifUrls.length === 0) {
            return res.status(404).send('No IIIF images found');
        }

        const templatePath = path.join(
            __dirname,
            'viewer',
            'modules',
            'iiif',
            'iiif.html'
        );

        const template = await fs.promises.readFile(
            templatePath,
            'utf8'
        );

        const result = template.replace(
            /'PLACEHOLDER_IIIF_IMAGE_URL'/g,
            JSON.stringify(iiifUrls)
        );

        res.send(result);

    } catch (error) {
        console.error('Error loading IIIF image:', error.message);
        console.error(error.response?.data);

        res.status(500).send('Internal Server Error');
    }
});

//get runes venn data
app.get('/api/runes/venn', async (req, res) => {
    try {
        const apiResponse = await axios.get(
            'https://runes.dh.gu.se/api/venn/'
        );
        res.json(apiResponse.data);

    } catch (error) {
        res.status(500).json({
            error: 'Could not load rune Venn data'
        });
    }
});

//get runes metadata
app.get('/api/runes/metadata/:id', async (req, res) => {
    try {
        const response = await axios.get(
            `https://runes.dh.gu.se/api/metadata/${encodeURIComponent(req.params.id)}/`
        );

        res.json(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Could not load rune metadata'
        });
    }
});

app.use('/viewer', express.static(path.join(__dirname, 'viewer')));

app.get(['/viewer', '/viewer/'], (req, res) => {
  res.sendFile(path.join(projectPath, 'index.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(projectPath, 'index.html'));
});

app.listen(port, () => {
  console.log(`Runes viewer is running on port ${port}`);
});
