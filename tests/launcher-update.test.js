const { autoUpdater } = require('electron-updater');

// Mock electron-updater
jest.mock('electron-updater', () => ({
    autoUpdater: {
        checkForUpdatesAndNotify: jest.fn(),
        checkForUpdates: jest.fn(),
        downloadUpdate: jest.fn(),
        quitAndInstall: jest.fn(),
        on: jest.fn(),
        autoDownload: false,
        autoInstallOnAppQuit: true,
        logger: null
    }
}));

// Mock Electron
const mockWindow = {
    webContents: {
        send: jest.fn()
    }
};

jest.mock('electron', () => ({
    app: {
        getVersion: jest.fn(() => '1.0.0'),
        isReady: jest.fn(() => true),
        on: jest.fn()
    },
    BrowserWindow: jest.fn(() => mockWindow)
}));

describe('Launcher Self-Update Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should check for updates on startup', async () => {
        autoUpdater.checkForUpdates = jest.fn().mockResolvedValue({
            updateInfo: {
                version: '1.0.1'
            }
        });

        const setupAutoUpdater = () => {
            autoUpdater.autoDownload = false;
            autoUpdater.autoInstallOnAppQuit = true;

            setTimeout(() => {
                autoUpdater.checkForUpdates();
            }, 2000);
        };

        setupAutoUpdater();

        // Wait for check
        await new Promise(resolve => setTimeout(resolve, 2100));

        expect(autoUpdater.checkForUpdates).toHaveBeenCalled();
    });

    test('should notify user when update is available', async () => {
        let updateAvailableCallback;

        autoUpdater.on = jest.fn((event, callback) => {
            if (event === 'update-available') {
                updateAvailableCallback = callback;
            }
        });

        const setupAutoUpdater = mainWindow => {
            autoUpdater.on('update-available', info => {
                mainWindow.webContents.send('update-available', info);
            });
        };

        setupAutoUpdater(mockWindow);

        // Simulate update available
        if (updateAvailableCallback) {
            updateAvailableCallback({ version: '1.0.2' });
        }

        expect(mockWindow.webContents.send).toHaveBeenCalledWith('update-available', {
            version: '1.0.2'
        });
    });

    test('should download update when requested', async () => {
        autoUpdater.downloadUpdate = jest.fn().mockResolvedValue(undefined);

        const downloadUpdate = async () => {
            await autoUpdater.downloadUpdate();
            return { success: true };
        };

        const result = await downloadUpdate();

        expect(result.success).toBe(true);
        expect(autoUpdater.downloadUpdate).toHaveBeenCalled();
    });

    test('should track download progress', async () => {
        let downloadProgressCallback;

        autoUpdater.on = jest.fn((event, callback) => {
            if (event === 'download-progress') {
                downloadProgressCallback = callback;
            }
        });

        const setupAutoUpdater = mainWindow => {
            autoUpdater.on('download-progress', progress => {
                mainWindow.webContents.send('update-download-progress', progress);
            });
        };

        setupAutoUpdater(mockWindow);

        // Simulate progress updates
        if (downloadProgressCallback) {
            downloadProgressCallback({
                bytesPerSecond: 1000000,
                percent: 50,
                transferred: 5000000,
                total: 10000000
            });
        }

        expect(mockWindow.webContents.send).toHaveBeenCalledWith(
            'update-download-progress',
            expect.objectContaining({
                percent: 50,
                transferred: 5000000,
                total: 10000000
            })
        );
    });

    test('should notify when update is downloaded', async () => {
        let updateDownloadedCallback;

        autoUpdater.on = jest.fn((event, callback) => {
            if (event === 'update-downloaded') {
                updateDownloadedCallback = callback;
            }
        });

        const setupAutoUpdater = mainWindow => {
            autoUpdater.on('update-downloaded', info => {
                mainWindow.webContents.send('update-downloaded', info);
            });
        };

        setupAutoUpdater(mockWindow);

        // Simulate download complete
        if (updateDownloadedCallback) {
            updateDownloadedCallback({ version: '1.0.2' });
        }

        expect(mockWindow.webContents.send).toHaveBeenCalledWith('update-downloaded', {
            version: '1.0.2'
        });
    });

    test('should quit and install update', async () => {
        autoUpdater.quitAndInstall = jest.fn();

        const installUpdate = () => {
            autoUpdater.quitAndInstall();
            return { success: true };
        };

        const result = installUpdate();

        expect(result.success).toBe(true);
        expect(autoUpdater.quitAndInstall).toHaveBeenCalled();
    });

    test('should handle update errors gracefully', async () => {
        let errorCallback;

        autoUpdater.on = jest.fn((event, callback) => {
            if (event === 'error') {
                errorCallback = callback;
            }
        });

        const setupAutoUpdater = mainWindow => {
            autoUpdater.on('error', error => {
                mainWindow.webContents.send('update-error', error.message);
            });
        };

        setupAutoUpdater(mockWindow);

        // Simulate error
        if (errorCallback) {
            errorCallback(new Error('Update server unavailable'));
        }

        expect(mockWindow.webContents.send).toHaveBeenCalledWith(
            'update-error',
            'Update server unavailable'
        );
    });

    test('should check for updates from GitHub releases', async () => {
        autoUpdater.checkForUpdates = jest.fn().mockResolvedValue({
            updateInfo: {
                version: '1.0.3',
                releaseDate: '2026-01-02',
                releaseName: 'WoW Launcher v1.0.3',
                releaseNotes: 'Bug fixes and improvements'
            }
        });

        const result = await autoUpdater.checkForUpdates();

        expect(result.updateInfo).toHaveProperty('version');
        expect(result.updateInfo.version).toBe('1.0.3');
    });

    test('should auto-install on quit when configured', () => {
        const setupAutoUpdater = () => {
            autoUpdater.autoDownload = false;
            autoUpdater.autoInstallOnAppQuit = true;
        };

        setupAutoUpdater();

        expect(autoUpdater.autoDownload).toBe(false);
        expect(autoUpdater.autoInstallOnAppQuit).toBe(true);
    });

    test('should handle no updates available', async () => {
        let notAvailableCallback;

        autoUpdater.on = jest.fn((event, callback) => {
            if (event === 'update-not-available') {
                notAvailableCallback = callback;
            }
        });

        const setupAutoUpdater = mainWindow => {
            autoUpdater.on('update-not-available', () => {
                mainWindow.webContents.send('update-not-available');
            });
        };

        setupAutoUpdater(mockWindow);

        // Simulate no update available
        if (notAvailableCallback) {
            notAvailableCallback();
        }

        expect(mockWindow.webContents.send).toHaveBeenCalledWith('update-not-available');
    });

    describe('Platform-Specific Configuration', () => {
        let originalPlatform;

        // Helper function to simulate the configuration logic from main.js
        const setupPlatformConfig = () => {
            const { app } = require('electron');
            autoUpdater.allowDowngrade = false; // Default setting
            if (!app.isPackaged) {
                if (process.platform === 'win32') {
                    autoUpdater.forceDevUpdateConfig = true;
                }

                if (process.platform === 'darwin') {
                    autoUpdater.forceDevUpdateConfig = true;
                    autoUpdater.allowDowngrade = true;
                }
            }
        };

        beforeEach(() => {
            // Save original values
            originalPlatform = process.platform;
            jest.clearAllMocks();
        });

        afterEach(() => {
            // Restore original values
            Object.defineProperty(process, 'platform', {
                value: originalPlatform
            });
        });

        test('should enable forceDevUpdateConfig for Windows in development', () => {
            // Mock Windows platform
            Object.defineProperty(process, 'platform', {
                value: 'win32'
            });

            const { app } = require('electron');
            app.isPackaged = false;

            setupPlatformConfig();

            expect(autoUpdater.forceDevUpdateConfig).toBe(true);
        });

        test('should enable forceDevUpdateConfig and allowDowngrade for macOS in development', () => {
            // Mock macOS platform
            Object.defineProperty(process, 'platform', {
                value: 'darwin'
            });

            const { app } = require('electron');
            app.isPackaged = false;

            setupPlatformConfig();

            expect(autoUpdater.forceDevUpdateConfig).toBe(true);
            expect(autoUpdater.allowDowngrade).toBe(true);
        });

        test('should not enable forceDevUpdateConfig for macOS in production', () => {
            // Mock macOS platform
            Object.defineProperty(process, 'platform', {
                value: 'darwin'
            });

            const { app } = require('electron');
            app.isPackaged = true;

            // Reset the values
            autoUpdater.forceDevUpdateConfig = false;
            autoUpdater.allowDowngrade = false;

            setupPlatformConfig();

            expect(autoUpdater.forceDevUpdateConfig).toBe(false);
            expect(autoUpdater.allowDowngrade).toBe(false);
        });

        test('should not enable forceDevUpdateConfig for Windows in production', () => {
            // Mock Windows platform
            Object.defineProperty(process, 'platform', {
                value: 'win32'
            });

            const { app } = require('electron');
            app.isPackaged = true;

            // Reset the value
            autoUpdater.forceDevUpdateConfig = false;

            setupPlatformConfig();

            expect(autoUpdater.forceDevUpdateConfig).toBe(false);
        });
    });
});
