const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '..', 'icons');
const SOURCE_PATH = path.join(__dirname, '..', 'logo.jpeg');

const SIZES = [16, 32, 48, 72, 96, 128, 144, 152, 167, 180, 192, 384, 512];
const BG = { r: 255, g: 255, b: 255, alpha: 1 };

async function generate() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('Instale sharp: npm install sharp --save-dev');
    process.exit(1);
  }

  if (!fs.existsSync(SOURCE_PATH)) {
    console.error('No se encontró logo.jpeg en la raíz del proyecto');
    process.exit(1);
  }

  const resizeIcon = (size) =>
    sharp(SOURCE_PATH)
      .resize(size, size, { fit: 'contain', background: BG })
      .png();

  for (const size of SIZES) {
    await resizeIcon(size).toFile(path.join(ICONS_DIR, `icon-${size}.png`));
    console.log(`Generado: icon-${size}.png`);
  }

  const maskableInner = Math.round(512 * 0.8);
  await sharp(SOURCE_PATH)
    .resize(maskableInner, maskableInner, { fit: 'contain', background: BG })
    .extend({
      top: 51,
      bottom: 51,
      left: 51,
      right: 51,
      background: BG,
    })
    .png()
    .toFile(path.join(ICONS_DIR, 'icon-maskable-512.png'));
  console.log('Generado: icon-maskable-512.png');

  await resizeIcon(32).toFile(path.join(ICONS_DIR, 'favicon.ico'));
  console.log('Generado: favicon.ico');

  console.log('Iconos generados desde logo.jpeg correctamente.');
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
