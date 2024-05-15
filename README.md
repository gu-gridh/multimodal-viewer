# Multimodal Viewer
A Node.js application built with Express for visualizing and interacting with meshes, pointclouds, and IIIF images. It uses the 3DHOP, Potree, Relight, OpenLime, and Openseadragon libraries.

## Table of Contents
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Installation](#installation)

## Getting Started

npm install
define a .env.local variable with PROJECT=etruscan/shfa/sophia + npm start:  

PROJECT=sophia npm start  
PROJECT=shfa npm start  
PROJECT=etruscan npm start  

## Usage

Sample URLs for testing:  
http://localhost:8095/?q=118-02/orthophoto  
http://localhost:8095/?q=120-20/orthophoto  

## Installation

npm install

## Deployment 

If already running, identify the topmost process attached to the viewer and kill the id 
Create a screen with screen -S multimodalviewer   
Cd to the correct location and run the deploy script ./deploy-... & 
Deattach from the current screen 
