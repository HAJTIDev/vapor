# Vapor 🎮

A minimal, flat DRM-free game launcher for Windows.

## Features
- Auto-scans folders for `.exe` games (GOG, itch.io, etc.)
- Fetches cover art & backgrounds via RAWG API
- Playtime tracking (per-session, auto-saved)
- Controller support (D-pad navigation, A to launch, B to back)
- Keyboard: arrow keys + Enter to navigate, Escape to go back

## Setup

```bash
npm install
npm start
```

## Build (Windows installer)

```bash
npm run build
```

## Get a RAWG API key

1. Go to https://rawg.io/apidocs
2. Sign up for a free account
3. Copy your API key
4. Paste it in Vapor → Settings → RAWG API Key

Without an API key the launcher still works — games just won't have cover art.

## How game scanning works

Point Vapor at a root folder like `D:\Games\`. It will look at each
subdirectory (e.g. `Hollow Knight\`, `Celeste\`) and find the main `.exe`
inside, ignoring setup/uninstall/crash reporter executables.

Folder structure it expects:
```
D:\Games\
  Hollow Knight\
    hollow_knight.exe   ← picked as main exe
    ...
  Celeste\
    Celeste.exe
    ...
```

Games are persisted in `%APPDATA%\vapor\games.json`.
