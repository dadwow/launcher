// Global error handler - catch any errors before initialization
window.onerror = function(message, source, lineno, colno, error) {
    console.error('Global error caught:', { message, source, lineno, colno, error });
    alert(`Global Error: ${message}\nAt: ${source}:${lineno}:${colno}\n\nCheck console for details.`);
    return false;
};

console.log('Renderer.js loaded');

// Setup window controls for frameless window
document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM elements now that DOM is ready
    elements = {
        serverName: document.getElementById('server-name'),
        statusDot: document.getElementById('status-dot'),
        statusText: document.getElementById('status-text'),
        gameStatus: document.getElementById('game-status'),
        settingsButton: document.getElementById('settings-button'),
        settingsModal: document.getElementById('settings-modal'),
        settingsIframe: document.getElementById('settings-iframe'),

        // Progress elements
        progressContainer: document.getElementById('progress-container'),
        progressText: document.getElementById('progress-text'),
        progressPercentage: document.getElementById('progress-percentage'),
        progressFill: document.getElementById('progress-fill'),
        pauseButton: document.getElementById('pause-button'),
        cancelButton: document.getElementById('cancel-button'),

        // Main action button
        mainActionButton: document.getElementById('main-action-button'),
        actionIcon: document.getElementById('action-icon'),
        actionText: document.getElementById('action-text'),

        // Footer
        aboutLink: document.getElementById('about-link'),
        launcherVersion: document.getElementById('launcher-version'),
        loadingOverlay: document.getElementById('loading-overlay'),
        loadingText: document.getElementById('loading-text'),

        // Update notification
        updateNotification: document.getElementById('update-notification'),
        updateTitle: document.getElementById('update-title'),
        updateMessage: document.getElementById('update-message'),
        updateIcon: document.querySelector('.update-icon'),
        updateDownloadBtn: document.getElementById('update-download-btn'),
        updateDismissBtn: document.getElementById('update-dismiss-btn')
    };
    
    const minimizeBtn = document.getElementById('minimize-btn');
    const closeBtn = document.getElementById('close-btn');

    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => {
            window.electronAPI.windowMinimize();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            window.electronAPI.windowClose();
        });
    }
    
    // Listen for messages from settings iframe
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'closeSettingsModal') {
            closeSettingsModal();
        }
    });

    // Handle electronAPI requests from iframe (settings modal)
    window.addEventListener('message', async (event) => {
        if (event.data.type === 'electronAPI-request') {
            try {
                const { requestId, method, args } = event.data;
                const result = await window.electronAPI[method](...args);
                
                // Send response back to iframe
                event.source.postMessage({
                    type: 'electronAPI-response',
                    requestId: requestId,
                    result: result
                }, '*');
            } catch (error) {
                // Send error back to iframe
                event.source.postMessage({
                    type: 'electronAPI-response',
                    requestId: event.data.requestId,
                    error: error.message || error.toString()
                }, '*');
            }
        }
        
        // Handle new proxy electronAPI calls
        if (event.data.type === 'electronAPICall') {
            try {
                const { id, method, args } = event.data;
                const result = await window.electronAPI[method](...args);
                
                // Send response back to iframe
                event.source.postMessage({
                    type: 'electronAPIResponse',
                    id: id,
                    result: result
                }, '*');
            } catch (error) {
                // Send error back to iframe
                event.source.postMessage({
                    type: 'electronAPIResponse',
                    id: event.data.id,
                    error: error.message || error.toString()
                }, '*');
            }
        }
    });
    
    // Close modal with Escape key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && elements.settingsModal && elements.settingsModal.style.display === 'flex') {
            closeSettingsModal();
        }
    });
    
    // Setup modal backdrop click handler after DOM is loaded
    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal) {
        const backdrop = settingsModal.querySelector('.settings-modal-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', closeSettingsModal);
        }
    }
    
    // Setup update notification button handlers
    if (elements.updateDownloadBtn) {
        elements.updateDownloadBtn.addEventListener('click', async () => {
            if (elements.updateDownloadBtn.textContent === 'Download') {
                try {
                    elements.updateDownloadBtn.disabled = true;
                    elements.updateDownloadBtn.textContent = 'Starting...';
                    await window.electronAPI.downloadUpdate();
                } catch (error) {
                    console.error('Error downloading update:', error);
                    elements.updateDownloadBtn.disabled = false;
                    elements.updateDownloadBtn.textContent = 'Download';
                    showError('Failed to download update: ' + error.message);
                }
            }
        });
    }
    
    if (elements.updateDismissBtn) {
        elements.updateDismissBtn.addEventListener('click', () => {
            elements.updateNotification.style.display = 'none';
        });
    }
    
    // Add iframe error handling to prevent load errors
    if (elements.settingsIframe) {
        elements.settingsIframe.addEventListener('error', (e) => {
            console.warn('Settings iframe error (expected during initialization):', e);
        });
        
        elements.settingsIframe.addEventListener('load', () => {
            console.log('Settings iframe loaded successfully');
        });
        
        // Prevent initial src loading which might cause errors
        elements.settingsIframe.src = 'about:blank';
    }
    
    // Initialize the app after DOM and elements are ready
    initializeApp();
});

