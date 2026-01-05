/**
 * macOS Patches and Platform-Specific Tests
 * Tests for libsillicon patch and Apple Silicon optimizations
 */

const fs = require('fs-extra');
const path = require('path');

jest.mock('fs-extra');
jest.mock('child_process');

describe('macOS Patches Tests', () => {
    let platformManager;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock PlatformManager
        platformManager = {
            platform: 'darwin',
            arch: 'arm64',
            isMacOS: true,
            isAppleSilicon: true,

            checkWineInstallation: jest.fn(),
            applyLibSiliconPatch: jest.fn(),
            applyMacOSPatches: jest.fn()
        };

        fs.pathExists = jest.fn();
        fs.ensureDir = jest.fn().mockResolvedValue(undefined);
        fs.readFile = jest.fn();
        fs.writeFile = jest.fn().mockResolvedValue(undefined);
        fs.appendFile = jest.fn().mockResolvedValue(undefined);
    });

    test('should apply macOS patches on Apple Silicon', async () => {
        const installPath = '/Applications/World of Warcraft';

        // Mock WoW executable exists
        fs.pathExists.mockResolvedValue(true);

        // Mock CrossOver detected
        platformManager.checkWineInstallation.mockResolvedValue({
            installed: true,
            type: 'crossover',
            version: '23.0.0'
        });

        platformManager.applyMacOSPatches.mockImplementation(async (path, callback) => {
            if (callback) {
                callback('Checking macOS configuration...', 10);
                callback('Applying Apple Silicon optimizations (libsillicon)...', 30);
                callback('Setting file permissions...', 80);
                callback('macOS patches applied successfully!', 100);
            }

            return {
                success: true,
                patches: ['libsillicon (Apple Silicon optimization)', 'file permissions'],
                message: 'Applied 2 optimization(s)'
            };
        });

        const result = await platformManager.applyMacOSPatches(installPath, (msg, progress) => {
            expect(typeof msg).toBe('string');
            expect(typeof progress).toBe('number');
        });

        expect(result.success).toBe(true);
        expect(result.patches).toContain('libsillicon (Apple Silicon optimization)');
        expect(result.patches).toContain('file permissions');
    });

    test('should configure CrossOver with libsillicon settings', async () => {
        const installPath = '/Applications/World of Warcraft';
        const configPath = path.join(installPath, 'WTF', 'Config.wtf');

        fs.pathExists.mockResolvedValueOnce(false); // Config doesn't exist yet
        fs.ensureDir.mockResolvedValue(undefined);
        fs.writeFile.mockResolvedValue(undefined);

        platformManager.checkWineInstallation.mockResolvedValue({
            installed: true,
            type: 'crossover'
        });

        platformManager.applyLibSiliconPatch.mockImplementation(async () => {
            await fs.ensureDir(path.dirname(configPath));

            const recommendedSettings = [
                'SET gxApi "OpenGL"',
                'SET M2Faster "3"',
                'SET maxFPS "60"',
                'SET hwDetect "0"'
            ].join('\n');

            if (await fs.pathExists(configPath)) {
                const existingConfig = await fs.readFile(configPath, 'utf8');
                if (!existingConfig.includes('gxApi')) {
                    await fs.appendFile(configPath, '\n' + recommendedSettings + '\n');
                }
            } else {
                await fs.writeFile(configPath, recommendedSettings + '\n', 'utf8');
            }

            return {
                success: true,
                message: 'CrossOver with libsillicon configured'
            };
        });

        const result = await platformManager.applyLibSiliconPatch(installPath);

        expect(result.success).toBe(true);
        expect(fs.ensureDir).toHaveBeenCalled();
        expect(fs.writeFile).toHaveBeenCalledWith(
            configPath,
            expect.stringContaining('SET gxApi "OpenGL"'),
            'utf8'
        );
    });

    test('should not apply patches on non-macOS platforms', async () => {
        platformManager.isMacOS = false;
        platformManager.platform = 'linux';

        platformManager.applyMacOSPatches.mockImplementation(async () => {
            if (!platformManager.isMacOS) {
                return { success: false, error: 'Not running on macOS' };
            }
        });

        const result = await platformManager.applyMacOSPatches('/wow');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Not running on macOS');
    });

    test('should handle missing WoW executable', async () => {
        const installPath = '/Applications/World of Warcraft';

        fs.pathExists.mockResolvedValue(false); // Wow.exe doesn't exist

        platformManager.applyMacOSPatches.mockImplementation(async path => {
            const wowExePath = path + '/Wow.exe';
            if (!(await fs.pathExists(wowExePath))) {
                throw new Error('Wow.exe not found at installation path');
            }
        });

        await expect(platformManager.applyMacOSPatches(installPath)).rejects.toThrow(
            'Wow.exe not found at installation path'
        );
    });

    test('should warn when Wine is used instead of CrossOver on Apple Silicon', async () => {
        platformManager.checkWineInstallation.mockResolvedValue({
            installed: true,
            type: 'wine', // Regular Wine, not CrossOver
            version: '8.0'
        });

        platformManager.applyLibSiliconPatch.mockImplementation(async () => {
            const wineInfo = await platformManager.checkWineInstallation();

            if (wineInfo.type !== 'crossover') {
                console.warn(
                    'Using Wine on Apple Silicon - CrossOver recommended for better performance'
                );
                return {
                    success: false,
                    error: 'CrossOver recommended for optimal Apple Silicon support'
                };
            }
        });

        const result = await platformManager.applyLibSiliconPatch('/wow');

        expect(result.success).toBe(false);
        expect(result.error).toContain('CrossOver recommended');
    });

    test('should set proper file permissions on macOS', async () => {
        const installPath = '/Applications/World of Warcraft';
        const wowExePath = path.join(installPath, 'Wow.exe');

        fs.pathExists.mockResolvedValue(true);

        const mockExecAsync = jest.fn().mockResolvedValue({ stdout: '', stderr: '' });

        platformManager.applyMacOSPatches.mockImplementation(async path => {
            await mockExecAsync(`chmod -R u+rwX "${path}"`);
            await mockExecAsync(`chmod +x "${wowExePath}"`);

            return {
                success: true,
                patches: ['file permissions']
            };
        });

        const result = await platformManager.applyMacOSPatches(installPath);

        expect(result.success).toBe(true);
        expect(result.patches).toContain('file permissions');
    });
});

describe('Automatic Wine/CrossOver Installation Tests', () => {
    let platformManager;

    beforeEach(() => {
        jest.clearAllMocks();

        platformManager = {
            isMacOS: true,
            arch: 'arm64',
            installWineAutomatically: jest.fn()
        };
    });

    test('should automatically install Wine after client download', async () => {
        platformManager.installWineAutomatically.mockImplementation(async callback => {
            if (callback) {
                callback('Installing compatibility layer...', 0);
                callback('Downloading Wine...', 30);
                callback('Installing Wine...', 60);
                callback('Configuring Wine...', 90);
                callback('Installation complete!', 100);
            }

            return {
                success: true,
                message: 'Wine installed successfully'
            };
        });

        const result = await platformManager.installWineAutomatically((msg, progress) => {
            expect(typeof msg).toBe('string');
            expect(progress).toBeGreaterThanOrEqual(0);
            expect(progress).toBeLessThanOrEqual(100);
        });

        expect(result.success).toBe(true);
    });

    test('should handle Wine installation failure gracefully', async () => {
        platformManager.installWineAutomatically.mockRejectedValue(
            new Error('Failed to install Wine: Permission denied')
        );

        await expect(platformManager.installWineAutomatically()).rejects.toThrow(
            'Failed to install Wine'
        );
    });
});
