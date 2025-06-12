// Finnergy Tracker Pro - Next Gen App
const LIFF_ID = '2007552096-wrG1aV9p'; // Using existing LIFF ID
const API_URL = 'https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com'; // Using existing backend

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
let streakData = {
    currentStreak: 0,
    longestStreak: 0,
    lastActivityDate: null
};

// Initialize App
async function initializeApp() {
    try {
        // Check if we're coming back from LINE login with auth code
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        
        if (code && state) {
            // We're returning from LINE login, redirect to the official LIFF URL
            window.location.href = `https://liff.line.me/${LIFF_ID}?code=${code}&state=${state}`;
            return;
        }
        
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
        // Show login screen with option to use without LINE
        showLoginScreen();
        
        // Add a demo mode button
        const loginScreen = document.getElementById('loginScreen');
        if (!document.getElementById('demoButton')) {
            const demoBtn = document.createElement('button');
            demoBtn.id = 'demoButton';
            demoBtn.className = 'w-full py-3 px-6 rounded-xl glass hover:bg-white/10 transition-colors font-semibold mt-4';
            demoBtn.textContent = 'Try Demo Mode';
            demoBtn.onclick = () => {
                showMainApp();
                mockUserData();
            };
            loginScreen.querySelector('.glass').appendChild(demoBtn);
        }
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
    
    // Mock activities with more historical data for heatmap
    activities = [];
    const activityTypes = ['meeting', 'phone', 'quote', 'present', 'training'];
    
    // Generate random activities for the past 60 days
    for (let i = 0; i < 60; i++) {
        const daysAgo = Math.floor(Math.random() * 90);
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        date.setHours(Math.floor(Math.random() * 12) + 8); // 8 AM to 8 PM
        
        const type = activityTypes[Math.floor(Math.random() * activityTypes.length)];
        const activityType = ACTIVITY_TYPES.find(t => t.id === type);
        
        activities.push({
            type: type,
            points: activityType.points * (Math.floor(Math.random() * 3) + 1),
            timestamp: date.toISOString()
        });
    }
    
    // Add today's activities
    activities.push(
        { type: 'meeting', points: 50, timestamp: new Date().toISOString() },
        { type: 'phone', points: 40, timestamp: new Date().toISOString() }
    );
    
    // Sort by timestamp
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    renderRecentActivities();
    generateHeatmap();
    
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
    updateStreak();
    generateHeatmap();
    
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
    updateStreak();
    generateHeatmap();
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
    try {
        const response = await fetch(`${API_URL}/api/activities`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.userId,
                type: activity.type,
                points: activity.points,
                quantity: activity.quantity,
                timestamp: activity.timestamp
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to save activity');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Failed to save activity:', error);
        throw error;
    }
}

async function loadUserData() {
    // Load streak data from localStorage
    try {
        const savedStreak = localStorage.getItem('streakData');
        if (savedStreak) {
            streakData = JSON.parse(savedStreak);
            document.getElementById('currentStreak').textContent = streakData.currentStreak;
            document.getElementById('longestStreak').textContent = streakData.longestStreak;
        }
    } catch (e) {
        console.log('Could not load streak data');
    }
    
    try {
        // Register/update user
        const userResponse = await fetch(`${API_URL}/api/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.userId,
                name: currentUser.displayName,
                pictureUrl: currentUser.pictureUrl
            })
        });
        
        if (userResponse.ok) {
            const userData = await userResponse.json();
            
            // Update UI with user info
            document.getElementById('userName').textContent = currentUser.displayName;
            document.getElementById('userAvatar').src = currentUser.pictureUrl;
            document.getElementById('userAvatar').classList.remove('hidden');
            
            // Load activities
            const activitiesResponse = await fetch(`${API_URL}/api/activities?userId=${currentUser.userId}`);
            if (activitiesResponse.ok) {
                const data = await activitiesResponse.json();
                activities = data.activities || [];
                renderRecentActivities();
                updateStreakCalendar();
                generateHeatmap();
                
                // Calculate today's points
                const today = new Date().toDateString();
                const todayPoints = activities
                    .filter(a => new Date(a.timestamp).toDateString() === today)
                    .reduce((sum, a) => sum + a.points, 0);
                
                // Calculate week points
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                const weekPoints = activities
                    .filter(a => new Date(a.timestamp) >= weekAgo)
                    .reduce((sum, a) => sum + a.points, 0);
                
                updateStats({
                    todayPoints,
                    weekPoints,
                    goalProgress: Math.min(100, Math.round((todayPoints / 300) * 100)),
                    userRank: userData.rank || '-'
                });
            }
            
            // Load leaderboard
            const leaderboardResponse = await fetch(`${API_URL}/api/leaderboard/weekly`);
            if (leaderboardResponse.ok) {
                const leaderboard = await leaderboardResponse.json();
                renderLeaderboard(leaderboard.map((user, index) => ({
                    name: user.name,
                    points: user.points,
                    rank: index + 1,
                    isCurrentUser: user.userId === currentUser.userId
                })));
            }
        }
    } catch (error) {
        console.error('Failed to load user data:', error);
        // Fallback to mock data if API fails
        mockUserData();
    }
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

// Streak Management
function updateStreak() {
    const today = new Date().toDateString();
    const lastDate = streakData.lastActivityDate ? new Date(streakData.lastActivityDate).toDateString() : null;
    
    if (!lastDate) {
        // First activity ever
        streakData.currentStreak = 1;
        streakData.longestStreak = 1;
    } else if (lastDate === today) {
        // Already logged today, no change
        return;
    } else {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (lastDate === yesterday.toDateString()) {
            // Consecutive day!
            streakData.currentStreak++;
            if (streakData.currentStreak > streakData.longestStreak) {
                streakData.longestStreak = streakData.currentStreak;
            }
        } else {
            // Streak broken
            streakData.currentStreak = 1;
        }
    }
    
    streakData.lastActivityDate = new Date().toISOString();
    
    // Update UI
    document.getElementById('currentStreak').textContent = streakData.currentStreak;
    document.getElementById('longestStreak').textContent = streakData.longestStreak;
    
    // Update mini calendar
    updateStreakCalendar();
    
    // Save to localStorage
    try {
        localStorage.setItem('streakData', JSON.stringify(streakData));
    } catch (e) {
        console.log('Could not save streak data');
    }
    
    // Show streak animation for milestones
    if (streakData.currentStreak % 7 === 0) {
        showStreakMilestone();
    }
}

function updateStreakCalendar() {
    const calendar = document.getElementById('streakCalendar');
    const days = [];
    const today = new Date();
    
    // Show last 7 days
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toDateString();
        
        // Check if there was activity on this day
        const hasActivity = activities.some(act => {
            const actDate = new Date(act.timestamp).toDateString();
            return actDate === dateStr;
        });
        
        days.push(`
            <div class="w-6 h-6 rounded ${hasActivity ? 'bg-violet-500' : 'bg-gray-700'} ${i === 0 && hasActivity ? 'ring-2 ring-violet-400' : ''}"></div>
        `);
    }
    
    calendar.innerHTML = days.join('');
}

function showStreakMilestone() {
    const toast = document.createElement('div');
    toast.className = 'fixed top-20 left-1/2 -translate-x-1/2 glass rounded-full px-8 py-4 neon-glow z-50';
    toast.innerHTML = `
        <div class="flex items-center space-x-3">
            <span class="text-3xl">🔥</span>
            <div>
                <p class="text-lg font-bold">${streakData.currentStreak} Day Streak!</p>
                <p class="text-sm text-gray-400">Keep up the great work!</p>
            </div>
        </div>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.transition = 'opacity 0.5s, transform 0.5s';
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-20px)';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// Heatmap Functions
function generateHeatmap() {
    const grid = document.getElementById('heatmapGrid');
    const today = new Date();
    const days = 90; // Show last 90 days
    const weeks = Math.ceil(days / 7);
    
    // Create a map of date -> points
    const activityMap = {};
    activities.forEach(activity => {
        const date = new Date(activity.timestamp).toDateString();
        activityMap[date] = (activityMap[date] || 0) + activity.points;
    });
    
    // Find max points for scaling
    const maxPoints = Math.max(...Object.values(activityMap), 1);
    
    // Create grid HTML
    let html = '<div class="grid grid-flow-col gap-1">';
    
    // Add day labels
    html += '<div class="grid grid-rows-7 gap-1 mr-2 text-xs text-gray-500">';
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((day, i) => {
        html += `<div class="h-3 flex items-center ${i % 2 === 1 ? '' : 'opacity-0'}">${day}</div>`;
    });
    html += '</div>';
    
    // Generate cells for each week
    for (let week = weeks - 1; week >= 0; week--) {
        html += '<div class="grid grid-rows-7 gap-1">';
        
        for (let day = 0; day < 7; day++) {
            const date = new Date(today);
            date.setDate(date.getDate() - (week * 7 + (6 - day)));
            
            // Skip future dates
            if (date > today) {
                html += '<div class="w-3 h-3"></div>';
                continue;
            }
            
            const dateStr = date.toDateString();
            const points = activityMap[dateStr] || 0;
            const intensity = getIntensityLevel(points, maxPoints);
            const color = getHeatmapColor(intensity);
            
            html += `
                <div class="w-3 h-3 rounded cursor-pointer transition-all hover:scale-125 ${color}"
                     data-date="${dateStr}"
                     data-points="${points}"
                     title="${date.toLocaleDateString()}: ${points} points">
                </div>
            `;
        }
        
        html += '</div>';
    }
    
    html += '</div>';
    grid.innerHTML = html;
    
    // Add hover tooltips
    grid.querySelectorAll('[data-date]').forEach(cell => {
        cell.addEventListener('mouseenter', showHeatmapTooltip);
        cell.addEventListener('mouseleave', hideHeatmapTooltip);
        cell.addEventListener('click', showDayActivities);
    });
}

function getIntensityLevel(points, maxPoints) {
    if (points === 0) return 0;
    const ratio = points / maxPoints;
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
}

function getHeatmapColor(intensity) {
    const colors = [
        'bg-gray-700',      // 0 - no activity
        'bg-violet-900',    // 1 - low
        'bg-violet-700',    // 2 - medium
        'bg-violet-500',    // 3 - high
        'bg-violet-300'     // 4 - very high
    ];
    return colors[intensity];
}

let tooltipTimeout;
function showHeatmapTooltip(event) {
    const cell = event.target;
    const date = new Date(cell.dataset.date);
    const points = parseInt(cell.dataset.points);
    
    // Clear any existing timeout
    clearTimeout(tooltipTimeout);
    
    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'absolute z-50 glass rounded-lg px-3 py-2 text-sm pointer-events-none';
    tooltip.innerHTML = `
        <p class="font-semibold">${date.toLocaleDateString()}</p>
        <p class="text-xs">${points} points</p>
    `;
    
    // Position tooltip
    const rect = cell.getBoundingClientRect();
    tooltip.style.left = `${rect.left + window.scrollX}px`;
    tooltip.style.top = `${rect.top + window.scrollY - 50}px`;
    
    document.body.appendChild(tooltip);
    cell.heatmapTooltip = tooltip;
}

function hideHeatmapTooltip(event) {
    const tooltip = event.target.heatmapTooltip;
    if (tooltip) {
        tooltipTimeout = setTimeout(() => {
            tooltip.remove();
        }, 100);
    }
}

function showDayActivities(event) {
    const date = event.target.dataset.date;
    const dayActivities = activities.filter(act => 
        new Date(act.timestamp).toDateString() === date
    );
    
    if (dayActivities.length === 0) {
        showToast('No activities on this day');
        return;
    }
    
    // Create modal to show activities
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50';
    modal.innerHTML = `
        <div class="glass rounded-3xl p-6 max-w-md w-full space-y-4">
            <h3 class="text-xl font-bold">${new Date(date).toLocaleDateString()}</h3>
            <div class="space-y-2 max-h-60 overflow-y-auto">
                ${dayActivities.map(activity => {
                    const type = ACTIVITY_TYPES.find(t => t.id === activity.type);
                    const time = new Date(activity.timestamp).toLocaleTimeString();
                    return `
                        <div class="glass rounded-xl p-3 flex items-center justify-between">
                            <div class="flex items-center space-x-3">
                                <span class="text-xl">${type.emoji}</span>
                                <div>
                                    <p class="font-semibold text-sm">${type.name}</p>
                                    <p class="text-xs text-gray-400">${time}</p>
                                </div>
                            </div>
                            <p class="text-lg font-bold text-violet-400">+${activity.points}</p>
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="flex justify-between items-center">
                <p class="text-sm text-gray-400">Total</p>
                <p class="text-xl font-bold">${dayActivities.reduce((sum, act) => sum + act.points, 0)} points</p>
            </div>
            <button onclick="this.closest('.fixed').remove()" class="w-full py-3 rounded-xl glass hover:bg-white/10 transition-colors">
                Close
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-20 left-1/2 -translate-x-1/2 glass rounded-full px-6 py-3 z-50';
    toast.innerHTML = `<span class="text-sm">${message}</span>`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.transition = 'opacity 0.5s';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 2000);
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initializeApp);