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

        // Tab switching
        elements.tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
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
        setButtonLoading('browse-install-path', true);
        const selectedPath = await proxyElectronAPICall('selectFolder');
        if (selectedPath) {
            optionsState.installPath = selectedPath;
            if (elements.installPathInput) {
                elements.installPathInput.value = selectedPath;
            }
            await checkInstallation();
            
            // Rescan addons with new install path
            await loadInstalledAddons();
            
            showToast('Installation path updated', 'success');
        }
    } catch (error) {
        console.error('Failed to select folder:', error);
        showToast('Failed to select folder', 'error');
    } finally {
        setButtonLoading('browse-install-path', false);
    }
}

// Check WoW installation
async function checkInstallation() {
    setButtonLoading('check-installation', true);
    
    if (!optionsState.installPath) {
        setButtonLoading('check-installation', false);
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
    } finally {
        setButtonLoading('check-installation', false);
    }
}

// Test realm connection
async function testRealmConnection() {
    setButtonLoading('test-connection', true);
    
    const realmAddress = optionsState.realmAddress || optionsState.config?.defaultRealm;
    
    if (!realmAddress) {
        setButtonLoading('test-connection', false);
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
    } finally {
        const testBtn = document.getElementById('test-connection');
        if (testBtn) setButtonLoading('test-connection', false);
    }
}

// Install addon from GitHub
async function installAddonFromGitHub() {
    const repoUrl = elements.githubRepoUrl?.value;
    const installBtn = document.getElementById('install-addon-btn');
    
    if (!repoUrl) {
        setButtonState('install-addon-btn', 'error', 'Please enter a GitHub repository URL');
        return;
    }
    
    // Get install path
    const installPath = optionsState.settings.installPath || optionsState.config?.installPath;
    if (!installPath) {
        setButtonState('install-addon-btn', 'error', 'Please set your WoW installation path first');
        return;
    }

    try {
        setButtonLoading('install-addon-btn', true);
        
        // Parse GitHub URL to get owner and repo
        const urlMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (!urlMatch) {
            setButtonState('install-addon-btn', 'error', 'Invalid GitHub repository URL');
            return;
        }
        
        const [, owner, repo] = urlMatch;
        const cleanRepo = repo.replace(/\.git$/, '');
        
        console.log(`Installing addon from ${owner}/${cleanRepo}`);
        
        const result = await proxyElectronAPICall('installAddonFromGitHub', owner, cleanRepo, installPath);
        
        if (result.success) {
            setButtonState('install-addon-btn', 'success', 'Addon installed successfully!');
            elements.githubRepoUrl.value = '';
            // Reload addon list
            await loadInstalledAddons();
        } else {
            setButtonState('install-addon-btn', 'error', `Failed to install: ${result.error || 'Unknown error'}`);
        }
        
    } catch (error) {
        console.error('Error installing addon:', error);
        setButtonState('install-addon-btn', 'error', 'Installation failed: ' + (error.message || error));
    }
}

// Save options
async function saveOptions() {
    try {
        setButtonLoading('save-options', true);
        
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
        
        setButtonFeedback('save-options', 'Saved!', 'success', 1500);

        // Close modal after feedback
        setTimeout(() => {
            if (window.parent !== window) {
                window.parent.postMessage({ type: 'closeSettingsModal' }, '*');
            } else {
                window.close();
            }
        }, 1500);

    } catch (error) {
        console.error('Error saving settings:', error);
        setButtonFeedback('save-options', 'Save Failed', 'error', 2000);
    }
}

// Reset to defaults
function resetToDefaults() {
    // Reset form values directly without confirmation
    if (elements.installPathInput) elements.installPathInput.value = '';
    if (elements.realmAddressInput) elements.realmAddressInput.value = optionsState.config?.defaultRealm || '';
    if (elements.downloadUrlInput) elements.downloadUrlInput.value = optionsState.config?.downloadUrl || '';
    if (elements.autoUpdateRealmlist) elements.autoUpdateRealmlist.checked = true;
    if (elements.closeOnLaunch) elements.closeOnLaunch.checked = false;
    if (elements.enableLogging) elements.enableLogging.checked = false;
    if (elements.addonBackup) elements.addonBackup.checked = true;
    
    setButtonState('reset-options', 'success', 'Settings reset to defaults');
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
        
        const addons = await proxyElectronAPICall('getInstalledAddons', installPath);
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
                    <button class="btn btn-danger btn-sm" onclick="uninstallAddon('${addon.name}')"><span class="btn-text">Remove</span></button>
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
        const installPath = optionsState.settings.installPath || optionsState.config?.installPath;
        if (!installPath) {
            showToast('Install path not available', 'error');
            return;
        }
        
        // Find the remove button for this addon and set loading state
        const addonItems = document.querySelectorAll('.addon-item');
        let removeBtn = null;
        for (const item of addonItems) {
            const nameEl = item.querySelector('.addon-name');
            if (nameEl && nameEl.textContent === addonName) {
                removeBtn = item.querySelector('.btn-danger');
                break;
            }
        }
        
        if (removeBtn) {
            removeBtn.classList.add('btn-loading');
            removeBtn.disabled = true;
        }
        
        await proxyElectronAPICall('uninstallAddon', addonName, installPath);
        
        showToast(`${addonName} has been uninstalled successfully`, 'success');
        
        // Reload addon list after a short delay
        setTimeout(async () => {
            await loadInstalledAddons();
        }, 500);
        
    } catch (error) {
        console.error('Failed to uninstall addon:', error);
        showToast(`Failed to uninstall ${addonName}: ${error.message || 'Unknown error'}`, 'error');
        
        // Find and reset the button state
        const addonItems = document.querySelectorAll('.addon-item');
        for (const item of addonItems) {
            const nameEl = item.querySelector('.addon-name');
            if (nameEl && nameEl.textContent === addonName) {
                const removeBtn = item.querySelector('.btn-danger');
                if (removeBtn) {
                    removeBtn.classList.remove('btn-loading');
                    removeBtn.disabled = false;
                }
                break;
            }
        }
    }
}

