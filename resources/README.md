# TurtleSilicon Patches for Apple Silicon

This directory contains patches required to run WoW 3.3.5a on macOS Apple Silicon (M1/M2/M3/M4) Macs.

## ⚠️ Platform-Specific

**These patches are ONLY bundled in macOS builds.**

- ✅ **macOS (arm64)**: Patches bundled and auto-installed
- ❌ **Windows**: Patches NOT bundled (native execution, no Wine)
- ❌ **Linux**: Patches NOT bundled (x86_64 Wine doesn't need them)

## Contents

### rosettax87/
- `rosettax87` - x87 FPU emulation service for Rosetta 2
- `libRuntimeRosettax87` - Runtime library for rosettax87

**Purpose**: Solves x87 FPU instruction limitations when running x86 WoW through Rosetta 2 translation on Apple Silicon.

### winerosetta/
- `winerosetta.dll` - x87 FPU translation DLL (11KB)
- `d3d9.dll` - d9vk DirectX9→Vulkan translation (3.8MB)
- `libSiliconPatch.dll` - Silicon patch library
- `libDllLdr.dll` - OLD method DLL loader (not used, kept for compatibility)

**Purpose**: 
- `winerosetta.dll`: Provides x87 FPU translation when loaded by WoW
- `d3d9.dll`: Translates DirectX9 calls to Vulkan, then MoltenVK translates to Metal (GPU acceleration)

## How It Works

### NEW Method (Fast - 3x faster than OLD method)
1. Launcher replaces `DivxDecoder.dll` with `winerosetta.dll`
2. WoW imports DivxDecoder.dll on startup (direct import)
3. Gets winerosetta.dll's x87 translation automatically
4. ~55-65 FPS expected

### OLD Method (Slow - deprecated but still supported)
1. Uses `libDllLdr.dll` to inject `winerosetta.dll` at runtime
2. Requires patched `Wow_patched.exe` 
3. ~20-30 FPS (slower due to injection overhead)
4. NOT recommended

## Build Configuration

In `package.json`:

```json
"mac": {
    "extraResources": [
        {
            "from": "resources",
            "to": "resources",
            "filter": ["**/*"]
        }
    ]
}
```

Resources are **only included in macOS builds** to avoid bloating Windows/Linux distributables.

## Credits

These patches are based on [TurtleSilicon by Gcenx](https://github.com/Gcenx/TurtleSilicon), which enables WoW 3.3.5a to run on Apple Silicon Macs without crashing.

## Technical Details

**Problem**: WoW 3.3.5a uses x87 FPU instructions that are not supported in Rosetta 2's translation layer, causing `ILLEGAL_INSTRUCTION` crashes.

**Solution**: rosettax87 service + winerosetta.dll provide software emulation of x87 FPU instructions, allowing WoW to run.

**Performance**: Software x87 emulation has overhead, but optimized implementation in winerosetta.dll achieves playable framerates (30-65 FPS depending on scene complexity).

## File Sizes

- `rosettax87`: ~529 KB
- `libRuntimeRosettax87`: ~53 KB
- `winerosetta.dll`: ~11 KB
- `d3d9.dll`: ~3.8 MB
- `libSiliconPatch.dll`: ~68 KB
- `libDllLdr.dll`: ~24 KB

**Total**: ~4.5 MB (only in macOS builds)

## License

These patches are distributed under their original licenses. See TurtleSilicon repository for details.
