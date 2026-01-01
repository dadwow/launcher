const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const { spawn, exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Platform detection and utilities
class PlatformManager {
    constructor() {
        this.platform = os.platform();
        this.arch = os.arch();
        this.isWindows = this.platform === 'win32';
        this.isMacOS = this.platform === 'darwin';
        this.isLinux = this.platform === 'linux';
        this.needsWine = !this.isWindows;
    }

    // Get platform-specific information
    getPlatformInfo() {
        return {
            platform: this.platform,
            arch: this.arch,
            isWindows: this.isWindows,
            isMacOS: this.isMacOS,
            isLinux: this.isLinux,
            needsWine: this.needsWine,
            platformName: this.getPlatformName()
        };
    }

    getPlatformName() {
        switch (this.platform) {
            case 'win32': return 'Windows';
            case 'darwin': return 'macOS';
            case 'linux': return 'Linux';
            default: return 'Unknown';
        }
    }

    // Get default WoW installation paths for each platform
    getDefaultInstallPaths() {
        const homeDir = os.homedir();

        switch (this.platform) {
            case 'win32':
                return [
                    path.join('C:', 'Program Files (x86)', 'World of Warcraft'),
                    path.join('C:', 'Program Files', 'World of Warcraft'),
                    path.join(homeDir, 'Documents', 'World of Warcraft')
                ];

            case 'darwin':
                return [
                    path.join(homeDir, 'Applications', 'World of Warcraft'),
                    path.join('/Applications', 'World of Warcraft'),
                    path.join(homeDir, 'Documents', 'World of Warcraft'),
                    path.join(homeDir, '.wine', 'drive_c', 'Program Files (x86)', 'World of Warcraft'),
                    path.join(homeDir, 'Library', 'Application Support', 'CrossOver', 'Bottles', 'World of Warcraft', 'drive_c', 'Program Files (x86)', 'World of Warcraft')
                ];

            case 'linux':
                return [
                    path.join(homeDir, 'Games', 'world-of-warcraft'),
                    path.join(homeDir, '.wine', 'drive_c', 'Program Files (x86)', 'World of Warcraft'),
                    path.join(homeDir, '.local', 'share', 'lutris', 'runners', 'wine'),
                    path.join(homeDir, 'Documents', 'World of Warcraft')
                ];

            default:
                return [path.join(homeDir, 'Documents', 'World of Warcraft')];
        }
    }

    // Wine detection and management
    async checkWineInstallation() {
        if (this.isWindows) {
            return { installed: true, type: 'native', version: null };
        }

        const wineChecks = [
            { command: 'wine', type: 'wine' },
            { command: 'wine64', type: 'wine64' },
            { command: '/usr/local/bin/wine', type: 'wine-homebrew' },
            { command: '/opt/homebrew/bin/wine', type: 'wine-homebrew-m1' }
        ];

        // Check for CrossOver on macOS
        if (this.isMacOS) {
            const crossoverPaths = [
                '/Applications/CrossOver.app/Contents/SharedSupport/CrossOver/bin/wine',
                '/Applications/CrossOver.app/Contents/SharedSupport/CrossOver/bin/wine64'
            ];

            for (const crossoverPath of crossoverPaths) {
                if (await fs.pathExists(crossoverPath)) {
                    return {
                        installed: true,
                        type: 'crossover',
                        path: crossoverPath,
                        version: await this.getWineVersion(crossoverPath)
                    };
                }
            }
        }

        // Check standard wine installations
        for (const check of wineChecks) {
            try {
                const { stdout } = await execAsync(`which ${check.command}`);
                if (stdout.trim()) {
                    return {
                        installed: true,
                        type: check.type,
                        path: stdout.trim(),
                        version: await this.getWineVersion(check.command)
                    };
                }
            } catch (error) {
                // Command not found, continue checking
            }
        }

        return { installed: false, type: null, version: null };
    }

    async getWineVersion(wineCommand) {
        try {
            const { stdout } = await execAsync(`${wineCommand} --version`);
            return stdout.trim();
        } catch (error) {
            return 'unknown';
        }
    }

    // Wine prefix management
    getWinePrefixPath(installPath) {
        if (this.isWindows) return null;

        const homeDir = os.homedir();
        const prefixName = 'wow-335a';

        if (this.isMacOS) {
            return path.join(homeDir, '.wine-wow');
        } else if (this.isLinux) {
            return path.join(homeDir, '.wine-wow');
        }

        return null;
    }

    async createWinePrefix(prefixPath) {
        if (this.isWindows || !prefixPath) return true;

        const wine = await this.checkWineInstallation();
        if (!wine.installed) {
            throw new Error('Wine is not installed');
        }

        try {
            // Create wine prefix
            await execAsync(`WINEPREFIX="${prefixPath}" ${wine.path} wineboot`, {
                env: { ...process.env, WINEPREFIX: prefixPath }
            });

            // Install necessary Windows components for WoW
            await this.installWineComponents(prefixPath, wine.path);

            return true;
        } catch (error) {
            console.error('Failed to create wine prefix:', error);
            throw error;
        }
    }

    async installWineComponents(prefixPath, winePath) {
        const components = [
            'vcrun2019',  // Visual C++ Redistributable
            'corefonts',  // Windows fonts
            'd3dx9',      // DirectX 9
            'dxvk'        // Vulkan-based D3D implementation (if available)
        ];

        // Use winetricks if available
        try {
            await execAsync('which winetricks');

            for (const component of components) {
                try {
                    console.log(`Installing ${component}...`);
                    await execAsync(`WINEPREFIX="${prefixPath}" winetricks -q ${component}`, {
                        env: { ...process.env, WINEPREFIX: prefixPath },
                        timeout: 300000 // 5 minute timeout per component
                    });
                } catch (error) {
                    console.warn(`Failed to install ${component}:`, error.message);
                    // Continue with other components
                }
            }
        } catch (error) {
            console.warn('Winetricks not available, skipping component installation');
        }
    }

    // Platform-specific WoW launching
    async launchWoW(installPath, wineConfig = null) {
        if (this.isWindows) {
            return this.launchWoWWindows(installPath);
        } else {
            return this.launchWoWWine(installPath, wineConfig);
        }
    }

    async launchWoWWindows(installPath) {
        const wowExePath = path.join(installPath, 'WoW.exe');

        if (!(await fs.pathExists(wowExePath))) {
            throw new Error('WoW.exe not found in installation directory');
        }

        const wowProcess = spawn(wowExePath, [], {
            cwd: installPath,
            detached: true,
            stdio: 'ignore'
        });

        wowProcess.unref();
        return { success: true, process: wowProcess };
    }

    async launchWoWWine(installPath, wineConfig) {
        const wine = await this.checkWineInstallation();
        if (!wine.installed) {
            throw new Error('Wine is not installed. Please install Wine or CrossOver to run WoW on this platform.');
        }

        const wowExePath = path.join(installPath, 'WoW.exe');
        if (!(await fs.pathExists(wowExePath))) {
            throw new Error('WoW.exe not found in installation directory');
        }

        // Determine wine prefix
        const prefixPath = wineConfig?.prefixPath || this.getWinePrefixPath(installPath);

        // Ensure wine prefix exists
        if (prefixPath && !(await fs.pathExists(prefixPath))) {
            await this.createWinePrefix(prefixPath);
        }

        // Set up environment variables
        const env = {
            ...process.env,
            WINEPREFIX: prefixPath,
            WINEDLLOVERRIDES: 'mscoree,mshtml=', // Disable .NET and IE components
            WINE_CPU_TOPOLOGY: '4:2', // Optimize CPU topology for WoW
        };

        // Platform-specific optimizations
        if (this.isMacOS) {
            env.DYLD_FALLBACK_LIBRARY_PATH = '/usr/lib';
            // Disable Mac-specific Wine features that might interfere
            env.WINE_MAC_DRIVER = '0';
        } else if (this.isLinux) {
            // Linux-specific optimizations
            env.WINEDEBUG = '-all'; // Disable debug output for performance
            env.__GL_SHADER_DISK_CACHE = '1';
            env.__GL_THREADED_OPTIMIZATIONS = '1';
        }

        try {
            const wowProcess = spawn(wine.path, [wowExePath], {
                cwd: installPath,
                env: env,
                detached: true,
                stdio: 'ignore'
            });

            wowProcess.unref();
            return { success: true, process: wowProcess };
        } catch (error) {
            throw new Error(`Failed to launch WoW with Wine: ${error.message}`);
        }
    }

    // Check for platform-specific WoW client compatibility
    async validateWoWInstallation(installPath) {
        const wowExePath = path.join(installPath, 'WoW.exe');
        const dataPath = path.join(installPath, 'Data');

        const baseCheck = {
            hasExecutable: await fs.pathExists(wowExePath),
            hasData: await fs.pathExists(dataPath),
            hasRealmlist: await fs.pathExists(path.join(installPath, 'realmlist.wtf'))
        };

        if (this.isWindows) {
            return {
                ...baseCheck,
                isValid: baseCheck.hasExecutable && baseCheck.hasData,
                platform: 'Windows (Native)',
                requirements: []
            };
        }

        // Wine requirements check
        const wine = await this.checkWineInstallation();
        const requirements = [];

        if (!wine.installed) {
            requirements.push(this.isMacOS ?
                'Wine or CrossOver required for macOS' :
                'Wine required for Linux'
            );
        }

        return {
            ...baseCheck,
            isValid: baseCheck.hasExecutable && baseCheck.hasData && wine.installed,
            platform: `${this.getPlatformName()} (Wine)`,
            wineInfo: wine,
            requirements: requirements
        };
    }

    // Automatically install Wine based on platform
    async installWineAutomatically(progressCallback = null) {
        if (this.isWindows) {
            if (progressCallback) progressCallback('Wine not needed on Windows', 100);
            return { success: true, message: 'Wine not needed on Windows' };
        }

        if (progressCallback) progressCallback('Starting Wine installation...', 0);

        try {
            if (this.isMacOS) {
                return await this.installWineOnMacOS(progressCallback);
            } else if (this.isLinux) {
                return await this.installWineOnLinux(progressCallback);
            }
        } catch (error) {
            console.error('Wine installation failed:', error);
            return {
                success: false,
                message: `Wine installation failed: ${error.message}`,
                error: error
            };
        }

        return { success: false, message: 'Unsupported platform for automatic Wine installation' };
    }

    // Install Wine on macOS via Homebrew
    async installWineOnMacOS(progressCallback = null) {
        try {
            // Check if Homebrew is installed
            if (progressCallback) progressCallback('Checking for Homebrew...', 10);
            
            let hasHomebrew = false;
            try {
                await execAsync('which brew');
                hasHomebrew = true;
            } catch (error) {
                // Homebrew not found, install it
                if (progressCallback) progressCallback('Installing Homebrew...', 20);
                
                const installHomebrew = spawn('/bin/bash', ['-c', 
                    '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
                ], { stdio: 'pipe' });

                await new Promise((resolve, reject) => {
                    installHomebrew.on('close', (code) => {
                        if (code === 0) resolve();
                        else reject(new Error(`Homebrew installation failed with code ${code}`));
                    });
                    installHomebrew.on('error', reject);
                });
            }

            // Install XQuartz
            if (progressCallback) progressCallback('Installing XQuartz...', 40);
            await execAsync('brew install --cask xquartz');

            // Install Wine
            if (progressCallback) progressCallback('Installing Wine...', 70);
            await execAsync('brew install --cask wine-stable');

            if (progressCallback) progressCallback('Wine installation completed!', 100);

            return {
                success: true,
                message: 'Wine installed successfully via Homebrew. Please restart your Mac for best compatibility.',
                requiresRestart: true
            };

        } catch (error) {
            return {
                success: false,
                message: `Failed to install Wine on macOS: ${error.message}`,
                error: error
            };
        }
    }

    // Install Wine on Linux with automatic package manager detection
    async installWineOnLinux(progressCallback = null) {
        try {
            const packageManager = await this.detectLinuxPackageManager();
            
            if (progressCallback) progressCallback(`Installing Wine via ${packageManager}...`, 30);

            let installCommand;
            switch (packageManager) {
                case 'apt':
                    // Ubuntu/Debian
                    await execAsync('sudo apt update');
                    if (progressCallback) progressCallback('Updating package lists...', 40);
                    installCommand = 'sudo apt install -y wine wine32 wine64 winetricks';
                    break;
                case 'dnf':
                    // Fedora
                    installCommand = 'sudo dnf install -y wine winetricks';
                    break;
                case 'pacman':
                    // Arch Linux
                    installCommand = 'sudo pacman -S --noconfirm wine winetricks';
                    break;
                case 'zypper':
                    // openSUSE
                    installCommand = 'sudo zypper install -y wine winetricks';
                    break;
                default:
                    throw new Error(`Unsupported package manager: ${packageManager}`);
            }

            if (progressCallback) progressCallback('Installing Wine packages...', 60);
            await execAsync(installCommand);

            // Try to install Lutris as well for better gaming support
            if (progressCallback) progressCallback('Installing Lutris for better gaming support...', 80);
            try {
                await this.installLutrisOnLinux(packageManager);
            } catch (lutrisError) {
                console.warn('Lutris installation failed, but Wine was successful:', lutrisError);
            }

            if (progressCallback) progressCallback('Wine installation completed!', 100);

            return {
                success: true,
                message: 'Wine and gaming tools installed successfully!',
                packageManager: packageManager
            };

        } catch (error) {
            return {
                success: false,
                message: `Failed to install Wine on Linux: ${error.message}`,
                error: error
            };
        }
    }

    // Detect Linux package manager
    async detectLinuxPackageManager() {
        const managers = [
            { command: 'apt', name: 'apt' },
            { command: 'dnf', name: 'dnf' },
            { command: 'pacman', name: 'pacman' },
            { command: 'zypper', name: 'zypper' }
        ];

        for (const manager of managers) {
            try {
                await execAsync(`which ${manager.command}`);
                return manager.name;
            } catch (error) {
                continue;
            }
        }

        throw new Error('No supported package manager found');
    }

    // Install Lutris on Linux for better Wine gaming support
    async installLutrisOnLinux(packageManager) {
        let installCommand;
        
        switch (packageManager) {
            case 'apt':
                installCommand = 'sudo apt install -y lutris';
                break;
            case 'dnf':
                installCommand = 'sudo dnf install -y lutris';
                break;
            case 'pacman':
                installCommand = 'sudo pacman -S --noconfirm lutris';
                break;
            case 'zypper':
                installCommand = 'sudo zypper install -y lutris';
                break;
            default:
                throw new Error(`Lutris installation not supported for ${packageManager}`);
        }

        await execAsync(installCommand);
    }

    // Check if Wine installation is in progress
    isWineInstalling() {
        return this._wineInstalling || false;
    }

    // Get installation instructions for Wine (fallback for manual installation)
    getWineInstallInstructions() {
        if (this.isWindows) return null;

        if (this.isMacOS) {
            return {
                title: 'Manual Wine Installation on macOS',
                note: 'Automatic installation is recommended. Use these steps only if automatic installation fails.',
                methods: [
                    {
                        name: 'CrossOver (Commercial)',
                        description: 'Professional Wine distribution with excellent WoW support',
                        url: 'https://www.codeweavers.com/crossover'
                    },
                    {
                        name: 'Homebrew Wine (Free)',
                        description: 'Install via command line',
                        steps: [
                            'Install Homebrew if not present',
                            'Run: brew install --cask xquartz wine-stable'
                        ]
                    }
                ]
            };
        } else if (this.isLinux) {
            return {
                title: 'Manual Wine Installation on Linux',
                note: 'Automatic installation is recommended. Use these steps only if automatic installation fails.',
                methods: [
                    {
                        name: 'Package Manager',
                        steps: [
                            'Ubuntu/Debian: sudo apt install wine winetricks',
                            'Fedora: sudo dnf install wine winetricks',
                            'Arch: sudo pacman -S wine winetricks'
                        ]
                    }
                ]
            };
        }

        return null;
    }
}

module.exports = PlatformManager;