// Main application state
let appState = {
    config: null,
    settings: {},
    platform: null,
    installPath: '',
    isWowInstalled: false,
    isDownloading: false,
    downloadPaused: false,
    realmAddress: '',
    wineInfo: null
};

console.log('App state initialized');

// DOM elements - will be initialized when DOM is ready
let elements = {};

// Initialize the application
async function initializeApp() {
    try {
        showLoading('Loading configuration...');
        
        console.log('Starting initialization...');
        console.log('Checking DOM elements...');
        
        // Verify critical DOM elements exist
        const criticalElements = ['main-action-button', 'progress-container'];
        for (const id of criticalElements) {
            if (!document.getElementById(id)) {
                throw new Error(`Critical DOM element missing: ${id}`);
            }
        }
        console.log('All critical DOM elements found');

        // Get configuration and platform info from main process
        console.log('Loading configuration...');
        appState.config = await window.electronAPI.getConfig();
        console.log('Config loaded:', appState.config);
        
        appState.platform = appState.config.platform;
        console.log('Platform info:', appState.platform);
        
        appState.settings = await window.electronAPI.loadSettings();
        console.log('Settings loaded:', appState.settings);

        // Update UI with configuration
        if (elements.serverName) {
            elements.serverName.textContent = appState.config.serverName;
        }
        
        // Update launcher version display
        if (appState.config.version && elements.launcherVersion) {
            elements.launcherVersion.textContent = `Launcher v${appState.config.version}`;
        }

        // Use settings or fallback to config
        appState.installPath = appState.settings.installPath || appState.config.installPath || '';
        appState.realmAddress = appState.settings.realmAddress || appState.config.defaultRealm || '';
        console.log('Install path:', appState.installPath);

        // Check Wine installation on non-Windows platforms
        if (appState.platform.needsWine) {
            showLoading('Checking Wine installation...');
            console.log('Checking Wine installation...');
            appState.wineInfo = await window.electronAPI.checkWineInstallation();
            console.log('Wine info:', appState.wineInfo);
        }

        // Check initial installation status
        console.log('Checking game status...');
        await checkGameStatus();

        // Scan for installed addons if installation path exists
        if (appState.installPath) {
            console.log('Scanning for installed addons...');
            try {
                const addons = await window.electronAPI.getInstalledAddons(appState.installPath);
                console.log(`Found ${addons.length} installed addon(s)`);
            } catch (error) {
                console.error('Failed to scan addons on startup:', error);
            }
        }

        // Set up event listeners
        console.log('Setting up event listeners...');
        setupEventListeners();

        hideLoading();
        updateServerStatus('online'); // You can implement actual server status checking later
        console.log('Launcher initialized successfully!');

    } catch (error) {
        console.error('Failed to initialize app:', error);
        console.error('Error stack:', error.stack);
        hideLoading();
        
        // Show detailed error in production
        const errorDetails = `Failed to initialize launcher

Error: ${error.message}

Location: ${error.fileName || 'unknown'}:${error.lineNumber || '?'}

Config loaded: ${appState.config ? 'Yes' : 'No'}
Platform info: ${appState.platform ? 'Yes' : 'No'}

Stack trace:
${error.stack || 'No stack trace available'}`;
        
        console.log('Full error details:', errorDetails);
        alert(errorDetails);
    }
}

