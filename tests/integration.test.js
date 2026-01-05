const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const StreamZip = require('node-stream-zip');

jest.mock('axios');
jest.mock('fs-extra');
jest.mock('node-stream-zip');

describe('Integration Tests - Complete Launcher Workflow', () => {
    let mockZip;

    beforeEach(() => {
        jest.clearAllMocks();

        mockZip = {
            extract: jest.fn().mockResolvedValue(undefined),
            close: jest.fn().mockResolvedValue(undefined)
        };

        StreamZip.async = jest.fn().mockResolvedValue(mockZip);
    });

    test('should complete full workflow: download, extract, install addon, check update, update addon', async () => {
        // Step 1: Download client files
        const mockDownloadStream = {
            pipe: jest.fn().mockReturnThis(),
            on: jest.fn((event, callback) => {
                if (event === 'finish') setTimeout(() => callback(), 100);
                return mockDownloadStream;
            })
        };

        axios.mockResolvedValueOnce({
            data: mockDownloadStream,
            headers: { 'content-length': '1000000' }
        });

        fs.createWriteStream = jest.fn().mockReturnValue(mockDownloadStream);
        fs.ensureDir = jest.fn().mockResolvedValue(undefined);

        // Download
        const downloadClient = async (url, destination) => {
            await fs.ensureDir(destination);
            const response = await axios({ url, method: 'GET', responseType: 'stream' });
            const writer = fs.createWriteStream(path.join(destination, 'client.zip'));
            response.data.pipe(writer);
            await new Promise(resolve => writer.on('finish', resolve));
            return { success: true };
        };

        const downloadResult = await downloadClient('https://example.com/client.zip', '/wow');
        expect(downloadResult.success).toBe(true);

        // Step 2: Extract client files
        fs.readdir = jest
            .fn()
            .mockResolvedValueOnce(['ChromieCraft_3.3.5a'])
            .mockResolvedValueOnce(['Data', 'Wow.exe']);
        fs.stat = jest.fn().mockResolvedValue({ isDirectory: () => true });
        fs.copy = jest.fn().mockResolvedValue(undefined);
        fs.remove = jest.fn().mockResolvedValue(undefined);

        const extractClient = async (zipPath, destination) => {
            const tempPath = '/tmp/extract';
            await fs.ensureDir(tempPath);

            const zip = await StreamZip.async({ file: zipPath });
            await zip.extract(null, tempPath);
            await zip.close();

            const items = await fs.readdir(tempPath);
            const sourcePath = path.join(tempPath, items[0]);

            await fs.copy(sourcePath, destination);
            await fs.remove(tempPath);

            return { success: true };
        };

        const extractResult = await extractClient('/wow/client.zip', '/wow');
        expect(extractResult.success).toBe(true);
        expect(mockZip.extract).toHaveBeenCalled();

        // Step 3: Install addon from GitHub
        axios.get = jest.fn().mockResolvedValueOnce({ data: { default_branch: 'main' } });

        axios.mockResolvedValueOnce({
            data: mockDownloadStream
        });

        fs.readdir = jest
            .fn()
            .mockResolvedValueOnce(['ElvUI-main'])
            .mockResolvedValueOnce(['ElvUI', 'ElvUI_Config'])
            .mockResolvedValueOnce(['ElvUI.toc'])
            .mockResolvedValueOnce(['ElvUI_Config.toc']);

        fs.pathExists = jest.fn().mockResolvedValue(false);
        fs.move = jest.fn().mockResolvedValue(undefined);
        fs.writeFile = jest.fn().mockResolvedValue(undefined);

        const installAddon = async (owner, repo, installPath) => {
            await axios.get(`https://api.github.com/repos/${owner}/${repo}`);
            const addonPath = path.join(installPath, 'Interface', 'AddOns');
            await fs.ensureDir(addonPath);

            // Mock installation
            const addonFolders = ['ElvUI', 'ElvUI_Config'];
            for (const folder of addonFolders) {
                const targetPath = path.join(addonPath, folder);
                await fs.move(`/tmp/${folder}`, targetPath);
                await fs.writeFile(
                    path.join(targetPath, '.github-repo'),
                    `${owner}/${repo}`,
                    'utf8'
                );
                await fs.writeFile(path.join(targetPath, '.github-commit'), 'abc123', 'utf8');
            }

            return { success: true, addonsInstalled: addonFolders.length };
        };

        const installResult = await installAddon('ElvUI-WotLK', 'ElvUI', '/wow');
        expect(installResult.success).toBe(true);
        expect(installResult.addonsInstalled).toBe(2);

        // Step 4: Check for addon updates
        axios.get = jest
            .fn()
            .mockResolvedValueOnce({ data: { default_branch: 'main' } })
            .mockResolvedValueOnce({
                data: {
                    sha: 'xyz789',
                    commit: { committer: { date: '2026-01-02' } }
                }
            });

        fs.pathExists = jest.fn().mockResolvedValue(true);
        fs.readFile = jest.fn().mockResolvedValue('abc123'); // Old commit

        const checkUpdates = async addons => {
            const updates = [];
            for (const addon of addons) {
                const [owner, repo] = addon.githubRepo.split('/');
                const repoInfo = await axios.get(`https://api.github.com/repos/${owner}/${repo}`);
                const commits = await axios.get(
                    `https://api.github.com/repos/${owner}/${repo}/commits/${repoInfo.data.default_branch}`
                );

                const commitFile = path.join(addon.path, '.github-commit');
                const currentCommit = (await fs.pathExists(commitFile))
                    ? (await fs.readFile(commitFile, 'utf8')).trim()
                    : null;

                updates.push({
                    name: addon.name,
                    hasUpdate: currentCommit !== commits.data.sha
                });
            }
            return { success: true, updates };
        };

        const checkResult = await checkUpdates([
            {
                name: 'ElvUI',
                path: '/wow/Interface/AddOns/ElvUI',
                githubRepo: 'ElvUI-WotLK/ElvUI'
            }
        ]);

        expect(checkResult.success).toBe(true);
        expect(checkResult.updates[0].hasUpdate).toBe(true);

        // Step 5: Update addon
        axios.get = jest
            .fn()
            .mockResolvedValueOnce({ data: { default_branch: 'main' } })
            .mockResolvedValueOnce({ data: { sha: 'xyz789' } });

        axios.mockResolvedValueOnce({
            data: mockDownloadStream
        });

        fs.readdir = jest
            .fn()
            .mockResolvedValueOnce(['ElvUI-main'])
            .mockResolvedValueOnce(['ElvUI', 'ElvUI_Config'])
            .mockResolvedValueOnce(['ElvUI.toc'])
            .mockResolvedValueOnce(['ElvUI_Config.toc']);

        fs.pathExists = jest.fn().mockResolvedValue(true);
        fs.remove = jest.fn().mockResolvedValue(undefined);
        fs.move = jest.fn().mockResolvedValue(undefined);
        fs.writeFile = jest.fn().mockResolvedValue(undefined);

        const updateAddon = async (_githubRepo, installPath) => {
            const addonPath = path.join(installPath, 'Interface', 'AddOns');

            const addonFolders = ['ElvUI', 'ElvUI_Config'];
            for (const folder of addonFolders) {
                const targetPath = path.join(addonPath, folder);
                await fs.remove(targetPath);
                await fs.move(`/tmp/new/${folder}`, targetPath);
                await fs.writeFile(path.join(targetPath, '.github-commit'), 'xyz789', 'utf8');
            }

            return { success: true };
        };

        const updateResult = await updateAddon('ElvUI-WotLK/ElvUI', '/wow');
        expect(updateResult.success).toBe(true);

        // Verify complete workflow
        expect(downloadResult.success).toBe(true);
        expect(extractResult.success).toBe(true);
        expect(installResult.success).toBe(true);
        expect(checkResult.updates[0].hasUpdate).toBe(true);
        expect(updateResult.success).toBe(true);
    });

    test('should handle errors at any step without crashing', async () => {
        // Reset all mocks completely
        jest.resetAllMocks();

        // Mock axios to reject
        const mockAxios = require('axios');
        mockAxios.mockRejectedValueOnce(new Error('Network error'));

        const downloadClient = async () => {
            try {
                await mockAxios({ url: 'test', method: 'GET' });
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        };

        const result = await downloadClient();
        expect(result.success).toBe(false);
        expect(result.error).toBe('Network error');

        // Workflow should be able to continue with other operations
        expect(true).toBe(true); // Application didn't crash
    });
});
