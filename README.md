# Vapor

A minimal, flat, DRM-free game launcher for Windows.

![Vapor](src/img/image.png)

## Features

- **Auto-scans folders** for `.exe` games (GOG, itch.io, Epic, Steam, etc.)
- **SteamGridDB integration** for cover art, hero banners, logos, and icons
- **Playtime tracking** per session, auto-saved
- **Collections** to organize your games
- **Controller support** - D-pad navigation, A to launch, B to back
- **Keyboard navigation** - Arrow keys + Enter, Escape to go back
- **Auto-updates** via GitHub Releases
- **Auto-start** on Windows login

## Getting Started

```bash
# Install dependencies
npm install

# Run in development mode
npm start
```

## Building

```bash
# Build Windows installer
npm run build

# Build and publish to GitHub (requires gh auth)
npm run publish
```

## Folder Structure

Point Vapor at a root folder containing game subdirectories:

```
D:\Games\
  Hollow Knight\
    hollow_knight.exe   ← picked as main exe
    ...
  Celeste\
    Celeste.exe
    ...
```

Vapor automatically ignores setup, uninstall, crash reporter, and other helper executables.

## Configuration

Games and settings are stored in `%APPDATA%\vapor\`:
- `games.json` - Your game library
- `settings.json` - User preferences

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| D-pad / Arrows | Navigate |
| A / Enter | Launch game / Select |
| B / Escape | Go back |
| Start (controller) | Open settings |

## Tech Stack

- Electron 28
- React 18
- Vite 5
- electron-builder
- electron-updater

## License

Free and open source.
