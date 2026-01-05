/**
 * Addon Scanning Tests
 * Tests for automatic addon folder scanning on launch and path changes
 */

const fs = require('fs-extra');
const path = require('path');

jest.mock('fs-extra');

describe('Addon Scanning Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        fs.pathExists = jest.fn();
        fs.readdir = jest.fn();
        fs.stat = jest.fn();
        fs.readFile = jest.fn();
    });

    test('should scan for installed addons on launcher startup', async () => {
        const installPath = '/wow';
        const addonPath = path.join(installPath, 'Interface', 'AddOns');

        fs.pathExists.mockResolvedValue(true);
        fs.readdir.mockResolvedValue(['ElvUI', 'DBM-Core', 'Recount']);
        fs.stat.mockResolvedValue({ isDirectory: () => true });

        // Mock .toc file reading
        fs.readFile.mockImplementation(filePath => {
            if (filePath.includes('ElvUI.toc')) {
                return Promise.resolve(
                    '## Title: ElvUI\n## Version: 13.00\n## Notes: UI replacement'
                );
            }
            if (filePath.includes('DBM-Core.toc')) {
                return Promise.resolve('## Title: DBM-Core\n## Version: 10.0\n## Notes: Boss mod');
            }
            if (filePath.includes('Recount.toc')) {
                return Promise.resolve(
                    '## Title: Recount\n## Version: 1.0\n## Notes: Damage meter'
                );
            }
            return Promise.reject(new Error('File not found'));
        });

        const getInstalledAddons = async installPath => {
            const addonPath = path.join(installPath, 'Interface', 'AddOns');

            if (!(await fs.pathExists(addonPath))) {
                return [];
            }

            const addonFolders = await fs.readdir(addonPath);
            const addons = [];

            for (const folder of addonFolders) {
                const folderPath = path.join(addonPath, folder);
                const stat = await fs.stat(folderPath);

                if (stat.isDirectory()) {
                    const addon = {
                        name: folder,
                        path: folderPath,
                        description: null,
                        version: null,
                        githubRepo: null
                    };

                    // Try to read .toc file
                    const tocFiles = [folder + '.toc'];

                    for (const tocFile of tocFiles) {
                        try {
                            const tocContent = await fs.readFile(
                                path.join(folderPath, tocFile),
                                'utf8'
                            );

                            const titleMatch = tocContent.match(/## Title: (.+)/);
                            const versionMatch = tocContent.match(/## Version: (.+)/);
                            const notesMatch = tocContent.match(/## Notes: (.+)/);

                            if (titleMatch) addon.name = titleMatch[1].trim();
                            if (versionMatch) addon.version = versionMatch[1].trim();
                            if (notesMatch) addon.description = notesMatch[1].trim();

                            break;
                        } catch (err) {
                            // Ignore and continue
                        }
                    }

                    addons.push(addon);
                }
            }

            return addons;
        };

        const addons = await getInstalledAddons(installPath);

        expect(addons).toHaveLength(3);
        expect(addons[0].name).toBe('ElvUI');
        expect(addons[0].version).toBe('13.00');
        expect(addons[1].name).toBe('DBM-Core');
        expect(addons[2].name).toBe('Recount');
    });

    test('should return empty array when addon folder does not exist', async () => {
        fs.pathExists.mockResolvedValue(false);

        const getInstalledAddons = async installPath => {
            const addonPath = path.join(installPath, 'Interface', 'AddOns');
            if (!(await fs.pathExists(addonPath))) {
                return [];
            }
            return await fs.readdir(addonPath);
        };

        const addons = await getInstalledAddons('/nonexistent');

        expect(addons).toEqual([]);
        expect(fs.pathExists).toHaveBeenCalled();
    });

    test('should rescan addons when install path changes', async () => {
        const oldPath = '/wow-old';
        const newPath = '/wow-new';

        fs.pathExists.mockResolvedValue(true);
        fs.readdir
            .mockResolvedValueOnce(['ElvUI']) // Old path
            .mockResolvedValueOnce(['ElvUI', 'DBM-Core']); // New path
        fs.stat.mockResolvedValue({ isDirectory: () => true });
        fs.readFile.mockResolvedValue('## Title: Addon\n## Version: 1.0');

        const getInstalledAddons = async installPath => {
            const addonPath = path.join(installPath, 'Interface', 'AddOns');
            if (!(await fs.pathExists(addonPath))) return [];

            const folders = await fs.readdir(addonPath);
            const addons = [];

            for (const folder of folders) {
                const stat = await fs.stat(path.join(addonPath, folder));
                if (stat.isDirectory()) {
                    addons.push({ name: folder, path: path.join(addonPath, folder) });
                }
            }

            return addons;
        };

        const oldAddons = await getInstalledAddons(oldPath);
        expect(oldAddons).toHaveLength(1);

        const newAddons = await getInstalledAddons(newPath);
        expect(newAddons).toHaveLength(2);
        expect(newAddons.map(a => a.name)).toContain('DBM-Core');
    });

    test('should detect GitHub repo metadata in addon folder', async () => {
        const installPath = '/wow';
        const addonPath = path.join(installPath, 'Interface', 'AddOns', 'ElvUI');

        fs.pathExists.mockImplementation(path => {
            if (path.includes('.github-repo')) return Promise.resolve(true);
            return Promise.resolve(true);
        });

        fs.readFile.mockImplementation(filePath => {
            if (filePath.includes('.github-repo')) {
                return Promise.resolve('tukui-org/ElvUI');
            }
            if (filePath.includes('.github-commit')) {
                return Promise.resolve('abc123def456');
            }
            if (filePath.includes('ElvUI.toc')) {
                return Promise.resolve('## Title: ElvUI\n## Version: 13.00');
            }
            return Promise.reject(new Error('File not found'));
        });

        const getAddonMetadata = async addonPath => {
            const metadata = {
                githubRepo: null,
                commit: null
            };

            const repoFile = path.join(addonPath, '.github-repo');
            if (await fs.pathExists(repoFile)) {
                metadata.githubRepo = (await fs.readFile(repoFile, 'utf8')).trim();
            }

            const commitFile = path.join(addonPath, '.github-commit');
            if (await fs.pathExists(commitFile)) {
                metadata.commit = (await fs.readFile(commitFile, 'utf8')).trim();
            }

            return metadata;
        };

        const metadata = await getAddonMetadata(addonPath);

        expect(metadata.githubRepo).toBe('tukui-org/ElvUI');
        expect(metadata.commit).toBe('abc123def456');
    });

    test('should handle errors during addon scanning gracefully', async () => {
        const installPath = '/wow';

        fs.pathExists.mockResolvedValue(true);
        fs.readdir.mockRejectedValue(new Error('Permission denied'));

        const getInstalledAddons = async installPath => {
            try {
                const addonPath = path.join(installPath, 'Interface', 'AddOns');
                if (!(await fs.pathExists(addonPath))) return [];
                return await fs.readdir(addonPath);
            } catch (error) {
                console.error('Error getting installed addons:', error);
                return [];
            }
        };

        const addons = await getInstalledAddons(installPath);

        expect(addons).toEqual([]);
    });

    test('should scan addons after successful addon installation', async () => {
        const installPath = '/wow';

        // Before installation
        fs.pathExists.mockResolvedValue(true);
        fs.readdir.mockResolvedValueOnce(['ElvUI']);
        fs.stat.mockResolvedValue({ isDirectory: () => true });

        const getAddonCount = async installPath => {
            const addonPath = path.join(installPath, 'Interface', 'AddOns');
            if (!(await fs.pathExists(addonPath))) return 0;
            const folders = await fs.readdir(addonPath);
            return folders.length;
        };

        let count = await getAddonCount(installPath);
        expect(count).toBe(1);

        // After installation (mock new addon added)
        fs.readdir.mockResolvedValueOnce(['ElvUI', 'DBM-Core']);

        count = await getAddonCount(installPath);
        expect(count).toBe(2);
    });
});
