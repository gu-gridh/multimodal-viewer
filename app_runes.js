const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: './.env.local' });

const app = express();
const projectName = process.env.PROJECT || 'runes';
const projectPath = path.join(__dirname, 'viewer', 'projects', projectName);
const port = 8099;

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
