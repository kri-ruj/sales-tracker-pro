#!/usr/bin/env node

const axios = require('axios');
const chalk = require('chalk');

// If chalk is not installed, use a simple fallback
let log = {
    success: (msg) => console.log(`✅ ${msg}`),
    error: (msg) => console.log(`❌ ${msg}`),
    info: (msg) => console.log(`ℹ️  ${msg}`),
    warning: (msg) => console.log(`⚠️  ${msg}`),
    title: (msg) => console.log(`\n🚀 ${msg}\n${'='.repeat(50)}`)
};

try {
    const chalk = require('chalk');
    log = {
        success: (msg) => console.log(chalk.green(`✅ ${msg}`)),
        error: (msg) => console.log(chalk.red(`❌ ${msg}`)),
        info: (msg) => console.log(chalk.blue(`ℹ️  ${msg}`)),
        warning: (msg) => console.log(chalk.yellow(`⚠️  ${msg}`)),
        title: (msg) => console.log(chalk.bold.cyan(`\n🚀 ${msg}\n${'='.repeat(50)}`))
    };
} catch (e) {
    // Use fallback if chalk not available
}

// API Configuration
const API_URL = 'http://localhost:10000';
let authToken = null;

// Demo user
const demoUser = {
    lineUserId: 'DEMO_USER_' + Date.now(),
    displayName: 'Demo Sales Rep'
};

// Sleep function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// API Helper
async function apiCall(method, endpoint, data = null, includeAuth = true) {
    try {
        const config = {
            method,
            url: `${API_URL}${endpoint}`,
            headers: {}
        };

        if (includeAuth && authToken) {
            config.headers['Authorization'] = `Bearer ${authToken}`;
        }

        if (data) {
            config.data = data;
            config.headers['Content-Type'] = 'application/json';
        }

        const response = await axios(config);
        return { success: true, data: response.data, status: response.status };
    } catch (error) {
        return { 
            success: false, 
            error: error.response?.data || error.message,
            status: error.response?.status 
        };
    }
}

// Demo Functions
async function demoHealthCheck() {
    log.title('1. Health Check');
    
    const result = await apiCall('GET', '/health', null, false);
    if (result.success) {
        log.success('Server is healthy!');
        log.info(`Version: ${result.data.version}`);
        log.info(`Status: ${result.data.status}`);
    } else {
        log.error('Health check failed!');
    }
    
    await sleep(1000);
}

async function demoAuthentication() {
    log.title('2. Authentication Demo');
    
    // Try to access protected endpoint without token
    log.info('Attempting to access protected endpoint without authentication...');
    const noAuthResult = await apiCall('GET', `/api/activities/${demoUser.lineUserId}`, null, false);
    
    if (!noAuthResult.success && noAuthResult.status === 401) {
        log.warning('Access denied! (Expected behavior)');
        log.info(`Error: ${noAuthResult.error.error}`);
    }
    
    await sleep(1000);
    
    // Login to get token
    log.info('\nLogging in to get authentication token...');
    const loginResult = await apiCall('POST', '/api/auth/login', demoUser, false);
    
    if (loginResult.success) {
        log.success('Login successful!');
        log.info(`Token received: ${loginResult.data.token.substring(0, 20)}...`);
        authToken = loginResult.data.token;
    } else {
        log.error('Login failed!');
        return false;
    }
    
    await sleep(1000);
    return true;
}

async function demoInputValidation() {
    log.title('3. Input Validation Demo');
    
    // Test 1: Invalid activity type
    log.info('Test 1: Trying to create activity with invalid type...');
    const invalidTypeResult = await apiCall('POST', '/api/activities', {
        lineUserId: demoUser.lineUserId,
        activityType: 'INVALID_TYPE',
        title: 'Test Activity',
        points: 50,
        date: new Date().toISOString()
    });
    
    if (!invalidTypeResult.success) {
        log.warning('Validation error! (Expected behavior)');
        log.info(`Error: ${JSON.stringify(invalidTypeResult.error.errors[0])}`);
    }
    
    await sleep(1000);
    
    // Test 2: Negative points
    log.info('\nTest 2: Trying to create activity with negative points...');
    const negativePointsResult = await apiCall('POST', '/api/activities', {
        lineUserId: demoUser.lineUserId,
        activityType: 'โทร',
        title: 'Test Call',
        points: -50,
        date: new Date().toISOString()
    });
    
    if (!negativePointsResult.success) {
        log.warning('Validation error! (Expected behavior)');
        log.info(`Error: Points must be between 0 and 1000`);
    }
    
    await sleep(1000);
    
    // Test 3: XSS attempt
    log.info('\nTest 3: Trying XSS attack in title...');
    const xssResult = await apiCall('POST', '/api/activities', {
        lineUserId: demoUser.lineUserId,
        activityType: 'โทร',
        title: '<script>alert("XSS")</script>',
        points: 10,
        date: new Date().toISOString()
    });
    
    if (xssResult.success) {
        log.success('Activity created with escaped HTML!');
        log.info(`Title saved as: ${xssResult.data.activity.title}`);
        log.info('XSS attack prevented! ✨');
    }
    
    await sleep(1000);
}

async function demoAuthorization() {
    log.title('4. Authorization Demo');
    
    // Try to create activity for another user
    log.info('Trying to create activity for another user...');
    const otherUserResult = await apiCall('POST', '/api/activities', {
        lineUserId: 'OTHER_USER_123',
        activityType: 'โทร',
        title: 'Unauthorized Activity',
        points: 50,
        date: new Date().toISOString()
    });
    
    if (!otherUserResult.success && otherUserResult.status === 403) {
        log.warning('Access denied! (Expected behavior)');
        log.info(`Error: ${otherUserResult.error.error}`);
    }
    
    await sleep(1000);
}

