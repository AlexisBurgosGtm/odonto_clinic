const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const ICONS_DIR = path.join(ROOT_DIR, 'icons');
const SOURCE_PATH = path.join(ROOT_DIR, 'logonuevo.jpeg');

const SIZES = [16, 32, 48, 72, 96, 128, 144, 152, 167, 180, 192, 256, 384, 512];
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

async function generate() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('Instale sharp: npm install sharp --save-dev');
    process.exit(1);
  }

  if (!fs.existsSync(SOURCE_PATH)) {
    console.error('No se encontró logonuevo.jpeg en la raíz del proyecto');
    process.exit(1);
  }

  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  const resizeIcon = (size) =>
    sharp(SOURCE_PATH)
      .ensureAlpha()
      .resize(size, size, { fit: 'contain', background: TRANSPARENT })
      .png();

  for (const size of SIZES) {
    await resizeIcon(size).toFile(path.join(ICONS_DIR, `icon-${size}.png`));
    console.log(`Generado: icon-${size}.png`);
  }

  const maskableInner = Math.round(512 * 0.8);
  await sharp(SOURCE_PATH)
    .ensureAlpha()
    .resize(maskableInner, maskableInner, { fit: 'contain', background: TRANSPARENT })
    .extend({
      top: 51,
      bottom: 51,
      left: 51,
      right: 51,
      background: TRANSPARENT,
    })
    .png()
    .toFile(path.join(ICONS_DIR, 'icon-maskable-512.png'));
  console.log('Generado: icon-maskable-512.png');

  await resizeIcon(32).toFile(path.join(ICONS_DIR, 'favicon.ico'));
  console.log('Generado: icons/favicon.ico');

  await resizeIcon(192).toFile(path.join(ROOT_DIR, 'favicon.png'));
  console.log('Generado: favicon.png');

  console.log('Iconos generados con fondo transparente desde logonuevo.jpeg.');
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
