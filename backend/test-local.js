// Test if the backend can run locally
console.log('Testing backend startup...');

try {
    // Test if required modules are available
    require('express');
    console.log('✓ Express module found');
    
    require('cors');
    console.log('✓ CORS module found');
    
    // Test if server file exists and can be loaded
    const serverPath = './server-simple.js';
    require(serverPath);
    console.log('✓ server-simple.js loaded successfully');
    
    console.log('\n✅ All checks passed! Backend should work on Render.');
    console.log('\nIf deployment still fails, check:');
    console.log('1. Node version (needs >=18.0.0)');
    console.log('2. Environment variables in Render');
    console.log('3. Build logs in Render dashboard');
    
} catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nThis error needs to be fixed before deployment will work.');
}