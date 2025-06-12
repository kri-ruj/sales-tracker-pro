// Finnergy Tracker Pro - Next Gen App
const LIFF_ID = '2007552096-wrG1aV9p'; // Using existing LIFF ID for now
const API_URL = 'https://finnergy-api-v2-dot-salesappfkt.as.r.appspot.com'; // New API URL

// Activity Types with Emojis and Points
const ACTIVITY_TYPES = [
    { id: 'phone', name: 'Phone Call', emoji: '📱', points: 20, color: 'blue' },
    { id: 'meeting', name: 'Meeting', emoji: '🤝', points: 50, color: 'purple' },
    { id: 'quote', name: 'Quotation', emoji: '📋', points: 10, color: 'green' },
    { id: 'collab', name: 'Collaboration', emoji: '👥', points: 15, color: 'orange' },
    { id: 'present', name: 'Presentation', emoji: '📊', points: 30, color: 'red' },
    { id: 'training', name: 'Training', emoji: '🎓', points: 40, color: 'indigo' },
    { id: 'contract', name: 'Contract', emoji: '📄', points: 25, color: 'yellow' },
    { id: 'other', name: 'Other', emoji: '✨', points: 15, color: 'pink' }
];

// App State
let currentUser = null;
let selectedActivity = null;
let selectedQuantity = 1;
let activities = [];

// Initialize App
async function initializeApp() {
    try {
        await liff.init({ liffId: LIFF_ID });
        
        if (liff.isLoggedIn()) {
            const profile = await liff.getProfile();
            currentUser = profile;
            showMainApp();
            await loadUserData();
        } else {
            showLoginScreen();
        }
    } catch (error) {
        console.error('LIFF initialization failed:', error);
        // For development, show app anyway
        showMainApp();
        mockUserData();
    }
}

// Show/Hide Screens
function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').classList.add('hidden');
}

function showMainApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').classList.remove('hidden');
    renderActivityTypes();
    setupEventListeners();
}

// Mock Data for Development
function mockUserData() {
    currentUser = {
        userId: 'mock123',
        displayName: 'Test User',
        pictureUrl: 'https://ui-avatars.com/api/?name=Test+User&background=667eea&color=fff'
    };
    
    document.getElementById('userName').textContent = currentUser.displayName;
    document.getElementById('userAvatar').src = currentUser.pictureUrl;
    document.getElementById('userAvatar').classList.remove('hidden');
    
    // Mock stats
    updateStats({
        todayPoints: 120,
        weekPoints: 580,
        goalProgress: 65,
        userRank: 3
    });
    
    // Mock activities
    activities = [
        { type: 'meeting', points: 50, timestamp: new Date().toISOString() },
        { type: 'phone', points: 40, timestamp: new Date().toISOString() }
    ];
    renderRecentActivities();
    
    // Mock leaderboard
    renderLeaderboard([
        { name: 'Alice Johnson', points: 850, rank: 1 },
        { name: 'Bob Smith', points: 720, rank: 2 },
        { name: 'Test User', points: 580, rank: 3, isCurrentUser: true },
        { name: 'David Lee', points: 450, rank: 4 },
        { name: 'Emma Wilson', points: 320, rank: 5 }
    ]);
}

// Render Activity Types
function renderActivityTypes() {
    const grid = document.getElementById('activityGrid');
    const modalGrid = document.getElementById('modalActivityTypes');
    
    ACTIVITY_TYPES.forEach(activity => {
        // Main grid button
        const button = createActivityButton(activity);
        grid.appendChild(button);
        
        // Modal button
        const modalButton = createActivityButton(activity, true);
        modalGrid.appendChild(modalButton);
    });
}

function createActivityButton(activity, isModal = false) {
    const button = document.createElement('button');
    button.className = `glass rounded-xl p-3 flex flex-col items-center space-y-1 hover:bg-white/10 transition-all activity-card ${isModal ? 'modal-activity' : ''}`;
    button.innerHTML = `
        <span class="text-2xl">${activity.emoji}</span>
        <span class="text-xs">${activity.points}pt</span>
    `;
    
    if (isModal) {
        button.onclick = () => selectActivity(activity);
    } else {
        button.onclick = () => quickAddActivity(activity);
    }
    
    return button;
}

// Activity Selection
function selectActivity(activity) {
    selectedActivity = activity;
    
    // Update UI
    document.querySelectorAll('.modal-activity').forEach(btn => {
        btn.classList.remove('ring-2', 'ring-violet-500');
    });
    event.target.closest('button').classList.add('ring-2', 'ring-violet-500');
    
    updateAddButton();
}

// Quantity Selection
function setupEventListeners() {
    // FAB Button
    document.getElementById('fabButton').onclick = openActivityModal;
    
    // Quantity buttons
    document.querySelectorAll('#quantityButtons button').forEach(btn => {
        btn.onclick = () => {
            selectedQuantity = parseInt(btn.dataset.qty);
            document.querySelectorAll('#quantityButtons button').forEach(b => {
                b.classList.remove('ring-2', 'ring-violet-500');
            });
            btn.classList.add('ring-2', 'ring-violet-500');
            updateAddButton();
        };
    });
    
    // Confirm button
    document.getElementById('confirmAddActivity').onclick = confirmAddActivity;
}

