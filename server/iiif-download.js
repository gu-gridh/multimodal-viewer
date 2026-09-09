const express = require('express');
const axios = require('axios');
const sharp = require('sharp');

function imageUrl(value, host, allowQuery = false) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== host || url.port || url.username || url.password || (!allowQuery && url.search) || url.hash) {
    throw new Error('Unsupported image server.');
  }
  return url.href.replace(/\/info\.json\/?$/, '').replace(/\/$/, '');
}

function sourcesForImage(image, scale, crop = false) {
  if (!crop && scale === 1 && image.zenodo_url) {
    return { zenodoUrl: imageUrl(image.zenodo_url, 'zenodo.org', true) };
  }
  if (!image.iiif_file) throw new Error('No IIIF download image is available.');
  return { service: imageUrl(image.iiif_file, 'img.dh.gu.se') };
}

async function resolveSource(body, project, signal) {
  if (project !== 'munch') return { service: imageUrl(body.service, 'img.dh.gu.se') };
  const [panel, type] = String(body.query || '').split('/');
  if (!panel) throw new Error('Missing painting.');
  const { data } = await axios.get('https://munch.dh.gu.se/api/painting-images/', {
    params: { panel }, maxRedirects: 0, signal
  });
  const images = data.results || [];
  const image = type === 'topography'
    ? images.filter(item => item.image_type === 'topographical').sort((a, b) => a.sort_order - b.sort_order)[body.page]
    : images.find(item => item.image_type === 'orthophoto' && /\/[^/]*Medium[^/]*$/i.test(item.file));
  if (!image) throw new Error('The requested image is not available.');
  return sourcesForImage(image, body.scale, body.crop);
}

function registerIIIFDownload(app, project) {
  app.post('/viewer/modules/iiif/download-region', express.json({ limit: '20mb' }), async (req, res) => {
    const controller = new AbortController();
    const signal = controller.signal;
    const get = async (url, responseType = 'json') => (await axios.get(url, {
      responseType, signal, maxRedirects: 0
    })).data;
    res.on('close', () => { if (!res.writableFinished) controller.abort(); });
    try {
      validateExport(req.body);
      const source = await resolveSource(req.body, project, signal);
      if (req.body.sourceOnly || source.zenodoUrl) return res.json({ zenodoUrl: source.zenodoUrl || null });
      const body = req.body.crop ? req.body : {
        ...req.body,
        viewport: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
        rotation: 0, flipped: false
      };
      const imageSize = await get(`${source.service}/info.json`);
      if (!(imageSize.width > 0 && imageSize.height > 0)) throw new Error('Invalid IIIF image dimensions.');
      const region = getRegion(body.viewport, imageSize.width, imageSize.height);
      const scale = exportScale(body, region.height);
      const size = scale < body.scale ? `,${Math.round(region.height * scale)}`
        : body.scale === 1 ? 'max' : `pct:${body.scale * 100}`;
      const regionPath = body.crop ? [region.left, region.top, region.width, region.height].join(',') : 'full';
      const input = Buffer.from(await get(`${source.service}/${regionPath}/${size}/0/default.jpg`, 'arraybuffer'));
      const actual = await sharp(input, { limitInputPixels: false }).metadata();
      if (actual.width < Math.round(region.width * scale) - 1 || actual.height < Math.round(region.height * scale) - 1) {
        throw new Error(`The IIIF server limited this image to ${actual.width} × ${actual.height} pixels.`);
      }
      const output = await renderRegion(input, imageSize, region, body);
      if (signal.aborted) { output.destroy(); return; }
      const quality = { 1: 'high', 0.5: 'medium', 0.25: 'low' }[body.scale];
      res.type('jpg');
      res.setHeader('Content-Disposition', `attachment; filename="${project}_${quality}.jpg"`);
      output.on('error', error => {
        console.error('IIIF export failed:', error.message);
        if (res.headersSent) res.destroy(error);
        else res.status(500).json({ error: 'Could not render the image export.' });
      });
      res.on('close', () => output.destroy());
      output.pipe(res);
    } catch (error) {
      if (signal.aborted) return;
      console.error('IIIF export failed:', error.message);
      res.status(400).json({ error: error.response ? 'The image service could not provide this region.' : error.message });
    }
  });
}

