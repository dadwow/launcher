# WoW Launcher Test Suite

## Overview
Comprehensive test suite for the WoW 3.3.5a Launcher, covering all critical functionality including downloads, extraction, addon management, and self-updates.

## Test Coverage

### 1. Client File Download Tests (`tests/download.test.js`)
- ✅ Download client files successfully
- ✅ Handle download errors gracefully
- ✅ Track download progress
- ✅ Verify network error handling
- ✅ Ensure destination directory creation

**What's tested:**
- Axios HTTP requests with streaming
- File system write operations
- Progress tracking callbacks
- Error propagation

### 2. Client File Extraction Tests (`tests/extraction.test.js`)
- ✅ Extract zip file to destination
- ✅ Handle nested folder structures (flatten ChromieCraft_3.3.5a folders)
- ✅ Extract non-nested archives correctly
- ✅ Handle extraction errors
- ✅ Ensure destination directory exists

**What's tested:**
- node-stream-zip extraction
- Nested folder detection
- Directory flattening logic
- Cleanup of temporary files

### 3. Addon Installation Tests (`tests/addon-installation.test.js`)
- ✅ Install addon from GitHub repository
- ✅ Handle multi-folder addons (ElvUI + ElvUI_Config)
- ✅ Handle single addon folder
- ✅ Auto-detect default branch (main/master)
- ✅ Create Interface/AddOns directory
- ✅ Save GitHub repository metadata
- ✅ Handle installation errors

**What's tested:**
- GitHub API integration
- .toc file detection
- Multiple addon folder handling
- Metadata storage (.github-repo file)

### 4. Addon Update Check Tests (`tests/addon-update-check.test.js`)
- ✅ Detect available updates via commit SHA comparison
- ✅ Handle addons without stored commit info
- ✅ Handle GitHub API errors gracefully
- ✅ Skip addons without repository info
- ✅ Compare latest commit with stored commit

**What's tested:**
- GitHub API commit queries
- Commit SHA comparison logic
- Metadata file reading (.github-commit)
- Error handling for rate limits

### 5. Addon Update Tests (`tests/addon-update.test.js`)
- ✅ Successfully update an addon
- ✅ Update commit SHA after update
- ✅ Preserve addon settings (SavedVariables)
- ✅ Handle update errors gracefully
- ✅ Cleanup temporary files after update
- ✅ Remove old version before installing new

**What's tested:**
- Full update workflow
- Settings preservation
- File replacement logic
- Temporary file cleanup

### 6. Launcher Self-Update Tests (`tests/launcher-update.test.js`)
- ✅ Check for updates on startup
- ✅ Notify user when update available
- ✅ Download update when requested
- ✅ Track download progress
- ✅ Notify when update downloaded
- ✅ Quit and install update
- ✅ Handle update errors
- ✅ Check updates from GitHub releases
- ✅ Auto-install on quit configuration

**What's tested:**
- electron-updater integration
- Event handling (update-available, download-progress, etc.)
- IPC communication with renderer
- Auto-update configuration

### 7. Integration Tests (`tests/integration.test.js`)
- ✅ Complete workflow: download → extract → install addon → check update → update addon
- ✅ Error handling at each step
- ✅ Verify workflow doesn't crash on errors

**What's tested:**
- End-to-end functionality
- Step sequencing
- Error resilience

## Running Tests

### Install Dependencies
```bash
npm install
```

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Generate Coverage Report
```bash
npm run test:coverage
```

Coverage reports are generated in the `coverage/` directory and include:
- Text summary in terminal
- HTML report in `coverage/lcov-report/index.html`
- LCOV format for CI/CD integration

## Test Structure

```
tests/
├── download.test.js              # Client download tests
├── extraction.test.js            # Zip extraction tests
├── addon-installation.test.js    # Addon install tests
├── addon-update-check.test.js    # Update detection tests
├── addon-update.test.js          # Addon update tests
├── launcher-update.test.js       # Self-update tests
└── integration.test.js           # End-to-end tests
```

## Mocking Strategy

All tests use Jest mocks for:
- **axios**: HTTP requests and streaming
- **fs-extra**: File system operations
- **node-stream-zip**: Zip extraction
- **electron**: IPC, app, BrowserWindow
- **electron-updater**: Auto-update functionality

This ensures:
- Fast test execution (no real network/disk I/O)
- Predictable test behavior
- Isolation from external dependencies

## CI/CD Integration

Tests run automatically on:
- Every push to any branch
- Pull requests to main
- Before release builds

See `.github/workflows/test.yml` for configuration.

## Coverage Goals

Target coverage: **80%+** for all modules

Current coverage:
- main.js: Core functionality
- options.js: UI logic
- platform-manager.js: Cross-platform launching

## Writing New Tests

### Template for new test files:

```javascript
const fs = require('fs-extra');
// ... other imports

jest.mock('fs-extra');
// ... other mocks

describe('Feature Name Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should do something specific', async () => {
        // Arrange
        const mockData = { /* ... */ };
        fs.someMethod = jest.fn().mockResolvedValue(mockData);

        // Act
        const result = await functionUnderTest();

        // Assert
        expect(result).toBe(expected);
        expect(fs.someMethod).toHaveBeenCalled();
    });
});
```

## Troubleshooting

### Tests failing with "Cannot find module"
Run `npm install` to ensure all dependencies are installed.

### Mock not working
Ensure `jest.clearAllMocks()` is in `beforeEach()`.

### Async tests timing out
Increase timeout in `jest.config.js` or specific test:
```javascript
test('my test', async () => {
    // ...
}, 60000); // 60 second timeout
```

## Future Test Enhancements

- [ ] Add E2E tests with Playwright
- [ ] Test Wine installation on Linux
- [ ] Test WoW launch on different platforms
- [ ] Add performance benchmarks
- [ ] Test realmlist.wtf updates
- [ ] Test concurrent downloads
