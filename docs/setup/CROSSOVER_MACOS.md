# CrossOver Setup for macOS (Apple Silicon)

## Why CrossOver for Apple Silicon?

CrossOver is **strongly recommended** for Apple Silicon (M1/M2/M3) Macs when running WoW 3.3.5a due to:

1. **Native ARM64 Support**: CrossOver includes native Apple Silicon builds with optimized performance
2. **libsillicon Integration**: Uses the same optimizations as turtlesillicon project
3. **Metal Rendering**: Better graphics performance through Apple's Metal API
4. **One-Click Setup**: Simplified bottle/prefix management
5. **Regular Updates**: Commercial support ensures compatibility with macOS updates

## Installation

### Option 1: CrossOver (Recommended for Apple Silicon)

1. Download from [CodeWeavers](https://www.codeweavers.com/crossover)
2. Free trial available, or purchase license
3. Launch CrossOver and create a new bottle for WoW 3.3.5a
4. Use the launcher - it will auto-detect CrossOver

### Option 2: Homebrew Wine (Free, Limited Support)

```bash
# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Wine
brew install --cask xquartz wine-stable
```

**Note**: Standard Wine has limited Apple Silicon optimization and may have performance issues.

## Features When Using CrossOver

The launcher automatically detects and configures CrossOver with:

- **CX_BOTTLE**: Dedicated WoW335a bottle
- **CX_PLATFORM**: ARM64 optimization flags
- **MTL_HUD_ENABLED**: Disabled for better performance
- **WINE_LARGE_ADDRESS_AWARE**: Memory optimization for WoW
- **DYLD_LIBRARY_PATH**: Homebrew library support

## Performance Tips

1. **Disable Metal HUD**: Already configured in launcher
2. **Use Dedicated Graphics**: Set in macOS System Preferences
3. **Close Background Apps**: Free up memory and CPU
4. **Update CrossOver**: Keep CrossOver up to date for latest optimizations

## Troubleshooting

### CrossOver Not Detected

Check installation paths:
- `/Applications/CrossOver.app/Contents/SharedSupport/CrossOver/bin/wine64`
- `~/Applications/CrossOver.app/Contents/SharedSupport/CrossOver/bin/wine64`

### Performance Issues

1. Check Activity Monitor for CPU/Memory usage
2. Verify Metal rendering is enabled in CrossOver bottle settings
3. Ensure macOS is up to date
4. Try reducing in-game graphics settings

### Compatibility

CrossOver is compatible with:
- macOS 11 (Big Sur) and later
- All Apple Silicon Macs (M1, M2, M3 series)
- Intel Macs (x86_64)

## libsillicon / turtlesillicon

The launcher's CrossOver integration uses similar optimizations to the turtlesillicon project:

- Native ARM64 translation
- Metal API rendering
- Optimized memory management
- Reduced translation overhead

For more details on the underlying technology, see the [turtlesillicon project](https://github.com/arendst/turtlesillicon).

## Cost Comparison

| Option | Cost | Apple Silicon Support | Performance | Setup Difficulty |
|--------|------|---------------------|-------------|-----------------|
| CrossOver | ~$60/year | Native ARM64 | Excellent | Easy |
| Homebrew Wine | Free | Limited/Rosetta | Good | Moderate |

For the best experience on Apple Silicon Macs, CrossOver is worth the investment.
