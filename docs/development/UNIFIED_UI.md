# Unified UI Implementation

## Overview
All launcher operations now use the same action button and progress bar for a consistent user experience.

## Unified Components

### Main Action Button (`main-action-button`)
Single button that handles all primary actions based on state:

**Button States:**
- `configure` - Opens settings when installation path is not configured
- `download` - Downloads client files
- `play` - Launches World of Warcraft
- `update` - Installs launcher updates

**Visual Feedback:**
- Button text changes based on operation (e.g., "Downloading...", "Installing Wine...", "📦 Extracting...")
- Button is disabled during operations
- Emoji indicators for special states (🎉 for updates, 📦 for extraction, ⬇️ for downloads)

### Progress Bar (`progress-container`)
Single progress indicator used for all operations:

**Progress Text Formats:**
- **Client Download:** `Downloading Client: 45MB / 100MB (2.5MB/s)`
- **Launcher Update:** `Downloading Launcher Update (5MB / 10MB)`
- **Extraction:** `Extracting Client Files...`
- **Wine Installation:** `Preparing Wine installation...` / `Installing Wine: 50%`

**Progress Controls:**
- Pause/Cancel buttons shown ONLY during client downloads (can be paused/cancelled)
- Buttons hidden during:
  - Launcher updates (cannot pause electron-updater)
  - File extraction (quick operation)
  - Wine installation (system operation)

## Operations Using Unified UI

### 1. Client Download
**Trigger:** User clicks "Download Client" button
**Progress Display:**
```
Downloading Client: 45MB / 100MB (2.5MB/s)
[████████░░░░░░░░░░] 45%
[Pause] [Cancel]
```
**Button State:** `download` → "Downloading..."
**Can Pause:** ✅ Yes
**Can Cancel:** ✅ Yes

### 2. Client Extraction
**Trigger:** Automatically after download completes
**Progress Display:**
```
Extracting Client Files...
[████████████████████] 100%
```
**Button State:** `download` → "📦 Extracting..."
**Can Pause:** ❌ No
**Can Cancel:** ❌ No

### 3. Launcher Updates
**Trigger:** User clicks "Download Update" or "🎉 Install Update" button
**Progress Display:**
```
Downloading Launcher Update (5MB / 10MB)
[████████░░░░░░░░░░] 50%
```
**Button State:** `update` → "Downloading Update..." → "🎉 Install Update v1.0.12"
**Can Pause:** ❌ No
**Can Cancel:** ❌ No

### 4. Wine/CrossOver Installation
**Trigger:** Automatic prompt on macOS/Linux when client is installed but Wine is not
**Progress Display:**
```
Installing Wine: 75%
[███████████████░░░░░] 75%
```
**Button State:** `configure` → "Installing Wine..."
**Can Pause:** ❌ No
**Can Cancel:** ❌ No

## Implementation Details

### Modified Files

#### src/renderer.js
- ✅ `handleDownloadProgress()` - Shows "Downloading Client:" prefix, displays pause/cancel buttons
- ✅ `handleExtractionProgress()` - Shows extraction status, hides pause/cancel buttons
- ✅ `updateDownloadProgress()` - Shows launcher update progress, hides pause/cancel buttons
- ✅ `showUpdateReady()` - Changes main button to update state
- ✅ `handleMainAction()` - Handles 'update' button state
- ✅ `installWineAutomatically()` - Uses unified progress bar, hides pause/cancel buttons

#### src/main.js
- ✅ Added `extraction-progress` IPC event sent before extraction starts

#### src/preload.js
- ✅ Added `onExtractionProgress()` listener for extraction events

### Event Flow

#### Client Download & Extraction Flow
```
User clicks "Download Client"
  ↓
startDownload() → Button: "Downloading..."
  ↓
download-progress events → "Downloading Client: X / Y (Z/s)" + Pause/Cancel shown
  ↓
Download completes (100%)
  ↓
extraction-progress event → "Extracting Client Files..." + Pause/Cancel hidden
  ↓
extraction completes
  ↓
download-complete event → Button: "Launch World of Warcraft"
```

#### Launcher Update Flow
```
update-available event → Notification: "Update Available v1.0.12"
  ↓
User clicks "Download Update"
  ↓
downloadLauncherUpdate() → Button: "Downloading Update..."
  ↓
update-download-progress events → "Downloading Launcher Update (X / Y)" + Pause/Cancel hidden
  ↓
update-downloaded event → Button: "🎉 Install Update v1.0.12"
  ↓
User clicks button
  ↓
App quits and installer runs
```

#### Wine Installation Flow
```
checkGameStatus() detects missing Wine
  ↓
installWineAutomatically() → Button: "Installing Wine..."
  ↓
wine-install-progress events → "Installing Wine: X%" + Pause/Cancel hidden
  ↓
Installation completes
  ↓
Button: "Launch World of Warcraft"
```

## Benefits

### User Experience
- **Consistent Interface:** All operations use the same visual components
- **Clear Status:** Text clearly indicates what operation is in progress
- **Appropriate Controls:** Pause/Cancel only shown when applicable
- **No Confusion:** Single progress bar eliminates competing progress indicators

### Developer Experience
- **Maintainable:** Single set of UI components to maintain
- **Extensible:** Easy to add new operations that follow the same pattern
- **Testable:** Consistent behavior makes testing simpler

## Testing Recommendations

### Manual Testing Checklist
- ✅ Download client files → verify "Downloading Client:" shows with Pause/Cancel
- ✅ Let download complete → verify "Extracting Client Files..." shows without Pause/Cancel
- ✅ Check for launcher updates → verify "Downloading Launcher Update" shows without Pause/Cancel
- ✅ Install Wine (macOS/Linux) → verify progress shows without Pause/Cancel
- ✅ Pause client download → verify button changes to "Resume"
- ✅ Cancel client download → verify UI resets properly

### Automated Testing
Consider adding tests for:
- Progress text formatting for each operation type
- Pause/Cancel button visibility based on operation
- Button state transitions
- Progress bar reset behavior

## Future Enhancements

### Potential Additions
- **Addon Updates:** Use same progress bar for addon installations/updates
- **Speed Graphs:** Show download speed history in the progress bar
- **Time Remaining:** Add ETA for downloads
- **Network Stats:** Show total downloaded/uploaded during session
- **Retry Logic:** Automatic retry with exponential backoff for failed downloads
