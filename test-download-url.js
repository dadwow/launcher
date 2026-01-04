#!/usr/bin/env node

/**
 * Test script to validate the download URL from .env file
 */

const axios = require('axios');
require('dotenv').config();

async function testDownloadUrl() {
    const url = process.env.CLIENT_DOWNLOAD_URL;

    console.log('Testing download URL:', url);

    if (!url) {
        console.error('❌ CLIENT_DOWNLOAD_URL is not set in .env file');
        process.exit(1);
    }

    try {
        // First, try HEAD request to check URL without downloading
        console.log('\n1. Checking URL accessibility...');
        const headResponse = await axios.head(url, {
            timeout: 10000,
            maxRedirects: 10,
            headers: {
                'User-Agent': 'PlusCraft-Launcher/1.0'
            }
        });

        console.log('✅ URL is accessible');
        console.log('   Status:', headResponse.status);
        console.log('   Content-Type:', headResponse.headers['content-type']);
        console.log('   Content-Length:', headResponse.headers['content-length'], 'bytes');

        if (headResponse.headers['content-length']) {
            const sizeMB = (parseInt(headResponse.headers['content-length']) / (1024 * 1024)).toFixed(2);
            console.log('   Size:', sizeMB, 'MB');
        }

        // Check content type
        const contentType = headResponse.headers['content-type'] || '';
        if (contentType.includes('application/zip') ||
            contentType.includes('application/octet-stream') ||
            contentType.includes('application/x-zip-compressed')) {
            console.log('✅ Content-Type indicates a downloadable file');
        } else {
            console.log('⚠️  Warning: Content-Type does not indicate a zip file:', contentType);
        }

        // Check final URL after redirects
        if (headResponse.request.res.responseUrl && headResponse.request.res.responseUrl !== url) {
            console.log('   Final URL (after redirects):', headResponse.request.res.responseUrl);
        }

        // Test a small download to ensure streaming works
        console.log('\n2. Testing download stream (first 1KB)...');
        const streamResponse = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 10000,
            maxRedirects: 10,
            headers: {
                'User-Agent': 'PlusCraft-Launcher/1.0',
                'Range': 'bytes=0-1023' // Request only first 1KB
            }
        });

        let bytesReceived = 0;

        await new Promise((resolve, reject) => {
            streamResponse.data.on('data', (chunk) => {
                bytesReceived += chunk.length;
            });

            streamResponse.data.on('end', () => {
                resolve();
            });

            streamResponse.data.on('error', (error) => {
                reject(error);
            });

            setTimeout(() => {
                streamResponse.data.destroy();
                resolve();
            }, 2000);
        });

        console.log('✅ Stream download test successful');
        console.log('   Received:', bytesReceived, 'bytes');

        console.log('\n✅ All tests passed! The download URL is valid and accessible.');

    } catch (error) {
        console.error('\n❌ Download URL test failed!');
        console.error('   Error:', error.message);

        if (error.code) {
            console.error('   Error Code:', error.code);
        }

        if (error.response) {
            console.error('   HTTP Status:', error.response.status);
            console.error('   Status Text:', error.response.statusText);
        }

        console.log('\nTroubleshooting suggestions:');
        console.log('• Check your internet connection');
        console.log('• Verify the URL in .env file is correct');
        console.log('• Test the URL manually in a browser');
        console.log('• Check if the download server is online');

        process.exit(1);
    }
}

testDownloadUrl();
