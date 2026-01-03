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

    // Wine configuration
    wineConfigGroup: document.getElementById('wine-config-group'),
    wineStatus: document.getElementById('wine-status'),
    wineInstallInstructions: document.getElementById('wine-install-instructions'),
    wineInstructionsText: document.getElementById('wine-instructions-text'),
    showWineInstructions: document.getElementById('show-wine-instructions'),
    winePrefixConfig: document.getElementById('wine-prefix-config'),
    winePrefixPath: document.getElementById('wine-prefix-path'),
    createWinePrefix: document.getElementById('create-wine-prefix'),

    // Server tab
    realmAddressInput: document.getElementById('realm-address-options'),
    testRealmConnection: document.getElementById('test-realm-connection'),
    realmConnectionStatus: document.getElementById('realm-connection-status'),
    downloadUrlInput: document.getElementById('download-url-options'),

    // Addons tab
    githubRepoUrl: document.getElementById('github-repo-url'),
    installAddonBtn: document.getElementById('install-addon-btn'),
    addonList: document.getElementById('addon-list'),
    autoUpdateAddons: document.getElementById('auto-update-addons'),
    addonBackup: document.getElementById('addon-backup'),

    // Buttons
    cancelOptions: document.getElementById('cancel-options'),
    resetOptions: document.getElementById('reset-options'),
    saveOptions: document.getElementById('save-options')
};

// Initialize options window
async function initializeOptions() {
    try {
        // Get configuration, settings, and platform info
        optionsState.config = await window.electronAPI.getConfig();
        optionsState.platform = optionsState.config.platform;
        optionsState.settings = await window.electronAPI.loadSettings();

        // Show platform information
        updatePlatformInfo();

        // Check Wine if needed
        if (optionsState.platform.needsWine) {
            elements.wineConfigGroup.style.display = 'block';
            await checkWineInstallation();
        }

        // Populate form with current values
        populateForm();

        // Set up event listeners
        setupEventListeners();

        // Load installed addons
        await loadInstalledAddons();

    } catch (error) {
        console.error('Failed to initialize options:', error);
        showError('Failed to load options. Please try again.');
    }
}

// Set up all event listeners
function setupEventListeners() {
    // Tab switching
    elements.tabButtons.forEach(button => {
        button.addEventListener('click', () => switchTab(button.dataset.tab));
    });

    // General tab events
    elements.browseInstallPath.addEventListener('click', browseForInstallPath);
    elements.suggestPaths.addEventListener('click', suggestInstallPaths);
    elements.installPathInput.addEventListener('change', checkInstallation);

    // Wine events
    if (optionsState.platform.needsWine) {
        elements.showWineInstructions.addEventListener('click', showWineInstallInstructions);
        elements.createWinePrefix.addEventListener('click', createWinePrefix);
    }

    // Server tab events
    elements.testRealmConnection.addEventListener('click', testRealmConnection);
    elements.realmAddressInput.addEventListener('input', (e) => {
        optionsState.realmAddress = e.target.value;
    });

    // Addons tab events
    elements.installAddonBtn.addEventListener('click', installAddonFromGitHub);
    elements.githubRepoUrl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            installAddonFromGitHub();
        }
    });
    elements.githubRepoUrl.addEventListener('input', debounce(validateRepoUrl, 800));
    elements.githubRepoUrl.addEventListener('paste', () => {
        setTimeout(() => validateRepoUrl(), 100);
    });

    // Button events
    elements.cancelOptions.addEventListener('click', () => window.close());
    elements.saveOptions.addEventListener('click', saveOptions);
    elements.resetOptions.addEventListener('click', resetToDefaults);
}

