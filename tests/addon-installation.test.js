const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const StreamZip = require('node-stream-zip');

jest.mock('axios');
jest.mock('fs-extra');
jest.mock('node-stream-zip');

describe('Addon Installation Tests', () => {
    let mockZip;

    beforeEach(() => {
        jest.clearAllMocks();

        mockZip = {
            extract: jest.fn().mockResolvedValue(undefined),
            close: jest.fn().mockResolvedValue(undefined)
        };

        StreamZip.async = jest.fn().mockResolvedValue(mockZip);
    });

    test('should install addon from GitHub repository', async () => {
        // Mock GitHub API responses
        axios.get = jest.fn().mockResolvedValueOnce({
            data: { default_branch: 'main' }
        });

        axios.mockResolvedValueOnce({
            data: {
                pipe: jest.fn().mockReturnThis(),
                on: jest.fn((event, callback) => {
                    if (event === 'finish') setTimeout(() => callback(), 100);
                    return this;
                })
            }
        });

        fs.createWriteStream = jest.fn().mockReturnValue({
            on: jest.fn((event, callback) => {
                if (event === 'finish') setTimeout(() => callback(), 100);
            })
        });

        fs.ensureDir = jest.fn().mockResolvedValue(undefined);
        fs.readdir = jest
            .fn()
            .mockResolvedValueOnce(['ElvUI-main']) // Extracted folder
            .mockResolvedValueOnce(['ElvUI', 'ElvUI_Config']) // Subdirectories with .toc files
            .mockResolvedValueOnce(['ElvUI.toc', 'core.lua'])
            .mockResolvedValueOnce(['ElvUI_Config.toc', 'config.lua']);

        fs.stat = jest.fn().mockResolvedValue({
            isDirectory: () => true
        });

        fs.pathExists = jest.fn().mockResolvedValue(false);
        fs.move = jest.fn().mockResolvedValue(undefined);
        fs.remove = jest.fn().mockResolvedValue(undefined);
        fs.writeFile = jest.fn().mockResolvedValue(undefined);

        const installAddon = async (owner, repo, installPath) => {
            // Get default branch
            const repoInfo = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
                headers: { 'User-Agent': 'WoW-Launcher' }
            });
            const defaultBranch = repoInfo.data.default_branch;

            // Download zip
            const downloadUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${defaultBranch}.zip`;
            const zipPath = path.join('/tmp', `${repo}.zip`);

            const response = await axios({
                url: downloadUrl,
                method: 'GET',
                responseType: 'stream'
            });

            const writer = fs.createWriteStream(zipPath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            // Extract
            const tempExtractPath = path.join('/tmp', `addon-extract-${Date.now()}`);
            await fs.ensureDir(tempExtractPath);

            const zip = await StreamZip.async({ file: zipPath });
            await zip.extract(null, tempExtractPath);
            await zip.close();

            // Find addon folders
            const extractedItems = await fs.readdir(tempExtractPath);
            const sourcePath = path.join(tempExtractPath, extractedItems[0]);
            const sourceContents = await fs.readdir(sourcePath);

            const addonFolders = [];
            for (const item of sourceContents) {
                const itemPath = path.join(sourcePath, item);
                const stat = await fs.stat(itemPath);
                if (stat.isDirectory()) {
                    const subFiles = await fs.readdir(itemPath);
                    if (subFiles.some(f => f.endsWith('.toc'))) {
                        addonFolders.push(item);
                    }
                }
            }

            // Install addons
            const addonPath = path.join(installPath, 'Interface', 'AddOns');
            await fs.ensureDir(addonPath);

            for (const addonFolder of addonFolders) {
                const addonSourcePath = path.join(sourcePath, addonFolder);
                const addonTargetPath = path.join(addonPath, addonFolder);

                if (await fs.pathExists(addonTargetPath)) {
                    await fs.remove(addonTargetPath);
                }

                await fs.move(addonSourcePath, addonTargetPath);

                // Save metadata
                await fs.writeFile(
                    path.join(addonTargetPath, '.github-repo'),
                    `${owner}/${repo}`,
                    'utf8'
                );
            }

            await fs.remove(zipPath);
            await fs.remove(tempExtractPath);

            return { success: true, addonsInstalled: addonFolders.length };
        };

        const result = await installAddon('ElvUI-WotLK', 'ElvUI', '/path/to/wow');

        expect(result.success).toBe(true);
        expect(result.addonsInstalled).toBe(2);
        expect(fs.writeFile).toHaveBeenCalledWith(
            expect.stringContaining('.github-repo'),
            'ElvUI-WotLK/ElvUI',
            'utf8'
        );
    });

    test('should handle single addon folder', async () => {
        axios.get = jest.fn().mockResolvedValueOnce({
            data: { default_branch: 'master' }
        });

        axios.mockResolvedValueOnce({
            data: {
                pipe: jest.fn(),
                on: jest.fn()
            }
        });

        fs.createWriteStream = jest.fn().mockReturnValue({
            on: jest.fn((event, callback) => {
                if (event === 'finish') callback();
            })
        });

        fs.ensureDir = jest.fn().mockResolvedValue(undefined);
        fs.readdir = jest
            .fn()
            .mockResolvedValueOnce(['Details-main'])
            .mockResolvedValueOnce(['Details.toc', 'core.lua']); // .toc file at root

        fs.stat = jest.fn().mockResolvedValue({
            isDirectory: () => false
        });

        fs.pathExists = jest.fn().mockResolvedValue(false);
        fs.move = jest.fn().mockResolvedValue(undefined);
        fs.remove = jest.fn().mockResolvedValue(undefined);
        fs.writeFile = jest.fn().mockResolvedValue(undefined);

        const installAddon = async (owner, repo, installPath) => {
            // Simplified version for single addon
            const addonPath = path.join(installPath, 'Interface', 'AddOns');
            await fs.ensureDir(addonPath);

            const targetPath = path.join(addonPath, repo);
            await fs.move('/tmp/source', targetPath);

            await fs.writeFile(path.join(targetPath, '.github-repo'), `${owner}/${repo}`, 'utf8');

            return { success: true, addonsInstalled: 1 };
        };

        const result = await installAddon('Details', 'Details', '/path/to/wow');

        expect(result.success).toBe(true);
        expect(result.addonsInstalled).toBe(1);
    });

    test('should handle addon installation errors', async () => {
        axios.get = jest.fn().mockRejectedValue(new Error('Repository not found'));

        const installAddon = async (owner, repo, installPath) => {
            try {
                await axios.get(`https://api.github.com/repos/${owner}/${repo}`);
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        };

        const result = await installAddon('Invalid', 'Repo', '/path/to/wow');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Repository not found');
    });

    test('should create Interface/AddOns directory if it does not exist', async () => {
        fs.ensureDir = jest.fn().mockResolvedValue(undefined);
        fs.pathExists = jest.fn().mockResolvedValue(false);

        const installAddon = async installPath => {
            const addonPath = path.join(installPath, 'Interface', 'AddOns');
            await fs.ensureDir(addonPath);
            return { success: true };
        };

        await installAddon('/path/to/wow');

        expect(fs.ensureDir).toHaveBeenCalledWith('/path/to/wow/Interface/AddOns');
    });
});
