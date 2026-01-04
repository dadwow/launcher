# GitHub Actions CI/CD Pipeline

This repository is configured with automatic build and release pipeline using GitHub Actions.

## 🚀 **Automated Build Process**

### **Trigger Events:**
- **Push to main branch** → Builds all platforms + Creates GitHub release
- **Pull requests** → Builds all platforms for testing (no release)
- **Tagged commits** → Builds all platforms + Creates GitHub release

### **Build Matrix:**
The pipeline builds on three platforms simultaneously:

| Platform | OS Runner | Outputs |
|----------|-----------|---------|
| **Windows** | `windows-latest` | `.exe` installer + portable |
| **macOS** | `macos-latest` | `.dmg` + `.zip` (Intel & Apple Silicon) |
| **Linux** | `ubuntu-latest` | `.AppImage`, `.deb`, `.rpm`, `.tar.gz` |

## 📦 **Build Outputs**

### **Windows** (Built on Windows Server)
- `WoW-Launcher-Setup-v{version}.exe` - NSIS installer
- `WoW-Launcher-Portable-v{version}.exe` - Portable executable

### **macOS** (Built on macOS)
- `WoW-Launcher-v{version}.dmg` - Disk image for installation
- ZIP archive with universal binary (Intel + Apple Silicon)

### **Linux** (Built on Ubuntu)
- `WoW-Launcher-v{version}.AppImage` - Universal Linux executable
- `WoW-Launcher-v{version}.deb` - Debian/Ubuntu package
- `WoW-Launcher-v{version}.rpm` - Red Hat/Fedora package
- `WoW-Launcher-v{version}.tar.gz` - Tarball archive

## ⚙️ **Pipeline Features**

✅ **Cross-platform native compilation**  
✅ **Automatic semantic versioning** (from package.json)  
✅ **GitHub Releases with detailed changelog**  
✅ **Artifact uploading with proper MIME types**  
✅ **Build caching** for faster CI runs  
✅ **Error handling** with continue-on-error for robustness  
✅ **Wine installation** on macOS for Windows cross-compilation  

## 🔄 **Release Workflow**

1. **Developer pushes** to main branch
2. **CI detects push** and starts build matrix
3. **Three runners build simultaneously:**
   - Windows runner → Windows binaries
   - macOS runner → macOS binaries  
   - Ubuntu runner → Linux binaries
4. **Artifacts collected** from all runners
5. **GitHub release created** with version from package.json
6. **All binaries uploaded** to the release
7. **Users can download** platform-specific builds

## 📋 **Manual Builds**

You can also trigger builds manually:

```bash
# Local builds (requires platform or cross-compilation setup)
npm run build:win      # Windows
npm run build:mac      # macOS  
npm run build:linux    # Linux
npm run build:all      # All platforms

# Platform-specific architecture builds
npm run build:win64    # Windows 64-bit only
npm run build:win32    # Windows 32-bit only
```

## 🛠️ **Configuration Files**

- **`.github/workflows/release.yml`** - Main CI/CD pipeline
- **`package.json`** - Build configuration and electron-builder settings
- **`build/entitlements.mac.plist`** - macOS entitlements (for future code signing)

## 🔐 **Security & Permissions**

The pipeline uses:
- `GITHUB_TOKEN` (automatically provided) for creating releases
- No external secrets required
- Builds run in isolated GitHub-hosted runners
- Artifacts are securely stored and distributed

## 📈 **Build Status**

Each push to main will:
1. Run the full build pipeline (~15-20 minutes)
2. Create a new GitHub release if successful
3. Make binaries available for download immediately

The pipeline is designed to be robust with continue-on-error policies to ensure at least some platforms succeed even if others fail.

## 🎯 **Next Steps**

- **Code signing** can be added for Windows/macOS with appropriate certificates
- **Notarization** for macOS can be configured with Apple Developer account
- **Auto-updater** can be implemented using the generated release metadata
- **Beta releases** can be configured using branch-specific triggers

---

**The automated build pipeline ensures every commit to main produces ready-to-distribute binaries for all supported platforms!** 🚀