// Populate form with current settings
function populateForm() {
    // General settings
    elements.installPathInput.value = optionsState.settings.installPath || optionsState.config.installPath || '';
    elements.autoUpdateRealmlist.value = optionsState.settings.autoUpdateRealmlist !== false ? 'true' : 'false';
    elements.closeOnLaunch.value = optionsState.settings.closeOnLaunch === true ? 'true' : 'false';

    // Server settings
    elements.realmAddressInput.value = optionsState.settings.realmAddress || optionsState.config.defaultRealm || '';
    elements.downloadUrlInput.value = optionsState.settings.downloadUrl || optionsState.config.downloadUrl || '';

    // Addon settings
    elements.autoUpdateAddons.value = optionsState.settings.autoUpdateAddons === true ? 'true' : 'false';
    elements.addonBackup.value = optionsState.settings.addonBackup !== false ? 'true' : 'false';

    // Update state
    optionsState.installPath = elements.installPathInput.value;
    optionsState.realmAddress = elements.realmAddressInput.value;

    // Check installation if path is set
    if (optionsState.installPath) {
        checkInstallation();
    }
}

// Tab switching functionality
function switchTab(tabName) {
    // Update buttons
    elements.tabButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.tab === tabName);
    });

    // Update content
    elements.tabContents.forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
}

// Browse for installation path
async function browseForInstallPath() {
    try {
        const selectedPath = await window.electronAPI.selectFolder();
        if (selectedPath) {
            optionsState.installPath = selectedPath;
            elements.installPathInput.value = selectedPath;
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
        const installationCheck = await window.electronAPI.checkWowInstallation(optionsState.installPath);

        if (installationCheck.isValid) {
            updateInstallationStatus('success', 'WoW client found and ready to launch.');
        } else {
            let message = 'WoW client not found in this directory.';
            if (!installationCheck.hasExecutable) message += ' Missing WoW.exe.';
            if (!installationCheck.hasData) message += ' Missing Data folder.';
            updateInstallationStatus('error', message);
        }
    } catch (error) {
        console.error('Error checking installation:', error);
        updateInstallationStatus('error', 'Error checking installation directory.');
    }
}

// Test realm connection
async function testRealmConnection() {
    const realmAddress = elements.realmAddressInput.value.trim();

    if (!realmAddress) {
        showError('Please enter a realm address first.');
        return;
    }

    try {
        elements.realmConnectionStatus.style.display = 'flex';
        updateConnectionStatus('testing', 'Testing connection to realm...');

        const result = await window.electronAPI.testRealmConnection(realmAddress);

        if (result.success) {
            updateConnectionStatus('success', `Connection successful! Ping: ${result.ping}ms`);
        } else {
            updateConnectionStatus('error', `Connection failed: ${result.error}`);
        }
    } catch (error) {
        console.error('Error testing connection:', error);
        updateConnectionStatus('error', 'Connection test failed.');
    }
}

// Install addon from GitHub
async function installAddonFromGitHub() {
    const repoUrl = elements.githubRepoUrl.value.trim();

    if (!repoUrl) {
        showError('Please enter a GitHub repository URL.');
        return;
    }

    if (!optionsState.installPath) {
        showError('Please set an installation path first.');
        return;
    }

    try {
        // Parse GitHub URL
        const repoInfo = parseGitHubUrl(repoUrl);
        if (!repoInfo) {
            showError('Invalid GitHub URL. Please use format: https://github.com/user/repo or user/repo');
            return;
        }

        // Disable button and show progress
        elements.installAddonBtn.disabled = true;
        elements.installAddonBtn.textContent = 'Installing...';

        // Install addon
        const result = await window.electronAPI.installAddonFromGitHub(
            repoInfo.owner,
            repoInfo.repo,
            optionsState.installPath
        );

        if (result.success) {
            showInfo(`Addon "${repoInfo.repo}" installed successfully!`);
            elements.githubRepoUrl.value = '';
            await loadInstalledAddons();
        } else {
            showError(`Failed to install addon: ${result.error}`);
        }

    } catch (error) {
        console.error('Error installing addon:', error);
        showError('Failed to install addon: ' + error.message);
    } finally {
        elements.installAddonBtn.disabled = false;
        elements.installAddonBtn.textContent = 'Install';
    }
}

// Parse GitHub URL
function parseGitHubUrl(url) {
    // Handle different URL formats
    let match;

    // Full GitHub URL
    match = url.match(/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git|\/|$)/);
    if (match) {
        return { owner: match[1], repo: match[2] };
    }

    // Short format (user/repo)
    match = url.match(/^([^\/]+)\/([^\/]+)$/);
    if (match) {
        return { owner: match[1], repo: match[2] };
    }

    return null;
}

