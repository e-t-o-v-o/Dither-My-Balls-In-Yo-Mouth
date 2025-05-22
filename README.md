# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

# Effects & Settings

## Effects

### channel
Splits the image into its red, green, and blue channel intensity maps, rendering each channel as a separate grayscale block.

### two-tone
Renders each pixel block in either the foreground color or background color based on the brightness threshold.

### binary
Similar to two-tone but fills fixed-size blocks with fg/bg colors according to threshold.

### decade
Groups brightness into numeric decades (0–9) and maps each decade to a color from the selected `decadePalette`. Controlled by `extractCount`.

### ascii
Converts pixel brightness to ASCII characters, rendering a character grid. Uses `asciiVariant`, `font`, `fontSize`, and colors from `charPalette`. Optionally overlays ASCII over the live video/image when `asciiUnderlay` is enabled.

### dither
Applies an 8×8 ordered or Floyd–Steinberg dithering algorithm to approximate shades using a limited palette. Controlled by `ditherMethod` and `ditherPalette`.

### dither-ascii
Combines dithering with ASCII mapping: first dithers the image, then renders ASCII characters based on dithered brightness.

### green-screen
Detects green-dominant pixels and replaces them with the chosen `bgColor`. If `removeGreen` is true, characters or blocks over green areas are omitted.

### binary-char
Renders threshold-based blocks and overlays a numeric character (0–9) indicating brightness level. Settings: `threshold`, `charPalette`, `fgColor`, `bgColor`.

### letter-char
Renders blocks filled by threshold and overlays a custom `char` on each block. Controlled by `threshold`, `char`, `font`, `fontSize`, `fgColor`, `bgColor`.

### letters-palette
Fills blocks with colors from `paletteName` and overlays letters from a preset list sized by `letterCount`. Uses `fgColor` for text.

### palette
Renders blocks in the nearest palette color (`paletteName`) and optionally overlays numbers or characters based on `overlayType` (`none`, `number`, `character`).

### edge
Applies a convolution edge-detection filter to highlight contours in high contrast. Adjustable via `threshold`, `fgColor`, `bgColor`.

## Settings

| Name               | Type                             | Default   | Description                                                                                   |
|--------------------|----------------------------------|-----------|-----------------------------------------------------------------------------------------------|
| mode               | 'video'  'video-file'  'image' | video     | Source: webcam, uploaded video, or uploaded image.                                             |
| effect             | string                           | channel   | Active effect to apply (see Effects above).                                                   |
| fgColor            | string (hex)                     | #FFFFFF   | Foreground/text color.                                                                        |
| bgColor            | string (hex)                     | #000000   | Background color.                                                                             |
| threshold          | number (0–255)                   | 128       | Brightness cutoff for threshold-based effects.                                                |
| pixelSize          | number (px)                      | 20        | Size of pixel blocks for pixelated effects.                                                   |
| font               | string                           | Arial     | Font family for text overlays.                                                                |
| fontSize           | number (px)                      | 20        | Font size for text overlays.                                                                  |
| recordingFormat    | 'mp4'  'gif'               | mp4       | Format for recording canvas output.                                                           |
| decadePalette      | string                           | Default   | Name of color palette used by Decade effect.                                                  |
| charPalette        | string                           | Default   | Name of color palette used by character-based effects.                                        |
| ditherPalette      | string                           | Default   | Name of palette used for dithering effects.                                                   |
| ditherMethod       | 'ordered'  'floyd'         | ordered   | Dithering algorithm: ordered matrix or Floyd–Steinberg error diffusion.                        |
| smoothFactor       | number (0–1)                     | 1         | Interpolation for real-time smoothing (0 = static frame).                                     |
| char               | string                           | .         | Character to render in char-based overlays.                                                   |
| letterCount        | number                           | 10        | Number of letters to map in Letters-Palette effect.                                           |
| extractCount       | number                           | 8         | Number of brightness levels/groups in Decade effect.                                          |
| asciiVariant       | string                           | Default   | ASCII character set variant for ASCII-based effects.                                          |
| asciiMapping       | 'static'  'dynamic'       | dynamic   | Static uses fixed mapping; dynamic adjusts mapping per frame.                                  |
| transparentBg      | boolean                          | false     | Render a transparent background instead of solid bgColor.                                     |
| outputResolution   | 'native'  '1080p'  '4k' | native    | Canvas resolution mode: source native, 1080p, or full 4K.                                     |
| imageDownloadType  | string                           | png4x     | Download format for images (e.g. png, png4x, svg).                                            |
| overlayType        | 'none'  'number'  'character' | number    | Overlay style for Palette effect; none, numeric index, or custom character.                  |
| removeGreen        | boolean                          | false     | Omit or mask green areas in Green-Screen effect.                                              |
| asciiUnderlay      | boolean                          | false     | Draws the underlying source beneath ASCII characters when enabled.                             |
|--------------------|----------------------------------|-----------|-----------------------------------------------------------------------------------------------|
