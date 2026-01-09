const { app, BrowserWindow, Menu, ipcMain, dialog, shell, session } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const axios = require('axios');
const StreamZip = require('node-stream-zip');
// Use a pure JS git client to avoid requiring system git
const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');

// Handle uncaught exceptions (especially EPIPE errors from broken pipes)
process.on('uncaughtException', error => {
    // Ignore EPIPE errors (broken pipe when stdout/stderr is closed)
    if (error.code === 'EPIPE') {
        return;
    }
    console.error('Uncaught exception:', error);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, _promise) => {
    console.error('Unhandled promise rejection:', reason);
});

// Disable signature verification BEFORE importing autoUpdater
process.env.ELECTRON_UPDATER_ALLOW_UNSIGNED = '1';

const { autoUpdater } = require('electron-updater');
const PlatformManager = require('./platform-manager');

// Configure autoUpdater - disable all notifications, handle UI manually
autoUpdater.autoDownload = false; // Don't auto-download updates
autoUpdater.autoInstallOnAppQuit = true; // Install on quit if downloaded
autoUpdater.logger = null; // Disable console logging
autoUpdater.allowDowngrade = false; // Don't allow downgrades
autoUpdater.fullChangelog = false; // Don't fetch full changelog
autoUpdater.allowPrerelease = false; // Don't check for pre-releases

// Disable signature verification for Windows and macOS only in development/unsigned builds
if (!app.isPackaged) {
    if (process.platform === 'win32') {
        // Force update to bypass signature check on Windows (development only)
        autoUpdater.forceDevUpdateConfig = true;
    }

    if (process.platform === 'darwin') {
        // Disable signature verification on macOS for unsigned builds (development only)
        // This allows auto-updates to work without code signing certificates
        autoUpdater.forceDevUpdateConfig = true;
        // Allow downgrades explicitly for macOS unsigned builds
        autoUpdater.allowDowngrade = true;
    }
}

// Load .env from multiple possible locations
const dotenv = require('dotenv');
const envPaths = [
    path.join(__dirname, '.env'), // Development: src/.env
    path.join(__dirname, '..', '.env'), // Development: root/.env
    path.join(process.resourcesPath, '.env'), // Production: resources/.env
    path.join(app.getAppPath(), '.env') // Production: app/.env
];

let envLoaded = false;
for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
        console.log(`Loading .env from: ${envPath}`);
        dotenv.config({ path: envPath });
        envLoaded = true;
        break;
    }
}

if (!envLoaded) {
    console.warn('Warning: .env file not found in any expected location. Using defaults.');
    console.log('Searched paths:', envPaths);
}

// Keep a global reference of the window object
let mainWindow;
let optionsWindow;
let platformManager;
const downloadState = {
    isDownloading: false,
    isPaused: false,
    controller: null,
    response: null,
    writer: null,
    downloadedBytes: 0,
    totalBytes: 0,
    startTime: 0
};

// App configuration from environment
console.log('Environment variables loaded:');
console.log('DEFAULT_REALM:', process.env.DEFAULT_REALM);
console.log('SERVER_NAME:', process.env.SERVER_NAME);
console.log('CLIENT_DOWNLOAD_URL:', process.env.CLIENT_DOWNLOAD_URL);

const config = {
    width: parseInt(process.env.WINDOW_WIDTH) || 800,
    height: parseInt(process.env.WINDOW_HEIGHT) || 600,
    devMode: process.env.DEV_MODE === 'true',
    serverName: process.env.SERVER_NAME || 'WoW Server',
    defaultRealm: process.env.DEFAULT_REALM || 'logon.server.com',
    downloadUrl: process.env.CLIENT_DOWNLOAD_URL || '',
    installPath:
        process.env.WOW_INSTALL_PATH || path.join(os.homedir(), 'Documents', 'World of Warcraft')
};

console.log('Launcher configuration:', {
    serverName: config.serverName,
    defaultRealm: config.defaultRealm,
    hasDownloadUrl: !!config.downloadUrl,
    installPath: config.installPath,
    platform: process.platform
});

// Auto-updater event handlers
autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...');
    if (mainWindow) {
        mainWindow.webContents.send('update-status', { status: 'checking' });
    }
});

autoUpdater.on('update-available', info => {
    console.log('Update available:', info.version);
    if (mainWindow) {
        mainWindow.webContents.send('update-status', {
            status: 'available',
            version: info.version
        });
    }
});

autoUpdater.on('update-not-available', _info => {
    console.log('Update not available');
    if (mainWindow) {
        mainWindow.webContents.send('update-status', { status: 'not-available' });
    }
});

autoUpdater.on('error', err => {
    console.error('Update error:', err);
    if (mainWindow) {
        mainWindow.webContents.send('update-status', {
            status: 'error',
            message: err.message
        });
    }
});

autoUpdater.on('download-progress', progressObj => {
    if (mainWindow) {
        mainWindow.webContents.send('update-status', {
            status: 'downloading',
            percent: progressObj.percent,
            transferred: progressObj.transferred,
            total: progressObj.total
        });
    }
});

autoUpdater.on('update-downloaded', info => {
    console.log('Update downloaded');
    if (mainWindow) {
        mainWindow.webContents.send('update-status', {
            status: 'downloaded',
            version: info.version
        });
    }
});

function createWindow() {
    console.log('Creating main window...');

    // Create the browser window
    mainWindow = new BrowserWindow({
        width: config.width,
        height: config.height,
        minWidth: config.width,
        minHeight: config.height,
        maxWidth: config.width,
        maxHeight: config.height,
        resizable: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        title: `${config.serverName} Launcher`,
        icon: path.join(__dirname, '../assets/icon.png'),
        show: false, // Don't show until ready
        frame: false, // Frameless window for custom title bar
        transparent: false, // Keep false for better performance
        backgroundColor: '#0a1520',
        titleBarStyle: 'hidden', // Hide default title bar on macOS
        roundedCorners: true, // Enable rounded corners (Windows 11)
        ...(process.platform === 'win32' && {
            backgroundMaterial: 'acrylic' // Windows 11 acrylic effect
        })
    });

    console.log('Window created, loading index.html...');

    // Load the app
    mainWindow
        .loadFile(path.join(__dirname, 'index.html'))
        .then(() => {
            console.log('index.html loaded successfully');
        })
        .catch(err => {
            console.error('Failed to load index.html:', err);
        });

    // Show window when ready to prevent visual flash
    mainWindow.once('ready-to-show', () => {
        console.log('Window ready to show');
        mainWindow.show();

        // Open DevTools in development mode
        if (config.devMode) {
            console.log('Opening DevTools (dev mode)');
            mainWindow.webContents.openDevTools();
        }
    });

    // Log console messages from renderer (with error handling for EPIPE)
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        try {
            console.log(`[Renderer ${level}] ${message} (${sourceId}:${line})`);
        } catch (error) {
            // Ignore EPIPE errors when stdout is closed
            if (error.code !== 'EPIPE') {
                console.error('Error logging renderer message:', error);
            }
        }
    });

    // Log any errors in the renderer
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        try {
            console.error('Page failed to load:', errorCode, errorDescription);
        } catch (error) {
            // Ignore EPIPE errors
            if (error.code !== 'EPIPE') {
                console.error('Error logging load failure:', error);
            }
        }
    });

    // Handle window closed
    mainWindow.on('closed', () => {
        console.log('Main window closed');
        mainWindow = null;
    });

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
}

