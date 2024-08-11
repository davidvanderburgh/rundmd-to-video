"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const canvas_1 = require("canvas");
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const ffmpeg_static_1 = __importDefault(require("ffmpeg-static"));
// Configuration
const jsonFilePath = 'D:/Pinball/dmd/AC#DC/AC#DC_000.json';
const outputDir = 'frames';
const outputVideoPath = 'output.mp4';
const canvasWidth = 128;
const canvasHeight = 32;
const scaleFactor = 10;
const frameRate = 25; // Default frame rate, adjust as necessary
// Read and parse the JSON file
const jsonData = JSON.parse(fs_1.default.readFileSync(jsonFilePath, 'utf8'));
if (!fs_1.default.existsSync(outputDir)) {
    fs_1.default.mkdirSync(outputDir);
}
function processFrame(frame) {
    return __awaiter(this, void 0, void 0, function* () {
        const canvas = (0, canvas_1.createCanvas)(canvasWidth, canvasHeight);
        const ctx = canvas.getContext('2d');
        // Set background color
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        // Process bitmap
        const bitmap = frame.bitmap;
        for (let y = 0; y < bitmap.length; y++) {
            const row = bitmap[y].replace(/\|/g, '');
            for (let x = 0; x < row.length; x++) {
                const hex = row[x];
                const brightness = parseInt(hex, 16) / 15; // Normalize brightness
                ctx.fillStyle = `rgba(191, 87, 0, ${brightness})`; // Dark Amber
                ctx.fillRect(x, y, 1, 1);
            }
        }
        const filePath = path_1.default.join(outputDir, `frame_${frame.frame_num.toString().padStart(3, '0')}.png`);
        const out = fs_1.default.createWriteStream(filePath);
        const stream = canvas.createPNGStream();
        stream.pipe(out);
        yield new Promise(resolve => out.on('finish', resolve));
    });
}
function createVideo() {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            (0, fluent_ffmpeg_1.default)()
                .setFfmpegPath(ffmpeg_static_1.default !== null && ffmpeg_static_1.default !== void 0 ? ffmpeg_static_1.default : '')
                .addInput(path_1.default.join(outputDir, 'frame_%03d.png'))
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
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        // Ensure frames are processed in order
        const sortedFrames = jsonData.frames.sort((a, b) => a.frame_num - b.frame_num);
        for (const frame of sortedFrames) {
            yield processFrame(frame);
        }
        yield createVideo();
        console.log('Video creation complete.');
    });
}
main().catch(err => console.error(err));
