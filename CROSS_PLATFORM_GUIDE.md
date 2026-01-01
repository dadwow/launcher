# WoW 3.3.5a Cross-Platform Launcher Setup Guide

This launcher now supports **Windows**, **macOS**, and **Linux** with intelligent platform detection and Wine integration for non-Windows systems.

## 🚀 **Quick Start by Platform**

### **Windows (Native)**
- ✅ Native WoW.exe execution
- ✅ No additional software required
- ✅ Best performance

### **macOS (Wine/CrossOver)**
- 🍎 Automatic Wine detection
- 🎯 CrossOver support (recommended)
- 🛠 Homebrew Wine support
- 🔧 Automatic Wine prefix management

### **Linux (Wine)**
- 🐧 Wine compatibility layer
- 📦 Package manager integration
- 🎮 Lutris gaming support
- ⚡ Performance optimizations

## 📋 **Platform Requirements**

### **Windows**
- Windows 7 or newer
- WoW 3.3.5a client files
- DirectX 9 or newer

### **macOS**
- macOS 10.12 Sierra or newer
- **Option 1: CrossOver** (Recommended)
  - Commercial Wine distribution
  - Excellent WoW compatibility
  - Easy installation and management
- **Option 2: Homebrew Wine**
  - Free alternative
  - Requires XQuartz
  - Manual configuration needed

### **Linux**
- Most modern distributions
- Wine 5.0 or newer recommended
- Optional: Winetricks for components
- Optional: Lutris for gaming optimization

## 🛠 **Installation Instructions**

### **1. Install the Launcher**
```bash
# Clone and install
git clone <your-repo-url>
cd ac-launcher
npm install
```

### **2. Platform-Specific Setup**

#### **macOS Setup**

**Option A: CrossOver (Easiest)**
1. Download CrossOver from [CodeWeavers](https://www.codeweavers.com/crossover)
2. Install and launch CrossOver
3. The launcher will automatically detect CrossOver
4. Create Wine prefix through launcher Options

**Option B: Homebrew Wine**
```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install XQuartz (required for Wine)
brew install --cask xquartz

# Install Wine
brew install --cask wine-stable

# Restart your Mac
sudo reboot
```

#### **Linux Setup**

**Ubuntu/Debian:**
```bash
# Update package list
sudo apt update

# Install Wine
sudo apt install wine winetricks

# Optional: Install Lutris for gaming
sudo apt install lutris
```

**Fedora:**
```bash
# Install Wine
sudo dnf install wine winetricks

# Optional: Install Lutris
sudo dnf install lutris
```

**Arch Linux:**
```bash
# Install Wine
sudo pacman -S wine winetricks

# Optional: Install Lutris from AUR
yay -S lutris
```

### **3. Configure the Launcher**

1. **Start the launcher**: `npm start`
2. **Open Options**: Click "Options" button or Ctrl/Cmd+,
3. **Configure Installation Path**: Browse or use "Suggest" button
4. **Wine Setup** (Non-Windows):
   - Launcher will detect Wine automatically
   - Create Wine prefix if needed
   - Install Windows components automatically

## 🎮 **Wine Optimization**

The launcher automatically applies these optimizations for Wine:

### **macOS Optimizations**
- Disables Mac-specific Wine features that interfere with WoW
- Sets proper library paths
- Optimizes for macOS graphics subsystem

### **Linux Optimizations**
- Enables shader disk cache
- Activates threaded OpenGL optimizations
- Disables debug output for better performance
- Sets optimal CPU topology for WoW

### **Cross-Platform**
- Installs Visual C++ Redistributable
- Configures Windows fonts
- Sets up DirectX 9
- Optional DXVK for better graphics performance

## 🔧 **Advanced Configuration**

### **Environment Variables**
```bash
# Custom Wine prefix location
WINE_PREFIX_PATH=/custom/path/to/prefix

# Wine debug settings (Linux)
WINEDEBUG=-all

# Graphics optimizations (Linux)
__GL_SHADER_DISK_CACHE=1
__GL_THREADED_OPTIMIZATIONS=1
```

### **Manual Wine Prefix Setup**
```bash
# Create custom prefix
WINEPREFIX=~/.wine-wow wine wineboot

# Install components manually
WINEPREFIX=~/.wine-wow winetricks vcrun2019 corefonts d3dx9
```

## 🚨 **Troubleshooting**

### **Common macOS Issues**
- **"Wine not found"**: Install XQuartz and restart
- **Game crashes**: Try creating a new Wine prefix
- **Graphics issues**: Consider upgrading to CrossOver

### **Common Linux Issues**
- **Missing dependencies**: Install `lib32z1` and `lib32ncurses6`
- **Audio issues**: Install `pulseaudio-utils`
- **Font rendering**: Run `winetricks corefonts`

### **General Wine Issues**
- **Slow performance**: Enable DXVK if available
- **Connection issues**: Check firewall settings
- **Addon problems**: Ensure Wine prefix has proper permissions

## 📚 **Wine Compatibility**

### **Tested Configurations**
| Platform | Wine Version | Status | Performance |
|----------|--------------|--------|-------------|
| macOS Monterey | CrossOver 22+ | ✅ Excellent | 🟢 Native-like |
| macOS Monterey | Wine 7.0 | ✅ Good | 🟡 Playable |
| Ubuntu 22.04 | Wine 6.0+ | ✅ Excellent | 🟢 Very Good |
| Fedora 36+ | Wine 7.0+ | ✅ Excellent | 🟢 Very Good |
| Arch Linux | Wine Latest | ✅ Excellent | 🟢 Very Good |

### **Known Working Addons**
- ElvUI ✅
- Questie ✅
- Recount ✅
- Deadly Boss Mods ✅

## 💡 **Tips for Best Experience**

1. **Use CrossOver on macOS** for easiest setup
2. **Enable DXVK on Linux** for better graphics
3. **Create dedicated Wine prefix** for WoW only
4. **Install fonts properly** for UI rendering
5. **Use launcher's auto-prefix creation** for optimal setup

## 🆘 **Getting Help**

If you encounter issues:
1. Check the platform status in Options
2. Verify Wine installation
3. Try recreating the Wine prefix
4. Check the troubleshooting section above

The launcher provides detailed error messages and platform-specific guidance to help resolve issues quickly.