function createSettingsWindow() {
    if (optionsWindow) {
        optionsWindow.focus();
        return;
    }

    optionsWindow = new BrowserWindow({
        width: 700,
        height: 600,
        parent: mainWindow,
        modal: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        title: 'Options',
        resizable: true,
        minimizable: false,
        maximizable: false,
        frame: false, // Frameless for consistency
        backgroundColor: '#0a1520',
        titleBarStyle: 'hidden',
        roundedCorners: true
    });

    optionsWindow.loadFile(path.join(__dirname, 'options.html'));

    if (config.devMode) {
        optionsWindow.webContents.openDevTools();
    }

    optionsWindow.on('closed', () => {
        optionsWindow = null;
    });
}

function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Options',
                    accelerator: 'CmdOrCtrl+,',
                    click: () => createSettingsWindow()
                },
                { type: 'separator' },
                {
                    label: 'Quit',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                    click: () => app.quit()
                }
            ]
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Reload',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => mainWindow.reload()
                },
                {
                    label: 'Force Reload',
                    accelerator: 'CmdOrCtrl+Shift+R',
                    click: () => mainWindow.webContents.reloadIgnoringCache()
                },
                {
                    label: 'Toggle Developer Tools',
                    accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
                    click: () => mainWindow.webContents.toggleDevTools()
                }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'Check for Updates',
                    click: () => {
                        autoUpdater.checkForUpdates();
                    }
                },
                { type: 'separator' },
                {
                    label: 'About',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'About',
                            message: `${config.serverName} Launcher`,
                            detail: `World of Warcraft 3.3.5a Client Launcher\nVersion: ${app.getVersion()}\nBuilt with Electron and Node.js`
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);

    // Hide menu on Windows (but keep it on macOS and Linux)
    if (process.platform === 'win32') {
        Menu.setApplicationMenu(null);
    } else {
        Menu.setApplicationMenu(menu);
    }
}

// App event handlers
app.whenReady()
    .then(async () => {
        try {
            // Clear app cache on version change to ensure GUI updates properly
            const userDataPath = app.getPath('userData');
            const versionFile = path.join(userDataPath, 'app-version.txt');
            const currentVersion = app.getVersion();
            let shouldClearCache = false;

            try {
                if (await fs.pathExists(versionFile)) {
                    const savedVersion = (await fs.readFile(versionFile, 'utf8')).trim();
                    if (savedVersion !== currentVersion) {
                        console.log(
                            `Version changed from ${savedVersion} to ${currentVersion} - clearing cache`
                        );
                        shouldClearCache = true;
                    }
                } else {
                    console.log('First run or version file missing - clearing cache');
                    shouldClearCache = true;
                }

                // Clear cache if version changed
                if (shouldClearCache) {
                    await session.defaultSession.clearCache();
                    console.log('App cache cleared successfully');
                    // Save current version only after successful cache clear
                    await fs.writeFile(versionFile, currentVersion, 'utf8');
                } else {
                    // No cache clear needed; still ensure version file is up to date
                    await fs.writeFile(versionFile, currentVersion, 'utf8');
                }
            } catch (err) {
                console.error('Failed to check/clear cache:', err);
                // Continue anyway - this shouldn't break the app
            }

            // Register as handler for wow:// protocol URLs
            if (app.setAsDefaultProtocolClient) {
                app.setAsDefaultProtocolClient('wow');
            }

            // Initialize platform manager
            console.log('Initializing platform manager...');
            platformManager = new PlatformManager();
            console.log('Platform manager initialized');

            createWindow();
            createMenu();

            // Check for updates after a short delay (2 seconds) to let the app fully load
            setTimeout(() => {
                if (!config.devMode && mainWindow) {
                    // Notify UI that we're checking for updates (show loading state)
                    mainWindow.webContents.send('update-check-starting');

                    // Silently check for updates - no notifications
                    autoUpdater
                        .checkForUpdates()
                        .catch(err => {
                            // Suppress update check errors - don't notify user
                            console.error('Auto-updater check failed (suppressed):', err.message);
                        })
                        .finally(() => {
                            // Always re-enable UI after check completes (success or failure)
                            if (mainWindow) {
                                mainWindow.webContents.send('update-check-complete');
                            }
                        });
                }
            }, 2000);
        } catch (error) {
            console.error('Failed to initialize application:', error);
            dialog.showErrorBox(
                'Initialization Error',
                `Failed to start the launcher.\n\nError: ${error.message}\n\nPlease check the console logs for details.`
            );
            app.quit();
        }

        app.on('activate', () => {
            // On macOS, re-create window when dock icon is clicked
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    })
    .catch(error => {
        console.error('App failed to initialize:', error);
        app.quit();
    });

app.on('window-all-closed', () => {
    // On macOS, keep app running even when all windows are closed
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC handlers
ipcMain.handle('get-config', () => {
    try {
        if (!platformManager) {
            throw new Error('Platform manager not initialized');
        }

        const configData = {
            serverName: config.serverName,
            defaultRealm: config.defaultRealm,
            installPath: config.installPath,
            downloadUrl: config.downloadUrl,
            platform: platformManager.getPlatformInfo(),
            version: app.getVersion()
        };

        console.log('Returning config to renderer:', configData);
        return configData;
    } catch (error) {
        console.error('Error in get-config handler:', error);
        throw error;
    }
});

// Auto-updater IPC handlers
ipcMain.handle('check-for-updates', async () => {
    try {
        const result = await autoUpdater.checkForUpdates();
        return result;
    } catch (error) {
        console.error('Error checking for updates:', error);
        throw error;
    }
});

ipcMain.handle('download-update', async () => {
    try {
        await autoUpdater.downloadUpdate();
        return true;
    } catch (error) {
        console.error('Error downloading update:', error);
        throw error;
    }
});

ipcMain.handle('install-update', () => {
    // Quit, install, and automatically restart the app (like Discord)
    // isSilent=true: don't show dialogs during installation
    // isForceRunAfter=true: automatically restart after install
    autoUpdater.quitAndInstall(true, true);
});

// Window controls for frameless window
ipcMain.handle('window-minimize', event => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) window.minimize();
});

ipcMain.handle('window-maximize', event => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
        if (window.isMaximized()) {
            window.unmaximize();
        } else {
            window.maximize();
        }
    }
});

ipcMain.handle('window-close', event => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) window.close();
});

ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select WoW Installation Directory'
    });

    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

