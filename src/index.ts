import fs from 'fs';
import path from 'path';
import { createCanvas } from 'canvas';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

// Configuration
const jsonFilePath = 'D:/Pinball/dmd/AC#DC/AC#DC_000.json';
const outputDir = 'frames';
const outputVideoPath = 'output.mp4';
const canvasWidth = 128;
const canvasHeight = 32;
const scaleFactor = 10;
const frameRate = 25; // Default frame rate, adjust as necessary
const pixelSize = 10;  // Size of each pixel including border

// Read and parse the JSON file
const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

async function processFrame(frame: any) {
  const canvas = createCanvas(canvasWidth * pixelSize, canvasHeight * pixelSize);
  const ctx = canvas.getContext('2d');
  
  // Set background color
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvasWidth * pixelSize, canvasHeight * pixelSize);
  
  // Process bitmap
  const bitmap = frame.bitmap;
  for (let y = 0; y < bitmap.length; y++) {
    const row = bitmap[y].replace(/\|/g, '');
    for (let x = 0; x < row.length; x++) {
      const hex = row[x];
      const brightness = parseInt(hex, 16) / 15; // Normalize brightness
      ctx.fillStyle = `rgba(191, 87, 0, ${brightness})`;  // Dark Amber
      ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize - 1, pixelSize - 1);  // Pixel with border
    }
  }
  
  const filePath = path.join(outputDir, `frame_${frame.frame_num.toString().padStart(3, '0')}.png`);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  await new Promise(resolve => out.on('finish', resolve));
}

async function createVideo() {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .setFfmpegPath(ffmpegStatic ?? '')
      .addInput(path.join(outputDir, 'frame_%03d.png'))
      .inputFPS(frameRate)
      .outputOptions([
        `-vf scale=${canvasWidth * scaleFactor}:${canvasHeight * scaleFactor}`,
        '-c:v libx264',
        '-pix_fmt yuv420p'
      ])
      .on('end', () => resolve(true))
      .on('error', (err) => reject(err))
      .save(outputVideoPath);
  });
}

async function main() {
  // Ensure frames are processed in order
  const sortedFrames = jsonData.frames.sort((a: any, b: any) => a.frame_num - b.frame_num);
  
  for (const frame of sortedFrames) {
    await processFrame(frame);
  }
  
  await createVideo();
  console.log('Video creation complete.');
}

main().catch(err => console.error(err));
