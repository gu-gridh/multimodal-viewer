const express = require('express');
const axios = require('axios');
const sharp = require('sharp');

function imageUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'img.dh.gu.se' || url.port || url.username || url.password || url.search || url.hash) {
    throw new Error('Unsupported image server.');
  }
  return url.href.replace(/\/info\.json\/?$/, '').replace(/\/$/, '');
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
      const body = req.body;
      const service = imageUrl(body.service);
      const imageSize = await get(`${service}/info.json`);
      if (!(imageSize.width > 0 && imageSize.height > 0)) throw new Error('Invalid IIIF image dimensions.');
      const region = getRegion(body.viewport, imageSize.width, imageSize.height);
      const scale = exportScale(body, region, imageSize);
      const width = Math.max(1, Math.floor(region.width * scale));
      const height = Math.max(1, Math.floor(region.height * scale));
      const size = `!${width},${height}`;
      const requestedScale = Math.min(width / region.width, height / region.height);
      const regionPath = [region.left, region.top, region.width, region.height].join(',');
      const input = Buffer.from(await get(`${service}/${regionPath}/${size}/0/default.jpg`, 'arraybuffer'));
      const actual = await sharp(input, { limitInputPixels: false }).metadata();
      if (actual.width < Math.round(region.width * requestedScale) - 1 || actual.height < Math.round(region.height * requestedScale) - 1) {
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
    typeof body.flipped !== 'boolean' || body.crop !== true ||
    (body.focus !== undefined && typeof body.focus !== 'boolean') ||
    !Array.isArray(body.shapes) || !body.shapes.every(shape =>
      shape && Array.isArray(shape.points) && shape.points.length && shape.points.every(validPoint) &&
      (shape.dotted === undefined || typeof shape.dotted === 'boolean') &&
      typeof shape.color === 'string' && /^(#[\da-f]{3,8}|[a-z]+|rgba?\([\d.,%\s]+\))$/i.test(shape.color))) {
    throw new Error('Invalid image export request.');
  }
}

function exportScale(body, region, imageSize) {
  const maxSide = { 1: 3000, 0.5: 2000, 0.25: 1000 }[body.scale];
  const maxWidth = Math.min(maxSide, imageSize.maxWidth || Infinity);
  const maxHeight = Math.min(maxSide, imageSize.maxHeight || imageSize.maxWidth || Infinity);
  return Math.min(body.scale, maxWidth / region.width, maxHeight / region.height,
    Math.sqrt((imageSize.maxArea || Infinity) / (region.width * region.height)));
}

async function renderRegion(input, imageSize, region, body) {
  let image = sharp(input, { limitInputPixels: false });
  const { width, height } = await image.metadata();
  if (body.focus) {
    const tint = [0.2126, 0.7152, 0.0722].map(value => value * 0.45);
    image = image.recomb([tint, tint, tint]);
  }
  const project = point => `${(point.x * imageSize.width - region.left) * width / region.width},${(point.y * imageSize.height - region.top) * height / region.height}`;
  const [start, end] = body.viewport;
  const pixelsPerScreenPixel = Math.hypot(
    (end.x - start.x) * imageSize.width * width / region.width,
    (end.y - start.y) * imageSize.height * height / region.height
  ) / body.viewWidth;
  const strokeWidth = Math.max(1.5, 1.5 * pixelsPerScreenPixel);
  const shapes = body.shapes.map(shape => {
    const stroke = `stroke="${shape.color}"${shape.dotted ? ` stroke-dasharray="${strokeWidth / 1.5}" stroke-linecap="butt"` : ''}`;
    if (shape.points.length === 1) {
      const [cx, cy] = project(shape.points[0]).split(',');
      return `<circle cx="${cx}" cy="${cy}" r="${strokeWidth * 2}" ${stroke}/>`;
    }
    const tag = shape.closed ? 'polygon' : 'polyline';
    return `<${tag} points="${shape.points.map(project).join(' ')}" ${stroke}/>`;
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

module.exports = { registerIIIFDownload };