ipcMain.handle('check-wow-installation', async (event, installPath) => {
    try {
        return await platformManager.validateWoWInstallation(installPath);
    } catch (error) {
        return {
            isValid: false,
            hasExecutable: false,
            hasData: false,
            hasRealmlist: false,
            platform: platformManager.getPlatformName(),
            error: error.message
        };
    }
});

// Download functionality
// Validate download URL before starting download
async function validateDownloadUrl(url) {
    try {
        const response = await axios.head(url, {
            timeout: 10000,
            maxRedirects: 10,
            headers: {
                'User-Agent': 'PlusCraft-Launcher/1.0'
            }
        });

        const contentType = response.headers['content-type'] || '';
        const contentLength = response.headers['content-length'];

        console.log('URL validation result:', {
            status: response.status,
            contentType,
            contentLength,
            finalUrl: response.config.url
        });

        // Check if it's likely a zip file
        if (
            !contentType.includes('application/zip') &&
            !contentType.includes('application/octet-stream') &&
            !contentType.includes('application/x-zip-compressed')
        ) {
            console.warn('Warning: Content-Type does not indicate a zip file:', contentType);
        }

        return {
            valid: true,
            contentLength: parseInt(contentLength, 10) || 0,
            contentType
        };
    } catch (error) {
        console.error('URL validation failed:', error);
        return {
            valid: false,
            error: error.message
        };
    }
}

ipcMain.handle('start-download', async (event, url, destination) => {
    if (downloadState.isDownloading) {
        throw new Error('Download already in progress');
    }

    console.log('Starting download:', { url, destination });

    // Validate URL before starting download
    const validation = await validateDownloadUrl(url);
    if (!validation.valid) {
        throw new Error('Invalid or inaccessible download URL: ' + validation.error);
    }

    try {
        downloadState.controller = new AbortController();
        downloadState.isDownloading = true;
        downloadState.isPaused = false;
        downloadState.downloadedBytes = 0;
        downloadState.startTime = Date.now();

        // Create destination directory if it doesn't exist
        await fs.ensureDir(destination);

        const zipPath = path.join(destination, 'wow-client.zip');

        console.log('Initiating HTTP request to:', url);

        // Start the download with comprehensive error handling
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            signal: downloadState.controller.signal,
            timeout: 30000, // 30 second timeout for initial connection
            maxRedirects: 10, // Allow redirects (for bit.ly URLs)
            validateStatus: status => status >= 200 && status < 300,
            headers: {
                'User-Agent': 'PlusCraft-Launcher/1.0'
            }
        });

        console.log('Download response received:', {
            status: response.status,
            contentLength: response.headers['content-length'],
            contentType: response.headers['content-type']
        });

        downloadState.totalBytes = parseInt(response.headers['content-length'], 10) || 0;
        downloadState.response = response;

        if (downloadState.totalBytes === 0) {
            console.warn(
                'Warning: Content-Length header not present, progress tracking may be limited'
            );
        }

        const writer = fs.createWriteStream(zipPath);
        downloadState.writer = writer;

        let downloadedBytes = 0;
        let lastProgressTime = Date.now();

        // Handle stream errors
        writer.on('error', error => {
            console.error('Write stream error:', error);
            downloadState.isDownloading = false;
            if (!downloadState.controller.signal.aborted) {
                mainWindow.webContents.send('download-error', {
                    message: 'Failed to write download file: ' + error.message
                });
            }
        });

        response.data.on('data', chunk => {
            if (!downloadState.isPaused && downloadState.isDownloading) {
                try {
                    writer.write(chunk);
                    downloadedBytes += chunk.length;
                    downloadState.downloadedBytes = downloadedBytes;

                    // Throttle progress updates to avoid overwhelming the UI
                    const now = Date.now();
                    if (now - lastProgressTime > 100) {
                        // Update every 100ms
                        const percent =
                            downloadState.totalBytes > 0
                                ? (downloadedBytes / downloadState.totalBytes) * 100
                                : 0;
                        const elapsed = (now - downloadState.startTime) / 1000;
                        const bytesPerSecond = elapsed > 0 ? downloadedBytes / elapsed : 0;

                        mainWindow.webContents.send('download-progress', {
                            transferred: downloadedBytes,
                            total: downloadState.totalBytes,
                            percent: Math.round(percent * 100) / 100,
                            bytesPerSecond: bytesPerSecond
                        });

                        lastProgressTime = now;
                    }
                } catch (writeError) {
                    console.error('Error writing chunk:', writeError);
                    downloadState.isDownloading = false;
                    mainWindow.webContents.send('download-error', {
                        message: 'Write error: ' + writeError.message
                    });
                }
            }
        });

        response.data.on('end', async () => {
            console.log('Download stream ended, total bytes downloaded:', downloadedBytes);

            try {
                await new Promise((resolve, reject) => {
                    writer.end(error => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve();
                        }
                    });
                });

                if (!downloadState.isPaused && downloadState.isDownloading) {
                    console.log('Starting file extraction...');

                    // Extract the zip file
                    mainWindow.webContents.send('download-progress', {
                        transferred: downloadState.totalBytes || downloadedBytes,
                        total: downloadState.totalBytes || downloadedBytes,
                        percent: 100,
                        bytesPerSecond: 0
                    });

                    // Send extraction progress
                    mainWindow.webContents.send('extraction-progress', {
                        status: 'extracting'
                    });

                    await extractZipFile(zipPath, destination);

                    // Clean up zip file
                    console.log('Cleaning up zip file...');
                    await fs.remove(zipPath);

                    downloadState.isDownloading = false;
                    console.log('Download completed successfully');
                    mainWindow.webContents.send('download-complete');
                }
            } catch (extractError) {
                console.error('Extraction/cleanup error:', extractError);
                downloadState.isDownloading = false;
                mainWindow.webContents.send('download-error', {
                    message: 'Failed to extract files: ' + extractError.message
                });
            }
        });

        response.data.on('error', error => {
            console.error('Download stream error:', error);
            downloadState.isDownloading = false;

            // Close writer if it exists
            if (downloadState.writer) {
                try {
                    downloadState.writer.destroy();
                } catch (e) {
                    console.error('Error destroying writer:', e);
                }
            }

            if (!downloadState.controller.signal.aborted) {
                const errorMessage =
                    error.code === 'ENOTFOUND'
                        ? 'Network error: Unable to connect to download server'
                        : error.code === 'ECONNRESET'
                          ? 'Connection was reset by the server'
                          : error.code === 'ETIMEDOUT'
                            ? 'Download timed out'
                            : 'Download error: ' + error.message;

                mainWindow.webContents.send('download-error', { message: errorMessage });
            }
        });
    } catch (error) {
        console.error('Download initialization error:', error);
        downloadState.isDownloading = false;

        let errorMessage = 'Failed to start download';

        if (error.code === 'ENOTFOUND') {
            errorMessage = 'Invalid download URL or network connection issue';
        } else if (error.code === 'ECONNREFUSED') {
            errorMessage = 'Download server refused connection';
        } else if (error.response) {
            errorMessage = `Server responded with ${error.response.status}: ${error.response.statusText}`;
        } else if (error.message.includes('timeout')) {
            errorMessage = 'Connection timed out while connecting to download server';
        } else {
            errorMessage = error.message;
        }

        throw new Error(errorMessage);
    }
});

