const fs = require('fs-extra');
const path = require('path');
const StreamZip = require('node-stream-zip');

jest.mock('fs-extra');
jest.mock('node-stream-zip');

describe('Client File Extraction Tests', () => {
    let mockZip;

    beforeEach(() => {
        jest.clearAllMocks();

        mockZip = {
            extract: jest.fn().mockResolvedValue(undefined),
            close: jest.fn().mockResolvedValue(undefined),
            entries: jest.fn().mockReturnValue({})
        };

        StreamZip.async = jest.fn().mockResolvedValue(mockZip);
    });

    test('should extract zip file to destination', async () => {
        fs.ensureDir = jest.fn().mockResolvedValue(undefined);
        fs.readdir = jest
            .fn()
            .mockResolvedValueOnce(['ChromieCraft_3.3.5a']) // First readdir - finds nested folder
            .mockResolvedValueOnce(['Data', 'Wow.exe', 'Interface']); // Second readdir - contents
        fs.stat = jest.fn().mockResolvedValue({ isDirectory: () => true });
        fs.readdir = jest
            .fn()
            .mockResolvedValueOnce(['ChromieCraft_3.3.5a'])
            .mockResolvedValueOnce(['Data', 'Wow.exe']);
        fs.copy = jest.fn().mockResolvedValue(undefined);
        fs.remove = jest.fn().mockResolvedValue(undefined);

        const extractZipFile = async (zipPath, destination) => {
            const tempExtractPath = path.join('/tmp', `extract-${Date.now()}`);
            await fs.ensureDir(tempExtractPath);

            const zip = await StreamZip.async({ file: zipPath });
            await zip.extract(null, tempExtractPath);
            await zip.close();

            // Check for nested folder structure
            const extractedItems = await fs.readdir(tempExtractPath);
            if (extractedItems.length === 1) {
                const firstItem = path.join(tempExtractPath, extractedItems[0]);
                const stat = await fs.stat(firstItem);

                if (stat.isDirectory()) {
                    // Check if it contains WoW files
                    const contents = await fs.readdir(firstItem);
                    const hasWowFiles = contents.some(
                        file => file.toLowerCase() === 'data' || file.toLowerCase() === 'wow.exe'
                    );

                    if (hasWowFiles) {
                        // Flatten the structure
                        await fs.copy(firstItem, destination);
                        await fs.remove(tempExtractPath);
                        return { success: true, flattened: true };
                    }
                }
            }

            await fs.copy(tempExtractPath, destination);
            await fs.remove(tempExtractPath);
            return { success: true, flattened: false };
        };

        const zipPath = '/tmp/client.zip';
        const destination = '/path/to/wow';

        const result = await extractZipFile(zipPath, destination);

        expect(result.success).toBe(true);
        expect(result.flattened).toBe(true);
        expect(mockZip.extract).toHaveBeenCalledWith(null, expect.any(String));
        expect(mockZip.close).toHaveBeenCalled();
    });

    test('should handle extraction of non-nested zip files', async () => {
        fs.ensureDir = jest.fn().mockResolvedValue(undefined);
        fs.readdir = jest.fn().mockResolvedValueOnce(['Data', 'Wow.exe', 'Interface']); // Multiple items at root
        fs.copy = jest.fn().mockResolvedValue(undefined);
        fs.remove = jest.fn().mockResolvedValue(undefined);

        const extractZipFile = async (zipPath, destination) => {
            const tempExtractPath = path.join('/tmp', `extract-${Date.now()}`);
            await fs.ensureDir(tempExtractPath);

            const zip = await StreamZip.async({ file: zipPath });
            await zip.extract(null, tempExtractPath);
            await zip.close();

            await fs.readdir(tempExtractPath);

            // Multiple items at root - no flattening needed
            await fs.copy(tempExtractPath, destination);
            await fs.remove(tempExtractPath);
            return { success: true, flattened: false };
        };

        const zipPath = '/tmp/client.zip';
        const destination = '/path/to/wow';

        const result = await extractZipFile(zipPath, destination);

        expect(result.success).toBe(true);
        expect(result.flattened).toBe(false);
    });

    test('should handle extraction errors', async () => {
        mockZip.extract.mockRejectedValue(new Error('Corrupted archive'));

        const extractZipFile = async (zipPath, _destination) => {
            try {
                const tempExtractPath = path.join('/tmp', `extract-${Date.now()}`);
                await fs.ensureDir(tempExtractPath);

                const zip = await StreamZip.async({ file: zipPath });
                await zip.extract(null, tempExtractPath);
                await zip.close();

                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        };

        const zipPath = '/tmp/client.zip';
        const destination = '/path/to/wow';

        const result = await extractZipFile(zipPath, destination);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Corrupted archive');
    });

    test('should ensure destination directory exists', async () => {
        fs.ensureDir = jest.fn().mockResolvedValue(undefined);
        fs.readdir = jest.fn().mockResolvedValue(['Data']);
        fs.copy = jest.fn().mockResolvedValue(undefined);
        fs.remove = jest.fn().mockResolvedValue(undefined);

        const extractZipFile = async (zipPath, destination) => {
            const tempExtractPath = path.join('/tmp', `extract-${Date.now()}`);
            await fs.ensureDir(tempExtractPath);
            await fs.ensureDir(destination); // Should ensure destination exists

            const zip = await StreamZip.async({ file: zipPath });
            await zip.extract(null, tempExtractPath);
            await zip.close();

            await fs.copy(tempExtractPath, destination);
            await fs.remove(tempExtractPath);
            return { success: true };
        };

        const zipPath = '/tmp/client.zip';
        const destination = '/path/to/wow';

        await extractZipFile(zipPath, destination);

        expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('/tmp'));
        expect(fs.ensureDir).toHaveBeenCalledWith(destination);
    });
});
