const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const dotenv = require('dotenv');

//load environment variables from .env.local
dotenv.config({ path: './.env.local' });

const projectName = process.env.PROJECT || 'default';

//path to the configuration file for the specified project
const configPath = path.join(__dirname, 'projects', projectName, 'config.json');

let config;
try {
    config = require(configPath);
} catch (error) {
    console.error(`Failed to load config for project ${projectName}:`, error);
    process.exit(1);
}

//determine which app file to run based on the config
const appToRun = config.appFile || 'app.js';

console.log(`Using application file: ${appToRun}`);

const serverProcess = exec(`node ${appToRun}`);

serverProcess.stdout.on('data', (data) => {
    console.log(`${data}`);
});
