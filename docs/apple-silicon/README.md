# Apple Silicon (M1/M2/M3) Compatibility Guide

## Current Status: ⚠️ **PARTIAL - CRASHES AT CHARACTER SELECT**

### What Works ✅
- Game launches successfully
- Login screen displays correctly
- Realm selection works
- Character select screen loads
- DirectX9 → Vulkan → Metal graphics pipeline functional (via d9vk + MoltenVK)
- Audio output configured (CoreAudio)

### What Doesn't Work ❌
- **CRITICAL**: Game crashes immediately after loading character select screen
- Error: `ILLEGAL_INSTRUCTION (0xC000001D)` at address `07974360`
- Crash instruction: `63 D0` (ARPL - Adjust RPL Field of Selector)

---

## Technical Details

### System Requirements
- **Hardware**: Apple Silicon Mac (M1, M2, M3 series)
- **macOS**: Sonoma 14.x or later
- **Wine**: CrossOver 25.0.1 or later
- **Rosetta 2**: Required (automatically installed by macOS)

### Architecture Components

#### 1. Wine Translation Layer
- Using CrossOver's `wineloader2` (code signature removed)
- Translates Windows x86 calls to macOS system calls
- Command: `codesign --remove-signature wineloader` (done automatically)

#### 2. Rosetta 2 (x86_64 → ARM64)
- Apple's built-in x86_64 to ARM64 binary translator
- Handles most x86 instructions transparently
- **Issue**: Struggles with certain protected mode instructions (ARPL)

#### 3. Graphics Stack
```
WoW (DirectX 9) 
  → d3d9.dll (d9vk - DirectX9 to Vulkan)
  → Vulkan API
  → MoltenVK (Vulkan to Metal)
  → Metal (Apple's GPU API)
  → Apple GPU (M1/M2/M3)
```

#### 4. Required DLLs
- **DivxDecoder.dll**: Original from WoW 3.3.5a client (404KB)
  - WoW.exe has hardcoded imports: `InitializeDivxDecoder`, `UnInitializeDivxDecoder`, `DivxDecode`
  - Must be original file, not stub/wrapper
  - macOS quarantine attribute must be removed: `xattr -d com.apple.quarantine DivxDecoder.dll`
  
- **d3d9.dll**: TurtleSilicon d9vk build (3.8MB)
  - DirectX9 to Vulkan translation
  - Optimized for Apple Silicon
  - Source: https://github.com/turtlesilicon/winerosetta

---

## Installation Process

The launcher handles installation automatically on Apple Silicon Macs:

### 1. Patch Installation
```javascript
// Automatically installed to WoW directory:
- rosettax87/rosettax87 (529KB) - x87 FPU wrapper (not currently used)
- rosettax87/libRuntimeRosettax87 (53KB) - Runtime library
- d3d9.dll (3.8MB) - Graphics translation layer
- DivxDecoder.dll - Preserved from original client if exists
```

### 2. CrossOver Configuration
```javascript
// Automatically created:
- wineloader2 (unsigned copy of wineloader)
// Located at:
CrossOver.app/Contents/SharedSupport/CrossOver/CrossOver-Hosted Application/wineloader2
```

### 3. Environment Variables
```bash
WINEDLLOVERRIDES=d3d9=n,b              # Use native d3d9.dll
WINEESYNC=0                             # Disable esync (compatibility)
WINEFSYNC=0                             # Disable fsync (compatibility)
MTL_HUD_ENABLED=0                       # Disable Metal HUD
MVK_CONFIG_SYNCHRONOUS_QUEUE_SUBMITS=1  # Vulkan sync mode
DXVK_ASYNC=1                            # DXVK async shader compilation
WINE_LARGE_ADDRESS_AWARE=1              # Enable LAA for WoW
DYLD_LIBRARY_PATH=<rosettax87_dir>      # Runtime library path
OMP_NUM_THREADS=1                       # Single-threaded to avoid races
```

---

## Current Problem: ILLEGAL_INSTRUCTION Crash

### Crash Analysis

**Crash Log Details:**
```
ERROR #132 (0x85100084) Fatal Exception
Exception: 0xC000001D (ILLEGAL_INSTRUCTION) at 0107:07974360

Code: 16 bytes starting at (EIP = 07974360)
07974360: 63 D0 87 45  F4 87 55 F0  8B 45 FC 8B  55 F4 8B 7E

x86 Registers:
EAX=878A62A9  EBX=0BD311A8  ECX=2E80B566  EDX=1054DD05
ESI=0244FC0C  EDI=FE6A5808  EBP=0244FBE8  ESP=0244FBC8
EIP=07974360  FLG=00000246
```

**Instruction Breakdown:**
- `63 D0` = ARPL DX, AX (Adjust RPL Field of Selector)
- This is a protected mode segmentation instruction
- Used by Windows for privilege level management
- Address `07974360` is in unmapped memory (dynamic/JIT code)

### Why It Crashes

1. **Dynamic Code Generation**: The address `07974360` is not in any loaded module
   - Suggests JIT-compiled or dynamically generated code
   - WoW's anti-cheat or optimization system may generate this

2. **Rosetta 2 Limitation**: The ARPL instruction isn't being translated correctly
   - Rosetta 2 handles most x86 instructions but has edge cases
   - Protected mode instructions in dynamically generated code are problematic

3. **Timing Issue**: Crash happens specifically after character select loads
   - Character models, world data, or shaders trigger the problematic code path
   - Initial game launch (login, realm select) works fine

