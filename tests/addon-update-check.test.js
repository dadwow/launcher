const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

jest.mock('axios');
jest.mock('fs-extra');

describe('Addon Update Check Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should detect available updates for addons', async () => {
        const mockAddons = [
            {
                name: 'ElvUI',
                path: '/wow/Interface/AddOns/ElvUI',
                githubRepo: 'ElvUI-WotLK/ElvUI',
                version: '3.3.5'
            },
            {
                name: 'Details',
                path: '/wow/Interface/AddOns/Details',
                githubRepo: 'Details-Damage-Meter/Details',
                version: '1.0.0'
            }
        ];

        // Mock GitHub API responses
        axios.get = jest.fn()
            .mockResolvedValueOnce({
                data: { default_branch: 'main' }
            })
            .mockResolvedValueOnce({
                data: {
                    sha: 'abc123new',
                    commit: {
                        committer: {
                            date: '2026-01-01T00:00:00Z'
                        }
                    }
                }
            })
            .mockResolvedValueOnce({
                data: { default_branch: 'master' }
            })
            .mockResolvedValueOnce({
                data: {
                    sha: 'def456new',
                    commit: {
                        committer: {
                            date: '2026-01-02T00:00:00Z'
                        }
                    }
                }
            });

        // Mock stored commit SHAs
        fs.pathExists = jest.fn()
            .mockResolvedValueOnce(true)  // ElvUI .github-commit exists
            .mockResolvedValueOnce(true); // Details .github-commit exists
        
        fs.readFile = jest.fn()
            .mockResolvedValueOnce('abc123old') // ElvUI old commit
            .mockResolvedValueOnce('def456new'); // Details same commit (no update)

        const checkAddonUpdates = async (addons) => {
            const updates = [];

            for (const addon of addons) {
                const [owner, repo] = addon.githubRepo.split('/');

                // Get repo info
                const repoInfo = await axios.get(
                    `https://api.github.com/repos/${owner}/${repo}`,
                    { headers: { 'User-Agent': 'WoW-Launcher' } }
                );
                const defaultBranch = repoInfo.data.default_branch;

                // Get latest commit
                const commits = await axios.get(
                    `https://api.github.com/repos/${owner}/${repo}/commits/${defaultBranch}`,
                    { headers: { 'User-Agent': 'WoW-Launcher' } }
                );

                const latestCommit = commits.data.sha;
                const latestDate = commits.data.commit.committer.date;

                // Check stored commit
                const commitFile = path.join(addon.path, '.github-commit');
                let currentCommit = null;

                if (await fs.pathExists(commitFile)) {
                    currentCommit = (await fs.readFile(commitFile, 'utf8')).trim();
                }

                updates.push({
                    name: addon.name,
                    path: addon.path,
                    githubRepo: addon.githubRepo,
                    currentVersion: addon.version,
                    hasUpdate: !currentCommit || currentCommit !== latestCommit,
                    latestDate: new Date(latestDate).toLocaleDateString()
                });
            }

            return { success: true, updates };
        };

        const result = await checkAddonUpdates(mockAddons);

        expect(result.success).toBe(true);
        expect(result.updates).toHaveLength(2);
        expect(result.updates[0].hasUpdate).toBe(true); // ElvUI has update
        expect(result.updates[1].hasUpdate).toBe(false); // Details up to date
    });

    test('should handle addons without stored commit info', async () => {
        const mockAddons = [{
            name: 'NewAddon',
            path: '/wow/Interface/AddOns/NewAddon',
            githubRepo: 'Author/NewAddon',
            version: '1.0'
        }];

        axios.get = jest.fn()
            .mockResolvedValueOnce({ data: { default_branch: 'main' } })
            .mockResolvedValueOnce({
                data: {
                    sha: 'newcommit123',
                    commit: {
                        committer: { date: '2026-01-01T00:00:00Z' }
                    }
                }
            });

        fs.pathExists = jest.fn().mockResolvedValue(false); // No commit file

        const checkAddonUpdates = async (addons) => {
            const updates = [];

            for (const addon of addons) {
                const [owner, repo] = addon.githubRepo.split('/');

                const repoInfo = await axios.get(
                    `https://api.github.com/repos/${owner}/${repo}`
                );
                const commits = await axios.get(
                    `https://api.github.com/repos/${owner}/${repo}/commits/${repoInfo.data.default_branch}`
                );

                const commitFile = path.join(addon.path, '.github-commit');
                const currentCommit = await fs.pathExists(commitFile) 
                    ? await fs.readFile(commitFile, 'utf8') 
                    : null;

                updates.push({
                    name: addon.name,
                    hasUpdate: !currentCommit || currentCommit !== commits.data.sha
                });
            }

            return { success: true, updates };
        };

        const result = await checkAddonUpdates(mockAddons);

        expect(result.success).toBe(true);
        expect(result.updates[0].hasUpdate).toBe(true); // Should need update
    });

    test('should handle GitHub API errors gracefully', async () => {
        const mockAddons = [{
            name: 'ErrorAddon',
            path: '/wow/Interface/AddOns/ErrorAddon',
            githubRepo: 'Author/ErrorAddon',
            version: '1.0'
        }];

        axios.get = jest.fn().mockRejectedValue(new Error('API rate limit exceeded'));

        const checkAddonUpdates = async (addons) => {
            const updates = [];

            for (const addon of addons) {
                try {
                    const [owner, repo] = addon.githubRepo.split('/');
                    await axios.get(`https://api.github.com/repos/${owner}/${repo}`);
                } catch (error) {
                    updates.push({
                        name: addon.name,
                        hasUpdate: false,
                        error: error.message
                    });
                }
            }

            return { success: true, updates };
        };

        const result = await checkAddonUpdates(mockAddons);

        expect(result.success).toBe(true);
        expect(result.updates[0].error).toBe('API rate limit exceeded');
        expect(result.updates[0].hasUpdate).toBe(false);
    });

    test('should skip addons without GitHub repository info', async () => {
        const mockAddons = [
            {
                name: 'LocalAddon',
                path: '/wow/Interface/AddOns/LocalAddon',
                githubRepo: null,
                version: '1.0'
            }
        ];

        const checkAddonUpdates = async (addons) => {
            const updates = [];

            for (const addon of addons) {
                if (!addon.githubRepo) {
                    continue; // Skip addons without repo info
                }
                // ... check logic
            }

            return { success: true, updates };
        };

        const result = await checkAddonUpdates(mockAddons);

        expect(result.success).toBe(true);
        expect(result.updates).toHaveLength(0);
        expect(axios.get).not.toHaveBeenCalled();
    });
});
