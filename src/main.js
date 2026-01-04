const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const axios = require('axios');
const StreamZip = require('node-stream-zip');
const { spawn } = require('child_process');

// Handle uncaught exceptions (especially EPIPE errors from broken pipes)
process.on('uncaughtException', (error) => {
    // Ignore EPIPE errors (broken pipe when stdout/stderr is closed)
    if (error.code === 'EPIPE') {
        return;
    }
    console.error('Uncaught exception:', error);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled promise rejection:', reason);
});

// Disable signature verification BEFORE importing autoUpdater
process.env.ELECTRON_UPDATER_ALLOW_UNSIGNED = '1';

const { autoUpdater } = require('electron-updater');
const PlatformManager = require('./platform-manager');

// Configure autoUpdater to allow unsigned builds
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.logger = console;

// Disable signature verification for Windows
if (process.platform === 'win32') {
    // Force update to bypass signature check on Windows
    autoUpdater.forceDevUpdateConfig = true;
}

// Load .env from multiple possible locations
const dotenv = require('dotenv');
const envPaths = [
    path.join(__dirname, '.env'),                    // Development: src/.env
    path.join(__dirname, '..', '.env'),              // Development: root/.env
    path.join(process.resourcesPath, '.env'),        // Production: resources/.env
    path.join(app.getAppPath(), '.env')              // Production: app/.env
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
let downloadState = {
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
    installPath: process.env.WOW_INSTALL_PATH || path.join(os.homedir(), 'Documents', 'World of Warcraft')
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

autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    if (mainWindow) {
        mainWindow.webContents.send('update-status', {
            status: 'available',
            version: info.version
        });
    }
});

autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available');
    if (mainWindow) {
        mainWindow.webContents.send('update-status', { status: 'not-available' });
    }
});

autoUpdater.on('error', (err) => {
    console.error('Update error:', err);
    if (mainWindow) {
        mainWindow.webContents.send('update-status', {
            status: 'error',
            message: err.message
        });
    }
});

autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow) {
        mainWindow.webContents.send('update-status', {
            status: 'downloading',
            percent: progressObj.percent,
            transferred: progressObj.transferred,
            total: progressObj.total
        });
    }
});

