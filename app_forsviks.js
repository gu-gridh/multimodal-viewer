const express = require('express');
const path = require('path');
const { renderModule } = require('./scripts/render-module');
const axios = require('axios');
require('dotenv').config({ path: './.env.local' });
const { articleInfo } = require('./viewer/projects/forsviks/config');
const app = express();
app.use((req, res, next) => {
  if (typeof req.query.q === 'string' && req.query.q.endsWith('/')) req.query.q += 'image';
  next();
});
app.use(require('./viewer-query'));

function articleId(req) {
  return String(req.query.id || req.query.q || '1').split('/')[0];
}

async function getArticle(req) {
  const { data } = await axios.get(articleInfo, { params: { id: articleId(req) } });
  return data.results?.[0];
}

function absoluteMediaUrl(url) {
  return url ? new URL(url, articleInfo).href : '';
}

app.get('/api/article-info', async (req, res, next) => {
  try {
    const article = await getArticle(req);
    if (!article) return res.status(404).send('Article not found');
    res.json(article);
  } catch (error) { next(error); }
});

app.get('/viewer/modules/iiif/iiif.html', async (req, res, next) => {
  try {
    const media = (await getArticle(req))?.advanced_media;
    if (!media?.iiif_url) return res.status(404).send('No IIIF image found');
    await renderModule(res, 'iiif', {
      downloads: { directUrl: absoluteMediaUrl(media.download_url) },
      tileSources: [`${absoluteMediaUrl(media.iiif_url).replace(/\/$/, '')}/info.json`],
      initialPage: 0,
      preserveViewport: true,
      sequenceEnabled: false
    });
  } catch (error) { next(error); }
});

app.get('/viewer/modules/pointcloud/pointcloud.html', async (req, res, next) => {
  try {
    const article = await getArticle(req);
    const media = article?.advanced_media;
    if (!media?.url) return res.status(404).send('No pointcloud found');
    const response = {
      send: html => res.send(html.replace('</head>',
        `<script>
        const menuStyle = document.head.appendChild(document.createElement('style'));
        menuStyle.textContent = 'html .potree_menu_toggle { display: none; }';
        window.setPointcloudExpanded = expanded => menuStyle.sheet.disabled = Boolean(expanded);
        window.setPointcloudExpanded(window.parent.document.getElementById('main-content')?.classList.contains('panel-hidden'));
      </script></head>`))
    };
    await renderModule(response, 'pointcloud', {
      pointCloudUrl: absoluteMediaUrl(media.url),
      cameraPosition: media.camera_position || [],
      lookAt: media.look_at || [],
      annotationsUrl: ''
    });
  } catch (error) { next(error); }
});

app.get('/viewer/modules/texturedmesh/texturedmesh.html', async (req, res, next) => {
  try {
    const mesh = (await getArticle(req))?.advanced_media;
    if (!mesh?.url) return res.status(404).send('No textured model found');
    await renderModule(res, 'texturedmesh', {
      texturedMeshUrl: absoluteMediaUrl(mesh.url),
      title: mesh.title || 'Mesh',
      downloadUrl: absoluteMediaUrl(mesh.download_url),
      cameraPosition: mesh.camera_position || null,
      lookAt: mesh.look_at || null
    });
  } catch (error) { next(error); }
});

app.get('/viewer/modules/panorama/panorama.html', async (req, res, next) => {
  try {
    const media = (await getArticle(req))?.advanced_media;
    if (!media?.url) return res.status(404).send('No panorama found');
    const panorama = {
      id: String(media.id),
      title: media.title || 'Panorama',
      urlPublic: absoluteMediaUrl(media.url),
      downloadUrl: absoluteMediaUrl(media.download_url),
      startPos: media.start_position || [0, 0, 100],
      northOffset: media.north_offset == null ? null : Number(media.north_offset)
    };
    await renderModule(res, 'panorama', {
      panoramas: [panorama],
      initialScene: panorama.id
    });
  } catch (error) { next(error); }
});

app.get(['/', '/viewer', '/viewer/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'viewer/projects/forsviks/index.html'));
});
app.use('/viewer', express.static(path.join(__dirname, 'viewer')));
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).send('Unable to load viewer data');
});

const PORT = process.env.PORT || 8100;
app.listen(PORT, () => console.log(`Forsviks is running on port ${PORT}`));
