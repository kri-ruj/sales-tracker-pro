// Test script for local backend testing
const fetch = require('node-fetch');

const BACKEND_URL = 'http://localhost:10000';

// Test user data
const testUser = {
    userId: 'U1234567890abcdef',
    userName: 'Test User',
    userPicture: 'https://profile.line-scdn.net/test',
    userProfile: {
        displayName: 'Test User',
        pictureUrl: 'https://profile.line-scdn.net/test',
        statusMessage: 'Testing Sales Tracker'
    }
};

// Test activities
const testActivities = [
    { type: 'call', title: 'โทร', points: 10, date: new Date().toISOString().split('T')[0] },
    { type: 'appointment', title: 'นัด', points: 20, date: new Date().toISOString().split('T')[0] },
    { type: 'present', title: 'นำเสนอ', points: 40, date: new Date().toISOString().split('T')[0] }
];

async function testHealthCheck() {
    console.log('Testing health check...');
    try {
        const response = await fetch(`${BACKEND_URL}/health`);
        const data = await response.json();
        console.log('✅ Health check:', data);
    } catch (error) {
        console.error('❌ Health check failed:', error.message);
    }
}

async function testUserLogin() {
    console.log('\nTesting user login...');
    try {
        const response = await fetch(`${BACKEND_URL}/api/user/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: testUser.userId,
                userProfile: testUser.userProfile
            })
        });
        const data = await response.json();
        console.log('✅ User login:', data);
    } catch (error) {
        console.error('❌ User login failed:', error.message);
    }
}

async function testActivitySync() {
    console.log('\nTesting activity sync...');
    try {
        const response = await fetch(`${BACKEND_URL}/api/activities/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: testUser.userId,
                userName: testUser.userName,
                userPicture: testUser.userPicture,
                activities: testActivities
            })
        });
        const data = await response.json();
        console.log('✅ Activity sync:', data);
    } catch (error) {
        console.error('❌ Activity sync failed:', error.message);
    }
}

async function testLeaderboard() {
    console.log('\nTesting leaderboard...');
    try {
        const response = await fetch(`${BACKEND_URL}/api/leaderboard?period=today`);
        const data = await response.json();
        console.log('✅ Leaderboard:', data);
    } catch (error) {
        console.error('❌ Leaderboard failed:', error.message);
    }
}

async function testDashboard() {
    console.log('\nTesting dashboard...');
    try {
        const response = await fetch(`${BACKEND_URL}/api/user/${testUser.userId}/dashboard`);
        const data = await response.json();
        console.log('✅ Dashboard:', data);
    } catch (error) {
        console.error('❌ Dashboard failed:', error.message);
    }
}

async function runAllTests() {
    console.log('🚀 Starting backend tests...\n');
    console.log('Make sure backend is running on port 10000\n');
    
    await testHealthCheck();
    await testUserLogin();
    await testActivitySync();
    await testLeaderboard();
    await testDashboard();
    
    console.log('\n✨ Tests completed!');
}

// Run tests
runAllTests().catch(console.error);