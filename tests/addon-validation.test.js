const axios = require('axios');

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

    test('should validate a valid WoW addon repository with .toc in root (Details)', async () => {
        const result = await validateAddonRepo('Tercioo', 'Details-Damage-Meter');

        expect(result.valid).toBe(true);
        expect(result.addonInfo.hasTocInRoot).toBe(true);
        expect(result.addonInfo.tocFiles.length).toBeGreaterThan(0);
        expect(result.repoData).toBeDefined();
        expect(result.repoData.name).toBe('Details-Damage-Meter');
    });

    test('should validate a valid WoW addon repository with addon folders (ElvUI)', async () => {
        const result = await validateAddonRepo('ElvUI-WotLK', 'ElvUI');

        expect(result.valid).toBe(true);
        expect(result.addonInfo.addonFolders.length).toBeGreaterThan(0);
        expect(result.repoData).toBeDefined();
        expect(result.repoData.name).toBe('ElvUI');
    });

    test('should reject a non-existent repository', async () => {
        const result = await validateAddonRepo('nonexistentuser', 'nonexistentrepo');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Repository not found');
    });

    test('should reject a repository without .toc files', async () => {
        // Using a well-known non-addon repo
        const result = await validateAddonRepo('facebook', 'react');

        expect(result.valid).toBe(false);
        // Should not find any .toc files
        expect(
            result.addonInfo?.hasTocInRoot || result.addonInfo?.addonFolders?.length > 0
        ).toBeFalsy();
    });

    test('should include repository metadata', async () => {
        const result = await validateAddonRepo('Tercioo', 'Details-Damage-Meter');

        expect(result.repoData).toBeDefined();
        expect(result.repoData.fullName).toBe('Tercioo/Details-Damage-Meter');
        expect(result.repoData.stars).toBeGreaterThan(0);
        expect(result.repoData.defaultBranch).toBeDefined();
    });
});
