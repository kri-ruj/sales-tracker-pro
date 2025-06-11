#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get version from command line or package.json
const version = process.argv[2] || require('../package.json').version;

// Create version.json with timestamp
const versionData = {
  version: version,
  timestamp: new Date().toISOString(),
  deployment: process.env.NODE_ENV || 'production',
  commit: process.env.GITHUB_SHA || 'local',
  buildNumber: process.env.GITHUB_RUN_NUMBER || '0'
};

// Write version.json
fs.writeFileSync(
  path.join(__dirname, '..', 'version.json'),
  JSON.stringify(versionData, null, 2)
);

console.log(`✅ Updated version.json to ${version}`);
console.log(JSON.stringify(versionData, null, 2));