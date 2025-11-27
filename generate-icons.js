// generate-icons.js - Generate placeholder icons for Chrome extension
const fs = require('fs');
const path = require('path');

const sizes = [16, 48, 128];
const iconsDir = path.join(__dirname, 'icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

console.log('Generating icons with Jimp...');

// Use Jimp to create icons
const Jimp = require('jimp');

async function generateIcons() {
  for (const size of sizes) {
    try {
      // Create a new image with blue background (LinkedIn blue: #0077B5)
      const image = new Jimp(size, size, 0x0077B5);
      
      // Load appropriate font size based on icon size
      let fontPath;
      if (size === 16) {
        fontPath = Jimp.FONT_SANS_8_BLACK;
      } else if (size === 48) {
        fontPath = Jimp.FONT_SANS_16_BLACK;
      } else {
        fontPath = Jimp.FONT_SANS_32_BLACK;
      }
      
      const font = await Jimp.loadFont(fontPath);
      
      // Calculate text position to center it
      const text = 'LS';
      const textWidth = Jimp.measureText(font, text);
      const textHeight = Jimp.measureTextHeight(font, text);
      const x = Math.floor((size - textWidth) / 2);
      const y = Math.floor((size - textHeight) / 2);
      
      // Create a white text image by printing black text on white, then inverting
      const textImage = new Jimp(textWidth + 4, textHeight + 4, 0x000000);
      textImage.print(font, 2, 2, text);
      
      // Invert to make text white (black becomes white)
      textImage.invert();
      
      // Composite the white text onto the blue background
      image.composite(textImage, x - 2, y - 2);
      
      // Save the image
      const filePath = path.join(iconsDir, `icon${size}.png`);
      await image.writeAsync(filePath);
      console.log(`✅ Created ${filePath}`);
    } catch (error) {
      console.error(`❌ Error creating icon${size}.png:`, error.message);
    }
  }
  
  console.log('\n✅ All icons generated successfully!');
}

generateIcons().catch(error => {
  console.error('Failed to generate icons:', error);
  console.log('\nAlternative: Create simple PNG files manually:');
  sizes.forEach(size => {
    console.log(`  - icons/icon${size}.png (${size}x${size}px, blue #0077B5 background, white "LS" text)`);
  });
  process.exit(1);
});

