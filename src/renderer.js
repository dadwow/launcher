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

// DOM elements
const elements = {
    serverName: document.getElementById('server-name'),
    statusDot: document.getElementById('status-dot'),
    statusText: document.getElementById('status-text'),
    gameStatus: document.getElementById('game-status'),
    optionsButton: document.getElementById('options-button'),

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
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingText: document.getElementById('loading-text')
};

// Initialize the application
async function initializeApp() {
    try {
        showLoading('Loading configuration...');

        // Get configuration and platform info from main process
        console.log('Loading configuration...');
        appState.config = await window.electronAPI.getConfig();
        console.log('Config loaded:', appState.config);
        
        appState.platform = appState.config.platform;
        console.log('Platform info:', appState.platform);
        
        appState.settings = await window.electronAPI.loadSettings();
        console.log('Settings loaded:', appState.settings);

        // Update UI with configuration
        elements.serverName.textContent = appState.config.serverName;

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
        showError('Failed to initialize launcher. Please restart the application.');
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
    // Options button
    elements.optionsButton.addEventListener('click', openOptions);

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

// Open options window
async function openOptions() {
    try {
        await window.electronAPI.openOptionsWindow();
    } catch (error) {
        console.error('Failed to open options window:', error);
        showError('Failed to open options window.');
    }
}

// Check game installation status
async function checkGameStatus() {
    if (!appState.installPath) {
        let message = 'Please configure installation path in Options.';
        if (appState.platform.needsWine && !appState.wineInfo?.installed) {
            message = `Installing Wine for ${appState.platform.platformName}...`;
            updateGameStatus('warning', message);
            updateMainActionButton('configure', 'Install Wine', true);
            return;
        }
        updateGameStatus('warning', message);
        updateMainActionButton('configure', 'Configure Settings', false);
        return;
    }
    
    try {
        const installationCheck = await window.electronAPI.checkWowInstallation(appState.installPath);
        
        if (installationCheck.isValid) {
            appState.isWowInstalled = true;
            let statusMessage = `WoW client ready! (${installationCheck.platform})`;
            if (installationCheck.wineInfo?.version) {
                statusMessage += ` - Wine ${installationCheck.wineInfo.version}`;
            }
            updateGameStatus('success', statusMessage);
            updateMainActionButton('play', 'Launch World of Warcraft', true);
        } else {
            appState.isWowInstalled = false;
            let message = 'WoW client not found.';

            if (!installationCheck.hasExecutable) {
                message += ' Missing WoW.exe.';
            }
            if (!installationCheck.hasData) {
                message += ' Missing Data folder.';
            }

            // Add platform-specific requirements
            if (installationCheck.requirements && installationCheck.requirements.length > 0) {
                message += ` Requirements: ${installationCheck.requirements.join(', ')}`;
            }

            updateGameStatus('error', message);
            
            // Check if we can download
            const canDownload = appState.config.downloadUrl || appState.settings.downloadUrl;
            if (canDownload) {
                updateMainActionButton('download', 'Download Client', true);
            } else {
                updateMainActionButton('configure', 'Configure Download URL', false);
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
            await openOptions();
            break;
        case 'download':
            await startDownload();
            break;
        case 'play':
            await launchWow();
            break;
        default:
            console.warn('Unknown button state:', buttonState);
    }
}// Open options window
async function openOptions() {
    try {
        await window.electronAPI.openOptionsWindow();
    } catch (error) {
        console.error('Failed to open options:', error);
        updateGameStatus('error', 'Failed to open options window');
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
    elements.progressText.textContent = `Downloading... ${downloaded} / ${total} (${speed}/s)`;
}

// Handle download completion
function handleDownloadComplete() {
    showInfo('Download completed successfully!');
    resetDownloadUI();
    appState.isDownloading = false;
    appState.downloadPaused = false;

    // Recheck installation status
    setTimeout(() => checkGameStatus(), 1000);
}

// Handle download errors
function handleDownloadError(event, error) {
    console.error('Download error:', error);
    showError('Download failed: ' + error.message);
    resetDownloadUI();
    appState.isDownloading = false;
    appState.downloadPaused = false;
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
        showInfo('World of Warcraft launched successfully!');

        // Close launcher if setting is enabled
        if (appState.settings.closeOnLaunch === true) {
            setTimeout(() => window.close(), 2000);
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

function updateServerStatus(status) {
    elements.statusDot.className = `status-dot ${status}`;
    elements.statusText.textContent = status === 'online' ? 'Server Online' :
        status === 'offline' ? 'Server Offline' : 'Checking...';
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
document.addEventListener('DOMContentLoaded', initializeApp);

// Clean up event listeners when the page unloads
window.addEventListener('beforeunload', () => {
    window.electronAPI.removeAllListeners('download-progress');
    window.electronAPI.removeAllListeners('download-complete');
    window.electronAPI.removeAllListeners('download-error');
});