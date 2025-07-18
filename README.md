# Multimodal Viewer
A Node.js application built with Express for visualizing and interacting with meshes, pointclouds, RTI, and IIIF images. It uses the <a href="https://3dhop.net">3DHOP</a>, <a href="https://github.com/potree/potree">Potree</a>, <a href="https://github.com/cnr-isti-vclab/openlime">OpenLime</a>, <a href="https://openseadragon.github.io">Openseadragon</a>, and <a href="https://annotorious.github.io">Annotorious</a> libraries, with additions, adaptations, and custom user interface by <a href="mailto:jonathan.westin@lir.gu.se">Jonathan Westin</a> and <a href="mailto:tristan.bridge@lir.gu.se">Tristan Bridge</a>.



## Table of Contents
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Installation](#installation)
- [Database and API Documentation](#database-and-api-documentation)

## Getting Started

npm install
define a .env.local variable with PROJECT=etruscan/shfa/sophia + npm start:  

PROJECT=sophia npm start  
PROJECT=shfa npm start  
PROJECT=etruscan npm start  
PROJECT=dubb npm start  

## Usage

Sample URLs for testing:  
Sophia: http://localhost:8095/viewer/?q=120-19c/orthophoto   
SHFA: http://localhost:8097/viewer/?q=Tanum_1_1-2019_06_13/orthophoto  
Etruscan: http://localhost:8094/viewer/?q=2683/image  

## Installation

npm install

## Deployment

Run corresponding deploy script at `/appl/js/multimodal-viewer` as our gridh user.<br> 
Log out of that user and run `sudo systemctl restart ...` with the PROJECT name + `-viewer`.