// Handle Wine installation progress updates
function handleWineInstallProgress(event, data) {
    const { message, progress } = data;
    
    elements.progressText.textContent = message;
    elements.progressFill.style.width = `${progress}%`;
    elements.progressPercentage.textContent = `${progress}%`;
    
    console.log(`Wine installation progress: ${progress}% - ${message}`);
}

// Set up all event listeners
function setupEventListeners() {
    // Settings button
    elements.settingsButton.addEventListener('click', openSettings);

    // Main action button (handles download/launch based on state)
    elements.mainActionButton.addEventListener('click', handleMainAction);

    // Progress controls
    elements.pauseButton.addEventListener('click', toggleDownload);
    elements.cancelButton.addEventListener('click', cancelDownload);

    // Footer links
    elements.aboutLink.addEventListener('click', (e) => {
        e.preventDefault();
        showInfo(`${appState.config.serverName} Launcher v1.0.0\\nBuilt with Electron and Node.js\\n\\nCross-platform WoW 3.3.5a launcher with Wine support`);
    });

    // Download progress listeners
    window.electronAPI.onDownloadProgress(handleDownloadProgress);
    window.electronAPI.onDownloadComplete(handleDownloadComplete);
    window.electronAPI.onDownloadError(handleDownloadError);
    
    // Extraction progress listener
    window.electronAPI.onExtractionProgress(handleExtractionProgress);
    
    // Wine installation progress listener
    window.electronAPI.onWineInstallProgress(handleWineInstallProgress);

    // Listen for settings changes from options window
    window.addEventListener('focus', async () => {
        // Reload settings when window regains focus (after closing options)
        const newSettings = await window.electronAPI.loadSettings();
        if (JSON.stringify(newSettings) !== JSON.stringify(appState.settings)) {
            appState.settings = newSettings;
            appState.installPath = appState.settings.installPath || appState.config.installPath || '';
            appState.realmAddress = appState.settings.realmAddress || appState.config.defaultRealm || '';
            await checkGameStatus();
        }
    });
}

// Open settings window
async function openSettings() {
    try {
        // Show the modal
        if (elements.settingsModal) {
            elements.settingsModal.style.display = 'flex';
            
            // Load iframe content only when opening
            if (elements.settingsIframe) {
                elements.settingsIframe.src = 'options.html';
                
                // Wait for iframe to load, then pass data to it
                elements.settingsIframe.onload = async () => {
                    try {
                        console.log('Iframe loaded, sending data...');
                        // Get all the data the iframe needs
                        const config = await window.electronAPI.getConfig();
                        const settings = await window.electronAPI.loadSettings();
                        
                        console.log('Sending config to iframe:', config);
                        console.log('Sending settings to iframe:', settings);
                        
                        // Send data to the iframe
                        elements.settingsIframe.contentWindow.postMessage({
                            type: 'initializeWithData',
                            config: config,
                            settings: settings
                        }, '*');
                    } catch (error) {
                        console.warn('Failed to load settings data:', error);
                    }
                };
            }
        } else {
            console.warn('Settings modal element not found');
        }
    } catch (error) {
        // Silently handle errors during settings opening
        console.warn('Settings modal issue:', error.message || error);
    }
}

function closeSettingsModal() {
    if (elements.settingsModal) {
        const backdrop = elements.settingsModal.querySelector('.settings-modal-backdrop');
        const content = elements.settingsModal.querySelector('.settings-modal-content');
        
        // Add closing animation classes
        if (backdrop) backdrop.classList.add('closing');
        if (content) content.classList.add('closing');
        
        // Hide modal after animation completes (300ms is the longest animation)
        setTimeout(() => {
            elements.settingsModal.style.display = 'none';
            // Remove closing classes for next time
            if (backdrop) backdrop.classList.remove('closing');
            if (content) content.classList.remove('closing');
            
            // Refresh main window data after closing settings
            checkGameStatus();
            
            // Rescan addons in case install path changed
            if (appState.installPath) {
                window.electronAPI.getInstalledAddons(appState.installPath)
                    .then(addons => console.log(`Rescanned: ${addons.length} addon(s) found`))
                    .catch(err => console.error('Failed to rescan addons:', err));
            }
        }, 300);
    }
}

