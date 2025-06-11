// Prevent redeclaration error
if (typeof window !== 'undefined' && typeof window.CONFIG === 'undefined') {
    window.CONFIG = {
        liffId: '2007552096-wrG1aV9p', // Production LIFF ID
        apiBaseUrl: window.location.hostname === 'localhost' 
            ? 'http://localhost:10000/api' // Local development
            : 'https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/api', // GCP Production API URL - Firestore backend
        teamId: null, // Will be set automatically from group chat
        VERSION: '3.7.12' // Current version - Backend version sync fix
    };
}

// Export for use in other files (Node.js)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        liffId: '2007552096-wrG1aV9p',
        apiBaseUrl: 'http://localhost:10000/api',
        teamId: null,
        VERSION: '3.7.12'
    };
}