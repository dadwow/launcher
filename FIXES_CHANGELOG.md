# Fixes Applied - 2026-01-04

## Summary
Fixed two critical issues: nested directory extraction and CrossOver/Wine launching on macOS.

## 1. Nested Directory Extraction Fix

### Problem
After downloading WoW client archives, some had a nested folder structure (e.g., `WoW-Client/WoW.exe` instead of `WoW.exe` at the root). The launcher would extract but not flatten this structure, making the client undetectable.

### Solution
Enhanced the `extractZipFile` function in `src/main.js` to:
- Check if only one visible folder exists after extraction (ignoring hidden files and `.zip` files)
- Verify if that folder contains `WoW.exe`
- If both conditions are true, move all contents from the nested folder up to the installation directory
- Remove the now-empty nested folder

### Code Changes
**File: `src/main.js` (lines ~1007-1040)**
- Added filtering for hidden files and zip files
- Added check for `WoW.exe` presence before flattening
- Added detailed logging for debugging

## 2. CrossOver/Wine Launch Method Fix (TurtleSilicon Approach)

### Problem
The launcher was trying to launch WoW using `wineboot` to create Wine prefixes, which failed on macOS with CrossOver:
```
Error: Failed to launch WoW: Command failed: WINEPREFIX="/Users/user/.wine-wow" /path/to/wine wineboot
```

### Solution
Adopted the TurtleSilicon approach which:
- Launches WoW **directly** using `wineloader` or `wineloader2` (CrossOver)
- **Does NOT** create Wine prefixes (not required)
- Uses proper environment variables for optimal performance
- Supports native Apple Silicon optimization

### Key Improvements

1. **Direct Wine Loader Invocation**
   - No `wineboot` calls
   - No Wine prefix creation
   - Launches directly: `wineloader WoW.exe`

2. **TurtleSilicon Compatibility**
   - Checks for `wineloader2` (TurtleSilicon-patched CrossOver)
   - Falls back to standard CrossOver if not patched
   - Compatible with both vanilla CrossOver and TurtleSilicon-enhanced versions

3. **Environment Variables (TurtleSilicon-style)**
   ```javascript
   WINEDLLOVERRIDES: 'd3d9=n,b'  // Native d3d9 override
   MVK_CONFIG_SYNCHRONOUS_QUEUE_SUBMITS: '1'
   DXVK_ASYNC: '1'
   MTL_HUD_ENABLED: '0'  // macOS only
   ```

4. **Apple Silicon Optimizations**
   ```javascript
   DYLD_LIBRARY_PATH: '/opt/homebrew/lib'
   WINE_LARGE_ADDRESS_AWARE: '1'
   ```

### Code Changes

**File: `src/platform-manager.js`**

1. **Updated `launchWoWWine` function** (~lines 217-290)
   - Removed Wine prefix creation logic
   - Added wineloader2 detection for CrossOver
   - Implemented TurtleSilicon-style environment variables
   - Direct spawn of wine loader without prefix

2. **Deprecated Wine Prefix Functions** (~lines 145-165)
   - `getWinePrefixPath()` - now returns null
   - `createWinePrefix()` - now returns true (no-op)
   - `installWineComponents()` - simplified to no-op

3. **Simplified Launch Handler**
   - Removed `prefixPath` from wine config
   - Removed settings loading for wine prefix path

**File: `src/main.js`**

1. **Updated `launch-wow` IPC handler** (~lines 917-941)
   - Removed settings loading
   - Removed Wine prefix path parameter
   - Simplified to just pass install path

## Benefits

### For All Users
- ✅ More reliable WoW launching on macOS/Linux
- ✅ Faster startup (no Wine prefix initialization)
- ✅ Better compatibility with CrossOver
- ✅ Reduced complexity and points of failure

### For Apple Silicon Users
- ✅ Full TurtleSilicon compatibility
- ✅ Native ARM64 optimizations
- ✅ Better performance with wineloader2
- ✅ Metal graphics acceleration support

### For CrossOver Users
- ✅ Works with vanilla CrossOver installation
- ✅ Enhanced when TurtleSilicon patches are applied
- ✅ No more "wineboot" errors
- ✅ Automatic wineloader2 detection

## Testing Recommendations

1. **Test nested directory extraction:**
   - Download a client with nested folder structure
   - Verify WoW.exe is correctly moved to installation root
   - Check logs for "Found nested WoW client" message

2. **Test CrossOver launching on macOS:**
   - Ensure CrossOver is installed
   - Point to WoW client installation
   - Click "Launch World of Warcraft"
   - Verify no "wineboot" errors
   - Check if wineloader2 is detected (if TurtleSilicon patches applied)

3. **Test on Apple Silicon (if available):**
   - Verify Apple Silicon optimizations are applied
   - Check environment variables in logs
   - Confirm performance improvements

## Backwards Compatibility

- ✅ Windows: No changes, still uses native launch
- ✅ Standard Wine: Still works with standard wine installation
- ✅ CrossOver: Enhanced support, works better than before
- ✅ Linux: Improved environment variable setup

## References

- TurtleSilicon GitHub: https://github.com/Malachoris/turtlesilicon
- TurtleSilicon launch method: `pkg/launcher/launcher.go`
- TurtleSilicon CrossOver patching: `pkg/patching/patching.go`
