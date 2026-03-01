import fs from 'fs';

const htmlPath = './public-ui/index.html';
let html = fs.readFileSync(htmlPath, 'utf8');

// Remove aria-hidden="true" from all modal headers/bodies
html = html.replace(/(<div\s+(?:[^>]*?\s+)?class="modal\s+fade"[^>]*)aria-hidden="true"([^>]*>)/g, '$1$2');

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('Removed aria-hidden from modals.');
