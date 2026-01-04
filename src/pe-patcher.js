// PE (Portable Executable) Patcher for adding DLL imports to WoW.exe
// This creates Wow_patched.exe with libDllLdr.dll in the import table
// Enables TurtleSilicon's winerosetta.dll injection system

const fs = require('fs-extra');
const path = require('path');

class PEPatcher {
    constructor(exePath) {
        this.exePath = exePath;
        this.buffer = null;
        this.peOffset = 0;
        this.optionalHeaderOffset = 0;
        this.importTableRVA = 0;
        this.importTableSize = 0;
    }

    async load() {
        this.buffer = await fs.readFile(this.exePath);
        console.log(`Loaded ${this.exePath}: ${this.buffer.length} bytes`);

        // Verify DOS signature "MZ"
        const dosSignature = this.buffer.toString('ascii', 0, 2);
        if (dosSignature !== 'MZ') {
            throw new Error('Invalid DOS signature');
        }

        // Get PE header offset (at 0x3C)
        this.peOffset = this.buffer.readUInt32LE(0x3C);
        console.log(`PE offset: 0x${this.peOffset.toString(16)}`);

        // Verify PE signature "PE\0\0"
        const peSignature = this.buffer.toString('ascii', this.peOffset, this.peOffset + 4);
        if (peSignature !== 'PE\0\0') {
            throw new Error('Invalid PE signature');
        }

        // Read COFF header (20 bytes after PE signature)
        const coffHeaderOffset = this.peOffset + 4;
        const machine = this.buffer.readUInt16LE(coffHeaderOffset);
        const numberOfSections = this.buffer.readUInt16LE(coffHeaderOffset + 2);
        const sizeOfOptionalHeader = this.buffer.readUInt16LE(coffHeaderOffset + 16);

        console.log(`Machine: 0x${machine.toString(16)} (${machine === 0x14C ? 'i386' : 'unknown'})`);
        console.log(`Sections: ${numberOfSections}`);
        console.log(`Optional header size: ${sizeOfOptionalHeader}`);

        // Optional header starts after COFF header (24 bytes)
        this.optionalHeaderOffset = coffHeaderOffset + 20;

        // Read import table RVA and size (data directory entry 1)
        // Data directories start at offset 96 in PE32
        const dataDirectoryOffset = this.optionalHeaderOffset + 96;
        this.importTableRVA = this.buffer.readUInt32LE(dataDirectoryOffset + 8); // Entry 1
        this.importTableSize = this.buffer.readUInt32LE(dataDirectoryOffset + 12);

        console.log(`Import Table RVA: 0x${this.importTableRVA.toString(16)}`);
        console.log(`Import Table Size: ${this.importTableSize}`);

        return this;
    }

    async addImport(dllName) {
        console.log(`\nAdding import: ${dllName}`);

        // For now, we'll use a simpler approach: copy the TurtleSilicon patched version
        // Full PE import table modification is complex and requires:
        // 1. Parsing existing import descriptors
        // 2. Finding free space in the PE
        // 3. Adding new import descriptor
        // 4. Updating import address table (IAT)
        // 5. Adjusting all RVAs and section sizes

        // Instead, we'll call an external tool or copy the pre-patched version
        throw new Error('PE patching not yet implemented - use TurtleSilicon.app to create Wow_patched.exe manually');
    }

    async save(outputPath) {
        await fs.writeFile(outputPath, this.buffer);
        console.log(`Saved patched PE to: ${outputPath}`);
    }
}

// Simpler approach: Check if we can call TurtleSilicon's patcher programmatically
async function patchWowExe(wowExePath, outputPath, installPath) {
    console.log('Attempting to patch WoW.exe...');

    const wowPatchedExists = await fs.pathExists(outputPath);

    if (wowPatchedExists) {
        console.log(`Wow_patched.exe already exists at ${outputPath}`);
        return { success: true, message: 'Already patched' };
    }

    // Check if TurtleSilicon app is available
    const turtleSiliconApp = '/Applications/TurtleSilicon.app';
    if (await fs.pathExists(turtleSiliconApp)) {
        return {
            success: false,
            message: 'Please run TurtleSilicon.app to create Wow_patched.exe',
            instructions: [
                '1. Open TurtleSilicon.app',
                '2. Select your WoW installation folder',
                '3. Click "Patch" button',
                '4. Wait for Wow_patched.exe to be created',
                '5. Restart this launcher'
            ]
        };
    }

    return {
        success: false,
        message: 'TurtleSilicon.app not found',
        instructions: [
            'Download TurtleSilicon from: https://github.com/FriedAppleTeam/TurtleSilicon',
            'Install TurtleSilicon.app to /Applications/',
            'Run it to patch your WoW client',
            'Restart this launcher'
        ]
    };
}

module.exports = {
    PEPatcher,
    patchWowExe
};
