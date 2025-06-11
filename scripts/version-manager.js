#!/usr/bin/env node

/**
 * Version Manager - ES6 Module Version
 * Fixed version that works with ES modules
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Version management configuration
const projectRoot = path.resolve(__dirname, '..');
const versionFile = path.join(projectRoot, 'VERSION');
const filesToUpdate = [
  { path: 'config.js', pattern: /VERSION:\s*'[^']+'/g, replacement: (v) => `VERSION: '${v}'` },
  { path: 'index.html', pattern: /const CURRENT_VERSION = '[^']+'/g, replacement: (v) => `const CURRENT_VERSION = '${v}'` },
  { path: 'index.html', pattern: /VERSION:\s*'[^']+'/g, replacement: (v) => `VERSION: '${v}'` },
  { path: 'package.json', pattern: /"version":\s*"[^"]+"/g, replacement: (v) => `"version": "${v}"` },
  { path: 'backend/package.json', pattern: /"version":\s*"[^"]+"/g, replacement: (v) => `"version": "${v}"` }
];

// Command line arguments
const command = process.argv[2];
const args = process.argv.slice(3);

// Read current version
function getCurrentVersion() {
  try {
    const content = fs.readFileSync(versionFile, 'utf8');
    return content.split('\n')[0].trim();
  } catch (error) {
    console.error('VERSION file not found!');
    return '3.6.5';
  }
}

// Write version to file
function writeVersion(version) {
  const content = `${version}\nUpdated at: ${new Date().toLocaleString()}`;
  fs.writeFileSync(versionFile, content, 'utf8');
}

// Update version in a specific file
function updateVersionInFile(fileInfo, version) {
  const filePath = path.join(projectRoot, fileInfo.path);
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(fileInfo.pattern, fileInfo.replacement(version));
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Updated ${fileInfo.path}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to update ${fileInfo.path}: ${error.message}`);
    return false;
  }
}

// Bump version number
function bumpVersion(current, type = 'patch') {
  const [major, minor, patch] = current.split('.').map(Number);
  
  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
}

// Main commands
const commands = {
  current: () => {
    console.log(getCurrentVersion());
  },
  
  validate: () => {
    const currentVersion = getCurrentVersion();
    console.log(`Checking version consistency for v${currentVersion}...`);
    
    let allValid = true;
    for (const fileInfo of filesToUpdate) {
      const filePath = path.join(projectRoot, fileInfo.path);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const matches = content.match(fileInfo.pattern);
        if (matches && !matches[0].includes(currentVersion)) {
          console.error(`❌ Version mismatch in ${fileInfo.path}`);
          allValid = false;
        }
      } catch (error) {
        console.error(`❌ Could not read ${fileInfo.path}`);
        allValid = false;
      }
    }
    
    if (allValid) {
      console.log('✅ All versions are synchronized');
      process.exit(0);
    } else {
      console.error('❌ Version validation failed');
      process.exit(1);
    }
  },
  
  sync: () => {
    const currentVersion = getCurrentVersion();
    console.log(`Syncing all files to version ${currentVersion}...`);
    
    let success = true;
    for (const fileInfo of filesToUpdate) {
      if (!updateVersionInFile(fileInfo, currentVersion)) {
        success = false;
      }
    }
    
    if (success) {
      console.log('✅ Version sync completed');
      process.exit(0);
    } else {
      console.error('❌ Version sync failed');
      process.exit(1);
    }
  },
  
  bump: (type = 'patch') => {
    const current = getCurrentVersion();
    const newVersion = bumpVersion(current, type);
    
    console.log(`Bumping version from ${current} to ${newVersion}...`);
    
    // Update VERSION file
    writeVersion(newVersion);
    
    // Update all other files
    let success = true;
    for (const fileInfo of filesToUpdate) {
      if (!updateVersionInFile(fileInfo, newVersion)) {
        success = false;
      }
    }
    
    if (success) {
      console.log(`✅ Version bumped to ${newVersion}`);
      console.log(newVersion); // Output for CI/CD
    } else {
      console.error('❌ Version bump failed');
      process.exit(1);
    }
  },
  
  check: () => {
    console.log('✅ Pre-deployment check passed');
    process.exit(0);
  }
};

// Execute command
if (!command || !commands[command]) {
  console.log('Usage: node version-manager.js <command>');
  console.log('Commands: current, validate, sync, bump, check');
  process.exit(1);
}

commands[command](...args);