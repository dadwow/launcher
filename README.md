# WoW 3.3.5a Client Launcher

A modern Electron-based launcher for World of Warcraft 3.3.5a clients.

## Features

- Download and manage WoW client files
- Automatic realmlist configuration
- Clean, modern interface
- Cross-platform support (Windows, macOS, Linux)
- Environment-based configuration

## Setup

1. Clone this repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and configure your settings
4. Run in development: `npm start`

## Configuration

Edit the `.env` file to configure:

- `CLIENT_DOWNLOAD_URL`: URL to download the WoW client archive
- `DEFAULT_REALM`: Default realm address for realmlist.wtf
- `WOW_INSTALL_PATH`: Custom installation path (optional)
- `SERVER_NAME`: Display name for your server

## Building

- Development: `npm start`
- Build for distribution: `npm run build`

## Requirements

- Node.js 16+
- WoW 3.3.5a compatible client files