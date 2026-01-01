# WoW 3.3.5a Launcher - Setup Guide

## Overview
You now have a fully functional WoW 3.3.5a client launcher built with Electron and Node.js! Here's what has been implemented:

## ✅ Features Completed

### 🚀 Core Launcher Features
- **Modern Electron-based UI** with a sleek dark theme
- **Download Manager** for WoW client files with progress tracking
- **Realmlist Management** - automatically updates realmlist.wtf
- **Launch System** - properly launches WoW.exe with correct working directory
- **Settings Management** - configurable through environment variables
- **Cross-platform support** (Windows, macOS, Linux)

### 🎨 User Interface
- Clean, modern design with gradient styling
- Real-time download progress with speed indicators
- Installation status checking and validation
- Server status display
- Responsive design for different window sizes

### 🛠 Technical Features
- **Secure IPC communication** between main and renderer processes
- **File validation** - checks for WoW.exe and Data folder
- **ZIP extraction** for downloaded client files
- **Environment-based configuration**
- **Single instance prevention**
- **Proper error handling and user feedback**

## 🔧 Configuration

### 1. Environment Setup
Edit the `.env` file to configure your launcher:

```bash
# Required: URL to your WoW client ZIP file
CLIENT_DOWNLOAD_URL=https://your-server.com/wow-335a-client.zip

# Required: Your server's realm address
DEFAULT_REALM=logon.your-server.com

# Optional: Custom installation path (defaults to ~/Documents/World of Warcraft)
WOW_INSTALL_PATH=

# Display settings
SERVER_NAME=Your Awesome WoW Server
WINDOW_WIDTH=800
WINDOW_HEIGHT=600

# Development mode (shows dev tools)
DEV_MODE=false
```

### 2. Client Archive Requirements
Your `CLIENT_DOWNLOAD_URL` should point to a ZIP archive containing:
- `WoW.exe` (the main executable)
- `Data/` folder (containing all game data)
- Any other WoW client files

The archive will be automatically extracted to the installation directory.

### 3. Server Configuration
Make sure your WoW server is configured to accept connections and that the `DEFAULT_REALM` matches your server's logon address.

## 🎮 How to Use

### For End Users:
1. **Launch the application**: `npm start`
2. **Select installation directory**: Click "Browse" to choose where to install WoW
3. **Download client**: Click "Download Client" if you don't have WoW installed
4. **Configure realm**: Enter your server's realm address
5. **Launch game**: Click "Launch World of Warcraft"

### For Development:
```bash
# Development mode with dev tools
npm run dev

# Build for distribution
npm run build
```

## 🏗 Project Structure

```
ac-launcher/
├── src/
│   ├── main.js          # Main Electron process
│   ├── preload.js       # Secure IPC bridge
│   ├── index.html       # Main UI
│   ├── settings.html    # Settings modal
│   ├── styles.css       # UI styling
│   └── renderer.js      # UI logic
├── assets/              # Icons and images
├── .env                 # Configuration
├── .env.example         # Configuration template
├── package.json         # Dependencies and scripts
└── README.md           # Documentation
```

## 🔒 Security Features

- **Context isolation** enabled for security
- **Node integration disabled** in renderer
- **Secure IPC** communication via contextBridge
- **External link protection** - opens in system browser
- **Single instance enforcement**

## 🎯 Next Steps & Enhancements

You can extend this launcher with:

1. **Server Status API** - Real-time server population/status
2. **News/Updates Feed** - Display server announcements
3. **Automatic Updates** - Self-updating launcher
4. **Multiple Server Support** - Switch between different servers
5. **Account Management** - Registration/password reset
6. **Addon Management** - Download and manage addons
7. **Screenshot Gallery** - Share screenshots with community
8. **Voice Chat Integration** - Discord or TeamSpeak integration

## 🐛 Troubleshooting

### Common Issues:

1. **"Download URL not configured"**
   - Set `CLIENT_DOWNLOAD_URL` in your `.env` file

2. **"WoW client not found"**
   - Ensure your ZIP contains `WoW.exe` and `Data/` folder
   - Check the installation directory permissions

3. **"Failed to launch WoW"**
   - Verify WoW.exe exists and has execute permissions
   - Check if the installation directory is correct

4. **Download fails**
   - Verify the download URL is accessible
   - Check your internet connection
   - Ensure sufficient disk space

## 🤝 Contributing

The launcher is built with modern web technologies:
- **Electron 28+** for the desktop app framework
- **Axios** for HTTP requests and downloads
- **node-stream-zip** for ZIP file extraction
- **fs-extra** for enhanced file system operations
- **dotenv** for environment configuration

## 📝 License
MIT License - Feel free to modify and distribute!

---

**Congratulations!** 🎉 Your WoW 3.3.5a launcher is ready to use. Just configure your `.env` file with your server details and client download URL, and you're good to go!