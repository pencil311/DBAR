import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "assets/icon.svg");
const OUT_DIR = path.join(ROOT, "public/icons");
const PAPER = "#e8dcc4";

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const svg = await readFile(SRC);

  await sharp(svg, { density: 384 })
    .resize(192, 192)
    .png()
    .toFile(path.join(OUT_DIR, "icon-192.png"));

  await sharp(svg, { density: 384 })
    .resize(512, 512)
    .png()
    .toFile(path.join(OUT_DIR, "icon-512.png"));

  await sharp(svg, { density: 384 })
    .resize(180, 180)
    .png()
    .toFile(path.join(OUT_DIR, "apple-touch-icon.png"));

  // Maskable icons get cropped to a circle/rounded-square by the OS, so the
  // monogram is rendered smaller and padded onto a full-bleed paper-colored
  // canvas to stay inside the ~80% "safe zone".
  const inner = await sharp(svg, { density: 384 }).resize(360, 360).png().toBuffer();
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: PAPER },
  })
    .composite([{ input: inner, gravity: "center" }])
    .png()
    .toFile(path.join(OUT_DIR, "icon-512-maskable.png"));

  console.log("Icons generated in public/icons/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
