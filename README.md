# Multimodal Viewer
A Node.js application built with Express for visualizing and interacting with meshes, pointclouds, RTI, Panorama, and IIIF images. It uses the <a href="https://3dhop.net">3DHOP</a>, <a href="https://github.com/potree/potree">Potree</a>, <a href="https://github.com/cnr-isti-vclab/openlime">OpenLime</a>, <a href="https://openseadragon.github.io">Openseadragon</a>, <a href="https://github.com/annotorious/annotorious">Annotorious</a>, and <a href="https://github.com/mpetroff/pannellum">Pannellum</a> libraries, with additions, adaptations, and custom user interface by <a href="mailto:jonathan.westin@lir.gu.se">Jonathan Westin</a> and <a href="mailto:tristan.bridge@lir.gu.se">Tristan Bridge</a>.

## Getting Started

```nvm use 22``` <br>
```npm install``` <br>

Define a .env.local variable with PROJECT=etruscan/shfa/sophia + npm start: <br>
PROJECT=sophia npm start  
PROJECT=shfa npm start  
PROJECT=etruscan npm start  
PROJECT=dubb npm start  
PROJECT=runes npm start

## Usage

Sample URLs for testing:  
Sophia: http://localhost:8095/viewer/?q=120-19c/orthophoto <br>
SHFA: http://localhost:8097/viewer/?q=Tanum_1_1-2019_06_13/orthophoto <br>
Etruscan: http://localhost:8094/viewer/?q=2683/image  <br>
Munch: http://localhost:8098/viewer/?q=solen/photo <br>
Runes: http://localhost:8099/viewer/?q=5 WIP <br>