// Check game installation status
async function checkGameStatus() {
    if (!appState.installPath) {
        updateGameStatus('warning', 'Please configure installation path in Options.');
        updateMainActionButton('configure', 'Configure Settings', false);
        return;
    }
    
    try {
        const installationCheck = await window.electronAPI.checkWowInstallation(appState.installPath);
        
        // PRIORITY 1: Check if client files are downloaded
        if (!installationCheck.hasExecutable || !installationCheck.hasData) {
            appState.isWowInstalled = false;
            let message = 'WoW client not found.';

            if (!installationCheck.hasExecutable) {
                message += ' Missing WoW.exe.';
            }
            if (!installationCheck.hasData) {
                message += ' Missing Data folder.';
            }

            updateGameStatus('error', message);
            
            // Check if we can download
            const canDownload = appState.config.downloadUrl || appState.settings.downloadUrl;
            if (canDownload) {
                updateMainActionButton('download', 'Download Client Files', true);
            } else {
                updateMainActionButton('configure', 'Configure Download URL', false);
            }
            return; // Stop here - download client first
        }
        
        // PRIORITY 2: Client files exist, now check Wine/CrossOver on non-Windows
        if (appState.platform.needsWine && !appState.wineInfo?.installed) {
            updateGameStatus('warning', `Client ready. Wine/CrossOver required for ${appState.platform.platformName}`);
            updateMainActionButton('configure', 'Install Wine/CrossOver', true);
            return;
        }
        
        // PRIORITY 3: Everything is ready
        if (installationCheck.isValid) {
            appState.isWowInstalled = true;
            let statusMessage = `WoW client ready! (${installationCheck.platform})`;
            if (installationCheck.wineInfo?.version) {
                statusMessage += ` - ${installationCheck.wineInfo.type === 'crossover' ? 'CrossOver' : 'Wine'} ${installationCheck.wineInfo.version}`;
            }
            updateGameStatus('success', statusMessage);
            updateMainActionButton('play', 'Launch World of Warcraft', true);
        } else {
            appState.isWowInstalled = false;
            let message = 'Installation incomplete.';

            // Add platform-specific requirements
            if (installationCheck.requirements && installationCheck.requirements.length > 0) {
                message += ` ${installationCheck.requirements.join(', ')}`;
            }

            updateGameStatus('warning', message);
            
            // Check if we can download
            const canDownload = appState.config.downloadUrl || appState.settings.downloadUrl;
            if (canDownload) {
                updateMainActionButton('download', 'Re-download Client', true);
            } else {
                updateMainActionButton('configure', 'Check Settings', false);
            }
        }
    } catch (error) {
        console.error('Error checking installation:', error);
        updateGameStatus('error', 'Error checking installation directory.');
        updateMainActionButton('configure', 'Check Configuration', false);
    }
}

// Automatic Wine installation
async function installWineAutomatically() {
    try {
        updateMainActionButton('configure', 'Installing Wine...', false);
        updateGameStatus('warning', 'Installing Wine automatically...');
        
        // Show progress container for Wine installation
        elements.progressContainer.style.display = 'block';
        elements.progressText.textContent = 'Preparing Wine installation...';
        elements.progressFill.style.width = '0%';
        elements.progressPercentage.textContent = '0%';
        
        // Hide pause/cancel buttons for Wine installation
        elements.pauseButton.style.display = 'none';
        elements.cancelButton.style.display = 'none';

        const result = await window.electronAPI.installWineAutomatically();
        
        if (result.success) {
            updateGameStatus('success', result.message);
            
            // Recheck Wine installation
            appState.wineInfo = await window.electronAPI.checkWineInstallation();
            
            // Hide progress and recheck game status
            elements.progressContainer.style.display = 'none';
            
            if (result.requiresRestart) {
                updateMainActionButton('configure', 'Restart Required', false);
                showInfo('Wine installation completed! Please restart your Mac and then relaunch this application.');
            } else {
                await checkGameStatus();
            }
        } else {
            updateGameStatus('error', `Wine installation failed: ${result.message}`);
            updateMainActionButton('configure', 'Install Wine (Retry)', true);
            elements.progressContainer.style.display = 'none';
            showError(`Automatic Wine installation failed: ${result.message}\n\nYou can try the manual installation method in Options.`);
        }
        
    } catch (error) {
        console.error('Wine installation error:', error);
        updateGameStatus('error', 'Wine installation failed');
        updateMainActionButton('configure', 'Install Wine (Retry)', true);
        elements.progressContainer.style.display = 'none';
        showError('Wine installation failed. Please check your internet connection and try again.');
    }
}

