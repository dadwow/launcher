// Setup window controls for frameless window
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('close-btn');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            // Check if we're in an iframe (modal) or separate window
            if (window.parent !== window) {
                // We're in an iframe, tell parent to close modal
                window.parent.postMessage({ type: 'closeSettingsModal' }, '*');
            } else {
                // We're in a separate window
                if (window.electronAPI && window.electronAPI.windowClose) {
                    window.electronAPI.windowClose();
                } else {
                    window.close();
                }
            }
        });
    }
});

// Listen for data from parent window (when in iframe modal)
window.addEventListener('message', (event) => {
    console.log('Iframe received message:', event.data);
    if (event.data.type === 'initializeWithData') {
        // Initialize the options with the data passed from parent
        console.log('Initializing with data from parent:', event.data.config, event.data.settings);
        initializeWithData(event.data.config, event.data.settings).catch(error => {
            console.error('Failed to initialize with data:', error);
        });
    }
});

// Helper function to handle electronAPI calls (works in both iframe and standalone modes)
const electronAPI = {
    // Check if we're in an iframe
    isInIframe: () => window.parent !== window,
    
    // Generic proxy for all electronAPI methods
    call: (method, ...args) => {
        if (electronAPI.isInIframe()) {
            return new Promise((resolve, reject) => {
                const requestId = Math.random().toString(36).substr(2, 9);
                const messageListener = (event) => {
                    if (event.data.type === 'electronAPI-response' && event.data.requestId === requestId) {
                        window.removeEventListener('message', messageListener);
                        if (event.data.error) {
                            reject(new Error(event.data.error));
                        } else {
                            resolve(event.data.result);
                        }
                    }
                };
                window.addEventListener('message', messageListener);
                window.parent.postMessage({
                    type: 'electronAPI-request',
                    requestId: requestId,
                    method: method,
                    args: args
                }, '*');
            });
        }
        return window.electronAPI[method](...args);
    }
};

// Options window state
let optionsState = {
    config: null,
    platform: null,
    settings: {},
    installPath: '',
    realmAddress: '',
    installedAddons: [],
    wineInfo: null,
    winePrefixPath: ''
};

// DOM elements
const elements = {
    // Tab system
    tabButtons: document.querySelectorAll('.tab-button'),
    tabContents: document.querySelectorAll('.tab-content'),

    // General tab
    installPathInput: document.getElementById('install-path-options'),
    browseInstallPath: document.getElementById('browse-install-path'),
    suggestPaths: document.getElementById('suggest-paths'),
    installationStatus: document.getElementById('installation-status-options'),
    autoUpdateRealmlist: document.getElementById('auto-update-realmlist'),
    closeOnLaunch: document.getElementById('close-on-launch'),
    platformInfo: document.getElementById('platform-info'),
    platformStatus: document.getElementById('platform-status'),
    platformText: document.getElementById('platform-text'),

    // Server tab  
    realmAddressInput: document.getElementById('realm-address'),
    testRealmConnection: document.getElementById('test-connection'),
    connectionStatus: document.getElementById('connection-status'),

    // Wine configuration
    wineConfigGroup: document.getElementById('wine-config-group'),
    wineStatus: document.getElementById('wine-status'),
    showWineInstructions: document.getElementById('show-wine-instructions'),
    createWinePrefix: document.getElementById('create-wine-prefix'),

    // Advanced tab
    downloadUrlInput: document.getElementById('download-url-options'),
    enableLogging: document.getElementById('enable-logging'),
    addonBackup: document.getElementById('addon-backup'),
    checkInstallationBtn: document.getElementById('check-installation'),
    installationStatusOptions: document.getElementById('installation-status-options'),

    // Addons tab
    githubRepoUrl: document.getElementById('github-repo-url'),
    installAddonBtn: document.getElementById('install-addon-btn'),
    checkUpdatesBtn: document.getElementById('check-updates'),
    updateAllBtn: document.getElementById('update-all'),
    addonsList: document.getElementById('addons-list'),
    addonValidation: document.getElementById('addon-validation'),

    // Form controls
    cancelOptions: document.getElementById('cancel-options'),
    saveOptions: document.getElementById('save-options'),
    resetOptions: document.getElementById('reset-options')
};

