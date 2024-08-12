import fs from 'fs';
import path from 'path';
import { createCanvas } from 'canvas';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

// Configuration
const jsonDirPath = 'D:/Pinball/dmd/';
const outputDir = path.resolve(__dirname, '..', 'output');
const canvasWidth = 128;
const canvasHeight = 32;
const scaleFactor = 10;
const pixelSize = 10;  // Size of each pixel including border

type Frame = {
  frame_num: number;
  duration: number;
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
  const gamma = 2.2;  // Gamma correction factor
  
  for (let y = 0; y < bitmap.length; y++) {
    const row = bitmap[y].replace(/\|/g, '');
    for (let x = 0; x < row.length; x++) {
      const hex = row[x];
      let brightness = parseInt(hex, 16) / 15;  // Normalize brightness
      brightness = Math.pow(brightness, 1 / gamma);  // Apply gamma correction
      brightness = Math.min(brightness, 1);  // Ensure brightness doesn't exceed 1
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
async function createVideo(outputPath: string, videoOutputPath: string, frames: Frame[]) {
  console.log(`Creating video for output path: ${outputPath}`);
  console.log(`Video output path: ${videoOutputPath}`);

  const framesFile = path.join(outputPath, 'frames.txt');
  console.log(`Frames file path: ${framesFile}`);

  let frameLines: string[];

  if (frames.length === 1) {
    // If there's only one frame, we repeat it to fill the duration
    const frame = frames[0];
    const escapedPath = path.posix.join(outputPath, `frame_${frame.frame_num.toString().padStart(3, '0')}.png`)
      .replace(/'/g, "'\\''")
      .replace(/[\[\]]/g, '\\$&');  // Escape square brackets

    // Duplicate the frame line to fill the duration
    frameLines = [
      `file '${escapedPath}'`,
      `duration ${frame.duration / 1000}`,
      `file '${escapedPath}'`
    ];
  } else {
    // Normal multi-frame processing
    frameLines = frames.map(frame => {
      const escapedPath = path.posix.join(outputPath, `frame_${frame.frame_num.toString().padStart(3, '0')}.png`)
        .replace(/'/g, "'\\''")
        .replace(/[\[\]]/g, '\\$&');  // Escape square brackets
      return `file '${escapedPath}'
duration ${frame.duration / 1000}`;
    });
  }

  console.log(`Writing frames file...`);
  try {
    await fs.promises.writeFile(framesFile, frameLines.join('\n'));
    console.log(`Frames file written successfully.`);
  } catch (err) {
    console.error(`Error writing frames file:`, err);
    throw err;
  }

  const outputOptions = [
    `-vf scale=${canvasWidth * scaleFactor}:${canvasHeight * scaleFactor}`,
    '-c:v libx264',
    '-pix_fmt yuv420p',
    '-shortest'  // Ensure the video ends at the shortest duration when repeating frames
  ];

  console.log(`Starting FFmpeg process...`);
  return new Promise((resolve, reject) => {
    ffmpeg()
      .setFfmpegPath(ffmpegStatic ?? '')
      .input(framesFile)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions(outputOptions)
      .on('start', (commandLine) => {
        console.log('FFmpeg command:', commandLine);
      })
      .on('end', async () => {
        console.log(`FFmpeg process completed.`);
        try {
          // Delete the frame files and the temporary file after the video is created
          const frameFiles = await fs.promises.readdir(outputPath);
          for (const frameFile of frameFiles) {
            if (frameFile.startsWith('frame_') && frameFile.endsWith('.png')) {
              await fs.promises.unlink(path.join(outputPath, frameFile));
            }
          }
          await fs.promises.unlink(framesFile);
          console.log(`Cleanup completed.`);
          resolve(true);
        } catch (err) {
          console.error('Error during cleanup:', err);
          resolve(true); // Resolve anyway to not block the process
        }
      })
      .on('error', (err, stdout, stderr) => {
        console.error('FFmpeg error:', err);
        console.error('FFmpeg stdout:', stdout);
        console.error('FFmpeg stderr:', stderr);
        reject(err);
      })
      .save(videoOutputPath);
  });
}

// Function to process all JSON files in a directory
async function processJsonFiles(dirPath: string) {
  console.log(`Processing directory: ${dirPath}`);
  const files = await fs.promises.readdir(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stats = await fs.promises.stat(fullPath);
    
    if (stats.isDirectory()) {
      await processJsonFiles(fullPath); // Recursively process subdirectories
    } else if (path.extname(file) === '.json') {
      console.log(`Checking JSON file: ${fullPath}`);
      const relativePath = path.relative(jsonDirPath, dirPath);
      const outputPath = path.join(outputDir, relativePath);
      const videoOutputPath = path.join(outputPath, `${path.basename(file, '.json')}.mp4`);

      // Check if the output video file already exists
      if (await fileExists(videoOutputPath)) {
        console.log(`Video file already exists for ${file}. Skipping processing.`);
        continue; // Skip to the next file
      }

      console.log(`Processing JSON file: ${fullPath}`);

      try {
        console.log(`Creating output directory: ${outputPath}`);
        await fs.promises.mkdir(outputPath, { recursive: true });
        
        console.log(`Reading JSON file...`);
        const jsonData = JSON.parse(await fs.promises.readFile(fullPath, 'utf8'));
        const sortedFrames = jsonData.frames.sort((a: Frame, b: Frame) => a.frame_num - b.frame_num);

        console.log(`Processing ${sortedFrames.length} frames...`);
        for (const frame of sortedFrames) {
          await processFrame(frame, outputPath);
        }
        
        console.log(`Creating video at: ${videoOutputPath}`);
        await createVideo(outputPath, videoOutputPath, sortedFrames);
        console.log(`Video for ${file} created at ${videoOutputPath}`);
      } catch (err) {
        console.error(`Error processing ${file}:`, err);
      }
    }
  }
}

// Helper function to check if a file exists
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// Start processing
processJsonFiles(jsonDirPath).catch(err => console.error(err));