ipcMain.handle('pause-download', async () => {
    if (downloadState.isDownloading && !downloadState.isPaused) {
        downloadState.isPaused = true;
        return true;
    }
    return false;
});

ipcMain.handle('resume-download', async () => {
    if (downloadState.isDownloading && downloadState.isPaused) {
        downloadState.isPaused = false;
        return true;
    }
    return false;
});

ipcMain.handle('cancel-download', async () => {
    if (downloadState.isDownloading) {
        downloadState.isDownloading = false;
        downloadState.isPaused = false;

        if (downloadState.controller) {
            downloadState.controller.abort();
        }

        if (downloadState.writer) {
            downloadState.writer.destroy();
        }

        return true;
    }
    return false;
});

// Validate GitHub repo for WoW addon
ipcMain.handle('validate-addon-repo', async (event, owner, repo) => {
    try {
        // Check if repo exists and get basic info
        const repoResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
            headers: { 'User-Agent': 'PlusCraft-Launcher' }
        });

        const repoData = repoResponse.data;

        // Get repo contents to check for .toc files
        const contentsResponse = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/contents`,
            {
                headers: { 'User-Agent': 'PlusCraft-Launcher' }
            }
        );

        const contents = contentsResponse.data;

        // Check for .toc files in root
        const hasTocInRoot = contents.some(
            file => file.name.endsWith('.toc') && file.type === 'file'
        );

        let tocFiles = [];
        const addonFolders = [];

        if (hasTocInRoot) {
            // Root is the addon
            tocFiles = contents.filter(file => file.name.endsWith('.toc')).map(f => f.name);
        } else {
            // Check subdirectories for .toc files
            const directories = contents.filter(item => item.type === 'dir');

            for (const dir of directories.slice(0, 10)) {
                // Limit to first 10 dirs
                try {
                    const dirContentsResponse = await axios.get(dir.url, {
                        headers: { 'User-Agent': 'PlusCraft-Launcher' }
                    });
                    const dirContents = dirContentsResponse.data;
                    const dirTocFiles = dirContents.filter(file => file.name.endsWith('.toc'));

                    if (dirTocFiles.length > 0) {
                        addonFolders.push({
                            folder: dir.name,
                            tocFiles: dirTocFiles.map(f => f.name)
                        });
                    }
                } catch (err) {
                    console.error(`Error checking directory ${dir.name}:`, err.message);
                }
            }
        }

        // Get README
        let readme = null;
        try {
            const readmeResponse = await axios.get(
                `https://api.github.com/repos/${owner}/${repo}/readme`,
                {
                    headers: {
                        'User-Agent': 'PlusCraft-Launcher',
                        Accept: 'application/vnd.github.v3.raw'
                    }
                }
            );
            readme = readmeResponse.data;
        } catch {
            console.log('No README found');
        }

        // Get latest release
        let latestRelease = null;
        try {
            const releaseResponse = await axios.get(
                `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
                {
                    headers: { 'User-Agent': 'PlusCraft-Launcher' }
                }
            );
            latestRelease = releaseResponse.data;
        } catch {
            console.log('No releases found');
        }

        // Get recent releases
        let releases = [];
        try {
            const releasesResponse = await axios.get(
                `https://api.github.com/repos/${owner}/${repo}/releases?per_page=5`,
                {
                    headers: { 'User-Agent': 'PlusCraft-Launcher' }
                }
            );
            releases = releasesResponse.data;
        } catch {
            console.log('No releases found');
        }

        const isValid = hasTocInRoot || addonFolders.length > 0;

        return {
            valid: isValid,
            repoData: {
                name: repoData.name,
                fullName: repoData.full_name,
                description: repoData.description,
                stars: repoData.stargazers_count,
                language: repoData.language,
                updatedAt: repoData.updated_at,
                defaultBranch: repoData.default_branch
            },
            addonInfo: {
                hasTocInRoot,
                tocFiles,
                addonFolders
            },
            readme,
            latestRelease,
            releases
        };
    } catch (error) {
        console.error('Error validating addon repo:', error.message);
        return {
            valid: false,
            error: error.response?.status === 404 ? 'Repository not found' : error.message
        };
    }
});

// Get GitHub repo info
ipcMain.handle('get-repo-info', async (event, owner, repo) => {
    try {
        const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
            headers: { 'User-Agent': 'PlusCraft-Launcher' }
        });

        const data = response.data;
        return {
            name: data.name,
            fullName: data.full_name,
            description: data.description,
            stars: data.stargazers_count,
            forks: data.forks_count,
            language: data.language,
            updatedAt: data.updated_at,
            defaultBranch: data.default_branch,
            homepage: data.homepage,
            topics: data.topics
        };
    } catch (error) {
        console.error('Error fetching repo info:', error.message);
        throw new Error(error.response?.status === 404 ? 'Repository not found' : error.message);
    }
});

// Validate addon repository without requiring GitHub API (uses git refs)
ipcMain.handle('validateAddonRepo', async (event, owner, repo) => {
    try {
        const url = `https://github.com/${owner}/${repo}.git`;
        // Attempt to list refs to confirm repository exists and is reachable
        const refs = await git.listServerRefs({ http, url });
        const hasRefs = Array.isArray(refs) && refs.length > 0;
        if (hasRefs) {
            return { valid: true, addonInfo: { hasTocInRoot: false } };
        }
        return { valid: false, error: 'Repository unreachable or has no refs' };
    } catch (error) {
        // Treat rate limits or network errors as non-fatal for validation
        return { valid: true, note: `Validation fallback: ${error.message}` };
    }
});

// Get GitHub repo branches
ipcMain.handle('get-repo-branches', async (event, owner, repo) => {
    try {
        const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/branches`, {
            headers: { 'User-Agent': 'PlusCraft-Launcher' }
        });

        return response.data.map(branch => ({
            name: branch.name,
            commit: {
                sha: branch.commit.sha,
                url: branch.commit.url
            },
            protected: branch.protected
        }));
    } catch (error) {
        console.error('Error fetching branches:', error.message);
        throw new Error(error.response?.status === 404 ? 'Repository not found' : error.message);
    }
});

// Get GitHub repo README
ipcMain.handle('get-repo-readme', async (event, owner, repo) => {
    try {
        const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/readme`, {
            headers: {
                'User-Agent': 'PlusCraft-Launcher',
                Accept: 'application/vnd.github.v3.raw'
            }
        });

        return response.data;
    } catch (error) {
        console.error('Error fetching README:', error.message);
        if (error.response?.status === 404) {
            return null; // No README found
        }
        throw new Error(error.message);
    }
});