// Handle main action button click
async function handleMainAction() {
    const buttonState = elements.mainActionButton.dataset.state;
    
    // Check if we need to install Wine automatically
    if (appState.platform.needsWine && !appState.wineInfo?.installed) {
        await installWineAutomatically();
        return;
    }
    
    switch (buttonState) {
        case 'configure':
            // Only open settings if DOM elements are ready
            if (document.readyState === 'complete' && elements.settingsModal) {
                await openSettings();
            } else {
                console.warn('Tried to open settings before DOM ready or modal not found');
            }
            break;
        case 'download':
            await startDownload();
            break;
        case 'play':
            await launchWow();
            break;
        case 'update':
            await window.electronAPI.installUpdate();
            break;
        default:
            console.warn('Unknown button state:', buttonState);
    }
}

// Start downloading the WoW client
async function startDownload() {
    const downloadUrl = appState.settings.downloadUrl || appState.config.downloadUrl;

    if (!downloadUrl) {
        showError('Download URL not configured. Please check your options.');
        return;
    }

    if (!appState.installPath) {
        showError('Please configure an installation directory in Options first.');
        return;
    }

    try {
        appState.isDownloading = true;
        elements.progressContainer.style.display = 'block';
        updateMainActionButton('download', 'Downloading...', false);

        await window.electronAPI.startDownload(downloadUrl, appState.installPath);
    } catch (error) {
        console.error('Download error:', error);
        showError('Failed to start download: ' + error.message);
        resetDownloadUI();
    }
}

// Toggle download pause/resume
async function toggleDownload() {
    try {
        if (appState.downloadPaused) {
            await window.electronAPI.resumeDownload();
            appState.downloadPaused = false;
            elements.pauseButton.textContent = 'Pause';
        } else {
            await window.electronAPI.pauseDownload();
            appState.downloadPaused = true;
            elements.pauseButton.textContent = 'Resume';
        }
    } catch (error) {
        console.error('Toggle download error:', error);
        showError('Failed to toggle download.');
    }
}

// Cancel download
async function cancelDownload() {
    try {
        await window.electronAPI.cancelDownload();
        resetDownloadUI();
        appState.isDownloading = false;
        appState.downloadPaused = false;
    } catch (error) {
        console.error('Cancel download error:', error);
        showError('Failed to cancel download.');
    }
}

// Handle download progress updates
function handleDownloadProgress(event, progress) {
    const percentage = Math.round(progress.percent || 0);
    const downloaded = formatBytes(progress.transferred || 0);
    const total = formatBytes(progress.total || 0);
    const speed = formatBytes(progress.bytesPerSecond || 0);

    elements.progressPercentage.textContent = `${percentage}%`;
    elements.progressFill.style.width = `${percentage}%`;
    elements.progressText.textContent = `Downloading Client: ${downloaded} / ${total} (${speed}/s)`;
    
    // Show pause/cancel buttons for client downloads
    elements.pauseButton.style.display = 'inline-block';
    elements.cancelButton.style.display = 'inline-block';
}

// Handle extraction progress
function handleExtractionProgress(event, data) {
    if (data.status === 'extracting') {
        elements.progressContainer.style.display = 'block';
        elements.progressPercentage.textContent = '100%';
        elements.progressFill.style.width = '100%';
        elements.progressText.textContent = 'Extracting Client Files...';
        
        // Hide pause/cancel buttons during extraction
        elements.pauseButton.style.display = 'none';
        elements.cancelButton.style.display = 'none';
        
        updateMainActionButton('download', '📦 Extracting...', false);
    }
}

