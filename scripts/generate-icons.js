const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '..', 'icons');
const SVG_PATH = path.join(ICONS_DIR, 'icon.svg');

const SIZES = [16, 32, 48, 72, 96, 128, 144, 152, 167, 180, 192, 384, 512];

async function generate() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('Instale sharp: npm install sharp --save-dev');
    process.exit(1);
  }

  const svgBuffer = fs.readFileSync(SVG_PATH);

  for (const size of SIZES) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(ICONS_DIR, `icon-${size}.png`));
    console.log(`Generado: icon-${size}.png`);
  }

  await sharp(svgBuffer)
    .resize(410, 410)
    .extend({
      top: 51,
      bottom: 51,
      left: 51,
      right: 51,
      background: { r: 14, g: 165, b: 233, alpha: 1 },
    })
    .png()
    .toFile(path.join(ICONS_DIR, 'icon-maskable-512.png'));
  console.log('Generado: icon-maskable-512.png');

  await sharp(svgBuffer)
    .resize(32, 32)
    .toFile(path.join(ICONS_DIR, 'favicon.ico'));
  console.log('Generado: favicon.ico');

  console.log('Iconos generados correctamente.');
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