// Load installed addons
async function loadInstalledAddons() {
    if (!optionsState.installPath) {
        return;
    }

    try {
        const addons = await window.electronAPI.getInstalledAddons(optionsState.installPath);
        optionsState.installedAddons = addons;
        renderAddonList(addons);
    } catch (error) {
        console.error('Error loading addons:', error);
        renderAddonList([]);
    }
}

// Render addon list
function renderAddonList(addons) {
    if (!addons || addons.length === 0) {
        elements.addonList.innerHTML = `
            <div class="addon-item">
                <div class="addon-info">
                    <div class="addon-name">No addons installed</div>
                    <div class="addon-description">Install addons from GitHub repositories above</div>
                </div>
            </div>
        `;
        return;
    }

    elements.addonList.innerHTML = addons.map((addon, index) => `
        <div class="addon-item" id="addon-${index}">
            <div class="addon-info">
                <div class="addon-name">${addon.name}</div>
                <div class="addon-description">
                    ${addon.description || 'No description available'}
                    ${addon.version ? `• Version: ${addon.version}` : ''}
                </div>
            </div>
            <div class="addon-actions">
                <span class="addon-status installed">Installed</span>
                ${addon.githubRepo ? `<button class="btn btn-primary btn-small" onclick="updateSingleAddon('${addon.githubRepo}', ${index})" id="update-btn-${index}">Check Update</button>` : ''}
                <button class="btn btn-danger btn-small" onclick="uninstallAddon('${addon.name}')">Remove</button>
            </div>
        </div>
    `).join('');
}

// Check for addon updates
async function checkForUpdates() {
    if (!optionsState.installPath) {
        showError('Please set installation path first');
        return;
    }

    try {
        const addons = optionsState.installedAddons.filter(addon => addon.githubRepo);
        
        if (addons.length === 0) {
            showInfo('No addons with update information found');
            return;
        }

        // Show checking status
        showInfo('Checking for updates...');

        const result = await window.electronAPI.checkAddonUpdates(addons);

        if (result.success) {
            const updatesAvailable = result.updates.filter(u => u.hasUpdate);
            
            if (updatesAvailable.length > 0) {
                showInfo(`${updatesAvailable.length} addon(s) have updates available`);
                
                // Update UI to show which addons have updates
                result.updates.forEach((update, index) => {
                    const addonItem = optionsState.installedAddons.findIndex(a => a.githubRepo === update.githubRepo);
                    if (addonItem >= 0) {
                        const updateBtn = document.getElementById(`update-btn-${addonItem}`);
                        if (updateBtn) {
                            if (update.hasUpdate) {
                                updateBtn.textContent = 'Update Available';
                                updateBtn.classList.remove('btn-primary');
                                updateBtn.classList.add('btn-success');
                            } else {
                                updateBtn.textContent = 'Up to Date';
                                updateBtn.disabled = true;
                            }
                        }
                    }
                });

                // Show update all button if not already visible
                showUpdateAllButton(updatesAvailable.length);
            } else {
                showInfo('All addons are up to date!');
                
                // Mark all buttons as up to date
                result.updates.forEach((update, index) => {
                    const addonItem = optionsState.installedAddons.findIndex(a => a.githubRepo === update.githubRepo);
                    if (addonItem >= 0) {
                        const updateBtn = document.getElementById(`update-btn-${addonItem}`);
                        if (updateBtn) {
                            updateBtn.textContent = 'Up to Date';
                            updateBtn.disabled = true;
                        }
                    }
                });
            }
        } else {
            showError(`Failed to check for updates: ${result.error}`);
        }
    } catch (error) {
        console.error('Error checking for updates:', error);
        showError('Failed to check for updates: ' + error.message);
    }
}