function getRegion(viewport, width, height) {
  const xs = viewport.map(point => point.x * width);
  const ys = viewport.map(point => point.y * height);
  const left = Math.max(0, Math.floor(Math.min(...xs)));
  const top = Math.max(0, Math.floor(Math.min(...ys)));
  const right = Math.min(width, Math.ceil(Math.max(...xs)));
  const bottom = Math.min(height, Math.ceil(Math.max(...ys)));
  if (right <= left || bottom <= top) throw new Error('Move the image into view before downloading.');
  return { left, top, width: right - left, height: bottom - top };
}

function validateExport(body) {
  const validPoint = point => point && Number.isFinite(point.x) && Number.isFinite(point.y);
  if (!body || !Array.isArray(body.viewport) || body.viewport.length !== 4 || !body.viewport.every(validPoint) ||
    ![1, 0.5, 0.25].includes(body.scale) || !Number.isFinite(body.rotation) ||
    !Number.isFinite(body.viewWidth) || body.viewWidth <= 0 ||
    typeof body.flipped !== 'boolean' || typeof body.crop !== 'boolean' ||
    !Array.isArray(body.shapes) || !body.shapes.every(shape =>
      shape && Array.isArray(shape.points) && shape.points.length && shape.points.every(validPoint) &&
      typeof shape.color === 'string' && /^(#[\da-f]{3,8}|[a-z]+|rgba?\([\d.,%\s]+\))$/i.test(shape.color))) {
    throw new Error('Invalid image export request.');
  }
}

function exportScale(body, height) {
  const maxHeight = body.crop
    ? 6000 * body.scale
    : { 0.5: 10000, 0.25: 4000 }[body.scale] || Infinity;
  return Math.min(body.scale, maxHeight / height);
}

async function renderRegion(input, imageSize, region, body) {
  let image = sharp(input, { limitInputPixels: false });
  const { width, height } = await image.metadata();
  const project = point => `${(point.x * imageSize.width - region.left) * width / region.width},${(point.y * imageSize.height - region.top) * height / region.height}`;
  const [start, end] = body.viewport;
  const pixelsPerScreenPixel = Math.hypot(
    (end.x - start.x) * imageSize.width * width / region.width,
    (end.y - start.y) * imageSize.height * height / region.height
  ) / body.viewWidth;
  const strokeWidth = Math.max(1.5, 1.5 * pixelsPerScreenPixel);
  const shapes = body.shapes.map(shape => {
    if (shape.points.length === 1) {
      const [cx, cy] = project(shape.points[0]).split(',');
      return `<circle cx="${cx}" cy="${cy}" r="${strokeWidth * 2}" stroke="${shape.color}"/>`;
    }
    const tag = shape.closed ? 'polygon' : 'polyline';
    return `<${tag} points="${shape.points.map(project).join(' ')}" stroke="${shape.color}"/>`;
  }).join('');
  const svg = content => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${content}</svg>`);
  const rotation = ((body.rotation % 360) + 360) % 360;
  image = image.ensureAlpha().composite([
    { input: svg(`<g fill="none" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round">${shapes}</g>`), limitInputPixels: false },
    { input: svg(`<polygon points="${body.viewport.map(project).join(' ')}" fill="white"/>`), blend: 'dest-in', limitInputPixels: false },
    ...(!rotation && !body.flipped ? [{ input: svg('<rect width="100%" height="100%" fill="white"/>'), blend: 'dest-over', limitInputPixels: false }] : [])
  ]);
  if (rotation || body.flipped) {
    const composed = await image.raw().toBuffer({ resolveWithObject: true });
    image = sharp(composed.data, { raw: composed.info, limitInputPixels: false })
      .rotate(body.flipped ? -rotation : rotation, { background: '#00000000' });
    if (body.flipped) image = image.flop();
    const rotated = await image.raw().toBuffer({ resolveWithObject: true });
    image = sharp(rotated.data, { raw: rotated.info, limitInputPixels: false })
      .trim({ background: '#00000000', threshold: 0 });
  }
  return image.flatten({ background: '#ffffff' }).jpeg({ quality: 95, chromaSubsampling: '4:4:4' });
}

module.exports = { registerIIIFDownload, resolveSource, sourcesForImage, getRegion, validateExport, renderRegion };
