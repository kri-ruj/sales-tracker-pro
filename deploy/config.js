const CONFIG = {
    liffId: '2007539402-Mnwlaklq', // Production LIFF ID
    apiBaseUrl: 'https://sales-tracker-backend-vho4.onrender.com/api', // Production API URL
    teamId: null // Will be set automatically from group chat
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    window.CONFIG = CONFIG;
} 