/* global */

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
window.addEventListener('message', event => {
    console.log('Iframe received message:', event.data);
    if (event.data.type === 'initializeWithData') {
        // Initialize the options with the data passed from parent
        console.log('Initializing with data from parent:', event.data.config, event.data.settings);
        initializeWithData(event.data.config, event.data.settings).catch(error => {
            console.error('Failed to initialize with data:', error);
        });
    } else if (event.data.type === 'addonInstallProgress') {
        try {
            const data = event.data.data || {};
            const percent =
                data.percent !== null && data.percent !== undefined
                    ? Math.max(0, Math.min(100, Math.floor(data.percent)))
                    : null;
            const speedText = formatSpeed ? formatSpeed(data.speed) : '';
            const baseStatus = data.status || 'Installing';
            const pctStatus = percent !== null ? ` — ${percent}%` : '';
            const spdStatus = speedText ? ` @ ${speedText}` : '';
            updateInstallProgress(
                percent !== null ? percent : 0,
                `${baseStatus}${pctStatus}${spdStatus}`
            );
        } catch (e) {
            console.warn('Failed to process addonInstallProgress message:', e);
        }
    } else if (event.data.type === 'addonInstallComplete') {
        const data = event.data.data || {};
        if (data.success) {
            updateInstallProgress(100, '✓ Installation complete');
            setTimeout(() => updateInstallProgress(-1, ''), 1500);
        } else {
            updateInstallProgress(-1, '');
        }
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
                const messageListener = event => {
                    if (
                        event.data.type === 'electronAPI-response' &&
                        event.data.requestId === requestId
                    ) {
                        window.removeEventListener('message', messageListener);
                        if (event.data.error) {
                            reject(new Error(event.data.error));
                        } else {
                            resolve(event.data.result);
                        }
                    }
                };
                window.addEventListener('message', messageListener);
                window.parent.postMessage(
                    {
                        type: 'electronAPI-request',
                        requestId: requestId,
                        method: method,
                        args: args
                    },
                    '*'
                );
            });
        }
        return window.electronAPI[method](...args);
    }
};