// Handle download completion
async function handleDownloadComplete() {
    showInfo('✅ Client files downloaded and extracted successfully!');
    resetDownloadUI();
    appState.isDownloading = false;
    appState.downloadPaused = false;

    // Recheck installation status
    await checkGameStatus();
    
    // AUTOMATIC INSTALLATION FLOW FOR NON-WINDOWS
    if (appState.platform.needsWine && !appState.wineInfo?.installed) {
        const isAppleSilicon = appState.platform.isMacOS && appState.platform.arch === 'arm64';
        const recommendedTool = appState.platform.isMacOS ? 'CrossOver' : 'Wine';
        
        showInfo(
            `🔧 Installing ${recommendedTool} (Windows compatibility layer)...\n\n` +
            `This is required to run WoW on ${appState.platform.platformName}.`
        );
        
        try {
            // Automatically install Wine/CrossOver
            await installWineAutomatically();
            
            // After Wine/CrossOver is installed, apply macOS-specific patches
            if (appState.platform.isMacOS && isAppleSilicon) {
                showInfo('🍎 Applying Apple Silicon optimizations...');
                await applyMacOSPatches();
            }
            
            // Recheck status one final time
            await checkGameStatus();
            
            showInfo(
                `✅ Installation Complete!\n\n` +
                `World of Warcraft is now ready to play!`
            );
        } catch (error) {
            console.error('Auto-installation error:', error);
            showError(
                `❌ Failed to auto-install ${recommendedTool}\n\n` +
                `Error: ${error.message}\n\n` +
                `Please install ${recommendedTool} manually and try again.`
            );
        }
    }
}

// Handle download errors
function handleDownloadError(event, error) {
    console.error('Download error:', error);
    showError('Download failed: ' + error.message);
    resetDownloadUI();
    appState.isDownloading = false;
    appState.downloadPaused = false;
}

// Automatically install Wine/CrossOver after client download
async function installWineAutomatically() {
    try {
        showLoading('Installing compatibility layer...');
        
        const result = await window.electronAPI.installWineAutomatically();
        
        if (result.success) {
            // Recheck Wine installation
            appState.wineInfo = await window.electronAPI.checkWineInstallation();
            hideLoading();
            return true;
        } else {
            throw new Error(result.error || 'Installation failed');
        }
    } catch (error) {
        hideLoading();
        throw error;
    }
}

// Apply macOS-specific patches (libsillicon for Apple Silicon)
async function applyMacOSPatches() {
    try {
        showLoading('Applying macOS optimizations...');
        
        const result = await window.electronAPI.applyMacOSPatches(appState.installPath);
        
        if (result.success) {
            hideLoading();
            console.log('macOS patches applied successfully');
            return true;
        } else {
            throw new Error(result.error || 'Failed to apply patches');
        }
    } catch (error) {
        hideLoading();
        console.error('macOS patch error:', error);
        // Don't throw - patches are optional optimizations
        showInfo(`⚠️ Optional optimization skipped: ${error.message}`);
        return false;
    }
}

// Reset download UI to initial state
function resetDownloadUI() {
    elements.progressContainer.style.display = 'none';
    elements.pauseButton.textContent = 'Pause';
    elements.progressFill.style.width = '0%';
    elements.progressPercentage.textContent = '0%';
    elements.progressText.textContent = 'Preparing download...';

    // Reset main action button based on game status
    if (appState.isWowInstalled) {
        updateMainActionButton('play', 'Launch World of Warcraft', true);
    } else {
        const canDownload = appState.config.downloadUrl || appState.settings.downloadUrl;
        if (canDownload) {
            updateMainActionButton('download', 'Download Client', true);
        } else {
            updateMainActionButton('configure', 'Configure Settings', false);
        }
    }
}

// Launch WoW
async function launchWow() {
    if (!appState.isWowInstalled) {
        showError('WoW client is not installed.');
        return;
    }

    try {
        showLoading('Launching World of Warcraft...');

        // Update realmlist before launching if auto-update is enabled
        const autoUpdateRealmlist = appState.settings.autoUpdateRealmlist !== false;
        if (autoUpdateRealmlist && appState.realmAddress && appState.realmAddress.trim()) {
            await window.electronAPI.updateRealmlist(appState.installPath, appState.realmAddress);
        }

        await window.electronAPI.launchWow(appState.installPath);
        hideLoading();
        
        console.log('World of Warcraft launched successfully!');

        // Close launcher if setting is enabled
        if (appState.settings.closeOnLaunch === true) {
            setTimeout(() => window.close(), 1000);
        }
    } catch (error) {
        console.error('Launch error:', error);
        hideLoading();
        showError('Failed to launch WoW: ' + error.message);
    }
}