// Update Add Button
function updateAddButton() {
    const button = document.getElementById('confirmAddActivity');
    if (selectedActivity) {
        const totalPoints = selectedActivity.points * selectedQuantity;
        button.textContent = `Add ${totalPoints} Points`;
        button.disabled = false;
    } else {
        button.textContent = 'Add 0 Points';
        button.disabled = true;
    }
}

// Modal Functions
function openActivityModal() {
    document.getElementById('addActivityModal').style.display = 'flex';
    selectedActivity = null;
    selectedQuantity = 1;
    updateAddButton();
}

function closeActivityModal() {
    document.getElementById('addActivityModal').style.display = 'none';
}

// Add Activity
async function confirmAddActivity() {
    if (!selectedActivity) return;
    
    const activity = {
        type: selectedActivity.id,
        points: selectedActivity.points * selectedQuantity,
        quantity: selectedQuantity,
        timestamp: new Date().toISOString()
    };
    
    // Add to local array
    activities.unshift(activity);
    
    // Update UI
    renderRecentActivities();
    updateStatsAfterActivity(activity);
    
    // Close modal
    closeActivityModal();
    
    // Show success animation
    showSuccessAnimation();
    
    // Send to backend (async)
    try {
        await saveActivity(activity);
    } catch (error) {
        console.error('Failed to save activity:', error);
    }
}

// Quick Add Activity
async function quickAddActivity(activity) {
    const activityData = {
        type: activity.id,
        points: activity.points,
        quantity: 1,
        timestamp: new Date().toISOString()
    };
    
    activities.unshift(activityData);
    renderRecentActivities();
    updateStatsAfterActivity(activityData);
    showSuccessAnimation();
    
    try {
        await saveActivity(activityData);
    } catch (error) {
        console.error('Failed to save activity:', error);
    }
}

// Render Recent Activities
function renderRecentActivities() {
    const container = document.getElementById('recentActivities');
    
    if (activities.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 py-8">No activities yet. Start tracking!</p>';
        return;
    }
    
    container.innerHTML = activities.slice(0, 5).map(activity => {
        const type = ACTIVITY_TYPES.find(t => t.id === activity.type);
        const time = new Date(activity.timestamp).toLocaleTimeString();
        
        return `
            <div class="glass rounded-xl p-4 flex items-center justify-between activity-card">
                <div class="flex items-center space-x-3">
                    <span class="text-2xl">${type.emoji}</span>
                    <div>
                        <p class="font-semibold">${type.name}</p>
                        <p class="text-xs text-gray-400">${time}</p>
                    </div>
                </div>
                <p class="text-xl font-bold text-violet-400">+${activity.points}</p>
            </div>
        `;
    }).join('');
}

// Update Stats
function updateStats(stats) {
    document.getElementById('todayPoints').textContent = stats.todayPoints || 0;
    document.getElementById('weekPoints').textContent = stats.weekPoints || 0;
    document.getElementById('goalProgress').textContent = `${stats.goalProgress || 0}%`;
    document.getElementById('userRank').textContent = `#${stats.userRank || '-'}`;
}

function updateStatsAfterActivity(activity) {
    const todayPoints = parseInt(document.getElementById('todayPoints').textContent) + activity.points;
    const weekPoints = parseInt(document.getElementById('weekPoints').textContent) + activity.points;
    const goalProgress = Math.min(100, Math.round((todayPoints / 300) * 100));
    
    updateStats({
        todayPoints,
        weekPoints,
        goalProgress,
        userRank: document.getElementById('userRank').textContent.replace('#', '')
    });
}

// Render Leaderboard
function renderLeaderboard(leaders) {
    const container = document.getElementById('leaderboard');
    
    container.innerHTML = leaders.map(leader => {
        const rankEmoji = leader.rank === 1 ? '🥇' : leader.rank === 2 ? '🥈' : leader.rank === 3 ? '🥉' : '🏅';
        const isUser = leader.isCurrentUser;
        
        return `
            <div class="flex items-center justify-between p-3 rounded-xl ${isUser ? 'glass-dark ring-2 ring-violet-500' : 'hover:bg-white/5'} transition-colors">
                <div class="flex items-center space-x-3">
                    <span class="text-2xl">${rankEmoji}</span>
                    <div>
                        <p class="font-semibold ${isUser ? 'text-violet-400' : ''}">${leader.name}</p>
                        <p class="text-xs text-gray-400">Rank #${leader.rank}</p>
                    </div>
                </div>
                <p class="text-xl font-bold">${leader.points}</p>
            </div>
        `;
    }).join('');
}

// Success Animation
function showSuccessAnimation() {
    const toast = document.createElement('div');
    toast.className = 'fixed top-20 left-1/2 -translate-x-1/2 glass rounded-full px-6 py-3 neon-glow z-50';
    toast.innerHTML = '<span class="text-lg">✨ Activity Added!</span>';
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.transition = 'opacity 0.5s';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 2000);
}

// API Functions
async function saveActivity(activity) {
    // TODO: Implement API call to new backend
    console.log('Saving activity:', activity);
}

async function loadUserData() {
    // TODO: Implement API call to load user data
    mockUserData(); // For now, use mock data
}

// Authentication
async function handleLineLogin() {
    try {
        await liff.login();
    } catch (error) {
        console.error('Login failed:', error);
        alert('Login failed. Please try again.');
    }
}

async function handleLogout() {
    try {
        await liff.logout();
        window.location.reload();
    } catch (error) {
        console.error('Logout failed:', error);
        window.location.reload();
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initializeApp);