// Check for addon updates
ipcMain.handle('check-addon-updates', async (event, installPath) => {
    try {
        const addonsPath = path.join(installPath, 'Interface', 'AddOns');
        const addonDirs = await fs.readdir(addonsPath);

        const updates = [];

        for (const dir of addonDirs) {
            const addonPath = path.join(addonsPath, dir);
            const stat = await fs.stat(addonPath);

            if (!stat.isDirectory()) continue;

            // Check for .github-repo file
            const repoFilePath = path.join(addonPath, '.github-repo');
            const metadataPath = path.join(addonPath, '.github-addon-metadata');

            if (await fs.pathExists(repoFilePath)) {
                try {
                    const repoContent = await fs.readFile(repoFilePath, 'utf8');
                    const [owner, repo] = repoContent.trim().split('/');

                    if (!owner || !repo) continue;

                    // Get current metadata (if exists)
                    let currentCommit = null;
                    let currentBranch = 'main';
                    if (await fs.pathExists(metadataPath)) {
                        const metadata = await fs.readJson(metadataPath);
                        currentCommit = metadata.commitHash;
                        currentBranch = metadata.branch || 'main';
                    }

                    // Get latest commit from GitHub
                    const response = await axios.get(
                        `https://api.github.com/repos/${owner}/${repo}/commits/${currentBranch}`,
                        {
                            headers: { 'User-Agent': 'PlusCraft-Launcher' }
                        }
                    );

                    const latestCommit = response.data.sha;
                    const latestCommitShort = latestCommit.substring(0, 7);

                    // Check if update is available
                    if (!currentCommit || currentCommit !== latestCommit) {
                        updates.push({
                            addonName: dir,
                            owner,
                            repo,
                            currentCommit: currentCommit
                                ? currentCommit.substring(0, 7)
                                : 'unknown',
                            latestCommit: latestCommitShort,
                            latestCommitFull: latestCommit,
                            branch: currentBranch,
                            hasUpdate: true
                        });
                    }
                } catch (error) {
                    console.error(`Error checking updates for ${dir}:`, error.message);
                }
            }
        }

        return updates;
    } catch (error) {
        console.error('Error checking for updates:', error);
        throw new Error(error.message);
    }
});

// Update a specific addon
ipcMain.handle('update-addon', async (event, addonName, installPath) => {
    try {
        const addonPath = path.join(installPath, 'Interface', 'AddOns', addonName);
        const repoFilePath = path.join(addonPath, '.github-repo');

        if (!(await fs.pathExists(repoFilePath))) {
            throw new Error('Addon does not have GitHub repository information');
        }

        const repoContent = await fs.readFile(repoFilePath, 'utf8');
        const [owner, repo] = repoContent.trim().split('/');

        if (!owner || !repo) {
            throw new Error('Invalid repository information');
        }

        // Get current branch if available
        const metadataPath = path.join(addonPath, '.github-addon-metadata');
        let branch = 'main';
        if (await fs.pathExists(metadataPath)) {
            const metadata = await fs.readJson(metadataPath);
            branch = metadata.branch || 'main';
        }

        // Uninstall current version
        await fs.remove(addonPath);

        // Reinstall from GitHub
        const addonsPath = path.join(installPath, 'Interface', 'AddOns');
        const hasGit = await checkGitAvailable();

        if (hasGit) {
            return await installAddonWithGit(owner, repo, addonsPath, branch);
        } else {
            return await installAddonWithArchive(owner, repo, addonsPath, branch);
        }
    } catch (error) {
        console.error('Error updating addon:', error);
        throw new Error(error.message);
    }
});

// Realmlist management
ipcMain.handle('update-realmlist', async (event, installPath, realmAddress) => {
    try {
        const realmlistPath = path.join(installPath, 'Data', 'enUS', 'realmlist.wtf');
        const realmlistContent = `set realmlist ${realmAddress}\n`;

        // Ensure the Data/enUS directory exists
        await fs.ensureDir(path.dirname(realmlistPath));
        await fs.writeFile(realmlistPath, realmlistContent, 'utf8');
        return true;
    } catch (error) {
        throw new Error('Failed to update realmlist: ' + error.message);
    }
});

ipcMain.handle('get-realmlist', async (event, installPath) => {
    try {
        const realmlistPath = path.join(installPath, 'Data', 'enUS', 'realmlist.wtf');

        if (await fs.pathExists(realmlistPath)) {
            const content = await fs.readFile(realmlistPath, 'utf8');
            const match = content.match(/set realmlist (.+)/i);
            return match ? match[1].trim() : null;
        }

        return null;
    } catch (error) {
        throw new Error('Failed to read realmlist: ' + error.message);
    }
});

// Launch WoW
ipcMain.handle('launch-wow', async (event, installPath) => {
    try {
        const result = await platformManager.launchWoW(installPath);

        // Minimize the launcher window when WoW launches
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.minimize();
        }

        // Monitor the WoW process and restore window when it closes
        if (result.process) {
            result.process.on('exit', () => {
                console.log('WoW process exited, restoring launcher window');
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.restore();
                    mainWindow.focus();
                }
            });
        }

        return result.success;
    } catch (error) {
        throw new Error('Failed to launch WoW: ' + error.message);
    }
});

// Settings management
ipcMain.handle('save-settings', async (event, settings) => {
    try {
        const settingsPath = path.join(app.getPath('userData'), 'settings.json');
        await fs.writeJson(settingsPath, settings, { spaces: 2 });
        return true;
    } catch (error) {
        throw new Error('Failed to save settings: ' + error.message);
    }
});

ipcMain.handle('load-settings', async () => {
    try {
        const settingsPath = path.join(app.getPath('userData'), 'settings.json');

        if (await fs.pathExists(settingsPath)) {
            return await fs.readJson(settingsPath);
        }

        return {};
    } catch (error) {
        console.error('Failed to load settings:', error);
        return {};
    }
});

// Helper function to extract zip files
async function extractZipFile(zipPath, extractPath) {
    let zip;
    try {
        // Ensure extract path exists
        await fs.ensureDir(extractPath);

        // Open and extract zip file
        zip = new StreamZip.async({ file: zipPath });
        await zip.extract(null, extractPath);
        await zip.close();
        zip = null;

        // Check if extraction created a single root folder with no files
        const extractedContents = await fs.readdir(extractPath);

        // Filter out hidden files and zip files
        const visibleContents = extractedContents.filter(
            item => !item.startsWith('.') && !item.endsWith('.zip')
        );

        // If there's only one visible item and it's a directory,
        // check if we should move its contents up
        if (visibleContents.length === 1) {
            const singleItem = visibleContents[0];
            const singleItemPath = path.join(extractPath, singleItem);

            try {
                const stat = await fs.stat(singleItemPath);

                if (stat.isDirectory()) {
                    // Check if this folder contains WoW.exe
                    const nestedContents = await fs.readdir(singleItemPath);
                    const hasWowExe = nestedContents.some(item => item.toLowerCase() === 'wow.exe');

                    // Only move contents up if this appears to be the WoW client folder
                    if (hasWowExe) {
                        console.log(
                            `Found nested WoW client in folder: ${singleItem}, moving contents up...`
                        );

                        // Move contents from nested folder to parent
                        for (const item of nestedContents) {
                            const oldPath = path.join(singleItemPath, item);
                            const newPath = path.join(extractPath, item);
                            await fs.move(oldPath, newPath, { overwrite: true });
                        }

                        // Remove the now-empty nested folder
                        await fs.remove(singleItemPath);
                        console.log('Successfully flattened nested directory structure');
                    } else {
                        console.log(
                            "Single folder found but doesn't contain WoW.exe, leaving structure as-is"
                        );
                    }
                }
            } catch (statError) {
                console.error('Error processing nested folder:', statError);
                // Continue anyway - the extraction itself succeeded
            }
        }
    } catch (error) {
        // Make sure to close zip if it's still open
        if (zip) {
            try {
                await zip.close();
            } catch (closeError) {
                console.error('Error closing zip:', closeError);
            }
        }
        throw new Error(`Failed to extract zip file: ${error.message}`);
    }
}

