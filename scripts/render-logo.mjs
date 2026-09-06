import sharp from "sharp";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svg = join(__dirname, "../public/cashview-logo.svg");
const outPng = join(__dirname, "../public/cashview-logo.png");
const outIco = join(__dirname, "../public/cashview-logo-ios.png");

await sharp(svg).resize(512, 512).png().toFile(outPng);
await sharp(svg).resize(180, 180).png().toFile(outIco);

console.log("Logo renderizado:", outPng, outIco);