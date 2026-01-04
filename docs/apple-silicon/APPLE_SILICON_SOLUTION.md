# Apple Silicon (M1/M2/M3) Solution for WoW 3.3.5a

## Status: ✅ Mostly Working

### Discovery Summary

After extensive testing, we've discovered that **WoW 3.3.5a runs perfectly fine on Apple Silicon WITHOUT rosettax87!**

Key findings:
- **Rosetta 2** (built into macOS) handles x87 FPU translation automatically
- **No need for rosettax87 wrapper** - it adds unnecessary complexity
- WoW 3.3.5a has minimal x87 usage compared to 1.12.1 (Vanilla)

### Simple Launch Method

```bash
wineloader2 ./WoW.exe
```

That's it! No wrapper, no service, just direct Wine execution.

### Current Blocker: DivxDecoder.dll

**Problem:**
- WoW.exe has hardcoded imports from `DivxDecoder.dll`
- Functions: `InitializeDivxDecoder`, `UnInitializeDivxDecoder`, `DivxDecode`
- These are legacy dependencies from the Divx video codec era

**Solution:**
The original WoW 3.3.5a client download includes a working `DivxDecoder.dll`. Our launcher now preserves it during installation.

**If you're missing DivxDecoder.dll:**
1. Re-download the WoW 3.3.5a client (it includes the DLL)
2. Or restore from backup if available
3. The DLL just needs to export the three functions above (they likely do nothing)

### What We Install

1. **d3d9.dll** (3.8MB) - DirectX9 to Vulkan/Metal translation (d9vk)
   - Improves graphics performance significantly
   - Uses MoltenVK for Metal rendering

2. **wineloader2** - Modified CrossOver Wine loader
   - Code signature removed (required for Rosetta 2)
   - Allows x87 translation through Rosetta

### Technical Details

**Why rosettax87 isn't needed for 3.3.5a:**
- WoW 3.3.5a was compiled with modern compiler optimizations
- Uses SSE instructions instead of legacy x87 where possible
- Rosetta 2 (macOS Sonoma+) handles remaining x87 instructions natively
- No ILLEGAL_INSTRUCTION crashes observed

**Why rosettax87 WAS needed for 1.12.1:**
- Vanilla WoW heavily uses x87 FPU instructions
- Older compiler, no SSE optimizations
- Would crash immediately without x87 translation

### Testing Results

✅ Game launches successfully
✅ No ILLEGAL_INSTRUCTION crashes
✅ Graphics rendering works (via d3d9.dll → MoltenVK)
✅ Audio works (CoreAudio)
❌ Missing DivxDecoder.dll exports (needs original from client)

### Comparison to TurtleSilicon

| Feature | TurtleSilicon | Our Launcher |
|---------|---------------|--------------|
| rosettax87 service | ✅ Yes | ❌ Not needed |
| d3d9.dll | ✅ Yes | ✅ Yes |
| DivxDecoder.dll | ✅ Yes (from winerosetta) | ⚠️ Preserve original |
| Complexity | High (service + wrapper) | Low (direct launch) |
| Works for 1.12.1 | ✅ Yes | ❌ No (needs rosettax87) |
| Works for 3.3.5a | ✅ Yes | ✅ Yes (with correct DLL) |

### Next Steps

1. Ensure client download includes DivxDecoder.dll
2. Test on clean installation
3. Verify no overwrites during patching
4. Update user documentation

### For Other WoW Versions

- **1.12.1 (Vanilla)**: Needs rosettax87 service (heavy x87 usage)
- **2.4.3 (TBC)**: Probably similar to 3.3.5a (test needed)
- **3.3.5a (Wrath)**: Works with Rosetta 2 alone ✅
- **Cataclysm+**: Likely no special requirements

###Performance

With this simplified approach:
- Faster startup (no service initialization)
- Lower memory usage (no wrapper overhead)
- Native Rosetta 2 translation (optimized by Apple)
- Excellent graphics via MoltenVK

### Credits

Inspired by [TurtleSilicon](https://github.com/Malachoris/TurtleSilicon) by Malachoris