// Show update all button
function showUpdateAllButton(count) {
    const addonListHeader = document.querySelector('.addons-tab h3');
    if (addonListHeader && !document.getElementById('update-all-btn')) {
        const updateAllBtn = document.createElement('button');
        updateAllBtn.id = 'update-all-btn';
        updateAllBtn.className = 'btn btn-success';
        updateAllBtn.textContent = `Update All (${count})`;
        updateAllBtn.onclick = updateAllAddons;
        updateAllBtn.style.marginLeft = '10px';
        addonListHeader.appendChild(updateAllBtn);
    }
}

// Update single addon
async function updateSingleAddon(githubRepo, addonIndex) {
    const updateBtn = document.getElementById(`update-btn-${addonIndex}`);
    if (!updateBtn) return;

    const originalText = updateBtn.textContent;
    updateBtn.textContent = 'Updating...';
    updateBtn.disabled = true;

    try {
        const result = await window.electronAPI.updateAddon(githubRepo, optionsState.installPath);

        if (result.success) {
            showInfo('Addon updated successfully!');
            updateBtn.textContent = 'Updated ✓';
            
            // Reload addon list after a short delay
            setTimeout(async () => {
                await loadInstalledAddons();
            }, 1000);
        } else {
            showError(`Failed to update addon: ${result.error}`);
            updateBtn.textContent = originalText;
            updateBtn.disabled = false;
        }
    } catch (error) {
        console.error('Error updating addon:', error);
        showError('Failed to update addon: ' + error.message);
        updateBtn.textContent = originalText;
        updateBtn.disabled = false;
    }
}

// Update all addons
async function updateAllAddons() {
    const updateAllBtn = document.getElementById('update-all-btn');
    if (!updateAllBtn) return;

    updateAllBtn.disabled = true;
    updateAllBtn.textContent = 'Updating...';

    try {
        const addons = optionsState.installedAddons.filter(addon => addon.githubRepo);
        const result = await window.electronAPI.checkAddonUpdates(addons);

        if (result.success) {
            const updatesAvailable = result.updates.filter(u => u.hasUpdate);
            
            let successCount = 0;
            let failCount = 0;

            for (const update of updatesAvailable) {
                try {
                    const updateResult = await window.electronAPI.updateAddon(update.githubRepo, optionsState.installPath);
                    if (updateResult.success) {
                        successCount++;
                    } else {
                        failCount++;
                    }
                } catch (error) {
                    failCount++;
                    console.error(`Error updating ${update.name}:`, error);
                }
            }

            if (successCount > 0) {
                showInfo(`Successfully updated ${successCount} addon(s)${failCount > 0 ? `, ${failCount} failed` : ''}`);
            } else {
                showError('Failed to update addons');
            }

            // Remove the update all button
            updateAllBtn.remove();

            // Reload addon list
            await loadInstalledAddons();
        } else {
            showError(`Failed to check for updates: ${result.error}`);
            updateAllBtn.disabled = false;
            updateAllBtn.textContent = 'Update All';
        }
    } catch (error) {
        console.error('Error updating all addons:', error);
        showError('Failed to update addons: ' + error.message);
        updateAllBtn.disabled = false;
        updateAllBtn.textContent = 'Update All';
    }
}

// Uninstall addon
async function uninstallAddon(addonName) {
    if (!confirm(`Are you sure you want to remove the addon "${addonName}"?`)) {
        return;
    }

    try {
        const result = await window.electronAPI.uninstallAddon(addonName, optionsState.installPath);

        if (result.success) {
            showInfo(`Addon "${addonName}" removed successfully!`);
            await loadInstalledAddons();
        } else {
            showError(`Failed to remove addon: ${result.error}`);
        }
    } catch (error) {
        console.error('Error removing addon:', error);
        showError('Failed to remove addon: ' + error.message);
    }
}

// Save options
async function saveOptions() {
    try {
        const settings = {
            // General settings
            installPath: elements.installPathInput.value,
            autoUpdateRealmlist: elements.autoUpdateRealmlist.value === 'true',
            closeOnLaunch: elements.closeOnLaunch.value === 'true',

            // Server settings
            realmAddress: elements.realmAddressInput.value,
            downloadUrl: elements.downloadUrlInput.value,

            // Addon settings
            autoUpdateAddons: elements.autoUpdateAddons.value === 'true',
            addonBackup: elements.addonBackup.value === 'true'
        };

        await window.electronAPI.saveSettings(settings);
        showInfo('Settings saved successfully!');

        // Close window after a short delay
        setTimeout(() => window.close(), 1000);

    } catch (error) {
        console.error('Error saving settings:', error);
        showError('Failed to save settings: ' + error.message);
    }
}

