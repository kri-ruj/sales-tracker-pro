/**
 * Version Check Middleware
 * Ensures version consistency across services at runtime
 */

const fs = require('fs');
const path = require('path');

class VersionChecker {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '../..');
    this.versionFile = path.join(this.projectRoot, 'VERSION');
    this.lockFile = path.join(this.projectRoot, '.version.lock');
    this.lastCheck = null;
    this.checkInterval = 60000; // Check every minute
    this.versionCache = null;
  }

  getExpectedVersion() {
    // Cache version for performance
    if (this.versionCache && this.lastCheck && Date.now() - this.lastCheck < this.checkInterval) {
      return this.versionCache;
    }

    try {
      const content = fs.readFileSync(this.versionFile, 'utf8');
      this.versionCache = content.split('\n')[0].trim();
      this.lastCheck = Date.now();
      return this.versionCache;
    } catch (error) {
      console.error('Failed to read VERSION file:', error);
      return null;
    }
  }

  getVersionLock() {
    try {
      if (fs.existsSync(this.lockFile)) {
        return JSON.parse(fs.readFileSync(this.lockFile, 'utf8'));
      }
    } catch (error) {
      console.error('Failed to read version lock:', error);
    }
    return null;
  }

  validateRequest(req, res, next) {
    const expectedVersion = this.getExpectedVersion();
    const packageVersion = require('../package.json').version;
    
    // Add version headers to all responses
    res.setHeader('X-API-Version', packageVersion);
    res.setHeader('X-Expected-Version', expectedVersion || 'unknown');

    // Version mismatch detection
    if (expectedVersion && packageVersion !== expectedVersion) {
      console.error(`⚠️  Version mismatch detected! Package: ${packageVersion}, Expected: ${expectedVersion}`);
      
      // In production, log but don't block requests
      if (process.env.NODE_ENV === 'production') {
        res.setHeader('X-Version-Warning', 'Version mismatch detected');
      }
    }

    // Check frontend version from request headers
    const clientVersion = req.headers['x-client-version'];
    if (clientVersion && clientVersion !== expectedVersion) {
      res.setHeader('X-Client-Version-Warning', `Client version ${clientVersion} differs from server ${expectedVersion}`);
    }

    next();
  }

  // Version health check endpoint
  versionHealthCheck() {
    const expectedVersion = this.getExpectedVersion();
    const packageVersion = require('../package.json').version;
    const lock = this.getVersionLock();

    const health = {
      status: 'ok',
      version: {
        expected: expectedVersion,
        actual: packageVersion,
        match: expectedVersion === packageVersion
      },
      lock: lock ? {
        version: lock.version,
        hash: lock.hash,
        timestamp: lock.timestamp,
        gitCommit: lock.gitCommit
      } : null,
      timestamp: new Date().toISOString()
    };

    if (!health.version.match) {
      health.status = 'warning';
      health.message = 'Version mismatch detected';
    }

    return health;
  }
}

// Singleton instance
const checker = new VersionChecker();

// Middleware function
const versionCheckMiddleware = (req, res, next) => {
  checker.validateRequest(req, res, next);
};

// Health check handler
const versionHealthHandler = (req, res) => {
  const health = checker.versionHealthCheck();
  res.status(health.status === 'ok' ? 200 : 503).json(health);
};

module.exports = {
  versionCheckMiddleware,
  versionHealthHandler,
  VersionChecker
};