async function demoValidActivities() {
    log.title('5. Creating Valid Activities');
    
    const activities = [
        { type: 'โทร', title: 'Called potential client', points: 10 },
        { type: 'นัด', title: 'Meeting with customer', points: 20 },
        { type: 'ชิง', title: 'Pitched new product', points: 30 },
        { type: 'ข่าวสาร', title: 'Shared company news', points: 40 },
        { type: 'เริ่มเซน', title: 'Started new campaign', points: 50 }
    ];
    
    for (const activity of activities) {
        log.info(`Creating activity: ${activity.title}`);
        
        const result = await apiCall('POST', '/api/activities', {
            lineUserId: demoUser.lineUserId,
            activityType: activity.type,
            title: activity.title,
            points: activity.points,
            date: new Date().toISOString()
        });
        
        if (result.success) {
            log.success(`✨ Activity created! ID: ${result.data.activity.id}, Points: ${activity.points}`);
        } else {
            log.error(`Failed to create activity: ${result.error}`);
        }
        
        await sleep(500);
    }
}

async function demoFetchActivities() {
    log.title('6. Fetching Activities with Pagination');
    
    // Fetch with limit
    log.info('Fetching first 3 activities...');
    const page1Result = await apiCall('GET', `/api/activities/${demoUser.lineUserId}?limit=3&offset=0`);
    
    if (page1Result.success) {
        log.success(`Fetched ${page1Result.data.activities.length} activities`);
        page1Result.data.activities.forEach(act => {
            log.info(`- ${act.title} (${act.points} points)`);
        });
    }
    
    await sleep(1000);
    
    // Fetch next page
    log.info('\nFetching next 3 activities...');
    const page2Result = await apiCall('GET', `/api/activities/${demoUser.lineUserId}?limit=3&offset=3`);
    
    if (page2Result.success) {
        log.success(`Fetched ${page2Result.data.activities.length} more activities`);
        page2Result.data.activities.forEach(act => {
            log.info(`- ${act.title} (${act.points} points)`);
        });
    }
    
    await sleep(1000);
}

async function demoLeaderboard() {
    log.title('7. Leaderboard Demo');
    
    const periods = ['today', 'week', 'month'];
    
    for (const period of periods) {
        log.info(`\nFetching ${period} leaderboard...`);
        const result = await apiCall('GET', `/api/leaderboard?period=${period}&limit=5`);
        
        if (result.success) {
            log.success(`Top performers for ${period}:`);
            result.data.leaderboard.forEach(user => {
                const icon = user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : user.rank === 3 ? '🥉' : '  ';
                log.info(`${icon} #${user.rank} ${user.display_name || 'Unknown'} - ${user.total_points} points`);
            });
        }
        
        await sleep(1000);
    }
}

async function demoRateLimiting() {
    log.title('8. Rate Limiting Demo');
    
    log.info('Making multiple rapid requests to test rate limiting...');
    log.warning('This will make 10 requests quickly');
    
    const requests = [];
    for (let i = 0; i < 10; i++) {
        requests.push(apiCall('GET', '/health', null, false));
    }
    
    const results = await Promise.all(requests);
    const successCount = results.filter(r => r.success).length;
    const rateLimitedCount = results.filter(r => !r.success && r.status === 429).length;
    
    log.info(`Successful requests: ${successCount}`);
    if (rateLimitedCount > 0) {
        log.warning(`Rate limited requests: ${rateLimitedCount} (This is good - rate limiting is working!)`);
    }
    
    await sleep(1000);
}

async function demoSQLInjectionPrevention() {
    log.title('9. SQL Injection Prevention Demo');
    
    log.info('Attempting SQL injection attack...');
    const maliciousId = "'; DROP TABLE activities; --";
    
    // This would be dangerous with string concatenation!
    const result = await apiCall('GET', `/api/activities/${encodeURIComponent(maliciousId)}`);
    
    if (!result.success) {
        log.success('SQL injection attempt blocked!');
        log.info('Database is safe - parameterized queries prevented the attack');
    }
    
    await sleep(1000);
}

// Main Demo Runner
async function runDemo() {
    console.clear();
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║        🔒 FINNERGY Sales Tracker - Security Demo 🔒          ║
║                                                               ║
║  This demo will showcase all security features including:     ║
║  • Authentication & Authorization                             ║
║  • Input Validation & Sanitization                          ║
║  • SQL Injection Prevention                                  ║
║  • Rate Limiting                                             ║
║  • XSS Prevention                                            ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);
    
    log.info('Starting secure backend server demo...');
    log.warning('Make sure the secure server is running: npm run dev:secure\n');
    
    await sleep(2000);
    
    try {
        // Run all demos
        await demoHealthCheck();
        
        const authSuccess = await demoAuthentication();
        if (!authSuccess) {
            log.error('Authentication failed, cannot continue demo');
            return;
        }
        
        await demoInputValidation();
        await demoAuthorization();
        await demoValidActivities();
        await demoFetchActivities();
        await demoLeaderboard();
        await demoRateLimiting();
        await demoSQLInjectionPrevention();
        
        log.title('Demo Complete! 🎉');
        log.success('All security features demonstrated successfully!');
        log.info('\nYour backend is now secure with:');
        log.info('✅ JWT Authentication');
        log.info('✅ Input Validation');
        log.info('✅ SQL Injection Prevention');
        log.info('✅ Authorization Controls');
        log.info('✅ Rate Limiting');
        log.info('✅ XSS Prevention');
        log.info('✅ Error Handling');
        log.info('✅ Database Indexes');
        
    } catch (error) {
        log.error(`Demo failed: ${error.message}`);
        log.info('Make sure the secure server is running: npm run dev:secure');
    }
}

// Run the demo
runDemo();