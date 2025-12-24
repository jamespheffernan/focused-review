# App Icon Setup

## Icon File Location

Place your app icon in this directory as `icon.png`.

## Requirements

- **Format**: PNG (electron-builder will automatically convert to .icns)
- **Size**: 1024x1024 pixels (recommended)
- **Filename**: `icon.png`

## Alternative: Using .icns directly

If you have an `.icns` file, you can:
1. Place it as `icon.icns` in this directory
2. Update `package.json` to reference `build/icon.icns` instead of `build/icon.png`

## Converting Images to Icon Format

If you have the image in another format, you can:

### Option 1: Use online converters
- Upload your image to an online PNG to ICNS converter
- Download the `.icns` file and place it here

### Option 2: Use macOS tools
```bash
# If you have iconutil (macOS built-in)
# First create an iconset directory structure, then:
iconutil -c icns icon.iconset
```

### Option 3: Use electron-builder (automatic)
Just place a 1024x1024 PNG file as `icon.png` and electron-builder will handle the conversion automatically.

