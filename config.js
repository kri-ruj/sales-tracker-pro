// Prevent redeclaration error
if (typeof window !== 'undefined' && typeof window.CONFIG === 'undefined') {
    window.CONFIG = {
        liffId: '2007552096-wrG1aV9p', // Production LIFF ID
        apiBaseUrl: window.location.hostname === 'localhost' 
            ? 'http://localhost:10000/api' // Local development
            : 'https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/api', // GCP Production API URL - Firestore backend
        teamId: null, // Will be set automatically from group chat
        VERSION: '3.7.15', // Current version - Freshket branding update
        googleClientId: '728428181754-2funchcf7d02p0fq8emorlfb3ttjpo3b.apps.googleusercontent.com' // Replace with your Google Client ID
    };
}

// Export for use in other files (Node.js)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        liffId: '2007552096-wrG1aV9p',
        apiBaseUrl: 'http://localhost:10000/api',
        teamId: null,
        VERSION: '3.7.15'
    };
}