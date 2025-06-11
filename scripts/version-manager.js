#!/usr/bin/env node

/**
 * Version Manager - Single source of truth for all service versions
 * This script ensures version consistency across the entire project
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class VersionManager {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.versionFile = path.join(this.projectRoot, 'VERSION');
    this.lockFile = path.join(this.projectRoot, '.version.lock');
  }

  // Get current version from VERSION file (single source of truth)
  getCurrentVersion() {
    try {
      const content = fs.readFileSync(this.versionFile, 'utf8');
      const version = content.split('\n')[0].trim();
      return version;
    } catch (error) {
      console.error('❌ VERSION file not found!');
      process.exit(1);
    }
  }

  // Generate version hash for integrity checking
  generateVersionHash(version) {
    const crypto = require('crypto');
    const timestamp = new Date().toISOString();
    return crypto.createHash('sha256').update(`${version}-${timestamp}`).digest('hex').substring(0, 8);
  }

  // Update all version references in the project
  updateAllVersions(version, hash) {
    const updates = [
      // Frontend config.js
      {
        file: 'config.js',
        pattern: /VERSION:\s*['"][\d.]+['"]/,
        replacement: `VERSION: '${version}'`
      },
      // Frontend index.html (version display)
      {
        file: 'index.html',
        pattern: /v[\d.]+<\/span>/,
        replacement: `v${version}</span>`
      },
      // Backend package.json
      {
        file: 'backend/package.json',
        pattern: /"version":\s*"[\d.]+"/,
        replacement: `"version": "${version}"`
      },
      // Backend server files
      {
        file: 'backend/server.js',
        pattern: /version:\s*['"][\d.]+['"]/g,
        replacement: `version: '${version}'`
      },
      {
        file: 'backend/server-simple.js',
        pattern: /version:\s*['"][\d.]+['"]/g,
        replacement: `version: '${version}'`
      },
      // Root package.json
      {
        file: 'package.json',
        pattern: /"version":\s*"[\d.]+"/,
        replacement: `"version": "${version}"`
      },
      // App Engine app.yaml
      {
        file: 'app.yaml',
        pattern: /APP_VERSION:\s*['"][\d.]+['"]/,
        replacement: `APP_VERSION: '${version}'`
      },
      {
        file: 'backend/app.yaml',
        pattern: /APP_VERSION:\s*['"][\d.]+['"]/,
        replacement: `APP_VERSION: '${version}'`
      }
    ];

    let successCount = 0;
    const errors = [];

    for (const update of updates) {
      const filePath = path.join(this.projectRoot, update.file);
      
      try {
        if (!fs.existsSync(filePath)) {
          console.log(`⚠️  Skipping ${update.file} (not found)`);
          continue;
        }

        let content = fs.readFileSync(filePath, 'utf8');
        const originalContent = content;

        // Apply the replacement
        content = content.replace(update.pattern, update.replacement);

        if (content !== originalContent) {
          fs.writeFileSync(filePath, content);
          console.log(`✅ Updated ${update.file}`);
          successCount++;
        } else {
          console.log(`ℹ️  No changes needed in ${update.file}`);
        }
      } catch (error) {
        errors.push({ file: update.file, error: error.message });
      }
    }

    // Create version lock file with hash
    const lockData = {
      version,
      hash,
      timestamp: new Date().toISOString(),
      updatedFiles: successCount,
      gitCommit: this.getGitCommit()
    };

    fs.writeFileSync(this.lockFile, JSON.stringify(lockData, null, 2));

    return { successCount, errors };
  }

  // Get current git commit hash
  getGitCommit() {
    try {
      return execSync('git rev-parse HEAD').toString().trim().substring(0, 8);
    } catch {
      return 'unknown';
    }
  }

  // Validate all versions match
  validateVersions() {
    const version = this.getCurrentVersion();
    const mismatches = [];

    // Check config.js
    try {
      const configContent = fs.readFileSync(path.join(this.projectRoot, 'config.js'), 'utf8');
      const configMatch = configContent.match(/VERSION:\s*['"]([^'"]+)['"]/);
      if (configMatch && configMatch[1] !== version) {
        mismatches.push({ file: 'config.js', found: configMatch[1], expected: version });
      }
    } catch (e) {}

    // Check backend package.json
    try {
      const backendPkg = JSON.parse(fs.readFileSync(path.join(this.projectRoot, 'backend/package.json'), 'utf8'));
      if (backendPkg.version !== version) {
        mismatches.push({ file: 'backend/package.json', found: backendPkg.version, expected: version });
      }
    } catch (e) {}

    // Check index.html
    try {
      const indexContent = fs.readFileSync(path.join(this.projectRoot, 'index.html'), 'utf8');
      const indexMatch = indexContent.match(/v([\d.]+)<\/span>/);
      if (indexMatch && indexMatch[1] !== version) {
        mismatches.push({ file: 'index.html', found: indexMatch[1], expected: version });
      }
    } catch (e) {}

    return mismatches;
  }

  // Bump version
  bumpVersion(type = 'patch') {
    const currentVersion = this.getCurrentVersion();
    const [major, minor, patch] = currentVersion.split('.').map(Number);
    
    let newVersion;
    switch (type) {
      case 'major':
        newVersion = `${major + 1}.0.0`;
        break;
      case 'minor':
        newVersion = `${major}.${minor + 1}.0`;
        break;
      case 'patch':
      default:
        newVersion = `${major}.${minor}.${patch + 1}`;
    }

    // Update VERSION file
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' });
    fs.writeFileSync(this.versionFile, `${newVersion}\nUpdated at: ${timestamp}`);

    return newVersion;
  }

  // Pre-deployment check
  preDeployCheck() {
    console.log('🔍 Running pre-deployment version check...\n');

    const mismatches = this.validateVersions();
    
    if (mismatches.length > 0) {
      console.error('❌ Version mismatches detected:');
      mismatches.forEach(m => {
        console.error(`   ${m.file}: found "${m.found}", expected "${m.expected}"`);
      });
      return false;
    }

    console.log('✅ All versions are synchronized!');
    
    // Check version lock
    if (fs.existsSync(this.lockFile)) {
      const lock = JSON.parse(fs.readFileSync(this.lockFile, 'utf8'));
      const currentVersion = this.getCurrentVersion();
      
      if (lock.version !== currentVersion) {
        console.error(`❌ Version lock mismatch: ${lock.version} vs ${currentVersion}`);
        return false;
      }
      
      console.log(`✅ Version lock valid: ${lock.version} (${lock.hash})`);
    }

    return true;
  }
}

// CLI commands
const commands = {
  sync: () => {
    const vm = new VersionManager();
    const version = vm.getCurrentVersion();
    const hash = vm.generateVersionHash(version);
    
    console.log(`📦 Synchronizing version ${version} across all services...\n`);
    
    const result = vm.updateAllVersions(version, hash);
    
    console.log(`\n✨ Synchronization complete!`);
    console.log(`   Updated: ${result.successCount} files`);
    
    if (result.errors.length > 0) {
      console.error('\n❌ Errors encountered:');
      result.errors.forEach(e => console.error(`   ${e.file}: ${e.error}`));
    }
  },

  validate: () => {
    const vm = new VersionManager();
    const mismatches = vm.validateVersions();
    
    if (mismatches.length === 0) {
      console.log('✅ All versions are synchronized!');
      process.exit(0);
    } else {
      console.error('❌ Version mismatches found:');
      mismatches.forEach(m => {
        console.error(`   ${m.file}: found "${m.found}", expected "${m.expected}"`);
      });
      process.exit(1);
    }
  },

  bump: (type = 'patch') => {
    const vm = new VersionManager();
    const oldVersion = vm.getCurrentVersion();
    const newVersion = vm.bumpVersion(type);
    const hash = vm.generateVersionHash(newVersion);
    
    console.log(`🚀 Bumping version from ${oldVersion} to ${newVersion}\n`);
    
    const result = vm.updateAllVersions(newVersion, hash);
    
    console.log(`\n✨ Version bump complete!`);
    console.log(`   New version: ${newVersion}`);
    console.log(`   Updated: ${result.successCount} files`);
  },

  check: () => {
    const vm = new VersionManager();
    if (vm.preDeployCheck()) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  },

  current: () => {
    const vm = new VersionManager();
    console.log(vm.getCurrentVersion());
  }
};

// Main execution
const command = process.argv[2];
const args = process.argv.slice(3);

if (!command || !commands[command]) {
  console.log(`Version Manager - Ensures version consistency across all services

Usage:
  node version-manager.js <command> [options]

Commands:
  sync      - Synchronize version across all files
  validate  - Check if all versions match
  bump      - Increment version (patch|minor|major)
  check     - Pre-deployment version validation
  current   - Display current version

Examples:
  node version-manager.js sync
  node version-manager.js bump patch
  node version-manager.js validate
`);
  process.exit(1);
}

commands[command](...args);