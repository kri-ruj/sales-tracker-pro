/**
 * Version Monitor Routes
 * Provides endpoints to monitor version consistency across all services
 */

const express = require('express');
const axios = require('axios');
const router = express.Router();
const { versionHealthHandler } = require('../middleware/version-check');

// Version monitoring configuration
const SERVICES = {
  frontend: process.env.FRONTEND_URL || 'https://frontend-dot-salesappfkt.as.r.appspot.com',
  api: process.env.API_URL || 'https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com'
};

/**
 * Check version of a specific service
 */
async function checkServiceVersion(serviceName, serviceUrl) {
  try {
    const response = await axios.get(`${serviceUrl}/api/version`, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Version-Monitor/1.0'
      }
    });

    return {
      service: serviceName,
      url: serviceUrl,
      status: 'online',
      version: response.data.version || response.data,
      headers: {
        apiVersion: response.headers['x-api-version'],
        expectedVersion: response.headers['x-expected-version']
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    // Try alternative endpoints
    if (serviceName === 'frontend') {
      try {
        const htmlResponse = await axios.get(serviceUrl, { timeout: 5000 });
        const versionMatch = htmlResponse.data.match(/VERSION:\s*['"]([^'"]+)['"]/);
        const displayMatch = htmlResponse.data.match(/v([\d.]+)<\/span>/);
        
        return {
          service: serviceName,
          url: serviceUrl,
          status: 'online',
          version: versionMatch ? versionMatch[1] : (displayMatch ? displayMatch[1] : 'unknown'),
          source: 'html-parse',
          timestamp: new Date().toISOString()
        };
      } catch (e) {}
    }

    return {
      service: serviceName,
      url: serviceUrl,
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * GET /api/version
 * Returns current service version
 */
router.get('/version', (req, res) => {
  const packageVersion = require('../package.json').version;
  res.json({
    version: packageVersion,
    service: 'sales-tracker-api',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/version/health
 * Detailed version health check
 */
router.get('/version/health', versionHealthHandler);

/**
 * GET /api/version/monitor
 * Check versions across all services
 */
router.get('/version/monitor', async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  try {
    // Get expected version from VERSION file
    const versionFile = path.join(__dirname, '../../VERSION');
    const expectedVersion = fs.readFileSync(versionFile, 'utf8').split('\n')[0].trim();

    // Check all services
    const serviceChecks = await Promise.all([
      checkServiceVersion('frontend', SERVICES.frontend),
      checkServiceVersion('api', SERVICES.api)
    ]);

    // Add current backend version
    serviceChecks.push({
      service: 'backend-current',
      version: require('../package.json').version,
      status: 'online',
      timestamp: new Date().toISOString()
    });

    // Analyze results
    const versions = serviceChecks.map(s => s.version).filter(v => v && v !== 'unknown');
    const uniqueVersions = [...new Set(versions)];
    const allMatch = uniqueVersions.length === 1 && uniqueVersions[0] === expectedVersion;

    const summary = {
      status: allMatch ? 'healthy' : 'warning',
      expectedVersion,
      services: serviceChecks,
      analysis: {
        totalServices: serviceChecks.length,
        onlineServices: serviceChecks.filter(s => s.status === 'online').length,
        uniqueVersions: uniqueVersions.length,
        versions: uniqueVersions,
        synchronized: allMatch
      },
      timestamp: new Date().toISOString()
    };

    if (!allMatch) {
      summary.warnings = [];
      serviceChecks.forEach(service => {
        if (service.version && service.version !== expectedVersion) {
          summary.warnings.push(
            `${service.service}: version ${service.version} differs from expected ${expectedVersion}`
          );
        }
      });
    }

    res.status(allMatch ? 200 : 503).json(summary);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/version/sync
 * Trigger version synchronization (admin only)
 */
router.post('/version/sync', async (req, res) => {
  // Simple auth check - in production, use proper authentication
  const authToken = req.headers.authorization;
  if (authToken !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { execSync } = require('child_process');
    const result = execSync('node scripts/version-manager.js sync', {
      cwd: path.join(__dirname, '../..')
    }).toString();

    res.json({
      status: 'success',
      message: 'Version synchronization completed',
      output: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;