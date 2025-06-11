const CONFIG = {
    liffId: '2007552096-wrG1aV9p', // Production LIFF ID
    apiBaseUrl: 'https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/api', // GCP Production API URL
    teamId: null, // Will be set automatically from group chat
    VERSION: '3.6.5' // Current version
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    window.CONFIG = CONFIG;
} 