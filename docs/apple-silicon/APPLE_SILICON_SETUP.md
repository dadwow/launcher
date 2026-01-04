# Apple Silicon (M1/M2/M3/M4) Setup Guide

## Automatic TurtleSilicon Patch Installation

**Good newsrun dev* The PlusCraft Launcher now **automatically installs** TurtleSilicon patches on Apple Silicon Macs. You don't need to manually download or install anything!

## How It Works

When you launch WoW on an Apple Silicon Mac, the launcher automatically:

1. **Installs rosettax87 service** - Enables x87 FPU instruction translation
2. **Installs winerosetta.dll** - Patches WoW for ARM64 compatibility  
3. **Installs d3d9.dll** - Optimizes DirectX9 via Vulkan/Metal
4. **Creates wineloader2** - Patches CrossOver for unsigned binary execution

All patches are bundled with the launcher - no separate downloads needed!

## What You Need

- **Apple Silicon Mac** (M1, M2, M3, or M4)
- **CrossOver** installed (Wine compatibility layer)
- **WoW 3.3.5a client** downloaded

That's it! The launcher handles the rest automatically.

## Why These Patches Are Required

WoW 3.3.5a was built for x86 processors and uses x87 FPU instructions that don't exist on ARM64 (Apple Silicon). Without patches, the game crashes at character selection with:

```
ERROR #132 (0x85100084) Fatal Exception
Exception: 0xC000001D (ILLEGAL_INSTRUCTION)
```

TurtleSilicon's rosettax87 service translates these instructions on-the-fly, allowing the game to run smoothly.

## Troubleshooting

### If patches fail to install automatically:

1. **Check CrossOver installation**: Make sure CrossOver.app is in `/Applications/`
2. **Check permissions**: The launcher needs permission to write to:
   - Your WoW directory
   - CrossOver's application bundle
3. **View logs**: Check the launcher console for specific error messages

### If the game still crashes:

1. Verify CrossOver is properly installed
2. Try reinstalling CrossOver
3. Check that your WoW client is version 3.3.5a (12340)

## Technical Details

The launcher bundles and installs these components from [TurtleSilicon](https://github.com/Malachoris/turtlesilicon):

- **rosettax87** - x87 FPU instruction translator  
- **libRuntimeRosettax87** - Runtime library for rosettax87
- **winerosetta.dll** - Wine patch for ARM64 compatibility
- **d3d9.dll** - DirectX9 to Vulkan/Metal translator (d9vk)

All components are MIT licensed and credit goes to [@Lifeisawful](https://github.com/Lifeisawful) for the core translation layers.

## Credits

- **TurtleSilicon patches**: [Malachoris/turtlesilicon](https://github.com/Malachoris/turtlesilicon)
- **winerosetta**: [Lifeisawful/winerosetta](https://github.com/Lifeisawful/winerosetta)
- **rosettax87**: [Lifeisawful/rosettax87](https://github.com/Lifeisawful/rosettax87)

## Need Help?

If automatic installation fails or you encounter issues, please open an issue on our GitHub repository with:
- Your Mac model and macOS version
- CrossOver version
- Full error message from the launcher console
