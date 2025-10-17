// Create simple PNG icons for the Chrome extension
const fs = require('fs');
const path = require('path');

// Create a simple SVG icon and convert to different sizes
const iconSvg = `
<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" fill="#1a73e8" rx="20"/>
  <rect x="20" y="30" width="88" height="8" fill="white" rx="4"/>
  <rect x="20" y="50" width="88" height="8" fill="white" rx="4"/>
  <rect x="20" y="70" width="88" height="8" fill="white" rx="4"/>
  <rect x="20" y="90" width="60" height="8" fill="white" rx="4"/>
  <circle cx="95" cy="94" r="8" fill="white"/>
  <path d="M91 94 L95 98 L103 86" stroke="#1a73e8" stroke-width="2" fill="none"/>
</svg>
`;

// Create a simple base64 PNG data for testing
// This is a minimal 1x1 transparent PNG
const simplePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
const pngData = Buffer.from(simplePngBase64, 'base64');

// Icon sizes
const sizes = [16, 32, 48, 128];

// Create icons directory if it doesn't exist
if (!fs.existsSync('icons')) {
  fs.mkdirSync('icons');
}

// Create placeholder PNG files
sizes.forEach(size => {
  const filename = `icon${size}.png`;
  const filepath = path.join('icons', filename);
  
  try {
    fs.writeFileSync(filepath, pngData);
    console.log(`Created ${filename}`);
  } catch (error) {
    console.error(`Error creating ${filename}:`, error);
  }
});

console.log('Icon creation complete!');