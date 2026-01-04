# Documentation Index

Welcome to the WoW 3.3.5a Launcher documentation!

## 📖 Quick Links

### Getting Started
- **[Main README](../README.md)** - Project overview and quick start
- **[Setup Guide](setup/SETUP_GUIDE.md)** - Complete installation instructions
- **[CrossOver Setup (macOS)](setup/CROSSOVER_MACOS.md)** - Wine configuration for macOS

### Platform-Specific Guides
- **[Apple Silicon Support](apple-silicon/README.md)** - M1/M2/M3 Mac compatibility (⚠️ partial support)
- **[Windows Build Guide](development/WINDOWS_BUILD.md)** - Building on Windows

### Troubleshooting
- **[Download Issues](troubleshooting/DOWNLOAD_TROUBLESHOOTING.md)** - Client download problems
- **[Fixes Changelog](FIXES_CHANGELOG.md)** - Recent bug fixes and solutions

### Development
- **[Testing Guide](development/TESTING.md)** - Running and writing tests  
- **[Test Results](development/TEST_RESULTS.md)** - Current test status
- **[CI/CD Setup](development/CI_CD_SETUP.md)** - Continuous integration
- **[Cross-Platform Development](development/CROSS_PLATFORM_GUIDE.md)** - Multi-platform tips
- **[Optimization Report](development/OPTIMIZATION_REPORT.md)** - Performance improvements
- **[UI Design Decisions](development/UNIFIED_UI.md)** - Interface design

---

## 📂 Documentation Structure

```
docs/
├── README.md                    # This file
├── FIXES_CHANGELOG.md          # Bug fixes and improvements
├── setup/                      # Installation and configuration
│   ├── SETUP_GUIDE.md
│   └── CROSSOVER_MACOS.md
├── apple-silicon/              # M1/M2/M3 specific docs
│   └── README.md              # Comprehensive Apple Silicon guide
├── troubleshooting/            # Problem solving
│   └── DOWNLOAD_TROUBLESHOOTING.md
└── development/                # Developer documentation
    ├── TESTING.md
    ├── TEST_RESULTS.md
    ├── CI_CD_SETUP.md
    ├── CROSS_PLATFORM_GUIDE.md
    ├── OPTIMIZATION_REPORT.md
    └── UNIFIED_UI.md
```

---

## 🎯 Common Tasks

### Installing the Launcher
1. Read [Setup Guide](setup/SETUP_GUIDE.md)
2. If on macOS, also read [CrossOver Setup](setup/CROSSOVER_MACOS.md)
3. If on Apple Silicon, review [Apple Silicon Guide](apple-silicon/README.md)

### Troubleshooting Problems
1. Check [Download Issues](troubleshooting/DOWNLOAD_TROUBLESHOOTING.md) if download fails
2. Check [Fixes Changelog](FIXES_CHANGELOG.md) for recent bug fixes
3. Review [Apple Silicon Guide](apple-silicon/README.md) if on M1/M2/M3 Mac

### Contributing Code
1. Read [Testing Guide](development/TESTING.md)
2. Review [Cross-Platform Guide](development/CROSS_PLATFORM_GUIDE.md)
3. Check [CI/CD Setup](development/CI_CD_SETUP.md) for automation

### Building for Distribution
1. Follow [Setup Guide](setup/SETUP_GUIDE.md) for prerequisites
2. For Windows-specific builds, see [Windows Build Guide](development/WINDOWS_BUILD.md)
3. Review [Cross-Platform Guide](development/CROSS_PLATFORM_GUIDE.md) for multi-platform builds

---

## ℹ️ About This Launcher

### Platform Support Matrix

| Platform | Status | Requirements | Notes |
|----------|--------|--------------|-------|
| **Windows** | ✅ Full | Native | No additional software needed |
| **macOS Intel** | ✅ Full | CrossOver 25.0.1+ | Wine translation layer |
| **macOS Apple Silicon** | ⚠️ Partial | CrossOver 25.0.1+ | Crashes at character select ([details](apple-silicon/README.md)) |
| **Linux** | ✅ Full | Wine 8.0+ | Community tested |

### Key Features
- ✅ One-click client download and installation
- ✅ Automatic realmlist configuration
- ✅ Self-updating launcher
- ✅ Addon management
- ✅ Cross-platform UI
- ⚠️ Apple Silicon support (partial)

---

## 🆘 Getting Help

1. **Check Documentation** - Start here in the docs
2. **GitHub Issues** - Report bugs or request features
3. **GitHub Discussions** - Ask questions and share tips

---

## 📝 Documentation Guidelines

When contributing documentation:

1. **Use clear headings** - H2 for main sections, H3 for subsections
2. **Include code examples** - Show, don't just tell
3. **Add screenshots** - Visual aids help understanding
4. **Keep it updated** - Note the last update date
5. **Link between docs** - Help users navigate
6. **Test instructions** - Verify steps work as written

---

**Last Updated**: January 4, 2026  
**Launcher Version**: 1.0.36
