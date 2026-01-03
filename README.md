# WoW 3.3.5a Client Launcher

A modern Electron-based launcher for World of Warcraft 3.3.5a clients.

## Features

- Download and manage WoW client files
- Automatic realmlist configuration
- **Automatic launcher updates** from GitHub releases
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

## Testing

This launcher includes a comprehensive test suite covering all critical functionality.

### Quick Test
```bash
./test-status.sh
```

### Run All Tests
```bash
npm test
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Run Specific Test Suite
```bash
./run-tests.sh addon-install     # Addon installation tests
./run-tests.sh addon-update      # Addon update tests
./run-tests.sh launcher-update   # Launcher self-update tests
./run-tests.sh integration       # Full workflow tests
```

### Test Coverage
- ✅ Client file downloading
- ✅ Zip extraction with nested folder handling
- ✅ Addon installation from GitHub
- ✅ Addon update detection and updating
- ✅ Launcher self-updates
- ✅ Error handling and edge cases

See [TESTING.md](TESTING.md) for detailed testing documentation.

**Current Status:** 🟢 31/31 tests passing

## Requirements

- Node.js 16+
- WoW 3.3.5a compatible client files