// Reset to defaults
async function resetToDefaults() {
    if (!confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
        return;
    }

    try {
        // Reset form to default values
        elements.installPathInput.value = '';
        elements.autoUpdateRealmlist.value = 'true';
        elements.closeOnLaunch.value = 'false';
        elements.realmAddressInput.value = optionsState.config.defaultRealm || '';
        elements.downloadUrlInput.value = optionsState.config.downloadUrl || '';
        elements.autoUpdateAddons.value = 'false';
        elements.addonBackup.value = 'true';

        // Clear installation status
        updateInstallationStatus('warning', 'Please select an installation directory.');

        showInfo('Settings reset to defaults.');

    } catch (error) {
        console.error('Error resetting settings:', error);
        showError('Failed to reset settings.');
    }
}

// UI utility functions
function updateInstallationStatus(type, message) {
    const iconMap = {
        success: '✅',
        warning: '⚠️',
        error: '❌',
        info: 'ℹ️'
    };

    elements.installationStatus.className = `installation-status ${type}`;
    elements.installationStatus.innerHTML = `
        <span class="status-icon">${iconMap[type] || iconMap.info}</span>
        <span>${message}</span>
    `;
}

function updateConnectionStatus(type, message) {
    const iconMap = {
        success: '✅',
        error: '❌',
        testing: '🔄'
    };

    elements.realmConnectionStatus.className = `connection-status ${type}`;
    elements.realmConnectionStatus.innerHTML = `
        <span class="status-icon">${iconMap[type] || '❓'}</span>
        <span class="status-text">${message}</span>
    `;
}

function showError(message) {
    alert('Error: ' + message);
}

function showInfo(message) {
    alert(message);
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initializeOptions);

// Add to global scope for inline onclick handlers
window.uninstallAddon = uninstallAddon;

// Platform-specific functions
function updatePlatformInfo() {
    elements.platformInfo.style.display = 'block';

    const icon = optionsState.platform.isWindows ? '🪟' :
        optionsState.platform.isMacOS ? '🍎' :
            optionsState.platform.isLinux ? '🐧' : '💻';

    let statusClass = 'info';
    let statusText = `${icon} ${optionsState.platform.platformName}`;

    if (optionsState.platform.needsWine) {
        statusText += ' (Requires Wine)';
        statusClass = 'warning';
    }

    elements.platformStatus.className = `status-display ${statusClass}`;
    elements.platformText.textContent = statusText;
}