// Options window state
const optionsState = {
    config: null,
    platform: null,
    settings: {},
    installPath: '',
    realmAddress: '',
    installedAddons: [],
    availableUpdates: [],
    wineInfo: null,
    winePrefixPath: '',
    updatingAddons: new Set() // Track which addons are currently updating
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
            button.addEventListener('click', () => {
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
            elements.realmAddressInput.addEventListener('input', e => {
                optionsState.realmAddress = e.target.value;
            });
        }

        // Addons tab events
        if (elements.installAddonBtn) {
            elements.installAddonBtn.addEventListener('click', openAddonModal);
        }

        // Paste button for GitHub URL (workaround for iframe clipboard restrictions)
        const pasteRepoUrlBtn = document.getElementById('paste-repo-url-btn');
        if (pasteRepoUrlBtn && elements.githubRepoUrl) {
            pasteRepoUrlBtn.addEventListener('click', async () => {
                try {
                    const text = await navigator.clipboard.readText();
                    elements.githubRepoUrl.value = text;
                    console.log('Pasted from clipboard:', text);
                    // Trigger validation
                    validateRepoUrl(text);
                } catch (error) {
                    console.error('Failed to read clipboard:', error);
                    // Fallback: show instruction
                    window.alert(
                        'Please use Ctrl+V (or Cmd+V on Mac) to paste, or try typing the URL manually.'
                    );
                }
            });
        }

        if (elements.githubRepoUrl) {
            // Handle paste event - intercept keyboard shortcut and use Clipboard API
            elements.githubRepoUrl.addEventListener('keydown', async e => {
                // Check for Cmd+V (Mac) or Ctrl+V (Windows/Linux)
                if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
                    e.preventDefault(); // Prevent default paste behavior
                    try {
                        const text = await navigator.clipboard.readText();
                        elements.githubRepoUrl.value = text;
                        console.log('Pasted from clipboard via keyboard:', text);
                        // Trigger input event so any listeners are notified
                        elements.githubRepoUrl.dispatchEvent(
                            new window.Event('input', { bubbles: true })
                        );
                    } catch (error) {
                        console.error('Failed to read clipboard:', error);
                    }
                }
            });

            // Handle paste event
            elements.githubRepoUrl.addEventListener('paste', _e => {
                console.log('Paste event detected');
                // Ensure paste works by not preventing default
                setTimeout(() => {
                    console.log('Pasted value:', elements.githubRepoUrl.value);
                }, 10);
            });

            // Handle input event for any changes
            elements.githubRepoUrl.addEventListener('input', e => {
                console.log('Input changed:', e.target.value);
                validateRepoUrl(e.target.value);
            });

            elements.githubRepoUrl.addEventListener('keypress', e => {
                if (e.key === 'Enter') {
                    openAddonModal();
                }
            });
        }

        // Addon search functionality
        const addonSearchInput = document.getElementById('addon-search');
        if (addonSearchInput) {
            // Handle paste keyboard shortcut
            addonSearchInput.addEventListener('keydown', async e => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
                    e.preventDefault();
                    try {
                        const text = await navigator.clipboard.readText();
                        addonSearchInput.value = text;
                        // Trigger input event to filter addons
                        addonSearchInput.dispatchEvent(
                            new window.Event('input', { bubbles: true })
                        );
                    } catch (error) {
                        console.error('Failed to read clipboard:', error);
                    }
                }
            });

            addonSearchInput.addEventListener('input', e => {
                filterAddons(e.target.value);
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
        const installationCheck = await proxyElectronAPICall(
            'checkWowInstallation',
            optionsState.installPath
        );

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

// Validate GitHub repository URL
let validateRepoTimeout = null;
async function validateRepoUrl(repoUrl) {
    const validationElement = document.getElementById('repo-validation');
    const validationText = document.getElementById('repo-validation-text');

    // Clear previous timeout
    if (validateRepoTimeout) {
        clearTimeout(validateRepoTimeout);
    }

    // Hide validation if input is empty
    if (!repoUrl || repoUrl.trim() === '') {
        if (validationElement) {
            validationElement.className = 'repo-validation';
            validationElement.style.display = 'none';
        }
        return;
    }

    // Parse GitHub URL to get owner and repo
    const urlMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!urlMatch) {
        // Check if it's in "owner/repo" format
        const simpleMatch = repoUrl.match(/^([^/]+)\/([^/]+)$/);
        if (!simpleMatch) {
            if (validationElement && validationText) {
                validationElement.className = 'repo-validation invalid';
                validationElement.style.display = 'flex';
                validationText.textContent =
                    'Invalid format. Use: github.com/owner/repo or owner/repo';
            }
            return;
        }
    }

    // Show validating state
    if (validationElement && validationText) {
        validationElement.className = 'repo-validation validating';
        validationElement.style.display = 'flex';
        validationText.textContent = 'Validating repository...';
    }

    // Debounce the validation API call
    validateRepoTimeout = setTimeout(async () => {
        try {
            const match = urlMatch || repoUrl.match(/^([^/]+)\/([^/]+)$/);
            const owner = match[1];
            const repo = match[2].replace(/\.git$/, '');

            const result = await proxyElectronAPICall('validateAddonRepo', owner, repo);

            if (result.valid) {
                if (validationElement && validationText) {
                    validationElement.className = 'repo-validation valid';
                    validationElement.style.display = 'flex';

                    const addonInfo = result.addonInfo || {};
                    const folderCount = addonInfo.addonFolders?.length || 0;
                    const hasRoot = addonInfo.hasTocInRoot ? 1 : 0;
                    const addonCount = folderCount || hasRoot;

                    if (addonCount > 0) {
                        const plural = addonCount > 1 ? 's' : '';
                        validationText.textContent = `✓ Valid addon repo (${addonCount} addon${plural} found)`;
                    } else {
                        validationText.textContent = '✓ Valid addon repository';
                    }
                }
            } else {
                if (validationElement && validationText) {
                    validationElement.className = 'repo-validation invalid';
                    validationElement.style.display = 'flex';
                    validationText.textContent = `✗ ${result.error || 'Not a valid WoW addon repository (no .toc files found)'}`;
                }
            }
        } catch (error) {
            console.error('Validation error:', error);
            if (validationElement && validationText) {
                validationElement.className = 'repo-validation invalid';
                validationElement.style.display = 'flex';
                validationText.textContent = `✗ ${error.message || 'Failed to validate repository'}`;
            }
        }
    }, 500); // 500ms debounce
}

// Update progress bar
function updateInstallProgress(percent, status) {
    // Main tab progress
    const progressContainer = document.getElementById('addon-install-progress');
    const progressBar = document.getElementById('addon-install-progress-bar');
    const progressStatus = document.getElementById('addon-install-status');

    if (progressContainer) {
        progressContainer.style.display = percent >= 0 ? 'block' : 'none';
    }
    if (progressBar) {
        progressBar.style.width = `${percent}%`;
    }
    if (progressStatus) {
        progressStatus.textContent = status;
    }

    // Modal progress (mirrors main)
    const modalProgressContainer = document.getElementById('modal-install-progress');
    const modalProgressBar = document.getElementById('modal-install-progress-bar');
    const modalProgressStatus = document.getElementById('modal-install-status');

    if (modalProgressContainer) {
        modalProgressContainer.style.display = percent >= 0 ? 'block' : 'none';
    }
    if (modalProgressBar) {
        modalProgressBar.style.width = `${percent}%`;
    }
    if (modalProgressStatus) {
        modalProgressStatus.textContent = status;
    }
}

// Format speeds given bytes/sec or generic units/sec
function formatSpeed(speed) {
    if (!speed || isNaN(speed) || speed <= 0) return '';
    if (speed > 1024) {
        const kb = speed / 1024;
        if (kb < 1024) return `${kb.toFixed(1)} KB/s`;
        const mb = kb / 1024;
        return `${mb.toFixed(1)} MB/s`;
    }
    return `${Math.round(speed)} u/s`;
}

// Attach real-time progress events
function attachAddonInstallProgressEvents() {
    try {
        if (window.electronAPI && window.electronAPI.onAddonInstallProgress) {
            window.electronAPI.onAddonInstallProgress((_event, data) => {
                const percent =
                    data.percent !== null && data.percent !== undefined
                        ? Math.max(0, Math.min(100, Math.floor(data.percent)))
                        : null;
                const speedText = formatSpeed(data.speed);
                const baseStatus = data.status || 'Installing';
                const pctStatus = percent !== null ? ` — ${percent}%` : '';
                const spdStatus = speedText ? ` @ ${speedText}` : '';
                updateInstallProgress(
                    percent !== null ? percent : 0,
                    `${baseStatus}${pctStatus}${spdStatus}`
                );
            });
        }
        if (window.electronAPI && window.electronAPI.onAddonInstallComplete) {
            window.electronAPI.onAddonInstallComplete((_event, data) => {
                if (data && data.success) {
                    updateInstallProgress(100, '✓ Installation complete');
                    setTimeout(() => updateInstallProgress(-1, ''), 1500);
                } else if (data && data.error) {
                    updateInstallProgress(-1, '');
                }
            });
        }
    } catch (e) {
        console.warn('Could not attach addon install progress listeners:', e);
    }
}

// installAddonFromGitHub - functionality moved to modal-based flow (installAddonFromModal)

// Modal state
const modalState = {
    currentAddon: null,
    owner: null,
    repo: null,
    branches: [],
    selectedBranch: null,
    isInstalled: false,
    installedAddonName: null
};

// Open addon modal (either for new install or existing addon)
async function openAddonModal() {
    const repoUrl = elements.githubRepoUrl?.value;

    if (!repoUrl) {
        showToast('Please enter a GitHub repository URL', 'error');
        return;
    }

    // Parse GitHub URL to get owner and repo
    const urlMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    const simpleMatch = repoUrl.match(/^([^/]+)\/([^/]+)$/);

    let owner, repo;
    if (urlMatch) {
        [, owner, repo] = urlMatch;
    } else if (simpleMatch) {
        [, owner, repo] = simpleMatch;
    } else {
        showToast('Invalid GitHub repository URL', 'error');
        return;
    }

    const cleanRepo = repo.replace(/\.git$/, '');

    await showAddonDetailsModal(owner, cleanRepo);
}

// Open modal for installed addon
async function openInstalledAddonModal(folderName, githubRepo) {
    if (!githubRepo) {
        showToast('No GitHub repository information available for this addon', 'error');
        return;
    }

    const [owner, repo] = githubRepo.split('/');
    modalState.isInstalled = true;
    modalState.installedAddonName = folderName; // Store folder name for uninstall

    await showAddonDetailsModal(owner, repo);
}

// Show addon details modal
async function showAddonDetailsModal(owner, repo) {
    const modal = document.getElementById('repo-info-modal');
    if (!modal) return;

    modalState.owner = owner;
    modalState.repo = repo;

    // Show modal
    modal.classList.add('active');

    // Update modal title
    const modalTitle = document.getElementById('modal-repo-title');
    if (modalTitle) {
        modalTitle.textContent = modalState.isInstalled
            ? `Addon Settings: ${modalState.installedAddonName}`
            : `Install: ${owner}/${repo}`;
    }

    // Show/hide appropriate buttons
    const installBtn = document.getElementById('modal-install-btn');
    const uninstallBtn = document.getElementById('modal-uninstall-btn');

    if (installBtn) {
        installBtn.style.display = modalState.isInstalled ? 'none' : 'block';
        installBtn.onclick = () => installAddonFromModal();
    }

    if (uninstallBtn) {
        // Individual addon modal - hide uninstall button (use group modal for deletion)
        uninstallBtn.style.display = 'none';
    }

    // Load addon details
    await loadAddonDetails(owner, repo);
}

// Load addon details from GitHub
async function loadAddonDetails(owner, repo) {
    try {
        // Fetch repository information
        const repoInfo = await proxyElectronAPICall('fetchGitHubRepoInfo', owner, repo);

        // Update modal info tab
        const descEl = document.getElementById('modal-description');
        const starsEl = document.getElementById('modal-stars');
        const updatedEl = document.getElementById('modal-updated');
        const branchEl = document.getElementById('modal-default-branch');

        if (descEl) descEl.textContent = repoInfo.description || 'No description';
        if (starsEl) starsEl.textContent = repoInfo.stars || '0';
        if (updatedEl) updatedEl.textContent = new Date(repoInfo.updatedAt).toLocaleDateString();
        if (branchEl) branchEl.textContent = repoInfo.defaultBranch;

        // Fetch branches
        const branches = await proxyElectronAPICall('fetchGitHubBranches', owner, repo);

        if (branches && branches.length > 0) {
            modalState.branches = branches;
            const branchSelector = document.getElementById('branch-selector');
            const branchContainer = document.getElementById('branch-selector-container');

            if (branchSelector && branchContainer) {
                branchSelector.innerHTML = branches
                    .map(branch => `<option value="${branch.name}">${branch.name}</option>`)
                    .join('');

                // Select default branch
                branchSelector.value = repoInfo.defaultBranch;
                modalState.selectedBranch = repoInfo.defaultBranch;

                // When dropdown changes, automatically switch branch
                branchSelector.onchange = async e => {
                    const selectedBranch = e.target.value;
                    await installAddonFromModal(selectedBranch);
                };

                // Show branch selector if multiple branches
                if (branches.length > 1) {
                    branchContainer.style.display = 'flex';
                } else {
                    branchContainer.style.display = 'none';
                }
            }
        }

        // Fetch README
        const readme = await proxyElectronAPICall('fetchGitHubReadme', owner, repo);
        const readmeContent = document.getElementById('modal-readme-content');

        if (readmeContent) {
            if (readme) {
                // Simple markdown rendering (basic)
                readmeContent.innerHTML = readme
                    .replace(/### (.+)/g, '<h3>$1</h3>')
                    .replace(/## (.+)/g, '<h2>$1</h2>')
                    .replace(/# (.+)/g, '<h1>$1</h1>')
                    .replace(/`([^`]+)`/g, '<code>$1</code>')
                    .replace(/\n\n/g, '</p><p>')
                    .replace(/^(.)/g, '<p>$1');
            } else {
                readmeContent.textContent = 'No README available';
            }
        }
    } catch (error) {
        console.error('Error loading addon details:', error);

        // Show error in modal
        const readmeContent = document.getElementById('modal-readme-content');
        if (readmeContent) {
            readmeContent.innerHTML = `
                <div style='padding: 20px; text-align: center; color: #ff6b6b;'>
                    <h3>Error Loading Repository</h3>
                    <p>${error.message || 'Unknown error occurred'}</p>
                    <p style="font-size: 0.9em; color: #aaa;">The repository may not exist or may be private.</p>
                </div>
            `;
        }

        showToast('Failed to load addon details: ' + error.message, 'error');
    }
}

// Install addon from modal
async function installAddonFromModal(branchFromDropdown = null) {
    const installBtn = document.getElementById('modal-install-btn');
    if (!installBtn) return;

    const installPath = optionsState.settings.installPath || optionsState.config?.installPath;
    if (!installPath) {
        showToast('Please set your WoW installation path first', 'error');
        return;
    }

    try {
        // Determine which branch to use
        const branchToUse = branchFromDropdown || modalState.selectedBranch;

        // Hide button and show status while switching/installing
        installBtn.disabled = true;
        installBtn.textContent = 'Processing...';

        // Show progress inside modal and attach real-time updates
        attachAddonInstallProgressEvents();
        updateInstallProgress(0, branchFromDropdown ? 'Switching branch...' : 'Preparing...');

        const result = await proxyElectronAPICall(
            'installAddonFromGitHub',
            modalState.owner,
            modalState.repo,
            installPath,
            branchToUse
        );

        // main process also emits completion event

        if (result.success) {
            updateInstallProgress(
                100,
                branchFromDropdown ? '✓ Branch switched!' : '✓ Installation complete!'
            );
            showToast(
                branchFromDropdown
                    ? 'Branch switched successfully!'
                    : 'Addon installed successfully!',
                'success'
            );
            elements.githubRepoUrl.value = '';
            await loadInstalledAddons();
            // Let user see the complete status briefly before closing
            setTimeout(() => {
                updateInstallProgress(-1, '');
                closeAddonModal();
            }, 1200);
        } else {
            updateInstallProgress(-1, '');
            showToast(
                `Failed to ${branchFromDropdown ? 'switch branch' : 'install'}: ${result.error || 'Unknown error'}`,
                'error'
            );
        }
    } catch (error) {
        console.error('Error installing addon:', error);
        updateInstallProgress(-1, '');
        showToast('Installation failed: ' + (error.message || error), 'error');
    } finally {
        installBtn.disabled = false;
        installBtn.textContent = modalState.isInstalled ? 'Switch Branch' : 'Install';
    }
}

// Uninstall addon from modal (exported to window below)
async function uninstallAddonFromModal() {
    if (!modalState.installedAddonName) return;

    const installPath = optionsState.settings.installPath || optionsState.config?.installPath;
    if (!installPath) {
        showToast('Install path not available', 'error');
        return;
    }

    try {
        showToast(`Uninstalling ${modalState.installedAddonName}...`, 'info');
        await proxyElectronAPICall('uninstallAddon', modalState.installedAddonName, installPath);
        showToast(`${modalState.installedAddonName} has been uninstalled successfully`, 'success');
        await loadInstalledAddons();
        closeAddonModal();
    } catch (error) {
        console.error('Failed to uninstall addon:', error);
        showToast(
            `Failed to uninstall ${modalState.installedAddonName}: ${error.message || 'Unknown error'}`,
            'error'
        );
    }
}

// Open repo group modal for managing all addons from a repository
async function openRepoGroupModal(githubRepo, addonCount) {
    const [owner, repo] = githubRepo.split('/');

    // Create a custom modal for group operations
    const existingModal = document.getElementById('repo-group-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'repo-group-modal';
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>🔗 ${repo}</h2>
                <button class="modal-close" onclick="closeRepoGroupModal()">×</button>
            </div>
            <div class="modal-tabs">
                <button class="tab-button active" onclick="switchRepoGroupTab('readme')">README</button>
                <button class="tab-button" onclick="switchRepoGroupTab('info')">Manage</button>
            </div>
            <div class="modal-body">
                <div id="group-tab-readme" class="tab-content active">
                    <div id="group-modal-readme-content" class="readme-content">Loading README...</div>
                </div>
                <div id="group-tab-info" class="tab-content">
                    <p style="margin-bottom: 20px;">
                        This repository contains <strong>${addonCount}</strong> addon module${addonCount > 1 ? 's' : ''}.
                    </p>
                    
                    <div class="option-item">
                        <label for="group-branch-selector">Switch Branch:</label>
                        <select id="group-branch-selector" style="width: 100%; padding: 8px; margin-top: 8px;">
                            <option value="">Loading branches...</option>
                        </select>
                        <div class="option-description">
                            Switch all modules from this repository to a different branch
                        </div>
                    </div>
                    
                    <div style="margin-top: 30px; display: flex; gap: 10px; flex-direction: column;">
                        <button id="group-switch-branch-btn" class="btn btn-primary" disabled>
                            <span class="btn-text">Switch Branch</span>
                        </button>
                        <button id="group-uninstall-btn" class="btn btn-danger">
                            <span class="btn-text">Uninstall All Modules</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Add click handler to close modal when clicking overlay background (but not content)
    modal.addEventListener('click', e => {
        if (e.target === modal) {
            closeRepoGroupModal();
        }
    });

    // Fetch branches
    try {
        const branches = await proxyElectronAPICall('fetchGitHubBranches', owner, repo);
        const branchSelector = document.getElementById('group-branch-selector');
        const switchBtn = document.getElementById('group-switch-branch-btn');

        if (branches && branches.length > 0) {
            branchSelector.innerHTML = branches
                .map(branch => `<option value="${branch.name}">${branch.name}</option>`)
                .join('');

            if (switchBtn) switchBtn.disabled = false;

            switchBtn.onclick = async () => {
                const selectedBranch = branchSelector.value;
                await switchRepoGroupBranch(githubRepo, selectedBranch);
            };
        }
    } catch (error) {
        console.error('Failed to load branches:', error);
    }

    // Fetch README
    try {
        const readme = await proxyElectronAPICall('fetchGitHubReadme', owner, repo);
        const readmeContent = document.getElementById('group-modal-readme-content');

        if (readmeContent) {
            if (readme) {
                readmeContent.innerHTML = readme
                    .replace(/### (.+)/g, '<h3>$1</h3>')
                    .replace(/## (.+)/g, '<h2>$1</h2>')
                    .replace(/# (.+)/g, '<h1>$1</h1>')
                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.+?)\*/g, '<em>$1</em>')
                    .replace(/`(.+?)`/g, '<code>$1</code>')
                    .replace(/\n/g, '<br>');
            } else {
                readmeContent.innerHTML = '<p style="color: #999;">No README available</p>';
            }
        }
    } catch (error) {
        console.error('Failed to load README:', error);
        const readmeContent = document.getElementById('group-modal-readme-content');
        if (readmeContent) {
            readmeContent.innerHTML = '<p style="color: #f44336;">Failed to load README</p>';
        }
    }

    // Setup uninstall button
    const uninstallBtn = document.getElementById('group-uninstall-btn');
    if (uninstallBtn) {
        uninstallBtn.onclick = async e => {
            e.stopPropagation();
            e.preventDefault();
            e.stopImmediatePropagation();
            await uninstallRepoGroup(githubRepo, addonCount);
        };
    }
}

function switchRepoGroupTab(tabName) {
    const tabs = document.querySelectorAll('#repo-group-modal .tab-button');
    const contents = document.querySelectorAll('#repo-group-modal .tab-content');

    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));

    const activeTab = Array.from(tabs).find(
        t => t.textContent === (tabName === 'info' ? 'Info' : 'README')
    );
    const activeContent = document.getElementById(`group-tab-${tabName}`);

    if (activeTab) activeTab.classList.add('active');
    if (activeContent) activeContent.classList.add('active');
}

function closeRepoGroupModal() {
    const modal = document.getElementById('repo-group-modal');
    if (modal) {
        modal.remove();
    }
}

async function switchRepoGroupBranch(githubRepo, branch) {
    const installPath = optionsState.settings.installPath || optionsState.config?.installPath;
    if (!installPath) {
        window.alert('Install path not available');
        return;
    }

    if (
        !window.confirm(
            `Switch all modules from ${githubRepo} to branch "${branch}"?\n\nThis will reinstall all modules from this repository.`
        )
    ) {
        return;
    }

    const switchBtn = document.getElementById('group-switch-branch-btn');
    if (switchBtn) {
        switchBtn.disabled = true;
        switchBtn.querySelector('.btn-text').textContent = 'Switching...';
    }

    try {
        // First, get all addons from this repo
        const addons = optionsState.installedAddons.filter(a => a.githubRepo === githubRepo);

        // Uninstall all modules
        for (const addon of addons) {
            await proxyElectronAPICall('uninstallAddon', addon.name, installPath);
        }

        // Reinstall from the new branch
        const [owner, repo] = githubRepo.split('/');
        await proxyElectronAPICall('installAddonFromGitHub', owner, repo, installPath, branch);

        window.alert(`Successfully switched ${addons.length} module(s) to branch "${branch}"`);
        await loadInstalledAddons();
        closeRepoGroupModal();
    } catch (error) {
        console.error('Failed to switch branch:', error);
        window.alert(`Failed to switch branch: ${error.message || 'Unknown error'}`);
    } finally {
        if (switchBtn) {
            switchBtn.disabled = false;
            switchBtn.querySelector('.btn-text').textContent = 'Switch Branch';
        }
    }
}

async function uninstallRepoGroup(githubRepo, addonCount) {
    const installPath = optionsState.settings.installPath || optionsState.config?.installPath;
    if (!installPath) {
        showToast('Install path not available', 'error');
        return;
    }

    const uninstallBtn = document.getElementById('group-uninstall-btn');
    if (uninstallBtn) {
        uninstallBtn.disabled = true;
        uninstallBtn.querySelector('.btn-text').textContent = 'Uninstalling...';
    }

    try {
        showToast(`Uninstalling ${addonCount} module(s)...`, 'info');

        // Get all addons from this repo
        const addons = optionsState.installedAddons.filter(a => a.githubRepo === githubRepo);

        // Uninstall each addon using the actual folder name
        for (const addon of addons) {
            await proxyElectronAPICall('uninstallAddon', addon.folderName, installPath);
        }

        showToast(`Successfully uninstalled ${addonCount} module(s)`, 'success');
        await loadInstalledAddons();
        closeRepoGroupModal();
    } catch (error) {
        console.error('Failed to uninstall group:', error);
        showToast(`Failed to uninstall: ${error.message || 'Unknown error'}`, 'error');
    } finally {
        if (uninstallBtn) {
            uninstallBtn.disabled = false;
            uninstallBtn.querySelector('.btn-text').textContent = 'Uninstall All Modules';
        }
    }
}

// Close addon modal
function closeAddonModal() {
    const modal = document.getElementById('repo-info-modal');
    if (modal) {
        modal.classList.remove('active');
    }

    // Reset modal state
    modalState.currentAddon = null;
    modalState.owner = null;
    modalState.repo = null;
    modalState.branches = [];
    modalState.selectedBranch = null;
    modalState.isInstalled = false;
    modalState.installedAddonName = null;

    // Hide branch selector
    const branchContainer = document.getElementById('branch-selector-container');
    if (branchContainer) {
        branchContainer.style.display = 'none';
    }
}

// Filter addons based on search
function filterAddons(searchTerm) {
    const addonItems = document.querySelectorAll('.addon-item:not(.addon-group-header)');
    const searchLower = searchTerm.toLowerCase();

    addonItems.forEach(item => {
        const nameEl = item.querySelector('.addon-name');
        const descEl = item.querySelector('.addon-description');

        if (nameEl) {
            const name = nameEl.textContent.toLowerCase();
            const desc = descEl ? descEl.textContent.toLowerCase() : '';
            const matches = name.includes(searchLower) || desc.includes(searchLower);

            item.classList.toggle('hidden', !matches);
        }
    });

    // Handle group visibility
    const groupHeaders = document.querySelectorAll('.addon-group-header');
    groupHeaders.forEach(header => {
        const groupItems = header.nextElementSibling;
        if (groupItems && groupItems.classList.contains('addon-group-items')) {
            const visibleItems = groupItems.querySelectorAll('.addon-item:not(.hidden)');
            header.classList.toggle('hidden', visibleItems.length === 0);
        }
    });
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
    if (elements.realmAddressInput)
        elements.realmAddressInput.value = optionsState.config?.defaultRealm || '';
    if (elements.downloadUrlInput)
        elements.downloadUrlInput.value = optionsState.config?.downloadUrl || '';
    if (elements.autoUpdateRealmlist) elements.autoUpdateRealmlist.checked = true;
    if (elements.closeOnLaunch) elements.closeOnLaunch.checked = false;
    if (elements.enableLogging) elements.enableLogging.checked = false;
    if (elements.addonBackup) elements.addonBackup.checked = true;

    setButtonState('reset-options', 'success', 'Done!');
}

// Populate form with current settings
function populateForm() {
    try {
        console.log('Populating form with settings:', optionsState.settings);
        console.log('Config data:', JSON.stringify(optionsState.config, null, 2));

        // Install path - use saved setting, or config installPath, or platform default
        if (elements.installPathInput) {
            let installPath =
                optionsState.settings.installPath || optionsState.config?.installPath || '';

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
            const realmAddress =
                optionsState.settings.realmAddress ||
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
            elements.downloadUrlInput.value =
                optionsState.settings.downloadUrl || optionsState.config?.downloadUrl || '';
        }

        if (elements.autoUpdateRealmlist) {
            elements.autoUpdateRealmlist.checked =
                optionsState.settings.autoUpdateRealmlist !== false;
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

        const icon = optionsState.platform.isWindows
            ? '🪟'
            : optionsState.platform.isMacOS
              ? '🍎'
              : optionsState.platform.isLinux
                ? '🐧'
                : '💻';

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

            const messageHandler = event => {
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

            window.parent.postMessage(
                {
                    type: 'electronAPICall',
                    id: id,
                    method: method,
                    args: args
                },
                '*'
            );

            // Timeout after 20 seconds for installations
            setTimeout(() => {
                window.removeEventListener('message', messageHandler);
                reject(new Error('ElectronAPI call timeout'));
            }, 20000);
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

    const statusClass = type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'error';

    elements.installationStatusOptions.className = `installation-status ${statusClass}`;
    elements.installationStatusOptions.textContent = message;
}

// Update connection status
function updateConnectionStatus(type, message) {
    if (!elements.connectionStatus) return;

    const statusClass = type === 'success' ? 'success' : type === 'testing' ? 'info' : 'error';

    elements.connectionStatus.className = `connection-status ${statusClass}`;
    elements.connectionStatus.textContent = message;
}

// Group addons by GitHub repository
function groupAddonsByRepo(addons) {
    const repoGroups = {};
    const prefixGroups = {};
    const standalone = [];
    const blizzardAddons = [];
    const processedAddons = new Set();

    console.log('Starting addon grouping with', addons.length, 'addons');

    // First, separate Blizzard addons
    addons.forEach(addon => {
        if (addon.name.startsWith('Blizzard_')) {
            blizzardAddons.push(addon);
            processedAddons.add(addon.name);
        }
    });

    // Then, group by GitHub repo (highest priority)
    addons.forEach(addon => {
        if (processedAddons.has(addon.name)) return;

        if (addon.githubRepo) {
            console.log(`Grouping ${addon.name} by repo: ${addon.githubRepo}`);
            if (!repoGroups[addon.githubRepo]) {
                repoGroups[addon.githubRepo] = [];
            }
            repoGroups[addon.githubRepo].push(addon);
            processedAddons.add(addon.name);
        }
    });

    // Then group remaining addons by prefix
    addons.forEach(addon => {
        if (processedAddons.has(addon.name)) return;

        const nameParts = addon.name.split('_');
        if (nameParts.length > 1) {
            const prefix = nameParts[0];

            // See if there are other addons with this prefix
            const related = addons.filter(
                a => !processedAddons.has(a.name) && a.name.startsWith(prefix + '_')
            );

            if (related.length > 1) {
                if (!prefixGroups[prefix]) {
                    prefixGroups[prefix] = [];
                }
                prefixGroups[prefix].push(addon);
                processedAddons.add(addon.name);
                return;
            }
        }

        standalone.push(addon);
    });

    return { repoGroups, prefixGroups, standalone, blizzardAddons };
}

// Render a settings icon SVG
function getSettingsIconSVG() {
    return `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
    `;
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
        console.log(
            'Addons with GitHub repos:',
            addons.filter(a => a.githubRepo).map(a => ({ name: a.name, repo: a.githubRepo }))
        );

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

        // Group addons by repo, then prefix
        const { repoGroups, prefixGroups, standalone, blizzardAddons } = groupAddonsByRepo(addons);

        console.log('Grouping results:', {
            repoGroups: Object.keys(repoGroups).map(k => ({
                repo: k,
                count: repoGroups[k].length
            })),
            prefixGroups: Object.keys(prefixGroups).map(k => ({
                prefix: k,
                count: prefixGroups[k].length
            })),
            standalone: standalone.length,
            blizzardAddons: blizzardAddons.length
        });

        let html = '';

        // Render repo groups (highest priority)
        Object.keys(repoGroups).forEach(repoKey => {
            const groupAddons = repoGroups[repoKey];
            const repoName = repoKey.split('/')[1] || repoKey; // Extract repo name from "owner/repo"
            const groupId = repoKey.replace(/[^a-zA-Z0-9]/g, '-'); // Safe ID for HTML

            html += `
                <div class="addon-group-header">
                    <div class="addon-group-title" onclick="toggleAddonGroup('${groupId}')">
                        <span>🔗 ${repoName}</span>
                        <span class="addon-group-count">${groupAddons.length} modules</span>
                        <span class="addon-group-toggle">▼</span>
                    </div>
                    <button class="addon-settings-btn" onclick="event.stopPropagation(); openRepoGroupModal('${repoKey.replace(/'/g, "\\'")}', ${groupAddons.length})" title="Repository settings">
                        ${getSettingsIconSVG()}
                    </button>
                </div>
                <div class="addon-group-items" id="group-${groupId}">
            `;

            groupAddons.forEach(addon => {
                html += renderAddonItem(addon);
            });

            html += '</div>';
        });

        // Render prefix groups (fallback)
        Object.keys(prefixGroups).forEach(prefix => {
            const groupAddons = prefixGroups[prefix];
            html += `
                <div class="addon-group-header" onclick="toggleAddonGroup('${prefix}')">
                    <div class="addon-group-title">
                        <span>📦 ${prefix}</span>
                        <span class="addon-group-count">${groupAddons.length} modules</span>
                    </div>
                    <span class="addon-group-toggle">▼</span>
                </div>
                <div class="addon-group-items" id="group-${prefix}">
            `;

            groupAddons.forEach(addon => {
                html += renderAddonItem(addon);
            });

            html += '</div>';
        });

        // Render standalone addons
        standalone.forEach(addon => {
            html += renderAddonItem(addon);
        });

        // Render Blizzard addons at the bottom (collapsed by default)
        if (blizzardAddons.length > 0) {
            html += `
                <div class="addon-group-header" onclick="toggleAddonGroup('blizzard')">
                    <div class="addon-group-title">
                        <span>⚙️ Blizzard UI</span>
                        <span class="addon-group-count">${blizzardAddons.length} modules</span>
                    </div>
                    <span class="addon-group-toggle">▶</span>
                </div>
                <div class="addon-group-items" id="group-blizzard" style="display: none;">
            `;

            blizzardAddons.forEach(addon => {
                html += renderAddonItem(addon);
            });

            html += '</div>';
        }

        addonList.innerHTML = html;

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

// Render a single addon item
function renderAddonItem(addon) {
    // Debug log
    if (addon.githubRepo) {
        console.log('Addon with GitHub repo:', addon.name, addon.githubRepo);
    }

    // Check if this addon has an update available
    const updates = optionsState.availableUpdates || [];
    const hasUpdate = updates.some(u => u.addonName === addon.name);
    const updateInfo = hasUpdate ? updates.find(u => u.addonName === addon.name) : null;
    const isUpdating = optionsState.updatingAddons.has(addon.name);

    const safeFolderKey = (addon.folderName || addon.name || '').replace(/'/g, "\\'");
    const settingsButton = addon.githubRepo
        ? `
        <button class="addon-settings-btn" onclick="openInstalledAddonModal('${safeFolderKey}', '${addon.githubRepo}')" title="Addon settings">
            ${getSettingsIconSVG()}
        </button>
    `
        : '';

    const updateButton =
        hasUpdate && !isUpdating
            ? `
        <button class="addon-update-btn" onclick="updateSingleAddon('${addon.name.replace(/'/g, "\\'")}')" title="Update available: ${updateInfo.currentCommit} → ${updateInfo.latestCommit}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            Update
        </button>
    `
            : '';

    const progressBar = isUpdating
        ? `
        <div class="addon-progress-bar">
            <div class="addon-progress-fill"></div>
        </div>
    `
        : '';

    // Version status badge - green if up to date, red with download icon if update available
    const versionBadge = addon.version
        ? `
        <div class="addon-status ${hasUpdate ? 'update-available' : 'installed'}" title="${hasUpdate ? 'Update available' : 'Up to date'}">
            ${hasUpdate ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>' : ''}
            v${addon.version}
        </div>
    `
        : '<div class="addon-status installed">Installed</div>';

    return `
        <div class="addon-item ${hasUpdate ? 'has-update' : ''} ${isUpdating ? 'updating' : ''}" data-addon-name="${addon.name}">
            ${progressBar}
            <div class="addon-info">
                <div class="addon-name">
                    ${addon.name || 'Unknown Addon'}
                    ${hasUpdate ? '<span class="update-badge">!</span>' : ''}
                    ${isUpdating ? '<span class="updating-text">Updating...</span>' : ''}
                </div>
                <div class="addon-description">${addon.description || 'No description available'}</div>
                ${hasUpdate && !isUpdating ? `<div class="addon-update-info" style="font-size: 0.75em; color: #4caf50; margin-top: 4px;">Update available: ${updateInfo.currentCommit} → ${updateInfo.latestCommit}</div>` : ''}
            </div>
            <div class="addon-actions">
                ${updateButton}
                ${versionBadge}
                ${settingsButton}
            </div>
        </div>
    `;
}

// Toggle addon group visibility (exported to window below)
function toggleAddonGroup(prefix, event) {
    const groupItems = document.getElementById(`group-${prefix}`);
    const groupHeader = event.currentTarget;
    const toggleIcon = groupHeader.querySelector('.addon-group-toggle');

    if (groupItems) {
        groupItems.classList.toggle('collapsed');
        if (toggleIcon) {
            toggleIcon.textContent = groupItems.classList.contains('collapsed') ? '▶' : '▼';
        }
    }
}

// Show status message

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

        await proxyElectronAPICall('uninstall-addon', addonName, installPath);

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
// eslint-disable-next-line no-unused-vars
async function checkForUpdates() {
    const updateBtn = document.getElementById('check-updates-btn');

    try {
        if (updateBtn) {
            updateBtn.classList.add('btn-loading');
            updateBtn.disabled = true;
        }

        // Get install path
        const installPath = optionsState.settings.installPath || optionsState.config?.installPath;
        if (!installPath) {
            if (updateBtn) {
                updateBtn.classList.remove('btn-loading');
                updateBtn.disabled = false;
            }
            console.error('Install path not available');
            return;
        }

        console.log('Checking for addon updates...');
        const updates = await proxyElectronAPICall('checkAddonUpdates', installPath);

        console.log('Updates found:', updates);

        // Store updates in state
        optionsState.availableUpdates = updates;

        if (updateBtn) {
            updateBtn.classList.remove('btn-loading');
            updateBtn.disabled = false;
        }

        // Show/hide Update All button
        const updateAllBtn = document.getElementById('update-all-btn');
        if (updateAllBtn) {
            updateAllBtn.style.display = updates.length > 0 ? 'inline-block' : 'none';
            if (updates.length > 0) {
                updateAllBtn.querySelector('.btn-text').textContent =
                    `Update All (${updates.length})`;
            }
        }

        // Re-render addon list with update icons
        await loadInstalledAddons();

        if (updates.length > 0) {
            console.log(`Found ${updates.length} update(s) available!`);
        } else {
            console.log('All addons are up to date!');
        }
    } catch (error) {
        console.error('Failed to check for updates:', error);
        if (updateBtn) {
            updateBtn.classList.remove('btn-loading');
            updateBtn.disabled = false;
        }
    }
}

async function updateAllAddons() {
    const updateAllBtn = document.getElementById('update-all-btn');

    try {
        if (updateAllBtn) {
            updateAllBtn.classList.add('btn-loading');
            updateAllBtn.disabled = true;
        }

        const updates = optionsState.availableUpdates || [];
        if (updates.length === 0) {
            console.log('No updates available');
            return;
        }

        const installPath = optionsState.settings.installPath || optionsState.config?.installPath;
        if (!installPath) {
            console.error('Install path not available');
            return;
        }

        console.log(`Updating ${updates.length} addon(s)...`);

        // Add all addons to updating set and render
        for (const update of updates) {
            optionsState.updatingAddons.add(update.addonName);
        }
        await loadInstalledAddons();

        // Update each addon
        for (const update of updates) {
            try {
                console.log(`Updating ${update.addonName}...`);
                await proxyElectronAPICall('updateAddon', update.addonName, installPath);
                console.log(`✓ Updated ${update.addonName}`);

                // Remove from updating set and re-render
                optionsState.updatingAddons.delete(update.addonName);
                await loadInstalledAddons();
            } catch (error) {
                console.error(`Failed to update ${update.addonName}:`, error);
                optionsState.updatingAddons.delete(update.addonName);
            }
        }

        // Clear updates and reload
        optionsState.availableUpdates = [];
        if (updateAllBtn) {
            updateAllBtn.style.display = 'none';
            updateAllBtn.classList.remove('btn-loading');
            updateAllBtn.disabled = false;
        }

        await loadInstalledAddons();
        console.log('All updates complete!');
    } catch (error) {
        console.error('Failed to update addons:', error);
        if (updateAllBtn) {
            updateAllBtn.classList.remove('btn-loading');
            updateAllBtn.disabled = false;
        }
    }
}

async function updateSingleAddon(addonName) {
    try {
        const installPath = optionsState.settings.installPath || optionsState.config?.installPath;
        if (!installPath) {
            console.error('Install path not available');
            return;
        }

        // Mark as updating
        optionsState.updatingAddons.add(addonName);
        await loadInstalledAddons();

        console.log(`Updating ${addonName}...`);
        await proxyElectronAPICall('updateAddon', addonName, installPath);
        console.log(`✓ Updated ${addonName}`);

        // Remove from updating and available updates
        optionsState.updatingAddons.delete(addonName);
        if (optionsState.availableUpdates) {
            optionsState.availableUpdates = optionsState.availableUpdates.filter(
                u => u.addonName !== addonName
            );

            // Update the "Update All" button
            const updateAllBtn = document.getElementById('update-all-btn');
            if (updateAllBtn) {
                const remaining = optionsState.availableUpdates.length;
                if (remaining > 0) {
                    updateAllBtn.querySelector('.btn-text').textContent =
                        `Update All (${remaining})`;
                } else {
                    updateAllBtn.style.display = 'none';
                }
            }
        }

        // Reload addon list
        await loadInstalledAddons();
    } catch (error) {
        console.error(`Failed to update ${addonName}:`, error);
        optionsState.updatingAddons.delete(addonName);
        await loadInstalledAddons();
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
        // button.classList.remove('btn-feedback-success', 'btn-feedback-error');
        // button.classList.add(`btn-feedback-${type}`);

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
function showToast(message, type = 'info', _duration = 4000) {
    console.log(`${type.toUpperCase()}: ${message}`);
}

function setButtonState(buttonId, state, message = '', duration = 3000) {
    if (message) {
        setButtonFeedback(buttonId, message, state, duration);
    } else {
        setButtonLoading(buttonId, false);
    }
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
window.closeAddonModal = closeAddonModal;
window.toggleAddonGroup = toggleAddonGroup;
window.openInstalledAddonModal = openInstalledAddonModal;
window.openRepoGroupModal = openRepoGroupModal;
window.switchRepoGroupTab = switchRepoGroupTab;
window.uninstallAddonFromModal = uninstallAddonFromModal;
window.updateAllAddons = updateAllAddons;
window.updateSingleAddon = updateSingleAddon;
window.uninstallAddon = uninstallAddon;
window.switchModalTab = function (tabName) {
    const tabs = document.querySelectorAll('.modal-tab');
    const contents = document.querySelectorAll('.modal-tab-content');

    tabs.forEach(tab => {
        tab.classList.toggle('active', tab.textContent.trim().toLowerCase() === tabName);
    });

    contents.forEach(content => {
        content.classList.toggle('active', content.id === `modal-tab-${tabName}`);
    });
};
