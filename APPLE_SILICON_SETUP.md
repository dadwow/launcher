# Apple Silicon Support for WoW 3.3.5a

## Important: TurtleSilicon Required for Apple Silicon Macs

If you're running this launcher on an Apple Silicon Mac (M1, M2, M3, M4), **you must install TurtleSilicon patches** before WoW 3.3.5a will run.

### Why?

WoW 3.3.5a uses x87 FPU instructions that cause this error on ARM64:
```
ERROR #132 (0x85100084) Fatal Exception
Exception: 0xC000001D (ILLEGAL_INSTRUCTION)
```

TurtleSilicon's `rosettax87` service solves this by intercepting and translating these instructions in real-time.

## Setup Instructions

### Step 1: Install CrossOver
- Download from: https://www.codeweavers.com/crossover
- Install to `/Applications/CrossOver.app`

### Step 2: Install TurtleSilicon
1. Download the latest release: https://github.com/Malachoris/turtlesilicon/releases
2. Open the DMG and drag TurtleSilicon to Applications
3. Open TurtleSilicon

### Step 3: Patch CrossOver
1. In TurtleSilicon, click "Set/Change" next to CrossOver Path
2. Select `/Applications/CrossOver.app`
3. Click "Patch CrossOver"
4. Wait for success message

### Step 4: Patch WoW Installation
1. Click "Set/Change" next to Game Directory Path
2. Select your WoW 3.3.5a installation folder (where WoW.exe is located)
3. Click "Patch Game"
4. Wait for success message

### Step 5: Use This Launcher
1. Close TurtleSilicon
2. Open this launcher
3. Configure your WoW installation path (same as in TurtleSilicon)
4. Click "Launch World of Warcraft"

The launcher will automatically:
- Detect that you're on Apple Silicon
- Verify TurtleSilicon patches are installed
- Launch WoW with the rosettax87 service
- Use optimized settings for Apple Silicon

## What If I Don't Have TurtleSilicon Patches?

The launcher will **refuse to launch** and show you a helpful error message with setup instructions. This prevents the game from crashing with ILLEGAL_INSTRUCTION errors.

## Verification

After patching with TurtleSilicon, these files should exist:
- `/Applications/CrossOver.app/Contents/SharedSupport/CrossOver/CrossOver-Hosted Application/wineloader2`
- `<Your WoW Path>/rosettax87/rosettax87`

The launcher checks for both before allowing launch.

## Intel Mac Users

If you're on an Intel Mac, you don't need TurtleSilicon. The launcher will work directly with CrossOver or Wine.

## Troubleshooting

### "TurtleSilicon patches required" error
- Follow the setup instructions above
- Make sure both CrossOver and WoW are patched
- Restart the launcher after patching

### Game still crashes
- Re-run TurtleSilicon patching
- Verify wineloader2 exists in CrossOver.app
- Verify rosettax87 folder exists in WoW directory
- Check console logs for "rosettax87" messages

### Performance issues
- TurtleSilicon includes optional graphics optimizations
- Check TurtleSilicon's graphics settings panel
- Enable libSiliconPatch for 2x+ FPS boost (optional)

## Credits

- TurtleSilicon by Malachoris: https://github.com/Malachoris/turtlesilicon
- This integration makes WoW 3.3.5a playable on Apple Silicon Macs