// Initialize options window
async function initializeOptions() {
    try {
        // Wait for data to be passed from parent window instead of accessing electronAPI directly
        console.log('Waiting for configuration data from parent window...');
    } catch (error) {
        console.error('Failed to initialize options:', error);
        showError('Failed to load options. Please try again.');
    }
}

// Initialize with data passed from parent window
async function initializeWithData(config, settings) {
    try {
        console.log('Initializing settings with data:', config, settings);
        
        // Set the data that would normally come from electronAPI
        optionsState.config = config;
        optionsState.platform = config.platform;
        optionsState.settings = settings;

        // Show platform information
        updatePlatformInfo();

        // Check Wine if needed (for Linux/macOS)
        if (optionsState.platform.needsWine) {
            checkWineStatus();
        }

        // Populate form with current values
        populateForm();

        // Load installed addons
        await loadInstalledAddons();

        // Set up event listeners
        setupEventListeners();

        console.log('Settings initialized successfully with data from parent window');
    } catch (error) {
        console.error('Failed to initialize options with data:', error);
        showError('Failed to load options. Please try again.');
    }
}

// Set up event listeners
function setupEventListeners() {
    try {
        console.log('Setting up event listeners...');
        console.log('tabButtons found:', elements.tabButtons.length);
        console.log('tabContents found:', elements.tabContents.length);
        
        // Tab switching
        elements.tabButtons.forEach(button => {
            console.log('Adding listener to tab button:', button.dataset.tab);
            button.addEventListener('click', () => {
                console.log('Tab clicked:', button.dataset.tab);
                switchTab(button.dataset.tab);
            });
        });

        // General tab events
        if (elements.browseInstallPath) {
            elements.browseInstallPath.addEventListener('click', browseForInstallPath);
        }

        if (elements.checkInstallationBtn) {
            elements.checkInstallationBtn.addEventListener('click', checkInstallation);
        }

        // Server tab events
        if (elements.testRealmConnection) {
            elements.testRealmConnection.addEventListener('click', testRealmConnection);
        }

        if (elements.realmAddressInput) {
            elements.realmAddressInput.addEventListener('input', (e) => {
                optionsState.realmAddress = e.target.value;
            });
        }

        // Addons tab events
        if (elements.installAddonBtn) {
            elements.installAddonBtn.addEventListener('click', installAddonFromGitHub);
        }

        if (elements.githubRepoUrl) {
            elements.githubRepoUrl.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    installAddonFromGitHub();
                }
            });
        }

        // Form buttons
        if (elements.cancelOptions) {
            elements.cancelOptions.addEventListener('click', () => {
                if (window.parent !== window) {
                    window.parent.postMessage({ type: 'closeSettingsModal' }, '*');
                } else {
                    window.close();
                }
            });
        }

        if (elements.saveOptions) {
            elements.saveOptions.addEventListener('click', saveOptions);
        }

        if (elements.resetOptions) {
            elements.resetOptions.addEventListener('click', resetToDefaults);
        }

        console.log('Event listeners set up successfully');
    } catch (error) {
        console.error('Error setting up event listeners:', error);
    }
}

// Tab switching functionality
function switchTab(tabName) {
    console.log('switchTab called with:', tabName);
    console.log('Available tabButtons:', elements.tabButtons.length);
    console.log('Available tabContents:', elements.tabContents.length);
    
    // Update buttons
    elements.tabButtons.forEach(button => {
        const isActive = button.dataset.tab === tabName;
        button.classList.toggle('active', isActive);
        console.log(`Button ${button.dataset.tab} active:`, isActive);
    });

    // Update content
    elements.tabContents.forEach(content => {
        const isActive = content.id === `${tabName}-tab`;
        content.classList.toggle('active', isActive);
        console.log(`Content ${content.id} active:`, isActive);
    });
}

