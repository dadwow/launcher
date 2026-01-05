const axios = require('axios');

// Mock axios to prevent external API calls during tests
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
        const contentsResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents`, {
            headers: { 'User-Agent': 'PlusCraft-Launcher' }
        });

        const contents = contentsResponse.data;
        
        // Check for .toc files in root
        const hasTocInRoot = contents.some(file => 
            file.name.endsWith('.toc') && file.type === 'file'
        );

        let tocFiles = [];
        let addonFolders = [];

        if (hasTocInRoot) {
            // Root is the addon
            tocFiles = contents.filter(file => file.name.endsWith('.toc')).map(f => f.name);
        } else {
            // Check subdirectories for .toc files
            const directories = contents.filter(item => item.type === 'dir');
            
            for (const dir of directories.slice(0, 10)) { // Limit to first 10 dirs
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
                    console.error(`Error checking directory ${dir.name}:`, err.message);
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
        console.error('Error validating addon repo:', error.message);
        return {
            valid: false,
            error: error.response?.status === 404 ? 'Repository not found' : error.message
        };
    }
}

describe('Addon Validation', () => {
    jest.setTimeout(15000); // Increase timeout for API calls

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should validate a valid WoW addon repository with .toc in root (Details)', async () => {
        // Mock successful API responses for Details addon
        axios.get.mockImplementation((url) => {
            if (url === 'https://api.github.com/repos/Tercioo/Details-Damage-Meter') {
                return Promise.resolve({
                    data: {
                        name: 'Details-Damage-Meter',
                        full_name: 'Tercioo/Details-Damage-Meter',
                        description: 'Detailed damage meter addon',
                        stargazers_count: 150,
                        language: 'Lua',
                        updated_at: '2024-01-01T00:00:00Z',
                        default_branch: 'master'
                    }
                });
            } else if (url === 'https://api.github.com/repos/Tercioo/Details-Damage-Meter/contents') {
                return Promise.resolve({
                    data: [
                        { name: 'Details.toc', type: 'file' },
                        { name: 'Details.lua', type: 'file' },
                        { name: 'README.md', type: 'file' }
                    ]
                });
            }
        });

        const result = await validateAddonRepo('Tercioo', 'Details-Damage-Meter');
        
        expect(result.valid).toBe(true);
        expect(result.addonInfo.hasTocInRoot).toBe(true);
        expect(result.addonInfo.tocFiles.length).toBeGreaterThan(0);
        expect(result.repoData).toBeDefined();
        expect(result.repoData.name).toBe('Details-Damage-Meter');
    });

    test('should validate a valid WoW addon repository with addon folders (ElvUI)', async () => {
        // Mock successful API responses for ElvUI addon with subdirectories
        axios.get.mockImplementation((url) => {
            if (url === 'https://api.github.com/repos/ElvUI-WotLK/ElvUI') {
                return Promise.resolve({
                    data: {
                        name: 'ElvUI',
                        full_name: 'ElvUI-WotLK/ElvUI',
                        description: 'ElvUI for WotLK',
                        stargazers_count: 300,
                        language: 'Lua',
                        updated_at: '2024-01-01T00:00:00Z',
                        default_branch: 'master'
                    }
                });
            } else if (url === 'https://api.github.com/repos/ElvUI-WotLK/ElvUI/contents') {
                return Promise.resolve({
                    data: [
                        { name: 'ElvUI', type: 'dir', url: 'https://api.github.com/repos/ElvUI-WotLK/ElvUI/contents/ElvUI' },
                        { name: 'ElvUI_OptionsUI', type: 'dir', url: 'https://api.github.com/repos/ElvUI-WotLK/ElvUI/contents/ElvUI_OptionsUI' },
                        { name: 'README.md', type: 'file' }
                    ]
                });
            } else if (url === 'https://api.github.com/repos/ElvUI-WotLK/ElvUI/contents/ElvUI') {
                return Promise.resolve({
                    data: [
                        { name: 'ElvUI.toc', type: 'file' },
                        { name: 'core.lua', type: 'file' }
                    ]
                });
            } else if (url === 'https://api.github.com/repos/ElvUI-WotLK/ElvUI/contents/ElvUI_OptionsUI') {
                return Promise.resolve({
                    data: [
                        { name: 'ElvUI_OptionsUI.toc', type: 'file' },
                        { name: 'core.lua', type: 'file' }
                    ]
                });
            }
        });

        const result = await validateAddonRepo('ElvUI-WotLK', 'ElvUI');
        
        expect(result.valid).toBe(true);
        expect(result.addonInfo.addonFolders.length).toBeGreaterThan(0);
        expect(result.repoData).toBeDefined();
        expect(result.repoData.name).toBe('ElvUI');
    });

    test('should reject a non-existent repository', async () => {
        // Mock 404 response for non-existent repo
        axios.get.mockRejectedValue({
            message: 'Request failed with status code 404',
            response: { status: 404 }
        });

        const result = await validateAddonRepo('nonexistentuser', 'nonexistentrepo');
        
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Repository not found');
    });

    test('should reject a repository without .toc files', async () => {
        // Mock React repo that doesn't have .toc files
        axios.get.mockImplementation((url) => {
            if (url === 'https://api.github.com/repos/facebook/react') {
                return Promise.resolve({
                    data: {
                        name: 'react',
                        full_name: 'facebook/react',
                        description: 'A JavaScript library',
                        stargazers_count: 50000,
                        language: 'JavaScript',
                        updated_at: '2024-01-01T00:00:00Z',
                        default_branch: 'main'
                    }
                });
            } else if (url === 'https://api.github.com/repos/facebook/react/contents') {
                return Promise.resolve({
                    data: [
                        { name: 'src', type: 'dir', url: 'https://api.github.com/repos/facebook/react/contents/src' },
                        { name: 'package.json', type: 'file' },
                        { name: 'README.md', type: 'file' }
                    ]
                });
            } else if (url === 'https://api.github.com/repos/facebook/react/contents/src') {
                return Promise.resolve({
                    data: [
                        { name: 'index.js', type: 'file' },
                        { name: 'React.js', type: 'file' }
                    ]
                });
            }
        });

        const result = await validateAddonRepo('facebook', 'react');
        
        expect(result.valid).toBe(false);
        // Should not find any .toc files
        expect(result.addonInfo?.hasTocInRoot || result.addonInfo?.addonFolders?.length > 0).toBeFalsy();
    });

    test('should include repository metadata', async () => {
        // Mock API responses for Details addon metadata
        axios.get.mockImplementation((url) => {
            if (url === 'https://api.github.com/repos/Tercioo/Details-Damage-Meter') {
                return Promise.resolve({
                    data: {
                        name: 'Details-Damage-Meter',
                        full_name: 'Tercioo/Details-Damage-Meter',
                        description: 'Detailed damage meter addon',
                        stargazers_count: 150,
                        language: 'Lua',
                        updated_at: '2024-01-01T00:00:00Z',
                        default_branch: 'master'
                    }
                });
            } else if (url === 'https://api.github.com/repos/Tercioo/Details-Damage-Meter/contents') {
                return Promise.resolve({
                    data: [
                        { name: 'Details.toc', type: 'file' },
                        { name: 'Details.lua', type: 'file' },
                        { name: 'README.md', type: 'file' }
                    ]
                });
            }
        });

        const result = await validateAddonRepo('Tercioo', 'Details-Damage-Meter');
        
        expect(result.repoData).toBeDefined();
        expect(result.repoData.fullName).toBe('Tercioo/Details-Damage-Meter');
        expect(result.repoData.stars).toBeGreaterThan(0);
        expect(result.repoData.defaultBranch).toBeDefined();
    });
});