autoUpdater.on('update-downloaded', (info) => {
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
    mainWindow.loadFile(path.join(__dirname, 'index.html')).then(() => {
        console.log('index.html loaded successfully');
    }).catch(err => {
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
app.whenReady().then(() => {
    try {
        // Initialize platform manager
        console.log('Initializing platform manager...');
        platformManager = new PlatformManager();
        console.log('Platform manager initialized');

        createWindow();
        createMenu();

        // Check for updates after a short delay (2 seconds) to let the app fully load
        setTimeout(() => {
            if (!config.devMode) {
                console.log('Checking for updates...');
                autoUpdater.checkForUpdates().catch(err => {
                    console.error('Auto-updater check failed:', err);
                });
            } else {
                console.log('Skipping update check in dev mode');
            }
        }, 2000);
    } catch (error) {
        console.error('Failed to initialize application:', error);
        dialog.showErrorBox('Initialization Error',
            `Failed to start the launcher.\n\nError: ${error.message}\n\nPlease check the console logs for details.`);
        app.quit();
    }

    app.on('activate', () => {
        // On macOS, re-create window when dock icon is clicked
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
}).catch(error => {
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
    autoUpdater.quitAndInstall(false, true);
});

// Window controls for frameless window
ipcMain.handle('window-minimize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) window.minimize();
});

ipcMain.handle('window-maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
        if (window.isMaximized()) {
            window.unmaximize();
        } else {
            window.maximize();
        }
    }
});

ipcMain.handle('window-close', (event) => {
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
        if (!contentType.includes('application/zip') &&
            !contentType.includes('application/octet-stream') &&
            !contentType.includes('application/x-zip-compressed')) {
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
            validateStatus: (status) => status >= 200 && status < 300,
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
            console.warn('Warning: Content-Length header not present, progress tracking may be limited');
        }

        const writer = fs.createWriteStream(zipPath);
        downloadState.writer = writer;

        let downloadedBytes = 0;
        let lastProgressTime = Date.now();

        // Handle stream errors
        writer.on('error', (error) => {
            console.error('Write stream error:', error);
            downloadState.isDownloading = false;
            if (!downloadState.controller.signal.aborted) {
                mainWindow.webContents.send('download-error', {
                    message: 'Failed to write download file: ' + error.message
                });
            }
        });

        response.data.on('data', (chunk) => {
            if (!downloadState.isPaused && downloadState.isDownloading) {
                try {
                    writer.write(chunk);
                    downloadedBytes += chunk.length;
                    downloadState.downloadedBytes = downloadedBytes;

                    // Throttle progress updates to avoid overwhelming the UI
                    const now = Date.now();
                    if (now - lastProgressTime > 100) { // Update every 100ms
                        const percent = downloadState.totalBytes > 0 ? (downloadedBytes / downloadState.totalBytes) * 100 : 0;
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
                    writer.end((error) => {
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

        response.data.on('error', (error) => {
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
                const errorMessage = error.code === 'ENOTFOUND'
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
        const contentsResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents`, {
            headers: { 'User-Agent': 'PlusCraft-Launcher' }
        });

        const contents = contentsResponse.data;

        // Check for .toc files in root
        const hasTocInRoot = contents.some(file =>
            file.name.endsWith('.toc') && file.type === 'file'
        );

        let tocFiles = [];
        let addonFolders = [];

        if (hasTocInRoot) {
            // Root is the addon
            tocFiles = contents.filter(file => file.name.endsWith('.toc')).map(f => f.name);
        } else {
            // Check subdirectories for .toc files
            const directories = contents.filter(item => item.type === 'dir');

            for (const dir of directories.slice(0, 10)) { // Limit to first 10 dirs
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
            const readmeResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}/readme`, {
                headers: {
                    'User-Agent': 'PlusCraft-Launcher',
                    'Accept': 'application/vnd.github.v3.raw'
                }
            });
            readme = readmeResponse.data;
        } catch (err) {
            console.log('No README found');
        }

        // Get latest release
        let latestRelease = null;
        try {
            const releaseResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
                headers: { 'User-Agent': 'PlusCraft-Launcher' }
            });
            latestRelease = releaseResponse.data;
        } catch (err) {
            console.log('No releases found');
        }

        // Get recent releases
        let releases = [];
        try {
            const releasesResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=5`, {
                headers: { 'User-Agent': 'PlusCraft-Launcher' }
            });
            releases = releasesResponse.data;
        } catch (err) {
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
        const settings = await loadSettingsFromFile();
        const result = await platformManager.launchWoW(installPath, {
            prefixPath: settings.winePrefixPath || platformManager.getWinePrefixPath(installPath)
        });

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

        // Check if extraction created a single root folder
        const extractedContents = await fs.readdir(extractPath);

        // If there's only one item and it's a directory, move its contents up
        if (extractedContents.length === 1) {
            const singleItem = extractedContents[0];
            const singleItemPath = path.join(extractPath, singleItem);

            try {
                const stat = await fs.stat(singleItemPath);

                if (stat.isDirectory()) {
                    // Move contents from nested folder to parent
                    const nestedContents = await fs.readdir(singleItemPath);

                    for (const item of nestedContents) {
                        const oldPath = path.join(singleItemPath, item);
                        const newPath = path.join(extractPath, item);
                        await fs.move(oldPath, newPath, { overwrite: true });
                    }

                    // Remove the now-empty nested folder
                    await fs.remove(singleItemPath);
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
ipcMain.handle('install-addon-from-github', async (event, owner, repo, installPath) => {
    try {
        const addonPath = path.join(installPath, 'Interface', 'AddOns');
        await fs.ensureDir(addonPath);

        // Check if git is available
        const hasGit = await checkGitAvailable();

        if (hasGit) {
            console.log('Using git clone for addon installation');
            return await installAddonWithGit(owner, repo, addonPath);
        } else {
            console.log('Git not available, falling back to archive download');
            return await installAddonWithArchive(owner, repo, addonPath);
        }
    } catch (error) {
        console.error('Addon installation error:', error);
        throw error;
    }
});

// Check if git is available on the system
async function checkGitAvailable() {
    return new Promise((resolve) => {
        const gitCheck = spawn('git', ['--version']);
        gitCheck.on('close', (code) => {
            resolve(code === 0);
        });
        gitCheck.on('error', () => {
            resolve(false);
        });
    });
}

// Install addon using git clone
async function installAddonWithGit(owner, repo, addonPath) {
    const repoUrl = `https://github.com/${owner}/${repo}.git`;
    const tempClonePath = path.join(addonPath, `temp_${repo}`);

    // Remove temp directory if it exists
    if (await fs.pathExists(tempClonePath)) {
        await fs.remove(tempClonePath);
    }

    console.log(`Cloning ${repoUrl} to ${tempClonePath}`);

    // Clone the repository
    await new Promise((resolve, reject) => {
        const gitClone = spawn('git', ['clone', '--depth', '1', repoUrl, tempClonePath]);

        gitClone.stdout.on('data', (data) => {
            console.log(`git: ${data}`);
        });

        gitClone.stderr.on('data', (data) => {
            console.log(`git: ${data}`);
        });

        gitClone.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Git clone failed with code ${code}`));
            }
        });

        gitClone.on('error', (error) => {
            reject(error);
        });
    });

    // Remove .git directory to save space
    const gitDir = path.join(tempClonePath, '.git');
    if (await fs.pathExists(gitDir)) {
        await fs.remove(gitDir);
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

        // Store metadata for update tracking
        const metadataPath = path.join(targetPath, '.github-addon-metadata');
        await fs.writeJson(metadataPath, {
            owner,
            repo,
            installedAt: new Date().toISOString(),
            method: 'git'
        });

        console.log(`Installed addon: ${repo}`);
        return { success: true, addons: [repo] };
    } else {
        // Check for multiple addon folders in subdirectories
        const addonFolders = [];
        for (const item of clonedContents) {
            const itemPath = path.join(tempClonePath, item);
            const stat = await fs.stat(itemPath);
            if (stat.isDirectory() && !item.startsWith('.')) {
                const subContents = await fs.readdir(itemPath);
                const tocFiles = subContents.filter(f => f.endsWith('.toc'));
                if (tocFiles.length > 0) {
                    addonFolders.push(item);
                }
            }
        }

        if (addonFolders.length > 0) {
            // Install each addon folder
            for (const addonFolder of addonFolders) {
                const sourcePath = path.join(tempClonePath, addonFolder);
                const targetPath = path.join(addonPath, addonFolder);

                if (await fs.pathExists(targetPath)) {
                    await fs.remove(targetPath);
                }

                await fs.move(sourcePath, targetPath);

                // Store metadata
                const metadataPath = path.join(targetPath, '.github-addon-metadata');
                await fs.writeJson(metadataPath, {
                    owner,
                    repo,
                    installedAt: new Date().toISOString(),
                    method: 'git'
                });

                console.log(`Installed addon: ${addonFolder}`);
            }

            // Clean up temp directory
            await fs.remove(tempClonePath);

            return { success: true, addons: addonFolders };
        } else {
            throw new Error('Could not find any .toc files. This does not appear to be a valid WoW addon.');
        }
    }
}

// Install addon using archive download (fallback method)
async function installAddonWithArchive(owner, repo, addonPath) {
    try {
        // Get repository information to find the default branch
        let defaultBranch = 'main';
        try {
            const repoInfoResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}`);
            defaultBranch = repoInfoResponse.data.default_branch || 'main';
            console.log(`Default branch for ${owner}/${repo}: ${defaultBranch}`);
        } catch (error) {
            console.log('Could not get repo info, trying common branches...');
        }

        // Try to download addon from GitHub as ZIP
        const possibleBranches = [defaultBranch, 'main', 'master'];
        let downloadUrl = null;
        let zipPath = null;
        let branchUsed = null;

        for (const branch of possibleBranches) {
            try {
                downloadUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;
                zipPath = path.join(addonPath, `${repo}.zip`);

                console.log(`Trying to download from: ${downloadUrl}`);

                const response = await axios({
                    method: 'GET',
                    url: downloadUrl,
                    responseType: 'stream',
                    maxRedirects: 5
                });

                const writer = fs.createWriteStream(zipPath);
                response.data.pipe(writer);

                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });

                branchUsed = branch;
                console.log(`Successfully downloaded from branch: ${branch}`);
                break;
            } catch (error) {
                console.log(`Branch ${branch} not found, trying next...`);
                if (await fs.pathExists(zipPath)) {
                    await fs.remove(zipPath);
                }
                continue;
            }
        }

        if (!branchUsed) {
            throw new Error(`Could not find repository or it has no main/master branch. Tried: ${possibleBranches.join(', ')}`);
        }

        // Extract the addon
        const tempExtractPath = path.join(addonPath, `temp_${repo}`);
        await extractZipFile(zipPath, tempExtractPath);

        // Find the main addon folder (usually repo-branchname)
        const extractedContents = await fs.readdir(tempExtractPath);
        console.log('Extracted contents:', extractedContents);

        const mainFolder = extractedContents.find(folder =>
            folder.startsWith(`${repo}-`) || folder === repo
        );

        if (!mainFolder) {
            throw new Error(`Could not find addon folder in extracted archive. Found: ${extractedContents.join(', ')}`);
        }

        const sourcePath = path.join(tempExtractPath, mainFolder);

        // Check if there are multiple addon folders inside or if this folder itself is an addon
        const sourceContents = await fs.readdir(sourcePath);
        console.log('Source contents:', sourceContents);

        // First, check if the root folder itself contains a .toc file (repo IS the addon)
        const rootTocFiles = sourceContents.filter(f => f.endsWith('.toc'));

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
            const addonFolders = [];
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
                throw new Error('Could not find any .toc files. This does not appear to be a valid WoW addon.');
            }
        }

        // Clean up
        await fs.remove(zipPath);
        await fs.remove(tempExtractPath);

        // Collect installed addon names
        const installedAddons = addonFolders.length > 0 ? addonFolders : [repo];

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

            const commitFile = path.join(addonTargetPath, '.github-commit');
            await fs.writeFile(commitFile, latestCommit, 'utf8');

            // Store metadata
            const metadataPath = path.join(addonTargetPath, '.github-addon-metadata');
            await fs.writeJson(metadataPath, {
                owner,
                repo,
                installedAt: new Date().toISOString(),
                method: 'archive',
                commit: latestCommit
            });
        }

        return { success: true, addons: installedAddons };
    } catch (error) {
        console.error('Archive installation error:', error);
        throw error;
    }
}

// Check for addon updates
ipcMain.handle('check-addon-updates', async (event, addons) => {
    try {
        const updates = [];

        for (const addon of addons) {
            if (!addon.githubRepo) continue;

            const [owner, repo] = addon.githubRepo.split('/');

            try {
                // Get latest commit from default branch
                const repoInfoUrl = `https://api.github.com/repos/${owner}/${repo}`;
                const repoInfoResponse = await axios.get(repoInfoUrl, {
                    headers: { 'User-Agent': 'WoW-Launcher' }
                });
                const defaultBranch = repoInfoResponse.data.default_branch;

                const commitsUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${defaultBranch}`;
                const commitsResponse = await axios.get(commitsUrl, {
                    headers: { 'User-Agent': 'WoW-Launcher' }
                });

                const latestCommit = commitsResponse.data.sha;
                const latestDate = commitsResponse.data.commit.committer.date;

                // Check if addon folder has stored commit info
                const commitFile = path.join(addon.path, '.github-commit');
                let currentCommit = null;

                if (await fs.pathExists(commitFile)) {
                    currentCommit = (await fs.readFile(commitFile, 'utf8')).trim();
                }

                // If no commit file or commits differ, update is available
                if (!currentCommit || currentCommit !== latestCommit) {
                    updates.push({
                        name: addon.name,
                        path: addon.path,
                        githubRepo: addon.githubRepo,
                        currentVersion: addon.version,
                        hasUpdate: true,
                        latestDate: new Date(latestDate).toLocaleDateString()
                    });
                } else {
                    updates.push({
                        name: addon.name,
                        path: addon.path,
                        githubRepo: addon.githubRepo,
                        currentVersion: addon.version,
                        hasUpdate: false
                    });
                }
            } catch (error) {
                console.error(`Error checking updates for ${addon.name}:`, error.message);
                updates.push({
                    name: addon.name,
                    path: addon.path,
                    githubRepo: addon.githubRepo,
                    currentVersion: addon.version,
                    hasUpdate: false,
                    error: error.message
                });
            }
        }

        return { success: true, updates };
    } catch (error) {
        console.error('Error checking addon updates:', error);
        return { success: false, error: error.message };
    }
});

// Update a single addon
ipcMain.handle('update-addon', async (event, githubRepo, installPath) => {
    try {
        const [owner, repo] = githubRepo.split('/');

        // Get repo info to find default branch
        const repoInfoUrl = `https://api.github.com/repos/${owner}/${repo}`;
        const repoInfoResponse = await axios.get(repoInfoUrl, {
            headers: { 'User-Agent': 'WoW-Launcher' }
        });
        const defaultBranch = repoInfoResponse.data.default_branch;

        // Download latest version
        const downloadUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${defaultBranch}.zip`;
        const zipPath = path.join(app.getPath('temp'), `${repo}-update.zip`);

        const response = await axios({
            url: downloadUrl,
            method: 'GET',
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(zipPath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        // Extract addon
        const tempExtractPath = path.join(app.getPath('temp'), `addon-extract-${Date.now()}`);
        await fs.ensureDir(tempExtractPath);

        const zip = new StreamZip.async({ file: zipPath });
        await zip.extract(null, tempExtractPath);
        await zip.close();

        // Find the source folder (should be repo-branch format)
        const extractedItems = await fs.readdir(tempExtractPath);
        if (extractedItems.length === 0) {
            throw new Error('Extracted archive is empty');
        }

        let sourcePath = path.join(tempExtractPath, extractedItems[0]);
        const sourceStats = await fs.stat(sourcePath);
        if (!sourceStats.isDirectory()) {
            sourcePath = tempExtractPath;
        }

        // Ensure AddOns directory exists
        const addonPath = path.join(installPath, 'Interface', 'AddOns');
        await fs.ensureDir(addonPath);

        // Find .toc files to determine addon folders
        const allFiles = await fs.readdir(sourcePath);
        const addonFolders = [];

        for (const item of allFiles) {
            const itemPath = path.join(sourcePath, item);
            const itemStat = await fs.stat(itemPath);

            if (itemStat.isDirectory()) {
                const subFiles = await fs.readdir(itemPath);
                const hasToc = subFiles.some(file => file.endsWith('.toc'));

                if (hasToc) {
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

                // Save repo and commit info
                const repoFile = path.join(addonTargetPath, '.github-repo');
                await fs.writeFile(repoFile, githubRepo, 'utf8');

                // Get and save latest commit
                const commitsUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${defaultBranch}`;
                const commitsResponse = await axios.get(commitsUrl, {
                    headers: { 'User-Agent': 'WoW-Launcher' }
                });
                const latestCommit = commitsResponse.data.sha;
                const commitFile = path.join(addonTargetPath, '.github-commit');
                await fs.writeFile(commitFile, latestCommit, 'utf8');
            }
        } else {
            // No .toc files found in subdirectories
            const targetPath = path.join(addonPath, repo);

            if (await fs.pathExists(targetPath)) {
                await fs.remove(targetPath);
            }

            await fs.move(sourcePath, targetPath);

            const repoFile = path.join(targetPath, '.github-repo');
            await fs.writeFile(repoFile, githubRepo, 'utf8');

            const commitsUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${defaultBranch}`;
            const commitsResponse = await axios.get(commitsUrl, {
                headers: { 'User-Agent': 'WoW-Launcher' }
            });
            const latestCommit = commitsResponse.data.sha;
            const commitFile = path.join(targetPath, '.github-commit');
            await fs.writeFile(commitFile, latestCommit, 'utf8');
        }

        // Clean up
        await fs.remove(zipPath);
        await fs.remove(tempExtractPath);

        return { success: true };
    } catch (error) {
        console.error('Error updating addon:', error);
        return { success: false, error: error.message };
    }
});

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
                    path: folderPath,
                    description: null,
                    version: null,
                    githubRepo: null
                };

                // Try to read addon information from .toc file
                const tocFiles = (await fs.readdir(folderPath)).filter(file => file.endsWith('.toc'));

                if (tocFiles.length > 0) {
                    try {
                        const tocContent = await fs.readFile(path.join(folderPath, tocFiles[0]), 'utf8');
                        const titleMatch = tocContent.match(/## Title: (.+)/);
                        const versionMatch = tocContent.match(/## Version: (.+)/);
                        const notesMatch = tocContent.match(/## Notes: (.+)/);

                        if (titleMatch) addon.name = titleMatch[1].trim();
                        if (versionMatch) addon.version = versionMatch[1].trim();
                        if (notesMatch) addon.description = notesMatch[1].trim();
                    } catch (tocError) {
                        // Ignore TOC reading errors
                    }
                }

                // Check if there's a .github-repo file that stores the repo info
                const repoFile = path.join(folderPath, '.github-repo');
                if (await fs.pathExists(repoFile)) {
                    try {
                        const repoInfo = await fs.readFile(repoFile, 'utf8');
                        addon.githubRepo = repoInfo.trim();
                    } catch (error) {
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
            const response = await axios({
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
ipcMain.handle('install-wine-automatically', async (event) => {
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

// Helper function to load settings
async function loadSettingsFromFile() {
    try {
        const settingsPath = path.join(app.getPath('userData'), 'settings.json');
        if (await fs.pathExists(settingsPath)) {
            return await fs.readJson(settingsPath);
        }
        return {};
    } catch (error) {
        return {};
    }
}

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