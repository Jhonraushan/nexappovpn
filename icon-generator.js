const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');
const toIco = require('to-ico');

async function createConnectedIcon() {
  // Create a new 32x32 image with transparent background (larger for better quality)
  const image = await new Jimp(32, 32, 0x00000000);
  
  // Draw green circle
  for (let x = 0; x < 32; x++) {
    for (let y = 0; y < 32; y++) {
      const distanceFromCenter = Math.sqrt(Math.pow(x - 16, 2) + Math.pow(y - 16, 2));
      if (distanceFromCenter <= 14) {
        // Green fill
        image.setPixelColor(Jimp.cssColorToHex('#4CAF50'), x, y);
        
        // Darker border
        if (distanceFromCenter > 12 && distanceFromCenter <= 14) {
          image.setPixelColor(Jimp.cssColorToHex('#388E3C'), x, y);
        }
      }
    }
  }
  
  // Draw checkmark (adjusted for 32x32)
  const checkPoints = [
    [12, 16], [13, 17], [14, 18], [15, 19], [16, 20],
    [17, 19], [18, 18], [19, 17], [20, 16], [21, 15], [22, 14], [23, 13]
  ];
  
  checkPoints.forEach(([x, y]) => {
    image.setPixelColor(Jimp.cssColorToHex('#FFFFFF'), x, y);
  });
  
  // Save as PNG first
  const pngPath = path.join(__dirname, 'app', 'connected.png');
  await image.writeAsync(pngPath);
  
  // Convert PNG to ICO using to-ico
  const pngBuffer = fs.readFileSync(pngPath);
  const icoBuffer = await toIco([pngBuffer], {
    sizes: [16, 24, 32, 48, 64],
    resize: true
  });
  
  fs.writeFileSync(path.join(__dirname, 'app', 'connected.ico'), icoBuffer);
  console.log('Connected icon created successfully');
}

async function createDisconnectedIcon() {
  // Create a new 32x32 image with transparent background
  const image = await new Jimp(32, 32, 0x00000000);
  
  // Draw red circle
  for (let x = 0; x < 32; x++) {
    for (let y = 0; y < 32; y++) {
      const distanceFromCenter = Math.sqrt(Math.pow(x - 16, 2) + Math.pow(y - 16, 2));
      if (distanceFromCenter <= 14) {
        // Red fill
        image.setPixelColor(Jimp.cssColorToHex('#F44336'), x, y);
        
        // Darker border
        if (distanceFromCenter > 12 && distanceFromCenter <= 14) {
          image.setPixelColor(Jimp.cssColorToHex('#D32F2F'), x, y);
        }
      }
    }
  }
  
  // Draw X (adjusted for 32x32)
  const xPoints = [
    [10, 10], [11, 11], [12, 12], [13, 13], [14, 14], [15, 15], [16, 16], [17, 17], [18, 18], [19, 19], [20, 20], [21, 21],
    [10, 21], [11, 20], [12, 19], [13, 18], [14, 17], [15, 16], [16, 15], [17, 14], [18, 13], [19, 12], [20, 11], [21, 10]
  ];
  
  xPoints.forEach(([x, y]) => {
    image.setPixelColor(Jimp.cssColorToHex('#FFFFFF'), x, y);
  });
  
  // Save as PNG first
  const pngPath = path.join(__dirname, 'app', 'disconnected.png');
  await image.writeAsync(pngPath);
  
  // Convert PNG to ICO using to-ico
  const pngBuffer = fs.readFileSync(pngPath);
  const icoBuffer = await toIco([pngBuffer], {
    sizes: [16, 24, 32, 48, 64],
    resize: true
  });
  
  fs.writeFileSync(path.join(__dirname, 'app', 'disconnected.ico'), icoBuffer);
  console.log('Disconnected icon created successfully');
}

// Create both icons
async function createIcons() {
  try {
    // Ensure app directory exists
    const appDir = path.join(__dirname, 'app');
    if (!fs.existsSync(appDir)) {
      fs.mkdirSync(appDir, { recursive: true });
    }
    
    await createConnectedIcon();
    await createDisconnectedIcon();
    console.log('All icons created successfully');
  } catch (error) {
    console.error('Error creating icons:', error);
  }
}

createIcons();