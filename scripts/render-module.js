const fs = require('fs').promises;
const path = require('path');

async function renderModule(res, module, config) {
  const html = await fs.readFile(path.join(__dirname, '../viewer/modules', module, `${module}.html`), 'utf8');
  const json = JSON.stringify(config).replace(/</g, '\\u003c');
  res.send(html.replace("'PLACEHOLDER_VIEWER_CONFIG'", () => json));
}

module.exports = { renderModule };
