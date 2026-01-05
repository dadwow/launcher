# WoW 3.3.5a Client Launcher

A modern Electron-based launcher for World of Warcraft 3.3.5a clients with cross-platform support.

## Features

- 📥 Download and manage WoW client files
- 🔄 Automatic launcher updates from GitHub releases
- ⚙️ Automatic realmlist configuration
- 🎨 Clean, modern interface
- 🌍 Cross-platform support (Windows, macOS, Linux)
- 🍎 Apple Silicon (M1/M2/M3) support (partial - see docs)
- 🔧 Environment-based configuration
- 🧩 Addon management

## Platform Support

| Platform            | Status          | Notes                       |
| ------------------- | --------------- | --------------------------- |
| Windows             | ✅ Full Support | Native client runs directly |
| macOS Intel         | ✅ Full Support | Via CrossOver/Wine          |
| macOS Apple Silicon | ✅ Full Support | Via CrossOver/Wine          |
| Linux               | ✅ Full Support | Via Wine                    |

## Quick Start

### Prerequisites

- Node.js 16+
- For macOS: CrossOver 25.0.1 or later

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd ac-launcher

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your server details

# Run in development
npm run dev
```

### Building for Distribution

```bash
# Build for current platform
npm run build

# Build for specific platforms
npm run build:mac
npm run build:win
npm run build:linux
```

## Documentation

### Setup & Configuration

- **[Setup Guide](docs/setup/SETUP_GUIDE.md)** - Complete installation and configuration
- **[CrossOver Setup](docs/setup/CROSSOVER_MACOS.md)** - macOS-specific Wine configuration

### Platform-Specific

- **[Apple Silicon Guide](docs/apple-silicon/README.md)** - M1/M2/M3 support status and troubleshooting
- **[Windows Build Guide](docs/development/WINDOWS_BUILD.md)** - Building on Windows

### Troubleshooting

- **[Download Troubleshooting](docs/troubleshooting/DOWNLOAD_TROUBLESHOOTING.md)** - Client download issues
- **[Fixes Changelog](docs/FIXES_CHANGELOG.md)** - Recent bug fixes and improvements

### Development

- **[Testing Guide](docs/development/TESTING.md)** - Running and writing tests
- **[CI/CD Setup](docs/development/CI_CD_SETUP.md)** - Continuous integration configuration
- **[Cross-Platform Guide](docs/development/CROSS_PLATFORM_GUIDE.md)** - Multi-platform development
- **[Optimization Report](docs/development/OPTIMIZATION_REPORT.md)** - Performance improvements
- **[UI Design](docs/development/UNIFIED_UI.md)** - Interface design decisions

## Configuration

Edit the `.env` file:

```env
CLIENT_DOWNLOAD_URL=<url-to-wow-client-zip>
DEFAULT_REALM=your.server.address
SERVER_NAME=Your Server Name
WOW_INSTALL_PATH=/path/to/install  # Optional, defaults to Documents
```

## Testing

```bash
# Quick status check
./test-status.sh

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
./run-tests.sh addon-install
./run-tests.sh addon-update
./run-tests.sh integration
```

**Current Status:** 🟢 31/31 tests passing

See [Testing Guide](docs/development/TESTING.md) for details.

## Project Structure

```
ac-launcher/
├── src/                    # Source code
│   ├── main.js            # Electron main process
│   ├── renderer.js        # UI logic
│   ├── platform-manager.js # Platform-specific code
│   └── ...
├── docs/                   # Documentation
│   ├── setup/             # Installation guides
│   ├── apple-silicon/     # M1/M2/M3 specific docs
│   ├── troubleshooting/   # Problem solving
│   └── development/       # Dev documentation
├── tests/                  # Test suites
├── resources/              # Bundled resources
│   ├── winerosetta/       # Apple Silicon patches
│   └── rosettax87/        # x87 FPU translation
└── assets/                 # Images and icons
```

## Requirements

- **All Platforms**: Node.js 16+, WoW 3.3.5a client files
- **macOS**: CrossOver 25.0.1+ (Intel or Apple Silicon)
- **Linux**: Wine 8.0+
- **Windows**: Native (no additional requirements)

## Known Issues

### Apple Silicon (M1/M2/M3)

- ⚠️ Game crashes after character select screen
- Crash: `ILLEGAL_INSTRUCTION (0xC000001D)` at address `07974360`
- See [Apple Silicon Guide](docs/apple-silicon/README.md) for details and workarounds

### General

- See [GitHub Issues](../../issues) for reported problems

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add/update tests as needed
5. Submit a pull request

## License

[Your License Here]

## Support

- **Issues**: [GitHub Issues](../../issues)
- **Discussions**: [GitHub Discussions](../../discussions)
- **Documentation**: [docs/](docs/)

## Credits

- **TurtleSilicon Project**: Apple Silicon Wine patches and tools
- **CrossOver**: macOS Wine implementation
- **MoltenVK**: Vulkan to Metal translation
- **d9vk**: DirectX 9 to Vulkan translation

---

**Version**: 1.0.36  
**Last Updated**: January 4, 2026
