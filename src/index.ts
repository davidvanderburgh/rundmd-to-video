import fs from 'fs';
import path from 'path';
import { createCanvas } from 'canvas';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

// Configuration
const jsonDirPath = 'D:/Pinball/dmd/';
const outputDir = 'output';
const canvasWidth = 128;
const canvasHeight = 32;
const scaleFactor = 10;
const frameRate = 25; // Default frame rate, adjust as necessary
const pixelSize = 10;  // Size of each pixel including border

type Frame = {
  frame_num: number;
  bitmap: string[];
};

// Function to process a single frame
async function processFrame(frame: Frame, outputPath: string) {
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
  
  const filePath = path.join(outputPath, `frame_${frame.frame_num.toString().padStart(3, '0')}.png`);
  const out = fs.createWriteStream(filePath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  await new Promise(resolve => out.on('finish', resolve));
}

// Function to create a video from the processed frames and delete the frames afterward
async function createVideo(outputPath: string, videoOutputPath: string) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .setFfmpegPath(ffmpegStatic ?? '')
      .addInput(path.join(outputPath, 'frame_%03d.png'))
      .inputFPS(frameRate)
      .outputOptions([
        `-vf scale=${canvasWidth * scaleFactor}:${canvasHeight * scaleFactor}`,
        '-c:v libx264',
        '-pix_fmt yuv420p'
      ])
      .on('end', async () => {
        // Delete the frame files after the video is created
        const frameFiles = fs.readdirSync(outputPath).filter(file => file.startsWith('frame_') && file.endsWith('.png'));
        for (const frameFile of frameFiles) {
          fs.unlinkSync(path.join(outputPath, frameFile));
        }
        resolve(true);
      })
      .on('error', (err) => reject(err))
      .save(videoOutputPath);
  });
}

// Function to process all JSON files in a directory
async function processJsonFiles(dirPath: string) {
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stats = fs.statSync(fullPath);
    
    if (stats.isDirectory()) {
      await processJsonFiles(fullPath); // Recursively process subdirectories
    } else if (path.extname(file) === '.json') {
      const relativePath = path.relative(jsonDirPath, dirPath);
      const outputPath = path.join(outputDir, relativePath); // Use the output directory with the same folder structure

      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }
      
      const jsonData = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      const sortedFrames = jsonData.frames.sort((a: Frame, b: Frame) => a.frame_num - b.frame_num);

      for (const frame of sortedFrames) {
        await processFrame(frame, outputPath);
      }
      
      const videoOutputPath = path.join(outputPath, `${path.basename(file, '.json')}.mp4`);
      await createVideo(outputPath, videoOutputPath);
      console.log(`Video for ${file} created at ${videoOutputPath}`);
    }
  }
}

// Start processing
processJsonFiles(jsonDirPath).catch(err => console.error(err));
