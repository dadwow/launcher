# Download Troubleshooting Guide

## Issue
Download failing with "download failed, aborted" error when attempting to download client files.

## Investigation Results

### Download URL Validation ✅
- **URL**: `https://bit.ly/3JwHKKX`
- **Status**: Working correctly
- **Final URL**: `https://btground.tk/chmi/ChromieCraft_3.3.5a.zip`
- **Size**: 16.9 GB (17,674,749,792 bytes)
- **Content-Type**: `application/zip`

### Improvements Made

#### 1. Enhanced Error Handling in `src/main.js`
- ✅ Added comprehensive logging for download initialization
- ✅ Added timeout configuration (30 seconds for initial connection)
- ✅ Enabled redirect following (maxRedirects: 10)
- ✅ Added User-Agent header for better compatibility
- ✅ Improved error messages with specific error codes (ENOTFOUND, ECONNRESET, ETIMEDOUT)
- ✅ Added writer stream error handling
- ✅ Fixed writer.end() to properly wait for completion
- ✅ Added URL validation before starting download

#### 2. URL Validation Function
```javascript
validateDownloadUrl(url)
```
- Performs HEAD request to validate URL before downloading
- Checks content-type and content-length headers
- Handles redirects properly
- Provides detailed validation results

#### 3. Better Error Display in `src/renderer.js`
- Enhanced error messages with helpful troubleshooting suggestions
- Contextual help based on error type
- Better user experience with actionable information

#### 4. Added Test Script: `test-download-url.js`
Run with: `node test-download-url.js`
- Validates download URL accessibility
- Checks redirects and final destination
- Tests streaming functionality
- Provides detailed diagnostics

## Testing Instructions

1. **Run the test script first:**
   ```bash
   node test-download-url.js
   ```
   This validates that the URL is accessible and working.

2. **Start the launcher with debug logging:**
   ```bash
   npm start 2>&1 | tee launcher-debug.log
   ```

3. **Attempt the download and observe:**
   - Check the console output for detailed error messages
   - Look for log entries like:
     - "Starting download: ..."
     - "URL validation result: ..."
     - "Initiating HTTP request to: ..."
     - "Download response received: ..."
     - Any error messages with specific error codes

4. **Check the log file:**
   ```bash
   cat launcher-debug.log
   ```

## Common Issues and Solutions

### Issue: Download starts but immediately aborts
**Possible Causes:**
- Disk space insufficient for 16.9 GB file
- Permission issues in the installation directory
- Antivirus/firewall blocking the download
- Network proxy interfering with the connection

**Solution:**
1. Check available disk space: `df -h ~/Documents/World\ of\ Warcraft`
2. Check directory permissions: `ls -la ~/Documents/World\ of\ Warcraft`
3. Try disabling antivirus temporarily
4. Check network proxy settings

### Issue: Connection timeout
**Possible Causes:**
- Slow or unstable internet connection
- Download server is overloaded
- Firewall blocking outgoing connections

**Solution:**
1. Test internet speed
2. Try again during off-peak hours
3. Check firewall settings

### Issue: Invalid URL error
**Possible Causes:**
- bit.ly link expired or changed
- DNS resolution issues
- Network restrictions

**Solution:**
1. Verify the URL in `.env` file is correct
2. Test the URL in a browser
3. Try updating the CLIENT_DOWNLOAD_URL to the direct URL: `https://btground.tk/chmi/ChromieCraft_3.3.5a.zip`

## Debugging Commands

### Check disk space:
```bash
df -h ~/Documents
```

### Check permissions:
```bash
ls -la ~/Documents/World\ of\ Warcraft
```

### Test URL directly with curl:
```bash
curl -I "https://bit.ly/3JwHKKX"
```

### Monitor download with curl:
```bash
curl -O --progress-bar "https://bit.ly/3JwHKKX"
```

## Next Steps for User

1. Try running the launcher again with the improved error handling
2. The error messages should now be more specific and helpful
3. Check the console output for detailed debug information
4. If you see a specific error message, follow the suggestions provided
5. Report back with the exact error message shown in the console

## Additional Improvements to Consider

If issues persist, consider:
1. Adding resumable download support
2. Implementing download retry logic
3. Adding progress indication during URL validation
4. Creating alternative download sources
5. Implementing chunk-based downloading for better reliability with large files