// Addon management IPC handlers
ipcMain.handle('install-addon-from-github', async (event, owner, repo, installPath, branch) => {
    try {
        const addonPath = path.join(installPath, 'Interface', 'AddOns');
        await fs.ensureDir(addonPath);

        // Check if git is available
        const hasGit = await checkGitAvailable();

        if (hasGit) {
            console.log('Using git clone for addon installation');
            return await installAddonWithGit(owner, repo, addonPath, branch);
        } else {
            console.log('Git not available, falling back to archive download');
            return await installAddonWithArchive(owner, repo, addonPath, branch);
        }
    } catch (error) {
        console.error('Addon installation error:', error);
        throw error;
    }
});

// With isomorphic-git we don't require system git
async function checkGitAvailable() {
    return true;
}

// Install addon using git clone
async function installAddonWithGit(owner, repo, addonPath, branch = null) {
    const repoUrl = `https://github.com/${owner}/${repo}.git`;
    const tempClonePath = path.join(addonPath, `temp_${repo}`);
    const startedAt = Date.now();
    let lastTick = startedAt;
    let lastLoaded = 0;

    // Remove temp directory if it exists
    if (await fs.pathExists(tempClonePath)) {
        await fs.remove(tempClonePath);
    }

    console.log(`Cloning ${repoUrl} to ${tempClonePath}${branch ? ` (branch: ${branch})` : ''}`);
    // Clone using isomorphic-git (no system git required)
    await fs.ensureDir(tempClonePath);
    if (mainWindow) {
        mainWindow.webContents.send('addon-install-progress', {
            status: 'Starting clone...',
            percent: 0,
            speed: 0
        });
    }

    await git.clone({
        fs,
        http,
        url: repoUrl,
        dir: tempClonePath,
        singleBranch: true,
        depth: 1,
        ...(branch ? { ref: branch } : {}),
        onProgress: evt => {
            if (evt && evt.phase) {
                const now = Date.now();
                let percent = null;
                let speed = null;
                if (evt.total && evt.loaded !== null) {
                    const ratio = evt.loaded / evt.total;
                    percent = Math.max(0, Math.min(100, Math.floor(ratio * 100)));
                    const dt = (now - lastTick) / 1000;
                    const dl = Math.max(0, evt.loaded - lastLoaded);
                    if (dt > 0) speed = dl / dt; // units depend on isomorphic-git reporting
                    lastTick = now;
                    lastLoaded = evt.loaded;
                }
                if (mainWindow) {
                    mainWindow.webContents.send('addon-install-progress', {
                        status: evt.phase,
                        percent,
                        speed
                    });
                }
                const pctText = percent !== null ? ` ${percent}%` : '';
                const spdText = speed !== null ? ` @ ${Math.round(speed)} u/s` : '';
                console.log(`git: ${evt.phase}${pctText}${spdText}`);
            }
        }
    });

    // Get current commit hash and branch using isomorphic-git
    let commitHash = null;
    let actualBranch = branch || 'main';
    try {
        commitHash = await git.resolveRef({ fs, dir: tempClonePath, ref: 'HEAD' });
        const current = await git.currentBranch({ fs, dir: tempClonePath, fullname: false });
        if (current) actualBranch = current;
    } catch (error) {
        console.error('Error getting commit info:', error);
    }

    // Remove .git directory to save space
    const gitDir = path.join(tempClonePath, '.git');
    if (await fs.pathExists(gitDir)) {
        await fs.remove(gitDir);
    }

    if (mainWindow) {
        mainWindow.webContents.send('addon-install-progress', {
            status: 'Clone complete',
            percent: 100,
            speed: 0
        });
    }

    // Check if the cloned folder contains .toc file(s)
    const clonedContents = await fs.readdir(tempClonePath);
    const rootTocFiles = clonedContents.filter(f => f.endsWith('.toc'));

    if (rootTocFiles.length > 0) {
        // The repo itself is the addon
        console.log('Root folder contains .toc files, treating as single addon');
        const targetPath = path.join(addonPath, repo);

        if (await fs.pathExists(targetPath)) {
            await fs.remove(targetPath);
        }

        await fs.move(tempClonePath, targetPath);

        // Store GitHub repo info
        const repoFile = path.join(targetPath, '.github-repo');
        await fs.writeFile(repoFile, `${owner}/${repo}`, 'utf8');

        // Store metadata for update tracking
        const metadataPath = path.join(targetPath, '.github-addon-metadata');
        await fs.writeJson(metadataPath, {
            owner,
            repo,
            installedAt: new Date().toISOString(),
            method: 'git',
            commitHash,
            branch: actualBranch
        });

        console.log(`Installed addon: ${repo}`);
        if (mainWindow) {
            mainWindow.webContents.send('addon-install-complete', { success: true });
        }
        return { success: true, addons: [repo] };
    } else {
        // Recursively search for addon folders (directories containing .toc files)
        const addonFolders = [];
        async function findAddonFolders(searchPath, currentDepth = 0) {
            try {
                const contents = await fs.readdir(searchPath);
                for (const item of contents) {
                    if (item.startsWith('.')) continue; // Skip hidden
                    const itemPath = path.join(searchPath, item);
                    const stat = await fs.stat(itemPath);
                    if (stat.isDirectory()) {
                        const subContents = await fs.readdir(itemPath);
                        const tocFiles = subContents.filter(f => f.endsWith('.toc'));
                        if (tocFiles.length > 0) {
                            const relativePath = path.relative(tempClonePath, itemPath);
                            addonFolders.push(relativePath);
                        } else if (currentDepth < 4) {
                            await findAddonFolders(itemPath, currentDepth + 1);
                        }
                    }
                }
            } catch (err) {
                console.error(`Error searching in ${searchPath}:`, err.message);
            }
        }
        await findAddonFolders(tempClonePath);

        if (addonFolders.length > 0) {
            // Install each addon folder found (may be nested paths)
            for (const addonFolderRelPath of addonFolders) {
                const sourcePath = path.join(tempClonePath, addonFolderRelPath);
                const addonFolderName = path.basename(addonFolderRelPath);
                const targetPath = path.join(addonPath, addonFolderName);

                if (await fs.pathExists(targetPath)) {
                    await fs.remove(targetPath);
                }

                await fs.move(sourcePath, targetPath);

                // Store GitHub repo info
                const repoFile = path.join(targetPath, '.github-repo');
                await fs.writeFile(repoFile, `${owner}/${repo}`, 'utf8');

                // Store metadata
                const metadataPath = path.join(targetPath, '.github-addon-metadata');
                await fs.writeJson(metadataPath, {
                    owner,
                    repo,
                    installedAt: new Date().toISOString(),
                    method: 'git',
                    commitHash,
                    branch: actualBranch
                });

                console.log(`Installed addon: ${addonFolderName}`);
            }

            // Clean up temp directory
            await fs.remove(tempClonePath);

            const installed = addonFolders.map(p => path.basename(p));
            if (mainWindow) {
                mainWindow.webContents.send('addon-install-complete', { success: true });
            }
            return { success: true, addons: installed };
        } else {
            throw new Error(
                'Could not find any .toc files. This does not appear to be a valid WoW addon.'
            );
        }
    }
}