### Attempted Solutions

#### ❌ **Tried: TurtleSilicon rosettax87 Wrapper**
```bash
rosettax87 service  # Start x87 FPU translation service
rosettax87 wineloader2 WoW.exe  # Launch through wrapper
```
**Result**: Service starts but client can't connect
**Error**: `connect: No such file or directory`

#### ❌ **Tried: Wine Environment Tuning**
```bash
WINEESYNC=0          # Disable event synchronization
WINEFSYNC=0          # Disable fast synchronization  
OMP_NUM_THREADS=1    # Force single threading
```
**Result**: Still crashes at same location

#### ❌ **Tried: CPU Topology Override**
```bash
WINE_CPU_TOPOLOGY=10:0  # Report 10 CPUs, no HT
```
**Result**: Still crashes

---

## Alternative Approaches to Try

### 1. Wine Staging/Development Builds
- CrossOver 25.0.1 is based on Wine 10.0
- Try bleeding-edge Wine builds with better ARM64 support
- CodeWeavers may have patches not in upstream Wine

### 2. Box86/Box64 Emulation Layer
- Alternative x86 → ARM64 translator
- May handle protected mode instructions differently than Rosetta 2
- Link: https://github.com/ptitSeb/box86

### 3. WoW Client Patches
- Some private servers have patched WoW clients for better compatibility
- Remove anti-cheat or optimization code that generates problematic instructions
- Requires server operator cooperation

### 4. Older macOS Version
- macOS Ventura (13.x) vs Sonoma (14.x) Rosetta 2 differences
- Earlier Rosetta 2 versions may have different instruction handling

### 5. CrossOver Bottles Configuration
- Custom Windows version detection
- Registry tweaks for CPU capabilities
- DLL overrides for system libraries

### 6. QEMU Full Emulation (Last Resort)
- Full x86 emulation instead of translation
- Much slower but more compatible
- Use UTM or QEMU directly

---

## For Developers

### Testing the Current Implementation

1. **Launch the game**:
   ```bash
   npm run dev
   # Click "Play" button in launcher
   ```

2. **Monitor for crash**:
   - Game should launch to login screen
   - Enter credentials and select realm
   - Character select screen loads
   - **CRASH** occurs shortly after

3. **Check crash log**:
   ```bash
   cat "/Users/$USER/Documents/World of Warcraft/Errors/"*.txt | tail -100
   ```

### Code Locations

**Platform Detection**:
- File: `src/platform-manager.js`
- Function: `getPlatformInfo()` (lines ~80-110)

**Patch Installation**:
- Function: `installTurtleSiliconPatches()` (lines ~284-407)
- Installs rosettax87, d3d9.dll, preserves DivxDecoder.dll

**Launch Logic**:
- Function: `launchWithRosettaX87()` (lines ~409-490)
- Sets up environment, spawns wineloader2 process

**Environment Configuration**:
- Lines ~433-448: All Wine/Metal/Vulkan environment variables

### Debugging Tips

1. **Enable Wine debug output**:
   ```javascript
   env.WINEDEBUG = '+all,+relay,+seh'  // Very verbose!
   ```

2. **Check Rosetta 2 status**:
   ```bash
   pgrep -fl oahd  # Rosetta 2 daemon should be running
   ```

3. **Verify DivxDecoder.dll**:
   ```bash
   ls -lh@ "/Users/$USER/Documents/World of Warcraft/DivxDecoder.dll"
   # Should be 404KB, no com.apple.quarantine attribute
   ```

4. **Test direct Wine launch**:
   ```bash
   cd "/Users/$USER/Documents/World of Warcraft"
   WINEDLLOVERRIDES=d3d9=n,b wineloader2 ./WoW.exe
   ```

---

## Comparison: Intel vs Apple Silicon

| Feature | Intel Mac | Apple Silicon |
|---------|-----------|---------------|
| CPU Architecture | x86_64 native | ARM64 (via Rosetta 2) |
| Wine Compatibility | Excellent | Good (with issues) |
| Launch Success | ✅ Yes | ✅ Yes |
| Login/Realm Select | ✅ Works | ✅ Works |
| Character Select | ✅ Works | ❌ Crashes |
| In-Game | ✅ Works | ❓ Untested (crashes before) |
| Performance | Good | Potentially better (if working) |

---

## Community Resources

- **TurtleSilicon Project**: https://github.com/turtlesilicon/winerosetta
  - Patches and tools for running x86 Windows games on Apple Silicon
  - d9vk build, rosettax87 x87 FPU wrapper

- **CrossOver Forums**: https://www.codeweavers.com/support/forums
  - Official support for CrossOver on Apple Silicon
  - Other users running WoW on M1/M2

- **WineHQ AppDB**: https://appdb.winehq.org
  - Compatibility reports for various Wine versions
  - Tips and tricks from community

---

## Next Steps

1. **Contact TurtleSilicon devs** - Ask about ARPL instruction handling
2. **Test different Wine versions** - Try Wine Staging, Development, or older stable
3. **Investigate WoW client mods** - Community patches that remove problematic code
4. **Consider Intel-only distribution** - Label Apple Silicon as "experimental"
5. **Wait for Wine/Rosetta updates** - CrossOver/Wine/Apple may fix this in future releases

---

**Last Updated**: January 4, 2026  
**Status**: Actively investigating - crash at character select screen
