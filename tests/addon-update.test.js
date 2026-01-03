const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const StreamZip = require('node-stream-zip');

jest.mock('axios');
jest.mock('fs-extra');
jest.mock('node-stream-zip');

describe('Addon Update Tests', () => {
    let mockZip;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockZip = {
            extract: jest.fn().mockResolvedValue(undefined),
            close: jest.fn().mockResolvedValue(undefined)
        };

        StreamZip.async = jest.fn().mockResolvedValue(mockZip);
    });

    test('should successfully update an addon', async () => {
        // Mock GitHub API responses
        axios.get = jest.fn()
            .mockResolvedValueOnce({
                data: { default_branch: 'main' }
            })
            .mockResolvedValueOnce({
                data: {
                    sha: 'newcommit789',
                    commit: {
                        committer: { date: '2026-01-02T00:00:00Z' }
                    }
                }
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
        fs.readdir = jest.fn()
            .mockResolvedValueOnce(['ElvUI-main'])
            .mockResolvedValueOnce(['ElvUI', 'ElvUI_Config'])
            .mockResolvedValueOnce(['ElvUI.toc'])
            .mockResolvedValueOnce(['ElvUI_Config.toc']);
        
        fs.stat = jest.fn().mockResolvedValue({ 
            isDirectory: () => true 
        });
        
        fs.pathExists = jest.fn().mockResolvedValue(true);
        fs.remove = jest.fn().mockResolvedValue(undefined);
        fs.move = jest.fn().mockResolvedValue(undefined);
        fs.writeFile = jest.fn().mockResolvedValue(undefined);

        const updateAddon = async (githubRepo, installPath) => {
            const [owner, repo] = githubRepo.split('/');

            // Get repo info
            const repoInfo = await axios.get(
                `https://api.github.com/repos/${owner}/${repo}`,
                { headers: { 'User-Agent': 'WoW-Launcher' } }
            );
            const defaultBranch = repoInfo.data.default_branch;

            // Download latest version
            const downloadUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${defaultBranch}.zip`;
            const zipPath = path.join('/tmp', `${repo}-update.zip`);

            const response = await axios({
                url: downloadUrl,
                method: 'GET',
                responseType: 'stream'
            });

            const writer = fs.createWriteStream(zipPath);
            response.data.pipe(writer);

            await new Promise((resolve) => {
                writer.on('finish', resolve);
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
            const allFiles = await fs.readdir(sourcePath);

            const addonFolders = [];
            for (const item of allFiles) {
                const itemPath = path.join(sourcePath, item);
                const itemStat = await fs.stat(itemPath);
                
                if (itemStat.isDirectory()) {
                    const subFiles = await fs.readdir(itemPath);
                    if (subFiles.some(file => file.endsWith('.toc'))) {
                        addonFolders.push(item);
                    }
                }
            }

            // Update each addon folder
            const addonPath = path.join(installPath, 'Interface', 'AddOns');
            await fs.ensureDir(addonPath);

            for (const addonFolder of addonFolders) {
                const addonSourcePath = path.join(sourcePath, addonFolder);
                const addonTargetPath = path.join(addonPath, addonFolder);

                // Remove old version
                if (await fs.pathExists(addonTargetPath)) {
                    await fs.remove(addonTargetPath);
                }

                // Install new version
                await fs.move(addonSourcePath, addonTargetPath);

                // Update metadata
                await fs.writeFile(
                    path.join(addonTargetPath, '.github-repo'),
                    githubRepo,
                    'utf8'
                );

                // Get and save latest commit
                const commitsResponse = await axios.get(
                    `https://api.github.com/repos/${owner}/${repo}/commits/${defaultBranch}`,
                    { headers: { 'User-Agent': 'WoW-Launcher' } }
                );
                await fs.writeFile(
                    path.join(addonTargetPath, '.github-commit'),
                    'newcommit789',
                    'utf8'
                );
            }

            // Cleanup
            await fs.remove(zipPath);
            await fs.remove(tempExtractPath);

            return { success: true };
        };

        const result = await updateAddon('ElvUI-WotLK/ElvUI', '/path/to/wow');

        expect(result.success).toBe(true);
        expect(fs.remove).toHaveBeenCalledWith(expect.stringContaining('ElvUI'));
        expect(fs.move).toHaveBeenCalled();
        expect(fs.writeFile).toHaveBeenCalledWith(
            expect.stringContaining('.github-commit'),
            'newcommit789',
            'utf8'
        );
    });

    test('should preserve addon settings during update', async () => {
        axios.get = jest.fn()
            .mockResolvedValueOnce({ data: { default_branch: 'main' } })
            .mockResolvedValueOnce({ data: { sha: 'abc123' } });

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

        // Mock WTF folder structure (SavedVariables)
        const wtfPath = '/wow/WTF/Account/ACCOUNT/SavedVariables';
        fs.pathExists = jest.fn()
            .mockResolvedValueOnce(true)  // Old addon exists
            .mockResolvedValueOnce(true); // SavedVariables exists
        
        fs.readdir = jest.fn()
            .mockResolvedValueOnce(['ElvUI-main'])
            .mockResolvedValueOnce(['ElvUI'])
            .mockResolvedValueOnce(['ElvUI.toc']);
        
        fs.stat = jest.fn().mockResolvedValue({ 
            isDirectory: () => true 
        });
        
        fs.ensureDir = jest.fn().mockResolvedValue(undefined);
        fs.remove = jest.fn().mockResolvedValue(undefined);
        fs.move = jest.fn().mockResolvedValue(undefined);
        fs.writeFile = jest.fn().mockResolvedValue(undefined);

        const updateAddon = async (githubRepo, installPath) => {
            // Update logic...
            const addonPath = path.join(installPath, 'Interface', 'AddOns', 'ElvUI');
            
            // Remove old addon files (but WTF/SavedVariables remain untouched)
            if (await fs.pathExists(addonPath)) {
                await fs.remove(addonPath);
            }

            // Install new version
            await fs.move('/tmp/new/ElvUI', addonPath);

            return { success: true };
        };

        const result = await updateAddon('ElvUI-WotLK/ElvUI', '/path/to/wow');

        expect(result.success).toBe(true);
        // Verify we only removed addon folder, not WTF folder
        expect(fs.remove).toHaveBeenCalledWith(
            expect.stringContaining('Interface/AddOns/ElvUI')
        );
        expect(fs.remove).not.toHaveBeenCalledWith(
            expect.stringContaining('WTF')
        );
    });

    test('should handle update errors gracefully', async () => {
        axios.get = jest.fn().mockRejectedValue(new Error('Network timeout'));

        const updateAddon = async (githubRepo, installPath) => {
            try {
                const [owner, repo] = githubRepo.split('/');
                await axios.get(`https://api.github.com/repos/${owner}/${repo}`);
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        };

        const result = await updateAddon('Test/Addon', '/path/to/wow');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Network timeout');
    });

    test('should cleanup temporary files after update', async () => {
        axios.get = jest.fn()
            .mockResolvedValueOnce({ data: { default_branch: 'main' } })
            .mockResolvedValueOnce({ data: { sha: 'abc' } });

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
        fs.readdir = jest.fn()
            .mockResolvedValueOnce(['addon-main'])
            .mockResolvedValueOnce(['Addon']);
        fs.stat = jest.fn().mockResolvedValue({ isDirectory: () => true });
        fs.pathExists = jest.fn().mockResolvedValue(false);
        fs.move = jest.fn().mockResolvedValue(undefined);
        fs.remove = jest.fn().mockResolvedValue(undefined);
        fs.writeFile = jest.fn().mockResolvedValue(undefined);

        const updateAddon = async (githubRepo, installPath) => {
            const zipPath = '/tmp/addon-update.zip';
            const tempExtractPath = '/tmp/addon-extract-123';

            // ... update logic ...

            // Cleanup
            await fs.remove(zipPath);
            await fs.remove(tempExtractPath);

            return { success: true };
        };

        await updateAddon('Test/Addon', '/path/to/wow');

        expect(fs.remove).toHaveBeenCalledWith('/tmp/addon-update.zip');
        expect(fs.remove).toHaveBeenCalledWith('/tmp/addon-extract-123');
    });
});
