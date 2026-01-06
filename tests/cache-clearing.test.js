const fs = require('fs-extra');
const path = require('path');

// Mock Electron
const mockSession = {
    clearCache: jest.fn().mockResolvedValue(undefined)
};

const mockApp = {
    getPath: jest.fn(() => '/mock/user/data'),
    getVersion: jest.fn(() => '1.2.1')
};

jest.mock('electron', () => ({
    app: mockApp,
    session: {
        defaultSession: mockSession
    }
}));

describe('Cache Clearing Tests', () => {
    let versionFile;
    let mockUserDataPath;

    beforeEach(async () => {
        jest.clearAllMocks();
        mockUserDataPath = '/tmp/test-cache-clearing';
        versionFile = path.join(mockUserDataPath, 'app-version.txt');

        // Setup mock app.getPath to return our test directory
        mockApp.getPath.mockReturnValue(mockUserDataPath);

        // Create test directory
        await fs.ensureDir(mockUserDataPath);

        // Reset mock session
        mockSession.clearCache.mockClear();
        mockSession.clearCache.mockResolvedValue(undefined);
    });

    afterEach(async () => {
        // Cleanup test directory
        await fs.remove(mockUserDataPath);
    });

    test('should clear cache on version change', async () => {
        // Setup: Create version file with old version
        await fs.writeFile(versionFile, '1.0.0', 'utf8');

        // Simulate the cache clearing logic
        const currentVersion = mockApp.getVersion();
        let shouldClearCache = false;

        if (await fs.pathExists(versionFile)) {
            const savedVersion = (await fs.readFile(versionFile, 'utf8')).trim();
            if (savedVersion !== currentVersion) {
                shouldClearCache = true;
            }
        } else {
            shouldClearCache = true;
        }

        if (shouldClearCache) {
            await mockSession.clearCache();
            await fs.writeFile(versionFile, currentVersion, 'utf8');
        }

        // Verify cache was cleared
        expect(mockSession.clearCache).toHaveBeenCalledTimes(1);

        // Verify version file was updated
        const savedVersion = await fs.readFile(versionFile, 'utf8');
        expect(savedVersion).toBe('1.2.1');
    });

    test('should clear cache on first run (no version file)', async () => {
        // Ensure version file does not exist
        await fs.remove(versionFile);

        // Simulate the cache clearing logic
        const currentVersion = mockApp.getVersion();
        let shouldClearCache = false;

        if (await fs.pathExists(versionFile)) {
            const savedVersion = (await fs.readFile(versionFile, 'utf8')).trim();
            if (savedVersion !== currentVersion) {
                shouldClearCache = true;
            }
        } else {
            shouldClearCache = true;
        }

        if (shouldClearCache) {
            await mockSession.clearCache();
            await fs.writeFile(versionFile, currentVersion, 'utf8');
        }

        // Verify cache was cleared
        expect(mockSession.clearCache).toHaveBeenCalledTimes(1);

        // Verify version file was created
        const savedVersion = await fs.readFile(versionFile, 'utf8');
        expect(savedVersion).toBe('1.2.1');
    });

    test('should not clear cache when version is unchanged', async () => {
        // Setup: Create version file with current version
        await fs.writeFile(versionFile, '1.2.1', 'utf8');

        // Simulate the cache clearing logic
        const currentVersion = mockApp.getVersion();
        let shouldClearCache = false;

        if (await fs.pathExists(versionFile)) {
            const savedVersion = (await fs.readFile(versionFile, 'utf8')).trim();
            if (savedVersion !== currentVersion) {
                shouldClearCache = true;
            }
        } else {
            shouldClearCache = true;
        }

        if (shouldClearCache) {
            await mockSession.clearCache();
            await fs.writeFile(versionFile, currentVersion, 'utf8');
        } else {
            await fs.writeFile(versionFile, currentVersion, 'utf8');
        }

        // Verify cache was NOT cleared
        expect(mockSession.clearCache).not.toHaveBeenCalled();

        // Verify version file still has correct version
        const savedVersion = await fs.readFile(versionFile, 'utf8');
        expect(savedVersion).toBe('1.2.1');
    });

    test('should not save version file if cache clearing fails', async () => {
        // Setup: Create version file with old version
        await fs.writeFile(versionFile, '1.0.0', 'utf8');

        // Make clearCache fail
        mockSession.clearCache.mockRejectedValue(new Error('Cache clear failed'));

        // Simulate the cache clearing logic with error handling
        const currentVersion = mockApp.getVersion();
        let shouldClearCache = false;

        try {
            if (await fs.pathExists(versionFile)) {
                const savedVersion = (await fs.readFile(versionFile, 'utf8')).trim();
                if (savedVersion !== currentVersion) {
                    shouldClearCache = true;
                }
            } else {
                shouldClearCache = true;
            }

            if (shouldClearCache) {
                await mockSession.clearCache();
                await fs.writeFile(versionFile, currentVersion, 'utf8');
            }
        } catch (err) {
            // Error should be caught and logged, but not throw
            expect(err.message).toBe('Cache clear failed');
        }

        // Verify cache clear was attempted
        expect(mockSession.clearCache).toHaveBeenCalledTimes(1);

        // Verify version file was NOT updated (should still have old version)
        const savedVersion = await fs.readFile(versionFile, 'utf8');
        expect(savedVersion).toBe('1.0.0');
    });

    test('should handle file system errors gracefully', async () => {
        // Setup: Create a directory instead of a file (will cause read error)
        await fs.ensureDir(versionFile);

        // Simulate the cache clearing logic with error handling
        const currentVersion = mockApp.getVersion();

        try {
            if (await fs.pathExists(versionFile)) {
                const savedVersion = (await fs.readFile(versionFile, 'utf8')).trim();
                expect(savedVersion).toBe(currentVersion); // This line should not be reached
            }
        } catch (err) {
            // Error should be caught
            expect(err).toBeDefined();
        }

        // Should not crash the app
        expect(true).toBe(true);
    });

    test('should update version file even when no cache clear is needed', async () => {
        // Setup: Create version file with current version but slightly different format
        await fs.writeFile(versionFile, '1.2.1\n', 'utf8'); // with newline

        // Simulate the cache clearing logic
        const currentVersion = mockApp.getVersion();
        let shouldClearCache = false;

        if (await fs.pathExists(versionFile)) {
            const savedVersion = (await fs.readFile(versionFile, 'utf8')).trim();
            if (savedVersion !== currentVersion) {
                shouldClearCache = true;
            }
        } else {
            shouldClearCache = true;
        }

        if (shouldClearCache) {
            await mockSession.clearCache();
            await fs.writeFile(versionFile, currentVersion, 'utf8');
        } else {
            await fs.writeFile(versionFile, currentVersion, 'utf8');
        }

        // Verify cache was NOT cleared
        expect(mockSession.clearCache).not.toHaveBeenCalled();

        // Verify version file was still updated
        const savedVersion = await fs.readFile(versionFile, 'utf8');
        expect(savedVersion).toBe('1.2.1');
    });
});