// UI update functions
function updateGameStatus(type, message) {
    elements.gameStatus.className = `status-display ${type}`;
    elements.gameStatus.innerHTML = `<span class="status-icon">${getStatusIcon(type)}</span><span>${message}</span>`;
}

function updateLaunchButton(enabled, statusText) {
    // This function is maintained for compatibility but now delegates to main action button
    if (enabled && appState.isWowInstalled) {
        updateMainActionButton('play', 'Launch World of Warcraft', true);
    } else {
        updateMainActionButton('configure', statusText, false);
    }
}

// Update main action button appearance and state
function updateMainActionButton(state, text, enabled) {
    elements.mainActionButton.dataset.state = state;
    elements.mainActionButton.textContent = text;
    elements.mainActionButton.disabled = !enabled;

    // Update button appearance based on state
    elements.mainActionButton.className = 'main-action-btn';
    if (state === 'play') {
        elements.mainActionButton.classList.add('ready');
    } else if (state === 'download') {
        elements.mainActionButton.classList.add('download');
    }
}

function updateServerStatus(status, data = {}) {
    elements.statusDot.className = `status-dot ${status}`;
    elements.statusText.textContent = status === 'online' ? 'Server Online' :
        status === 'offline' ? 'Server Offline' : 'Checking...';
    
    // Update tooltip with additional information
    const statusContainer = document.getElementById('server-status');
    if (statusContainer) {
        if (status === 'online' && data.ping) {
            statusContainer.title = `Server Online\nPing: ${data.ping}ms\nLast checked: ${new Date().toLocaleTimeString()}`;
        } else if (status === 'offline') {
            statusContainer.title = `Server Offline\n${data.error || 'Unable to connect'}\nLast checked: ${new Date().toLocaleTimeString()}`;
        } else {
            statusContainer.title = 'Checking server status...';
        }
    }
}

async function checkServerStatus() {
    try {
        const config = await window.electronAPI.getConfig();
        const realmAddress = config.defaultRealm || 'play.ascend-digital.co.uk';
        
        updateServerStatus('checking');
        
        const result = await window.electronAPI.testRealmConnection(realmAddress);
        
        if (result.success) {
            updateServerStatus('online', { ping: result.ping });
        } else {
            updateServerStatus('offline', { error: result.error });
        }
    } catch (error) {
        console.error('Error checking server status:', error);
        updateServerStatus('offline', { error: error.message });
    }
}

// Poll server status every 30 seconds
let statusPollInterval;
function startServerStatusPolling() {
    // Check immediately
    checkServerStatus();
    
    // Then check every 30 seconds
    if (statusPollInterval) {
        clearInterval(statusPollInterval);
    }
    statusPollInterval = setInterval(checkServerStatus, 30000);
}

function stopServerStatusPolling() {
    if (statusPollInterval) {
        clearInterval(statusPollInterval);
        statusPollInterval = null;
    }
}

function getStatusIcon(type) {
    switch (type) {
        case 'success': return '✅';
        case 'warning': return '⚠️';
        case 'error': return '❌';
        default: return 'ℹ️';
    }
}

// Utility functions
function showLoading(text) {
    elements.loadingText.textContent = text;
    elements.loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    elements.loadingOverlay.style.display = 'none';
}

function showError(message) {
    // Simple alert for now - could be replaced with a modal later
    alert('Error: ' + message);
}

function showInfo(message) {
    // Simple alert for now - could be replaced with a modal later
    alert(message);
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    // Start server status polling
    startServerStatusPolling();
});

// Auto-updater event handlers
window.electronAPI.onUpdateStatus((event, data) => {
    console.log('Update status:', data);
    
    switch (data.status) {
        case 'checking':
            showUpdateChecking();
            break;
            
        case 'available':
            showUpdateNotification(data.version);
            break;
            
        case 'not-available':
            hideUpdateNotification();
            console.log('No updates available');
            break;
            
        case 'downloading':
            updateDownloadProgress(data);
            break;
            
        case 'downloaded':
            showUpdateReady(data.version);
            break;
            
        case 'error':
            console.error('Update error:', data.message);
            hideUpdateNotification();
            break;
    }
});

