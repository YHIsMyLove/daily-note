const fs = require('fs');
const path = require('path');

// Read PNG file
const pngPath = path.join(__dirname, '../src-tauri/icons/icon.png');
const icoPath = path.join(__dirname, '../src-tauri/icons/icon.ico');

try {
  // Create a minimal but valid ICO file
  // ICO format: ICONDIR header + ICONDIRENTRY
  const pngData = fs.readFileSync(pngPath);

  // Simple ICO with PNG data embedded ( Vista+ supports this)
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0);      // Reserved
  header.writeUInt16LE(1, 2);      // Type: 1 = ICO
  header.writeUInt16LE(1, 4);      // Count: 1 image

  const fileSize = pngData.length + 22;
  const dataOffset = 22;

  // Directory entry
  header.writeUInt8(32, 6);        // Width (256 = 0)
  header.writeUInt8(32, 7);        // Height (256 = 0)
  header.writeUInt8(0, 8);         // Color count (0 = >256 colors)
  header.writeUInt8(0, 9);         // Reserved
  header.writeUInt16LE(1, 10);     // Color planes
  header.writeUInt16LE(32, 12);    // Bits per pixel
  header.writeUInt32LE(pngData.length, 14);  // Size of image data
  header.writeUInt32LE(dataOffset, 18);      // Offset to image data

  const icoData = Buffer.concat([header, pngData]);
  fs.writeFileSync(icoPath, icoData);
  console.log('ICO file created successfully');
} catch (error) {
  console.error('Error:', error.message);
}
