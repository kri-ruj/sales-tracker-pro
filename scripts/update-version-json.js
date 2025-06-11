#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get version from command line or package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const version = process.argv[2] || packageJson.version;

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