// Browse for installation path
async function browseForInstallPath() {
    try {
        const selectedPath = await proxyElectronAPICall('selectFolder');
        if (selectedPath) {
            optionsState.installPath = selectedPath;
            if (elements.installPathInput) {
                elements.installPathInput.value = selectedPath;
            }
            await checkInstallation();
        }
    } catch (error) {
        console.error('Error selecting folder:', error);
        showError('Failed to select folder.');
    }
}

// Check WoW installation
async function checkInstallation() {
    if (!optionsState.installPath) {
        updateInstallationStatus('warning', 'Please select an installation directory.');
        return;
    }

    try {
        const installationCheck = await proxyElectronAPICall('checkWowInstallation', optionsState.installPath);

        if (installationCheck.isValid) {
            updateInstallationStatus('success', 'WoW client found and ready to launch.');
        } else {
            updateInstallationStatus('error', 'WoW client not found in this directory.');
        }
    } catch (error) {
        console.error('Error checking installation:', error);
        updateInstallationStatus('error', 'Error checking installation.');
    }
}

// Test realm connection
async function testRealmConnection() {
    const realmAddress = optionsState.realmAddress || optionsState.config?.defaultRealm;
    
    if (!realmAddress) {
        updateConnectionStatus('error', 'Please enter a realm address');
        return;
    }

    try {
        updateConnectionStatus('testing', 'Testing connection to realm...');

        const result = await proxyElectronAPICall('testRealmConnection', realmAddress);

        if (result.success) {
            updateConnectionStatus('success', `Connection successful! Ping: ${result.ping}ms`);
        } else {
            updateConnectionStatus('error', `Connection failed: ${result.error}`);
        }
    } catch (error) {
        console.error('Error testing connection:', error);
        updateConnectionStatus('error', 'Error testing connection');
    }
}

// Install addon from GitHub
async function installAddonFromGitHub() {
    const repoUrl = elements.githubRepoUrl?.value;
    
    if (!repoUrl) {
        showError('Please enter a GitHub repository URL');
        return;
    }
    
    // Get install path
    const installPath = optionsState.settings.installPath || optionsState.config?.installPath;
    if (!installPath) {
        showError('Please set your WoW installation path first');
        return;
    }

    try {
        showStatusMessage('Installing addon...', 'info');
        
        // Parse GitHub URL to get owner and repo
        const urlMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (!urlMatch) {
            showError('Invalid GitHub repository URL');
            return;
        }
        
        const [, owner, repo] = urlMatch;
        const cleanRepo = repo.replace(/\.git$/, '');
        
        console.log(`Installing addon from ${owner}/${cleanRepo}`);
        
        const result = await proxyElectronAPICall('install-addon-from-github', owner, cleanRepo, installPath);
        
        if (result.success) {
            showStatusMessage('Addon installed successfully!', 'success');
            elements.githubRepoUrl.value = '';
            // Reload addon list
            await loadInstalledAddons();
        } else {
            showError(`Failed to install addon: ${result.error || 'Unknown error'}`);
        }
        
    } catch (error) {
        console.error('Error installing addon:', error);
        showError('Failed to install addon: ' + (error.message || error));
    }
}

// Save options
async function saveOptions() {
    try {
        const settings = {
            installPath: elements.installPathInput?.value || optionsState.installPath,
            realmAddress: elements.realmAddressInput?.value || optionsState.realmAddress,
            downloadUrl: elements.downloadUrlInput?.value || '',
            autoUpdateRealmlist: elements.autoUpdateRealmlist?.checked || false,
            closeOnLaunch: elements.closeOnLaunch?.checked || false,
            enableLogging: elements.enableLogging?.checked || false,
            addonBackup: elements.addonBackup?.checked || false
        };

        await proxyElectronAPICall('saveSettings', settings);
        showInfo('Settings saved successfully!');

        // Close modal after a short delay
        setTimeout(() => {
            if (window.parent !== window) {
                window.parent.postMessage({ type: 'closeSettingsModal' }, '*');
            } else {
                window.close();
            }
        }, 1000);

    } catch (error) {
        console.error('Error saving settings:', error);
        showError('Failed to save settings');
    }
}

