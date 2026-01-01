# Windows Build Output

The Windows build has been successfully generated! The following files are available in the `dist` folder:

## 🚀 **Ready-to-distribute files:**

### **For End Users:**
- **`WoW 3.3.5a Launcher Setup 1.0.0.exe`** _(136MB)_
  - Full installer with NSIS
  - Creates desktop and start menu shortcuts
  - Includes uninstaller
  - **Recommended for most users**

- **`WoW 3.3.5a Launcher 1.0.0.exe`** _(136MB)_
  - Portable executable
  - No installation required
  - Can be run from any folder
  - **Good for testing or portable usage**

### **For Development:**
- **`win-unpacked/`** - 64-bit unpacked application
- **`win-ia32-unpacked/`** - 32-bit unpacked application
- **`latest.yml`** - Auto-updater metadata

## 📋 **Build Features:**

✅ **Cross-platform built from macOS**  
✅ **Both 64-bit and 32-bit Windows support**  
✅ **NSIS installer with proper shortcuts**  
✅ **Portable version available**  
✅ **Automatic Wine installation support**  
✅ **GitHub addon management**  
✅ **Environment-based configuration**  

## 🎯 **Distribution:**

- Upload the **Setup.exe** to GitHub releases or your distribution server
- The **portable.exe** can be shared directly with users
- Both versions include all dependencies and don't require Node.js installation

## 🔧 **Build Commands:**

```bash
npm run build:win      # Build for Windows (both architectures)
npm run build:win64    # Build for Windows 64-bit only
npm run build:win32    # Build for Windows 32-bit only
npm run build:all      # Build for Windows, macOS, and Linux
```

The Windows build is now ready for distribution! 🎉