function showUpdateChecking() {
    elements.updateTitle.textContent = 'Checking for Updates...';
    elements.updateMessage.textContent = 'Please wait';
    elements.updateNotification.style.display = 'block';
    elements.updateDownloadBtn.style.display = 'none';
    elements.updateDismissBtn.style.display = 'none';
    elements.updateIcon.style.animation = 'rotate 2s linear infinite';
}

function hideUpdateNotification() {
    setTimeout(() => {
        elements.updateNotification.style.display = 'none';
        checkGameStatus(); // Restore normal button state
    }, 2000);
}

async function downloadLauncherUpdate() {
    try {
        elements.updateDownloadBtn.disabled = true;
        elements.updateDownloadBtn.textContent = 'Starting...';
        elements.updateDismissBtn.style.display = 'none';
        await window.electronAPI.downloadUpdate();
    } catch (error) {
        console.error('Error downloading update:', error);
        elements.updateDownloadBtn.disabled = false;
        elements.updateDownloadBtn.textContent = 'Download Update';
        elements.updateDismissBtn.style.display = 'block';
        showError('Failed to download update: ' + error.message);
        checkGameStatus(); // Restore normal button state
    }
}

function showUpdateNotification(version) {
    elements.updateTitle.textContent = `Update Available: v${version}`;
    elements.updateMessage.textContent = 'A new version of the launcher is available. Click Download to update.';
    elements.updateNotification.style.display = 'block';
    elements.updateDownloadBtn.style.display = 'block';
    elements.updateDismissBtn.style.display = 'block';
    elements.updateDownloadBtn.textContent = 'Download Update';
    elements.updateDownloadBtn.disabled = false;
    elements.updateIcon.style.animation = 'rotate 2s linear infinite';
    
    // Update main button too
    updateMainActionButton('update', `⬇️ Download Update v${version}`, true);
    
    elements.updateDownloadBtn.onclick = async () => {
        await downloadLauncherUpdate();
    };
}

function updateDownloadProgress(data) {
    const percent = Math.round(data.percent);
    const transferred = formatBytes(data.transferred || 0);
    const total = formatBytes(data.total || 0);
    
    // Use main progress bar for launcher updates
    elements.progressContainer.style.display = 'block';
    elements.progressText.textContent = `Downloading Launcher Update (${transferred} / ${total})`;
    elements.progressPercentage.textContent = `${percent}%`;
    elements.progressFill.style.width = `${percent}%`;
    elements.pauseButton.style.display = 'none'; // Can't pause launcher updates
    elements.cancelButton.style.display = 'none';
    updateMainActionButton('download', 'Downloading Update...', false);
    
    // Keep update notification visible but minimal
    elements.updateNotification.style.display = 'block';
    elements.updateTitle.textContent = 'Downloading Update...';
    elements.updateMessage.textContent = `Version ${data.version || 'latest'}`;
    elements.updateDownloadBtn.style.display = 'none';
    elements.updateDismissBtn.style.display = 'none';
    elements.updateIcon.style.animation = 'rotate 2s linear infinite';
}

function showUpdateReady(version) {
    // Hide progress bar
    elements.progressContainer.style.display = 'none';
    
    // Update main action button to install update
    updateMainActionButton('update', `🎉 Install Update v${version}`, true);
    
    // Show notification
    elements.updateTitle.textContent = 'Update Ready! 🎉';
    elements.updateMessage.textContent = `Version ${version} is ready to install. Click the button below.`;
    elements.updateNotification.style.display = 'block';
    elements.updateDownloadBtn.style.display = 'none';
    elements.updateDismissBtn.style.display = 'block';
    elements.updateIcon.style.animation = 'none';
    
    elements.updateDismissBtn.onclick = () => {
        elements.updateNotification.style.display = 'none';
        checkGameStatus(); // Restore normal button state
    };
}

// Clean up event listeners when the page unloads
window.addEventListener('beforeunload', () => {
    window.electronAPI.removeAllListeners('download-progress');
    window.electronAPI.removeAllListeners('download-complete');
    window.electronAPI.removeAllListeners('download-error');
    window.electronAPI.removeAllListeners('update-status');
});