// Reset to defaults
function resetToDefaults() {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
        // Reset form values
        if (elements.installPathInput) elements.installPathInput.value = '';
        if (elements.realmAddressInput) elements.realmAddressInput.value = optionsState.config?.defaultRealm || '';
        if (elements.downloadUrlInput) elements.downloadUrlInput.value = optionsState.config?.downloadUrl || '';
        if (elements.autoUpdateRealmlist) elements.autoUpdateRealmlist.checked = true;
        if (elements.closeOnLaunch) elements.closeOnLaunch.checked = false;
        if (elements.enableLogging) elements.enableLogging.checked = false;
        if (elements.addonBackup) elements.addonBackup.checked = true;
        
        showInfo('Settings reset to defaults');
    }
}

// Populate form with current settings
function populateForm() {
    try {
        console.log('Populating form with settings:', optionsState.settings);
        console.log('Config data:', JSON.stringify(optionsState.config, null, 2));
        
        // Install path - use saved setting, or config installPath, or platform default
        if (elements.installPathInput) {
            let installPath = optionsState.settings.installPath || optionsState.config?.installPath || '';
            
            // If no install path set, use platform defaults
            if (!installPath) {
                if (optionsState.platform?.isWindows) {
                    installPath = `${process.env.USERPROFILE || 'C:\\Users\\User'}\\Documents\\World of Warcraft`;
                } else {
                    // Linux/macOS default
                    installPath = `${process.env.HOME || '/home/' + (process.env.USER || 'user')}/Documents/World of Warcraft`;
                }
            }
            
            elements.installPathInput.value = installPath;
            optionsState.installPath = installPath;
        }

        if (elements.realmAddressInput) {
            // Use saved setting, or config defaultRealm, or hardcoded fallback from .env
            const realmAddress = optionsState.settings.realmAddress || 
                               optionsState.config?.defaultRealm || 
                               'play.ascend-digital.co.uk'; // fallback to .env default
            
            console.log('Realm address sources:', {
                saved: optionsState.settings.realmAddress,
                configDefault: optionsState.config?.defaultRealm,
                configFull: optionsState.config,
                final: realmAddress
            });
            
            elements.realmAddressInput.value = realmAddress;
            optionsState.realmAddress = realmAddress;
        }

        if (elements.downloadUrlInput) {
            elements.downloadUrlInput.value = optionsState.settings.downloadUrl || optionsState.config?.downloadUrl || '';
        }

        if (elements.autoUpdateRealmlist) {
            elements.autoUpdateRealmlist.checked = optionsState.settings.autoUpdateRealmlist !== false;
        }

        if (elements.closeOnLaunch) {
            elements.closeOnLaunch.checked = optionsState.settings.closeOnLaunch || false;
        }

        if (elements.enableLogging) {
            elements.enableLogging.checked = optionsState.settings.enableLogging || false;
        }

        if (elements.addonBackup) {
            elements.addonBackup.checked = optionsState.settings.addonBackup !== false;
        }

        console.log('Form populated successfully');
    } catch (error) {
        console.error('Error populating form:', error);
    }
}

// Update platform information
function updatePlatformInfo() {
    if (!optionsState.platform || !elements.platformInfo) return;

    try {
        elements.platformInfo.style.display = 'block';

        const icon = optionsState.platform.isWindows ? '🪟' :
            optionsState.platform.isMacOS ? '🍎' :
                optionsState.platform.isLinux ? '🐧' : '💻';

        const platformText = `${icon} ${optionsState.platform.platformName} (${optionsState.platform.arch})`;
        
        if (elements.platformText) {
            elements.platformText.textContent = platformText;
        }

        // Show Wine configuration if needed
        if (optionsState.platform.needsWine && elements.wineConfigGroup) {
            elements.wineConfigGroup.style.display = 'block';
        }

        console.log('Platform info updated:', platformText);
    } catch (error) {
        console.error('Error updating platform info:', error);
    }
}

