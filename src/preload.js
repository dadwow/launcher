const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Configuration
    getConfig: () => ipcRenderer.invoke('get-config'),

    // File system operations
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    checkWowInstallation: installPath => ipcRenderer.invoke('check-wow-installation', installPath),

    // Download operations
    startDownload: (url, destination) => ipcRenderer.invoke('start-download', url, destination),
    pauseDownload: () => ipcRenderer.invoke('pause-download'),
    resumeDownload: () => ipcRenderer.invoke('resume-download'),
    cancelDownload: () => ipcRenderer.invoke('cancel-download'),

    // Realmlist management
    updateRealmlist: (installPath, realmAddress) =>
        ipcRenderer.invoke('update-realmlist', installPath, realmAddress),
    getRealmlist: installPath => ipcRenderer.invoke('get-realmlist', installPath),

    // Launch WoW
    launchWow: installPath => ipcRenderer.invoke('launch-wow', installPath),

    // Settings
    saveSettings: settings => ipcRenderer.invoke('save-settings', settings),
    loadSettings: () => ipcRenderer.invoke('load-settings'),

    // Addon management
    installAddonFromGitHub: (owner, repo, installPath, branch) =>
        ipcRenderer.invoke('install-addon-from-github', owner, repo, installPath, branch),
    getInstalledAddons: installPath => ipcRenderer.invoke('get-installed-addons', installPath),
    uninstallAddon: (addonName, installPath) =>
        ipcRenderer.invoke('uninstall-addon', addonName, installPath),
    validateAddonRepo: (owner, repo) => ipcRenderer.invoke('validate-addon-repo', owner, repo),

    // GitHub repository information
    fetchGitHubRepoInfo: (owner, repo) => ipcRenderer.invoke('get-repo-info', owner, repo),
    fetchGitHubBranches: (owner, repo) => ipcRenderer.invoke('get-repo-branches', owner, repo),
    fetchGitHubReadme: (owner, repo) => ipcRenderer.invoke('get-repo-readme', owner, repo),

    // Addon updates
    checkAddonUpdates: installPath => ipcRenderer.invoke('check-addon-updates', installPath),
    updateAddon: (addonName, installPath) =>
        ipcRenderer.invoke('update-addon', addonName, installPath),

    // Connection testing
    testRealmConnection: realmAddress => ipcRenderer.invoke('test-realm-connection', realmAddress),

    // Platform-specific methods
    getPlatformInfo: () => ipcRenderer.invoke('get-platform-info'),
    checkWineInstallation: () => ipcRenderer.invoke('check-wine-installation'),
    getWineInstallInstructions: () => ipcRenderer.invoke('get-wine-install-instructions'),
    getDefaultInstallPaths: () => ipcRenderer.invoke('get-default-install-paths'),
    createWinePrefix: prefixPath => ipcRenderer.invoke('create-wine-prefix', prefixPath),
    getWinePrefixPath: installPath => ipcRenderer.invoke('get-wine-prefix-path', installPath),

    // Automatic Wine installation
    installWineAutomatically: () => ipcRenderer.invoke('install-wine-automatically'),
    checkWineInstalling: () => ipcRenderer.invoke('check-wine-installing'),

    // macOS-specific patches
    applyMacOSPatches: installPath => ipcRenderer.invoke('apply-macos-patches', installPath),
    onMacOSPatchProgress: callback => ipcRenderer.on('macos-patch-progress', callback),

    // Window management
    windowMinimize: () => ipcRenderer.invoke('window-minimize'),
    windowMaximize: () => ipcRenderer.invoke('window-maximize'),
    windowClose: () => ipcRenderer.invoke('window-close'),

    // Auto-updater
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    installUpdate: () => ipcRenderer.invoke('install-update'),
    onUpdateStatus: callback => ipcRenderer.on('update-status', callback),

    // Event listeners for download progress
    onDownloadProgress: callback => ipcRenderer.on('download-progress', callback),
    onDownloadComplete: callback => ipcRenderer.on('download-complete', callback),
    onDownloadError: callback => ipcRenderer.on('download-error', callback),

    // Event listeners for addon install progress
    onAddonInstallProgress: callback => ipcRenderer.on('addon-install-progress', callback),
    onAddonInstallComplete: callback => ipcRenderer.on('addon-install-complete', callback),

    // Event listener for extraction progress
    onExtractionProgress: callback => ipcRenderer.on('extraction-progress', callback),

    // Event listeners for Wine installation progress
    onWineInstallProgress: callback => ipcRenderer.on('wine-install-progress', callback),

    // Event listeners for initial update check
    onUpdateCheckStarting: callback => ipcRenderer.on('update-check-starting', callback),
    onUpdateCheckComplete: callback => ipcRenderer.on('update-check-complete', callback),

    // Remove event listeners
    removeAllListeners: channel => ipcRenderer.removeAllListeners(channel)
});