async function checkWineInstallation() {
    try {
        optionsState.wineInfo = await window.electronAPI.checkWineInstallation();

        if (optionsState.wineInfo.installed) {
            elements.wineStatus.className = 'status-display success';
            elements.wineStatus.innerHTML = `
                <span class="status-icon">✅</span>
                <span>Wine installed: ${optionsState.wineInfo.version} (${optionsState.wineInfo.type})</span>
            `;
            elements.wineInstallInstructions.style.display = 'none';
            elements.winePrefixConfig.style.display = 'block';

            if (optionsState.installPath) {
                optionsState.winePrefixPath = await window.electronAPI.getWinePrefixPath(optionsState.installPath);
                elements.winePrefixPath.value = optionsState.winePrefixPath || '';
            }
        } else {
            elements.wineStatus.className = 'status-display error';
            elements.wineStatus.innerHTML = `
                <span class="status-icon">❌</span>
                <span>Wine not found - Will be installed automatically when needed</span>
            `;
            elements.wineInstallInstructions.style.display = 'block';
            elements.winePrefixConfig.style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking Wine:', error);
    }
}

async function showWineInstallInstructions() {
    try {
        const instructions = await window.electronAPI.getWineInstallInstructions();
        if (!instructions) return;

        let instructionText = `AUTOMATIC WINE INSTALLATION\n`;
        instructionText += `The launcher will automatically install Wine when you try to launch or download the game.\n`;
        instructionText += `This is the recommended approach for most users.\n\n`;
        
        if (instructions.note) {
            instructionText += `${instructions.note}\n\n`;
        }
        
        instructionText += `${instructions.title}\n\n`;

        instructions.methods.forEach((method, index) => {
            instructionText += `${index + 1}. ${method.name}\n`;
            if (method.description) instructionText += `${method.description}\n`;
            if (method.url) instructionText += `URL: ${method.url}\n`;
            if (method.steps) {
                instructionText += 'Steps:\n';
                method.steps.forEach((step, stepIndex) => {
                    instructionText += `  ${stepIndex + 1}. ${step}\n`;
                });
            }
            instructionText += '\n';
        });

        alert(instructionText);
    } catch (error) {
        console.error('Error getting instructions:', error);
    }
}

async function createWinePrefix() {
    if (!optionsState.winePrefixPath) {
        showError('Wine prefix path not configured.');
        return;
    }

    if (!confirm(`Create/reset Wine prefix at:\n${optionsState.winePrefixPath}\n\nThis may take several minutes.`)) {
        return;
    }

    try {
        elements.createWinePrefix.disabled = true;
        elements.createWinePrefix.textContent = 'Creating...';

        const result = await window.electronAPI.createWinePrefix(optionsState.winePrefixPath);

        if (result.success) {
            showInfo('Wine prefix created successfully!');
        } else {
            showError(`Failed to create Wine prefix: ${result.error}`);
        }
    } catch (error) {
        showError('Failed to create Wine prefix: ' + error.message);
    } finally {
        elements.createWinePrefix.disabled = false;
        elements.createWinePrefix.textContent = 'Create/Reset Prefix';
    }
}

// State for repo validation
let repoValidationState = {
    currentValidation: null,
    validatedRepoData: null
};

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Validate repository URL
async function validateRepoUrl() {
    const repoUrl = elements.githubRepoUrl.value.trim();
    const validationEl = document.getElementById('repo-validation');
    const validationText = document.getElementById('repo-validation-text');

    // Clear previous validation
    repoValidationState.validatedRepoData = null;
    validationEl.className = 'repo-validation';

    if (!repoUrl) {
        return;
    }

    // Parse URL
    const repoInfo = parseGitHubUrl(repoUrl);
    if (!repoInfo) {
        validationEl.className = 'repo-validation invalid';
        validationText.textContent = 'Invalid GitHub URL format';
        return;
    }

    // Show validating state
    validationEl.className = 'repo-validation validating';
    validationText.textContent = 'Validating repository...';

    try {
        const result = await window.electronAPI.validateAddonRepo(repoInfo.owner, repoInfo.repo);

        if (result.valid) {
            validationEl.className = 'repo-validation valid';
            let addonInfo = '';
            if (result.addonInfo.hasTocInRoot) {
                addonInfo = `Found ${result.addonInfo.tocFiles.length} addon(s) in root`;
            } else {
                addonInfo = `Found ${result.addonInfo.addonFolders.length} addon folder(s)`;
            }
            validationText.innerHTML = `✓ Valid WoW addon - ${addonInfo} <a href="#" onclick="showRepoModal(); return false;" style="color: #4a6fa5; text-decoration: underline;">View Details</a>`;
            
            // Store validation data for modal
            repoValidationState.validatedRepoData = result;
        } else {
            validationEl.className = 'repo-validation invalid';
            validationText.textContent = result.error || 'Not a valid WoW addon (no .toc files found)';
        }
    } catch (error) {
        validationEl.className = 'repo-validation invalid';
        validationText.textContent = 'Error validating repository';
        console.error('Validation error:', error);
    }
}

// Show repo info modal
function showRepoModal() {
    if (!repoValidationState.validatedRepoData) return;

    const data = repoValidationState.validatedRepoData;
    const modal = document.getElementById('repo-info-modal');
    const repoTitle = document.getElementById('modal-repo-title');
    const repoInfo = document.getElementById('modal-repo-info');
    const readmeContent = document.getElementById('modal-readme-content');
    const releasesContent = document.getElementById('modal-releases-content');
    const installBtn = document.getElementById('modal-install-btn');

    // Set title
    repoTitle.textContent = data.repoData.fullName;

    // Set repo info
    repoInfo.innerHTML = `
        <div class="repo-info-item">
            <span class="repo-info-label">Description:</span>
            ${data.repoData.description || 'No description'}
        </div>
        <div class="repo-info-item">
            <span class="repo-info-label">Stars:</span>
            ${data.repoData.stars || 0} ⭐
        </div>
        <div class="repo-info-item">
            <span class="repo-info-label">Language:</span>
            ${data.repoData.language || 'N/A'}
        </div>
        <div class="repo-info-item">
            <span class="repo-info-label">Last Updated:</span>
            ${new Date(data.repoData.updatedAt).toLocaleDateString()}
        </div>
        <div class="repo-info-item">
            <span class="repo-info-label">Addon Structure:</span>
            ${data.addonInfo.hasTocInRoot 
                ? `Root contains: ${data.addonInfo.tocFiles.join(', ')}`
                : `${data.addonInfo.addonFolders.length} addon folder(s): ${data.addonInfo.addonFolders.map(f => f.folder).join(', ')}`
            }
        </div>
    `;

    // Set README
    if (data.readme) {
        // Convert markdown to HTML (basic conversion)
        readmeContent.innerHTML = convertMarkdownToHtml(data.readme);
    } else {
        readmeContent.innerHTML = '<p style="color: #888;">No README available</p>';
    }

    // Set releases
    if (data.releases && data.releases.length > 0) {
        let releasesHtml = '';
        data.releases.forEach(release => {
            releasesHtml += `
                <div style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid rgba(218, 145, 60, 0.2);">
                    <h3 style="margin: 0 0 10px 0;">${release.name || release.tag_name}</h3>
                    <p style="color: #888; font-size: 0.9em; margin: 5px 0;">
                        Released ${new Date(release.published_at).toLocaleDateString()} by ${release.author?.login || 'Unknown'}
                    </p>
                    <div>${convertMarkdownToHtml(release.body || 'No release notes')}</div>
                </div>
            `;
        });
        releasesContent.innerHTML = releasesHtml;
    } else {
        releasesContent.innerHTML = '<p style="color: #888;">No releases available</p>';
    }

    // Set install button handler
    installBtn.onclick = () => {
        closeRepoModal();
        installAddonFromGitHub();
    };

    // Show modal
    modal.classList.add('active');
}

// Close modal
function closeRepoModal() {
    const modal = document.getElementById('repo-info-modal');
    modal.classList.remove('active');
}

// Switch modal tabs
function switchModalTab(tabName) {
    const tabs = document.querySelectorAll('.modal-tab');
    const tabContents = document.querySelectorAll('.modal-tab-content');

    tabs.forEach(tab => {
        if (tab.textContent.toLowerCase().includes(tabName)) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    tabContents.forEach(content => {
        if (content.id === `modal-tab-${tabName}`) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });
}

// Basic markdown to HTML converter
function convertMarkdownToHtml(markdown) {
    if (!markdown) return '';

    let html = markdown
        // Headers
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        // Bold
        .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.*?)\*/gim, '<em>$1</em>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" style="color: #4a6fa5;">$1</a>')
        // Code blocks
        .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/gim, '<code>$1</code>')
        // Line breaks
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');

    return `<p>${html}</p>`;
}

// Make functions available globally for onclick handlers
window.showRepoModal = showRepoModal;
window.closeRepoModal = closeRepoModal;
window.switchModalTab = switchModalTab;

async function suggestInstallPaths() {
    try {
        const defaultPaths = await window.electronAPI.getDefaultInstallPaths();

        let pathList = 'Suggested installation paths:\n\n';
        defaultPaths.forEach((path, index) => {
            pathList += `${index + 1}. ${path}\n`;
        });

        alert(pathList);
    } catch (error) {
        showError('Failed to get suggested paths.');
    }
}