// Proxy function for electronAPI calls when running in iframe
async function proxyElectronAPICall(method, ...args) {
    return new Promise((resolve, reject) => {
        // If we're in an iframe, use postMessage to communicate with parent
        if (window.parent && window.parent !== window) {
            const id = Date.now() + Math.random();
            
            const messageHandler = (event) => {
                if (event.data.type === 'electronAPIResponse' && event.data.id === id) {
                    window.removeEventListener('message', messageHandler);
                    if (event.data.error) {
                        reject(new Error(event.data.error));
                    } else {
                        resolve(event.data.result);
                    }
                }
            };
            
            window.addEventListener('message', messageHandler);
            
            window.parent.postMessage({
                type: 'electronAPICall',
                id: id,
                method: method,
                args: args
            }, '*');
            
            // Timeout after 10 seconds
            setTimeout(() => {
                window.removeEventListener('message', messageHandler);
                reject(new Error('ElectronAPI call timeout'));
            }, 10000);
        } else {
            // Direct call if not in iframe
            if (window.electronAPI && window.electronAPI[method]) {
                resolve(window.electronAPI[method](...args));
            } else {
                reject(new Error(`ElectronAPI method ${method} not available`));
            }
        }
    });
}

// Function to check wine status
async function checkWineStatus() {
    if (!optionsState.platform || !optionsState.platform.needsWine) return;
    
    try {
        const wineStatusDiv = document.getElementById('wine-status');
        if (!wineStatusDiv) return;

        wineStatusDiv.innerHTML = '<div class="checking">Checking wine installation...</div>';
        
        // Use the proxy system to check wine installation
        const wineStatus = await proxyElectronAPICall('checkWineInstallation');
        
        if (wineStatus && wineStatus.installed) {
            wineStatusDiv.innerHTML = `
                <div class="wine-installed">
                    <span class="status-icon">✓</span>
                    Wine ${wineStatus.version} installed
                </div>
            `;
        } else {
            wineStatusDiv.innerHTML = `
                <div class="wine-not-installed">
                    <span class="status-icon">✗</span>
                    Wine not found - Required for Windows games on Linux/macOS
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to check wine status:', error);
        const wineStatusDiv = document.getElementById('wine-status');
        if (wineStatusDiv) {
            wineStatusDiv.innerHTML = `
                <div class="wine-error">
                    <span class="status-icon">!</span>
                    Failed to check wine installation
                </div>
            `;
        }
    }
}

// Update installation status
function updateInstallationStatus(type, message) {
    if (!elements.installationStatusOptions) return;

    const statusClass = type === 'success' ? 'success' : 
                       type === 'warning' ? 'warning' : 'error';
    
    elements.installationStatusOptions.className = `installation-status ${statusClass}`;
    elements.installationStatusOptions.textContent = message;
}

// Update connection status
function updateConnectionStatus(type, message) {
    if (!elements.connectionStatus) return;

    const statusClass = type === 'success' ? 'success' : 
                       type === 'testing' ? 'info' : 'error';
    
    elements.connectionStatus.className = `connection-status ${statusClass}`;
    elements.connectionStatus.textContent = message;
}

// Show status message
function showStatusMessage(message, type = 'info') {
    console.log(`${type.toUpperCase()}: ${message}`);
    // You can implement a toast notification system here
}

// Load and display installed addons
async function loadInstalledAddons() {
    try {
        console.log('Loading installed addons...');
        
        // Get install path from settings or config
        const installPath = optionsState.settings.installPath || optionsState.config?.installPath;
        if (!installPath) {
            console.warn('No install path available for addon loading');
            const addonList = document.getElementById('addon-list');
            if (addonList) {
                addonList.innerHTML = `
                    <div class="addon-item">
                        <div class="addon-info">
                            <div class="addon-name">No install path configured</div>
                            <div class="addon-description">Please set your WoW installation path first</div>
                        </div>
                    </div>
                `;
            }
            return;
        }
        
        const addons = await proxyElectronAPICall('get-installed-addons', installPath);
        console.log('Loaded addons:', addons);
        
        const addonList = document.getElementById('addon-list');
        if (!addonList) {
            console.warn('Addon list element not found');
            return;
        }
        
        if (!addons || addons.length === 0) {
            addonList.innerHTML = `
                <div class="addon-item">
                    <div class="addon-info">
                        <div class="addon-name">No addons installed</div>
                        <div class="addon-description">Install addons from GitHub repositories above</div>
                    </div>
                </div>
            `;
            return;
        }
        
        // Display installed addons
        addonList.innerHTML = addons.map(addon => `
            <div class="addon-item">
                <div class="addon-info">
                    <div class="addon-name">${addon.name || 'Unknown Addon'}</div>
                    <div class="addon-description">${addon.description || 'No description available'}</div>
                    <div class="addon-version">Version: ${addon.version || 'Unknown'}</div>
                </div>
                <div class="addon-actions">
                    <div class="addon-status installed">Installed</div>
                    <button class="btn btn-danger btn-sm" onclick="uninstallAddon('${addon.name}')">Remove</button>
                </div>
            </div>
        `).join('');
        
        // Store loaded addons in state
        optionsState.installedAddons = addons;
        
    } catch (error) {
        console.error('Failed to load installed addons:', error);
        const addonList = document.getElementById('addon-list');
        if (addonList) {
            addonList.innerHTML = `
                <div class="addon-item">
                    <div class="addon-info">
                        <div class="addon-name">Error loading addons</div>
                        <div class="addon-description">Failed to load addon list: ${error.message}</div>
                    </div>
                </div>
            `;
        }
    }
}

// Uninstall addon function
async function uninstallAddon(addonName) {
    try {
        if (confirm(`Are you sure you want to uninstall ${addonName}?`)) {
            const installPath = optionsState.settings.installPath || optionsState.config?.installPath;
            if (!installPath) {
                showError('Install path not available');
                return;
            }
            
            await proxyElectronAPICall('uninstall-addon', addonName, installPath);
            showInfo(`${addonName} has been uninstalled successfully`);
            // Reload addon list
            await loadInstalledAddons();
        }
    } catch (error) {
        console.error('Failed to uninstall addon:', error);
        showError(`Failed to uninstall ${addonName}: ${error.message}`);
    }
}

// Check for addon updates
async function checkForUpdates() {
    try {
        showInfo('Checking for addon updates...');
        
        // Get installed addons first
        const installPath = optionsState.settings.installPath || optionsState.config?.installPath;
        if (!installPath) {
            showError('Install path not available');
            return;
        }
        
        const addons = optionsState.installedAddons || [];
        if (addons.length === 0) {
            showInfo('No addons installed to check for updates');
            return;
        }
        
        const result = await proxyElectronAPICall('check-addon-updates', addons);
        
        if (result && result.length > 0) {
            showInfo(`Found ${result.length} addon update(s) available!`);
        } else {
            showInfo('All addons are up to date!');
        }
    } catch (error) {
        console.error('Failed to check for updates:', error);
        showError('Failed to check for addon updates: ' + (error.message || error));
    }
}

// Show info message
function showInfo(message) {
    console.log(`INFO: ${message}`);
    alert(message); // Simple alert for now
}

// Show error message
function showError(message) {
    console.error(`ERROR: ${message}`);
    alert(`Error: ${message}`); // Simple alert for now
}

// Initialize when page loads - only if not in an iframe (for backwards compatibility)
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're in an iframe (modal) or separate window
    if (window.parent === window) {
        // We're in a separate window, initialize normally
        initializeOptions();
    } else {
        // We're in an iframe, wait for parent to send data
        console.log('Options loaded in iframe, waiting for parent data...');
    }
});

// Add to global scope for inline onclick handlers
window.uninstallAddon = function(addonName) {
    if (confirm(`Are you sure you want to uninstall ${addonName}?`)) {
        console.log(`Uninstalling addon: ${addonName}`);
        showInfo(`Addon uninstallation feature will be available soon!`);
    }
};