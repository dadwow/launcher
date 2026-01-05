const axios = require('axios');

// Mock axios
jest.mock('axios');

// Mock implementation of the validate-addon-repo handler
async function validateAddonRepo(owner, repo) {
    try {
        // Check if repo exists and get basic info
        const repoResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
            headers: { 'User-Agent': 'PlusCraft-Launcher' }
        });

        const repoData = repoResponse.data;

        // Get repo contents to check for .toc files
        const contentsResponse = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/contents`,
            {
                headers: { 'User-Agent': 'PlusCraft-Launcher' }
            }
        );

        const contents = contentsResponse.data;

        // Check for .toc files in root
        const hasTocInRoot = contents.some(
            file => file.name.endsWith('.toc') && file.type === 'file'
        );

        let tocFiles = [];
        const addonFolders = [];

        if (hasTocInRoot) {
            // Root is the addon
            tocFiles = contents.filter(file => file.name.endsWith('.toc')).map(f => f.name);
        } else {
            // Check subdirectories for .toc files
            const directories = contents.filter(item => item.type === 'dir');

            for (const dir of directories.slice(0, 10)) {
                // Limit to first 10 dirs
                try {
                    const dirContentsResponse = await axios.get(dir.url, {
                        headers: { 'User-Agent': 'PlusCraft-Launcher' }
                    });
                    const dirContents = dirContentsResponse.data;
                    const dirTocFiles = dirContents.filter(file => file.name.endsWith('.toc'));

                    if (dirTocFiles.length > 0) {
                        addonFolders.push({
                            folder: dir.name,
                            tocFiles: dirTocFiles.map(f => f.name)
                        });
                    }
                } catch (err) {
                    // Silent error handling during tests
                }
            }
        }

        const isValid = hasTocInRoot || addonFolders.length > 0;

        return {
            valid: isValid,
            repoData: {
                name: repoData.name,
                fullName: repoData.full_name,
                description: repoData.description,
                stars: repoData.stargazers_count,
                language: repoData.language,
                updatedAt: repoData.updated_at,
                defaultBranch: repoData.default_branch
            },
            addonInfo: {
                hasTocInRoot,
                tocFiles,
                addonFolders
            }
        };
    } catch (error) {
        return {
            valid: false,
            error: error.response?.status === 404 ? 'Repository not found' : error.message
        };
    }
}

describe('Addon Validation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should validate a valid WoW addon repository with .toc in root (Details)', async () => {
        // Mock repo response
        axios.get.mockResolvedValueOnce({
            data: {
                name: 'Details-Damage-Meter',
                full_name: 'Tercioo/Details-Damage-Meter',
                description: 'Detailed DPS Meter',
                stargazers_count: 100,
                language: 'Lua',
                updated_at: '2026-01-01',
                default_branch: 'main'
            }
        });

        // Mock contents response with .toc file in root
        axios.get.mockResolvedValueOnce({
            data: [
                { name: 'Details.toc', type: 'file' },
                { name: 'Details.lua', type: 'file' },
                { name: 'README.md', type: 'file' }
            ]
        });

        const result = await validateAddonRepo('Tercioo', 'Details-Damage-Meter');

        expect(result.valid).toBe(true);
        expect(result.addonInfo.hasTocInRoot).toBe(true);
        expect(result.addonInfo.tocFiles.length).toBeGreaterThan(0);
        expect(result.repoData).toBeDefined();
        expect(result.repoData.name).toBe('Details-Damage-Meter');
    });

    test('should validate a valid WoW addon repository with addon folders (ElvUI)', async () => {
        // Mock repo response
        axios.get.mockResolvedValueOnce({
            data: {
                name: 'ElvUI',
                full_name: 'ElvUI-WotLK/ElvUI',
                description: 'ElvUI for WotLK',
                stargazers_count: 500,
                language: 'Lua',
                updated_at: '2026-01-01',
                default_branch: 'main'
            }
        });

        // Mock contents response with addon folders
        axios.get.mockResolvedValueOnce({
            data: [
                {
                    name: 'ElvUI',
                    type: 'dir',
                    url: 'https://api.github.com/repos/ElvUI-WotLK/ElvUI/contents/ElvUI'
                },
                {
                    name: 'ElvUI_Config',
                    type: 'dir',
                    url: 'https://api.github.com/repos/ElvUI-WotLK/ElvUI/contents/ElvUI_Config'
                }
            ]
        });

        // Mock ElvUI folder contents
        axios.get.mockResolvedValueOnce({
            data: [
                { name: 'ElvUI.toc', type: 'file' },
                { name: 'Core.lua', type: 'file' }
            ]
        });

        // Mock ElvUI_Config folder contents
        axios.get.mockResolvedValueOnce({
            data: [
                { name: 'ElvUI_Config.toc', type: 'file' },
                { name: 'Config.lua', type: 'file' }
            ]
        });

        const result = await validateAddonRepo('ElvUI-WotLK', 'ElvUI');

        expect(result.valid).toBe(true);
        expect(result.addonInfo.addonFolders.length).toBeGreaterThan(0);
        expect(result.repoData).toBeDefined();
        expect(result.repoData.name).toBe('ElvUI');
    });

    test('should reject a non-existent repository', async () => {
        // Mock 404 error
        axios.get.mockRejectedValue({
            response: { status: 404 },
            message: 'Not Found'
        });

        const result = await validateAddonRepo('nonexistentuser', 'nonexistentrepo');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Repository not found');
    });

    test('should reject a repository without .toc files', async () => {
        // Mock repo response
        axios.get.mockResolvedValueOnce({
            data: {
                name: 'react',
                full_name: 'facebook/react',
                description: 'A JavaScript library',
                stargazers_count: 100000,
                language: 'JavaScript',
                updated_at: '2026-01-01',
                default_branch: 'main'
            }
        });

        // Mock contents response without .toc files
        axios.get.mockResolvedValueOnce({
            data: [
                {
                    name: 'src',
                    type: 'dir',
                    url: 'https://api.github.com/repos/facebook/react/contents/src'
                },
                { name: 'package.json', type: 'file' },
                { name: 'README.md', type: 'file' }
            ]
        });

        // Mock src folder contents (no .toc files)
        axios.get.mockResolvedValueOnce({
            data: [
                { name: 'index.js', type: 'file' },
                { name: 'App.js', type: 'file' }
            ]
        });

        const result = await validateAddonRepo('facebook', 'react');

        expect(result.valid).toBe(false);
        expect(result.addonInfo.hasTocInRoot).toBe(false);
        expect(result.addonInfo.addonFolders.length).toBe(0);
    });

    test('should include repository metadata', async () => {
        // Mock repo response
        axios.get.mockResolvedValueOnce({
            data: {
                name: 'Details-Damage-Meter',
                full_name: 'Tercioo/Details-Damage-Meter',
                description: 'Detailed DPS Meter',
                stargazers_count: 150,
                language: 'Lua',
                updated_at: '2026-01-01',
                default_branch: 'main'
            }
        });

        // Mock contents response
        axios.get.mockResolvedValueOnce({
            data: [{ name: 'Details.toc', type: 'file' }]
        });

        const result = await validateAddonRepo('Tercioo', 'Details-Damage-Meter');

        expect(result.repoData).toBeDefined();
        expect(result.repoData.fullName).toBe('Tercioo/Details-Damage-Meter');
        expect(result.repoData.stars).toBe(150);
        expect(result.repoData.defaultBranch).toBe('main');
    });
});
