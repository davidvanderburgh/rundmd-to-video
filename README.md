**Instructions**

1. Use the `rip_image.py` script from `https://github.com/Pwedge/RunDMD-Utils` on a RunDMD image (`B134` or preferably `B237` image from `https://swinks.com.au/manuals` for example)

2. The path for where those ripped JSON files goes into `jsonDirPath` in `src/index.ts`. Mine is `D:/Pinball/dmd/` for example.

3. You can change the pixel color to whatever you like if you change the `fillStyle` property within the `processFrame` function

4. You'll need FFMPEG installed in your path - directions can be found on Google and depend on your OS.

5. run `yarn`

6. run `yarn start`

7. You shuold see the videos start to generate in a folder specified by `outputDir` in `src/index.ts`. It is defaulted to a folder called `output` in the root project directory.