// Install addon using archive download (fallback method)
async function installAddonWithArchive(owner, repo, addonPath, branch = null) {
    try {
        // Get repository information to find the default branch
        let defaultBranch = 'main';
        if (!branch) {
            try {
                const repoInfoResponse = await axios.get(
                    `https://api.github.com/repos/${owner}/${repo}`
                );
                defaultBranch = repoInfoResponse.data.default_branch || 'main';
                console.log(`Default branch for ${owner}/${repo}: ${defaultBranch}`);
            } catch {
                console.log('Could not get repo info, trying common branches...');
            }
        }

        // Try to download addon from GitHub as ZIP
        const possibleBranches = branch ? [branch] : [defaultBranch, 'main', 'master'];
        let downloadUrl = null;
        let zipPath = null;
        let branchUsed = null;

        for (const branchToTry of possibleBranches) {
            try {
                downloadUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branchToTry}.zip`;
                zipPath = path.join(addonPath, `${repo}.zip`);

                console.log(`Trying to download from: ${downloadUrl}`);

                const response = await axios({
                    method: 'GET',
                    url: downloadUrl,
                    responseType: 'stream',
                    maxRedirects: 5
                });

                const writer = fs.createWriteStream(zipPath);
                const totalBytes = Number(response.headers['content-length'] || 0);
                let downloaded = 0;
                let lastTick = Date.now();
                let lastDownloaded = 0;
                response.data.on('data', chunk => {
                    downloaded += chunk.length;
                    const now = Date.now();
                    const dt = (now - lastTick) / 1000;
                    if (dt >= 0.5) {
                        const delta = downloaded - lastDownloaded;
                        const speed = delta / dt; // bytes/sec
                        const ratio = totalBytes ? downloaded / totalBytes : 0;
                        const percent = totalBytes
                            ? Math.max(0, Math.min(100, Math.floor(ratio * 100)))
                            : null;
                        if (mainWindow) {
                            mainWindow.webContents.send('addon-install-progress', {
                                status: 'Downloading archive',
                                percent,
                                speed
                            });
                        }
                        lastTick = now;
                        lastDownloaded = downloaded;
                    }
                });
                response.data.pipe(writer);

                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });

                branchUsed = branchToTry;
                console.log(`Successfully downloaded from branch: ${branchToTry}`);
                if (mainWindow) {
                    mainWindow.webContents.send('addon-install-progress', {
                        status: 'Download complete',
                        percent: 100,
                        speed: 0
                    });
                }
                break;
            } catch {
                console.log(`Branch ${branchToTry} not found, trying next...`);
                if (await fs.pathExists(zipPath)) {
                    await fs.remove(zipPath);
                }
                continue;
            }
        }

        if (!branchUsed) {
            throw new Error(
                `Could not find repository or it has no main/master branch. Tried: ${possibleBranches.join(', ')}`
            );
        }

        // Extract the addon
        const tempExtractPath = path.join(addonPath, `temp_${repo}`);
        await extractZipFile(zipPath, tempExtractPath);

        // Find the main addon folder (usually repo-branchname)
        const extractedContents = await fs.readdir(tempExtractPath);
        console.log('Extracted contents:', extractedContents);

        const mainFolder = extractedContents.find(
            folder => folder.startsWith(`${repo}-`) || folder === repo
        );

        if (!mainFolder) {
            throw new Error(
                `Could not find addon folder in extracted archive. Found: ${extractedContents.join(', ')}`
            );
        }

        const sourcePath = path.join(tempExtractPath, mainFolder);

        // Check if there are multiple addon folders inside or if this folder itself is an addon
        const sourceContents = await fs.readdir(sourcePath);
        console.log('Source contents:', sourceContents);

        // First, check if the root folder itself contains a .toc file (repo IS the addon)
        const rootTocFiles = sourceContents.filter(f => f.endsWith('.toc'));
        let addonFolders = [];

        if (rootTocFiles.length > 0) {
            // The extracted folder itself is the addon
            console.log('Root folder contains .toc files, treating as single addon');
            const targetPath = path.join(addonPath, repo);

            // Remove existing installation
            if (await fs.pathExists(targetPath)) {
                await fs.remove(targetPath);
            }

            // Move addon to final location
            await fs.move(sourcePath, targetPath);
            console.log(`Installed addon: ${repo}`);
        } else {
            // Check if there are multiple addon folders inside subdirectories
            addonFolders = [];
            for (const item of sourceContents) {
                const itemPath = path.join(sourcePath, item);
                const stat = await fs.stat(itemPath);
                if (stat.isDirectory()) {
                    // Check if it looks like an addon folder (has .toc file)
                    const tocFiles = (await fs.readdir(itemPath)).filter(f => f.endsWith('.toc'));
                    if (tocFiles.length > 0) {
                        addonFolders.push(item);
                    }
                }
            }

            if (addonFolders.length > 0) {
                // Install each addon folder separately
                for (const addonFolder of addonFolders) {
                    const addonSourcePath = path.join(sourcePath, addonFolder);
                    const addonTargetPath = path.join(addonPath, addonFolder);

                    // Remove existing installation
                    if (await fs.pathExists(addonTargetPath)) {
                        await fs.remove(addonTargetPath);
                    }

                    // Move addon to final location
                    await fs.move(addonSourcePath, addonTargetPath);
                    console.log(`Installed addon: ${addonFolder}`);
                }
            } else {
                // No .toc files found anywhere
                throw new Error(
                    'Could not find any .toc files. This does not appear to be a valid WoW addon.'
                );
            }
        }

        // Clean up
        await fs.remove(zipPath);
        await fs.remove(tempExtractPath);

        // Collect installed addon names
        const installedAddons = addonFolders.length > 0 ? addonFolders : [repo];

        console.log('Writing .github-repo files for addons:', installedAddons);

        // Save GitHub repo info and commit SHA for future updates
        const commitsUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${branchUsed}`;
        const commitsResponse = await axios.get(commitsUrl, {
            headers: { 'User-Agent': 'WoW-Launcher' }
        });
        const latestCommit = commitsResponse.data.sha;

        for (const addonFolder of installedAddons) {
            const addonTargetPath = path.join(addonPath, addonFolder);
            const repoFile = path.join(addonTargetPath, '.github-repo');
            await fs.writeFile(repoFile, `${owner}/${repo}`, 'utf8');
            console.log(`Created .github-repo for ${addonFolder}: ${owner}/${repo}`);

            const commitFile = path.join(addonTargetPath, '.github-commit');
            await fs.writeFile(commitFile, latestCommit, 'utf8');

            // Store metadata
            const metadataPath = path.join(addonTargetPath, '.github-addon-metadata');
            await fs.writeJson(metadataPath, {
                owner,
                repo,
                installedAt: new Date().toISOString(),
                method: 'archive',
                commitHash: latestCommit,
                branch: branchUsed
            });
        }

        if (mainWindow) {
            mainWindow.webContents.send('addon-install-complete', { success: true });
        }
        return { success: true, addons: installedAddons };
    } catch (error) {
        console.error('Archive installation error:', error);
        if (mainWindow) {
            mainWindow.webContents.send('addon-install-complete', {
                success: false,
                error: error.message
            });
        }
        throw error;
    }
}

ipcMain.handle('get-installed-addons', async (event, installPath) => {
    try {
        const addonPath = path.join(installPath, 'Interface', 'AddOns');

        if (!(await fs.pathExists(addonPath))) {
            return [];
        }

        const addonFolders = await fs.readdir(addonPath);
        const addons = [];

        for (const folder of addonFolders) {
            const folderPath = path.join(addonPath, folder);
            const stat = await fs.stat(folderPath);

            if (stat.isDirectory()) {
                const addon = {
                    name: folder,
                    folderName: folder,
                    path: folderPath,
                    description: null,
                    version: null,
                    githubRepo: null
                };

                // Try to read addon information from .toc file
                const tocFiles = (await fs.readdir(folderPath)).filter(file =>
                    file.endsWith('.toc')
                );

                if (tocFiles.length > 0) {
                    try {
                        const tocContent = await fs.readFile(
                            path.join(folderPath, tocFiles[0]),
                            'utf8'
                        );
                        // Strip WoW color/reset codes from TOC fields
                        const stripWowColorCodes = s =>
                            typeof s === 'string'
                                ? s
                                      .replace(/\|c[0-9A-Fa-f]{8}/g, '') // |cAARRGGBB
                                      .replace(/\|cff[0-9A-Fa-f]{6}/g, '') // |cffRRGGBB
                                      .replace(/\|r/g, '')
                                : s;

                        const titleMatch = tocContent.match(/## Title: (.+)/);
                        const versionMatch = tocContent.match(/## Version: (.+)/);
                        const notesMatch = tocContent.match(/## Notes: (.+)/);

                        if (titleMatch) {
                            addon.name = stripWowColorCodes(titleMatch[1].trim());
                        }
                        if (versionMatch) {
                            addon.version = stripWowColorCodes(versionMatch[1].trim());
                        }
                        if (notesMatch) {
                            addon.description = stripWowColorCodes(notesMatch[1].trim());
                        }
                    } catch {
                        // Ignore TOC reading errors
                    }
                }

                // Check if there's a .github-repo file that stores the repo info
                const repoFile = path.join(folderPath, '.github-repo');
                if (await fs.pathExists(repoFile)) {
                    try {
                        const repoInfo = await fs.readFile(repoFile, 'utf8');
                        addon.githubRepo = repoInfo.trim();
                        console.log(`Found .github-repo for ${folder}: ${addon.githubRepo}`);
                    } catch {
                        // Ignore
                    }
                }

                addons.push(addon);
            }
        }

        return addons;
    } catch (error) {
        console.error('Error getting installed addons:', error);
        return [];
    }
});

ipcMain.handle('uninstall-addon', async (event, addonName, installPath) => {
    try {
        const addonPath = path.join(installPath, 'Interface', 'AddOns', addonName);

        if (await fs.pathExists(addonPath)) {
            await fs.remove(addonPath);
            return { success: true };
        } else {
            return { success: false, error: 'Addon not found' };
        }
    } catch (error) {
        console.error('Addon uninstall error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('test-realm-connection', async (event, realmAddress) => {
    try {
        // Simple ping test using a basic HTTP request timeout
        const startTime = Date.now();

        try {
            // Try to connect to the realm on port 8085 (AzerothCore worldserver port)
            // This is a basic connectivity test
            await axios({
                method: 'GET',
                url: `http://${realmAddress}:8085`,
                timeout: 5000,
                validateStatus: () => true // Accept any status code
            });

            const ping = Date.now() - startTime;
            return { success: true, ping: ping };
        } catch (error) {
            if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                return { success: false, error: 'Cannot reach server' };
            } else if (error.code === 'ETIMEDOUT') {
                return { success: false, error: 'Connection timeout' };
            } else {
                const ping = Date.now() - startTime;
                // If we get any response (even error), the server is reachable
                return { success: true, ping: ping, note: 'Server reachable' };
            }
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Platform-specific IPC handlers
ipcMain.handle('get-platform-info', () => {
    return platformManager.getPlatformInfo();
});

ipcMain.handle('check-wine-installation', async () => {
    return await platformManager.checkWineInstallation();
});

ipcMain.handle('get-wine-install-instructions', () => {
    return platformManager.getWineInstallInstructions();
});

ipcMain.handle('get-default-install-paths', () => {
    return platformManager.getDefaultInstallPaths();
});

ipcMain.handle('create-wine-prefix', async (event, prefixPath) => {
    try {
        await platformManager.createWinePrefix(prefixPath);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-wine-prefix-path', (event, installPath) => {
    return platformManager.getWinePrefixPath(installPath);
});

// Automatic Wine installation handlers
ipcMain.handle('install-wine-automatically', async _event => {
    try {
        const result = await platformManager.installWineAutomatically((message, progress) => {
            mainWindow.webContents.send('wine-install-progress', { message, progress });
        });
        return result;
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('check-wine-installing', () => {
    return platformManager.isWineInstalling();
});

// Apply macOS-specific patches (libsillicon for Apple Silicon)
ipcMain.handle('apply-macos-patches', async (event, installPath) => {
    try {
        const result = await platformManager.applyMacOSPatches(installPath, (message, progress) => {
            if (mainWindow) {
                mainWindow.webContents.send('macos-patch-progress', { message, progress });
            }
        });
        return result;
    } catch (error) {
        console.error('macOS patch error:', error);
        return { success: false, error: error.message };
    }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        // Someone tried to run a second instance, focus our window instead
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}