// Check for addon updates
async function checkForUpdates() {
    const updateBtn = document.querySelector('button[onclick="checkForUpdates()"]');
    
    try {
        if (updateBtn) {
            updateBtn.classList.add('btn-loading');
            updateBtn.disabled = true;
        }
        
        // Get installed addons first
        const installPath = optionsState.settings.installPath || optionsState.config?.installPath;
        if (!installPath) {
            if (updateBtn) {
                updateBtn.classList.remove('btn-loading');
                updateBtn.disabled = false;
                showStatusMessage(updateBtn, 'Install path not available', 'error');
            }
            return;
        }
        
        const addons = optionsState.installedAddons || [];
        if (addons.length === 0) {
            if (updateBtn) {
                updateBtn.classList.remove('btn-loading');
                updateBtn.disabled = false;
                showStatusMessage(updateBtn, 'No addons installed to check', 'error');
            }
            return;
        }
        
        const result = await proxyElectronAPICall('checkAddonUpdates', addons);
        
        if (updateBtn) {
            updateBtn.classList.remove('btn-loading');
            updateBtn.disabled = false;
            
            if (result && result.length > 0) {
                showStatusMessage(updateBtn, `Found ${result.length} update(s) available!`, 'success');
            } else {
                showStatusMessage(updateBtn, 'All addons are up to date!', 'success');
            }
        }
    } catch (error) {
        console.error('Failed to check for updates:', error);
        if (updateBtn) {
            updateBtn.classList.remove('btn-loading');
            updateBtn.disabled = false;
            showStatusMessage(updateBtn, 'Failed to check for updates', 'error');
        }
    }
}

// Button state management utilities
function setButtonLoading(buttonId, loading = true) {
    const button = document.getElementById(buttonId);
    if (button) {
        if (loading) {
            // Store original text
            const textSpan = button.querySelector('.btn-text');
            if (textSpan && !button.dataset.originalText) {
                button.dataset.originalText = textSpan.textContent;
            }
            button.classList.add('btn-loading');
            button.disabled = true;
        } else {
            button.classList.remove('btn-loading');
            button.disabled = false;
        }
    }
}

function setButtonFeedback(buttonId, message, type = 'success', duration = 2000) {
    const button = document.getElementById(buttonId);
    if (!button) return;

    // Remove loading state first
    setButtonLoading(buttonId, false);
    
    const textSpan = button.querySelector('.btn-text');
    if (textSpan) {
        // Store original text if not already stored
        if (!button.dataset.originalText) {
            button.dataset.originalText = textSpan.textContent;
        }
        
        // Show feedback message
        textSpan.textContent = message;
        
        // Add visual feedback class
        button.classList.remove('btn-feedback-success', 'btn-feedback-error');
        button.classList.add(`btn-feedback-${type}`);
        
        // Restore original text after delay
        setTimeout(() => {
            if (button.dataset.originalText) {
                textSpan.textContent = button.dataset.originalText;
                button.classList.remove(`btn-feedback-${type}`);
                delete button.dataset.originalText; // Clear stored text for next use
            }
        }, duration);
    }
}

// Simplified functions for compatibility
function showToast(message, type = 'info', duration = 4000) {
    console.log(`${type.toUpperCase()}: ${message}`);
}

function showStatusMessage(button, message, type = 'info', duration = 3000) {
    // Not used anymore - feedback shown on button
}

function setButtonState(buttonId, state, message = '', duration = 3000) {
    if (message) {
        setButtonFeedback(buttonId, message, state, duration);
    } else {
        setButtonLoading(buttonId, false);
    }
}

// Show info message
function showInfo(message) {
    console.log(`INFO: ${message}`);
}

// Show error message
function showError(message) {
    console.error(`ERROR: ${message}`);
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