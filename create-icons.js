const fs = require('fs');
const path = require('path');

// Simple 16x16 ICO file for connected status (green circle with checkmark)
const connectedIconData = Buffer.from(
  'AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAQAABILAAASCwAAAAAA' +
  'AAAAAAD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A' +
  '////AP///wD///8A////AP///wD///8A////AP///wCIiIggiIiIcIiIiKCIiIigiIiIcIiIiCD/' +
  '//8A////AP///wD///8A////AP///wD///8AiIiIIIiIiKCIiIj/iIiI/4iIiP+IiIj/iIiI/4iI' +
  'iKCIiIgg////AP///wD///8A////AIiIiCCIiIiwiIiI/4iIiP+IiIj/iIiI/4iIiP+IiIj/iIiI' +
  '/4iIiP+IiIiwiIiIIP///wD///8AiIiIIIiIiOCIiIj/iIiI/4iIiP+IiIj/iIiI/4iIiP+IiIj/' +
  'iIiI/4iIiP+IiIj/iIiI4IiIiCD///8AiIiIcIiIiP+IiIj/iIiI/4iIiP+IiIj/iIiI/4iIiP+I' +
  'iIj/iIiI/4iIiP+IiIj/iIiI/4iIiHD///8AiIiIoIiIiP+IiIj/iIiI/4iIiP+IiIj/iIiI/4iI' +
  'iP+IiIj/iIiI/4iIiP+IiIj/iIiI/4iIiKD///8AiIiIoIiIiP+IiIj/iIiI/4iIiP+IiIj/iIiI' +
  '/4iIiP+IiIj/iIiI/4iIiP+IiIj/iIiI/4iIiKD///8AiIiIcIiIiP+IiIj/iIiI/4iIiP+IiIj/' +
  'iIiI/4iIiP+IiIj/iIiI/4iIiP+IiIj/iIiI/4iIiHD///8AiIiIIIiIiOCIiIj/iIiI/4iIiP+I' +
  'iIj/iIiI/4iIiP+IiIj/iIiI/4iIiP+IiIj/iIiI4IiIiCD///8A////AIiIiCCIiIiwiIiI/4iI' +
  'iP+IiIj/iIiI/4iIiP+IiIj/iIiI/4iIiP+IiIiwiIiIIP///wD///8A////AP///wCIiIggiIiI' +
  'oIiIiP+IiIj/iIiI/4iIiP+IiIj/iIiI/4iIiKCIiIgg////AP///wD///8A////AP///wD///8A' +
  '////AIiIiCCIiIhwiIiIoIiIiKCIiIhwiIiIIP///wD///8A////AP///wD///8A////AP///wD/' +
  '//8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP//' +
  '/wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////' +
  'AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A' +
  '////AP///wD///8AAA==',
  'base64'
);

// Simple 16x16 ICO file for disconnected status (red circle with X)
const disconnectedIconData = Buffer.from(
  'AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAQAABILAAASCwAAAAAA' +
  'AAAAAAD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A' +
  '////AP///wD///8A////AP///wD///8A////AP///wCIiIggiIiIcIiIiKCIiIigiIiIcIiIiCD/' +
  '//8A////AP///wD///8A////AP///wD///8AiIiIIIiIiKCIiIj/iIiI/4iIiP+IiIj/iIiI/4iI' +
  'iKCIiIgg////AP///wD///8A////AIiIiCCIiIiwiIiI/4iIiP+IiIj/iIiI/4iIiP+IiIj/iIiI' +
  '/4iIiP+IiIiwiIiIIP///wD///8AiIiIIIiIiOCIiIj/iIiI/4iIiP+IiIj/iIiI/4iIiP+IiIj/' +
  'iIiI/4iIiP+IiIj/iIiI4IiIiCD///8AiIiIcIiIiP+IiIj/iIiI/4iIiP+IiIj/iIiI/4iIiP+I' +
  'iIj/iIiI/4iIiP+IiIj/iIiI/4iIiHD///8AiIiIoIiIiP+IiIj/iIiI/4iIiP+IiIj/iIiI/4iI' +
  'iP+IiIj/iIiI/4iIiP+IiIj/iIiI/4iIiKD///8AiIiIoIiIiP+IiIj/iIiI/4iIiP+IiIj/iIiI' +
  '/4iIiP+IiIj/iIiI/4iIiP+IiIj/iIiI/4iIiKD///8AiIiIcIiIiP+IiIj/iIiI/4iIiP+IiIj/' +
  'iIiI/4iIiP+IiIj/iIiI/4iIiP+IiIj/iIiI/4iIiHD///8AiIiIIIiIiOCIiIj/iIiI/4iIiP+I' +
  'iIj/iIiI/4iIiP+IiIj/iIiI/4iIiP+IiIj/iIiI4IiIiCD///8A////AIiIiCCIiIiwiIiI/4iI' +
  'iP+IiIj/iIiI/4iIiP+IiIj/iIiI/4iIiP+IiIiwiIiIIP///wD///8A////AP///wCIiIggiIiI' +
  'oIiIiP+IiIj/iIiI/4iIiP+IiIj/iIiI/4iIiKCIiIgg////AP///wD///8A////AP///wD///8A' +
  '////AIiIiCCIiIhwiIiIoIiIiKCIiIhwiIiIIP///wD///8A////AP///wD///8A////AP///wD/' +
  '//8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP//' +
  '/wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////' +
  'AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A' +
  '////AP///wD///8AAA==',
  'base64'
);

// Write the icon files
fs.writeFileSync(path.join(__dirname, 'app', 'connected.ico'), connectedIconData);
fs.writeFileSync(path.join(__dirname, 'app', 'disconnected.ico'), disconnectedIconData);

console.log('Icon files created successfully!');