// Finnergy Tracker Pro - Next Gen App
const LIFF_ID = '2007552096-OZ6MNvR8'; // New LIFF ID
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

// Achievements System
const ACHIEVEMENTS = [
    { id: 'first_step', name: 'First Step', description: 'Log your first activity', icon: '👶', unlocked: false, category: 'starter' },
    { id: 'call_master', name: 'Call Master', description: 'Make 10 phone calls', icon: '📞', unlocked: false, category: 'phone', target: 10 },
    { id: 'meeting_pro', name: 'Meeting Pro', description: 'Attend 5 meetings', icon: '🤝', unlocked: false, category: 'meeting', target: 5 },
    { id: 'streak_3', name: 'Getting Started', description: '3-day activity streak', icon: '🔥', unlocked: false, category: 'streak', target: 3 },
    { id: 'streak_7', name: 'Week Warrior', description: '7-day activity streak', icon: '⚡', unlocked: false, category: 'streak', target: 7 },
    { id: 'streak_30', name: 'Unstoppable', description: '30-day activity streak', icon: '💪', unlocked: false, category: 'streak', target: 30 },
    { id: 'early_bird', name: 'Early Bird', description: 'Log activity before 9 AM', icon: '🌅', unlocked: false, category: 'time' },
    { id: 'night_owl', name: 'Night Owl', description: 'Log activity after 6 PM', icon: '🦉', unlocked: false, category: 'time' },
    { id: 'weekend_warrior', name: 'Weekend Warrior', description: 'Work on weekends', icon: '💼', unlocked: false, category: 'time' },
    { id: 'century', name: 'Century Club', description: 'Earn 100 points in one day', icon: '💯', unlocked: false, category: 'points', target: 100 },
    { id: 'perfectionist', name: 'Perfectionist', description: 'Complete all activity types', icon: '✨', unlocked: false, category: 'variety' },
    { id: 'social_butterfly', name: 'Social Butterfly', description: '5 collaborations in a day', icon: '🦋', unlocked: false, category: 'collab', target: 5 },
    { id: 'presenter', name: 'Master Presenter', description: 'Give 3 presentations', icon: '🎯', unlocked: false, category: 'present', target: 3 },
    { id: 'learner', name: 'Lifelong Learner', description: 'Complete 5 training sessions', icon: '🎓', unlocked: false, category: 'training', target: 5 },
    { id: 'closer', name: 'Deal Closer', description: 'Close 10 contracts', icon: '📝', unlocked: false, category: 'contract', target: 10 },
    { id: 'quota_crusher', name: 'Quota Crusher', description: '20 quotations in a week', icon: '📋', unlocked: false, category: 'quote', target: 20 },
    { id: 'top_performer', name: 'Top Performer', description: 'Reach #1 on leaderboard', icon: '👑', unlocked: false, category: 'rank' },
    { id: 'team_player', name: 'Team Player', description: 'Help team reach 1000 points', icon: '🤝', unlocked: false, category: 'team', target: 1000 },
    { id: 'consistency', name: 'Mr. Consistent', description: 'Same activity 5 days in a row', icon: '🎯', unlocked: false, category: 'pattern' },
    { id: 'legend', name: 'Sales Legend', description: 'Unlock all other achievements', icon: '🏆', unlocked: false, category: 'master' }
];

let userAchievements = [...ACHIEVEMENTS];
let activityCounts = {};
let totalPoints = 0;

// Initialize App
async function initializeApp() {
    console.log('initializeApp called');
    
    // Check if we're accessing from GitHub Pages directly
    const isGitHubPages = window.location.hostname === 'kri-ruj.github.io';
    
    if (isGitHubPages) {
        console.log('GitHub Pages detected - starting in demo mode');
        showMainApp();
        mockUserData();
        return;
    }
    
    try {
        // Check if LIFF is available
        if (typeof liff === 'undefined') {
            throw new Error('LIFF SDK not loaded. Please check your internet connection.');
        }
        
        console.log('LIFF SDK is available');
        
        console.log('Initializing LIFF with ID:', LIFF_ID);
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
    
    // Initialize new features
    renderAchievements();
    renderSmartSuggestions();
    renderLiveLeaderboard();
    updateChallengeTimer();
    
    // Set up live updates
    setInterval(renderLiveLeaderboard, 30000); // Update every 30 seconds
    setInterval(updateChallengeTimer, 60000); // Update timer every minute
    setInterval(renderSmartSuggestions, 300000); // Refresh suggestions every 5 minutes
    
    // Check achievements for existing activities
    activities.forEach(activity => {
        activityCounts[activity.type] = (activityCounts[activity.type] || 0) + 1;
        totalPoints += activity.points;
    });
    checkAchievements({ type: 'init', points: 0, timestamp: new Date().toISOString() });
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
    
    // Check for new achievements
    checkAchievements(activity);
    
    // Refresh smart suggestions
    renderSmartSuggestions();
    
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
    
    // Check for new achievements
    checkAchievements(activityData);
    
    // Refresh smart suggestions
    renderSmartSuggestions();
    
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

// Achievement System Functions
function renderAchievements() {
    const container = document.getElementById('achievementBadges');
    const unlocked = userAchievements.filter(a => a.unlocked).length;
    
    document.getElementById('achievementProgress').textContent = `${unlocked} / ${userAchievements.length} unlocked`;
    
    container.innerHTML = userAchievements.slice(0, 16).map(achievement => {
        return `
            <div class="relative group">
                <div class="w-14 h-14 rounded-xl ${achievement.unlocked ? 'glass neon-glow' : 'bg-gray-800'} 
                     flex items-center justify-center cursor-pointer transition-all hover:scale-110 
                     ${achievement.unlocked ? 'animate-pulse' : 'opacity-50'}">
                    <span class="text-2xl">${achievement.icon}</span>
                </div>
                <div class="absolute bottom-16 left-1/2 -translate-x-1/2 bg-black/90 text-white px-3 py-2 rounded-lg 
                     text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap">
                    <p class="font-semibold">${achievement.name}</p>
                    <p class="text-gray-300">${achievement.description}</p>
                </div>
            </div>
        `;
    }).join('');
}

function checkAchievements(activity) {
    const newUnlocks = [];
    const hour = new Date(activity.timestamp).getHours();
    const day = new Date(activity.timestamp).getDay();
    const today = new Date().toDateString();
    
    // Calculate activity counts
    activityCounts[activity.type] = (activityCounts[activity.type] || 0) + 1;
    totalPoints += activity.points;
    
    // Today's points
    const todayPoints = activities
        .filter(a => new Date(a.timestamp).toDateString() === today)
        .reduce((sum, a) => sum + a.points, 0);
    
    userAchievements.forEach(achievement => {
        if (achievement.unlocked) return;
        
        let shouldUnlock = false;
        
        switch (achievement.id) {
            case 'first_step':
                shouldUnlock = activities.length >= 1;
                break;
            case 'call_master':
                shouldUnlock = activityCounts.phone >= 10;
                break;
            case 'meeting_pro':
                shouldUnlock = activityCounts.meeting >= 5;
                break;
            case 'streak_3':
                shouldUnlock = streakData.currentStreak >= 3;
                break;
            case 'streak_7':
                shouldUnlock = streakData.currentStreak >= 7;
                break;
            case 'streak_30':
                shouldUnlock = streakData.currentStreak >= 30;
                break;
            case 'early_bird':
                shouldUnlock = hour < 9;
                break;
            case 'night_owl':
                shouldUnlock = hour >= 18;
                break;
            case 'weekend_warrior':
                shouldUnlock = day === 0 || day === 6;
                break;
            case 'century':
                shouldUnlock = todayPoints >= 100;
                break;
            case 'perfectionist':
                const uniqueTypes = new Set(activities.map(a => a.type));
                shouldUnlock = uniqueTypes.size >= ACTIVITY_TYPES.length;
                break;
            case 'social_butterfly':
                const todayCollabs = activities.filter(a => 
                    a.type === 'collab' && new Date(a.timestamp).toDateString() === today
                ).length;
                shouldUnlock = todayCollabs >= 5;
                break;
            case 'presenter':
                shouldUnlock = activityCounts.present >= 3;
                break;
            case 'learner':
                shouldUnlock = activityCounts.training >= 5;
                break;
            case 'closer':
                shouldUnlock = activityCounts.contract >= 10;
                break;
            case 'quota_crusher':
                const weekStart = new Date();
                weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                const weekQuotes = activities.filter(a => 
                    a.type === 'quote' && new Date(a.timestamp) >= weekStart
                ).length;
                shouldUnlock = weekQuotes >= 20;
                break;
        }
        
        if (shouldUnlock) {
            achievement.unlocked = true;
            newUnlocks.push(achievement);
        }
    });
    
    // Check legend achievement
    const legendAchievement = userAchievements.find(a => a.id === 'legend');
    if (!legendAchievement.unlocked) {
        const unlockedCount = userAchievements.filter(a => a.unlocked && a.id !== 'legend').length;
        if (unlockedCount === userAchievements.length - 1) {
            legendAchievement.unlocked = true;
            newUnlocks.push(legendAchievement);
        }
    }
    
    // Show achievement unlock animations
    newUnlocks.forEach((achievement, index) => {
        setTimeout(() => showAchievementUnlock(achievement), index * 1000);
    });
    
    if (newUnlocks.length > 0) {
        renderAchievements();
        updateRecentAchievement(newUnlocks[newUnlocks.length - 1]);
    }
}

function showAchievementUnlock(achievement) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50';
    modal.innerHTML = `
        <div class="glass rounded-3xl p-8 max-w-sm w-full text-center space-y-4 achievement-unlock">
            <div class="relative">
                <div class="w-20 h-20 rounded-2xl gradient-bg flex items-center justify-center mx-auto neon-glow animate-bounce">
                    <span class="text-4xl">${achievement.icon}</span>
                </div>
                <div class="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center">
                    <span class="text-sm">✨</span>
                </div>
            </div>
            <div>
                <h3 class="text-2xl font-bold neon-text">Achievement Unlocked!</h3>
                <p class="text-lg font-semibold mt-2">${achievement.name}</p>
                <p class="text-sm text-gray-400">${achievement.description}</p>
            </div>
            <button onclick="this.closest('.fixed').remove()" 
                class="w-full py-3 rounded-xl gradient-bg hover:opacity-90 transition-opacity font-semibold">
                Awesome!
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Auto-close after 5 seconds
    setTimeout(() => {
        if (document.body.contains(modal)) {
            modal.style.transition = 'opacity 0.5s';
            modal.style.opacity = '0';
            setTimeout(() => modal.remove(), 500);
        }
    }, 5000);
}

function updateRecentAchievement(achievement) {
    const container = document.getElementById('recentAchievement');
    document.getElementById('recentBadgeIcon').textContent = achievement.icon;
    document.getElementById('recentBadgeName').textContent = achievement.name;
    document.getElementById('recentBadgeDesc').textContent = achievement.description;
    container.classList.remove('hidden');
}

// Smart Suggestions System
function generateSmartSuggestions() {
    const suggestions = [];
    const hour = new Date().getHours();
    const day = new Date().getDay();
    const today = new Date().toDateString();
    
    // Time-based suggestions
    if (hour < 10) {
        suggestions.push({
            type: 'time',
            icon: '☀️',
            title: 'Good Morning Routine',
            description: 'Start with a planning meeting or check emails',
            action: 'Log Meeting',
            activityType: 'meeting'
        });
    } else if (hour >= 14 && hour < 16) {
        suggestions.push({
            type: 'time',
            icon: '📞',
            title: 'Peak Call Time',
            description: 'Afternoon is perfect for client calls',
            action: 'Make Calls',
            activityType: 'phone'
        });
    }
    
    // Pattern-based suggestions
    const recentActivities = activities.slice(0, 10);
    const commonType = getMostCommonActivity(recentActivities);
    if (commonType && Math.random() > 0.5) {
        const type = ACTIVITY_TYPES.find(t => t.id === commonType);
        suggestions.push({
            type: 'pattern',
            icon: type.emoji,
            title: `You're on a ${type.name} streak!`,
            description: `You've been doing great with ${type.name.toLowerCase()}s`,
            action: `Continue Streak`,
            activityType: commonType
        });
    }
    
    // Goal-based suggestions
    const todayPoints = activities
        .filter(a => new Date(a.timestamp).toDateString() === today)
        .reduce((sum, a) => sum + a.points, 0);
        
    if (todayPoints < 50) {
        suggestions.push({
            type: 'goal',
            icon: '🎯',
            title: 'Boost Your Day',
            description: 'A few more activities to reach your daily goal',
            action: 'Quick Win',
            activityType: 'quote'
        });
    }
    
    // Weekend suggestions
    if (day === 0 || day === 6) {
        suggestions.push({
            type: 'special',
            icon: '💼',
            title: 'Weekend Warrior',
            description: 'Prep for next week with training or planning',
            action: 'Get Ahead',
            activityType: 'training'
        });
    }
    
    return suggestions.slice(0, 3);
}

function getMostCommonActivity(activities) {
    const counts = {};
    activities.forEach(a => {
        counts[a.type] = (counts[a.type] || 0) + 1;
    });
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, null);
}

function renderSmartSuggestions() {
    const container = document.getElementById('smartSuggestions');
    const suggestions = generateSmartSuggestions();
    
    if (suggestions.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 py-4">No suggestions right now. Keep logging activities!</p>';
        return;
    }
    
    container.innerHTML = suggestions.map(suggestion => `
        <div class="glass rounded-xl p-4 activity-card cursor-pointer" onclick="quickAddSuggestion('${suggestion.activityType}')">
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                    <span class="text-2xl">${suggestion.icon}</span>
                    <div>
                        <p class="font-semibold text-sm">${suggestion.title}</p>
                        <p class="text-xs text-gray-400">${suggestion.description}</p>
                    </div>
                </div>
                <button class="px-3 py-1 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs transition-colors">
                    ${suggestion.action}
                </button>
            </div>
        </div>
    `).join('');
}

function quickAddSuggestion(activityType) {
    const activity = ACTIVITY_TYPES.find(t => t.id === activityType);
    if (activity) {
        quickAddActivity(activity);
        renderSmartSuggestions(); // Refresh suggestions
    }
}

// Live Team Competition
function renderLiveLeaderboard() {
    const container = document.getElementById('liveLeaderboard');
    
    // Mock live data with random variations
    const liveLeaders = [
        { name: 'Sarah Chen', points: 1250 + Math.floor(Math.random() * 100), rank: 1, change: '+2', trend: 'up' },
        { name: 'Mike Rodriguez', points: 1180 + Math.floor(Math.random() * 80), rank: 2, change: '0', trend: 'same' },
        { name: 'Test User', points: 580 + Math.floor(Math.random() * 200), rank: 3, change: '+1', trend: 'up', isCurrentUser: true },
        { name: 'Emma Thompson', points: 720 + Math.floor(Math.random() * 60), rank: 4, change: '-2', trend: 'down' },
        { name: 'David Kim', points: 650 + Math.floor(Math.random() * 40), rank: 5, change: '0', trend: 'same' }
    ];
    
    container.innerHTML = liveLeaders.map(leader => {
        const rankEmoji = leader.rank === 1 ? '🥇' : leader.rank === 2 ? '🥈' : leader.rank === 3 ? '🥉' : '🏅';
        const trendIcon = leader.trend === 'up' ? '↗️' : leader.trend === 'down' ? '↘️' : '→';
        const trendColor = leader.trend === 'up' ? 'text-green-400' : leader.trend === 'down' ? 'text-red-400' : 'text-gray-400';
        const isUser = leader.isCurrentUser;
        
        return `
            <div class="flex items-center justify-between p-3 rounded-xl ${isUser ? 'glass-dark ring-2 ring-violet-500' : 'hover:bg-white/5'} 
                 transition-all duration-300 ${isUser ? 'animate-pulse' : ''}">
                <div class="flex items-center space-x-3">
                    <span class="text-2xl">${rankEmoji}</span>
                    <div>
                        <p class="font-semibold ${isUser ? 'text-violet-400' : ''}">${leader.name}</p>
                        <div class="flex items-center space-x-2">
                            <p class="text-xs text-gray-400">Rank #${leader.rank}</p>
                            <span class="text-xs ${trendColor}">${trendIcon} ${leader.change}</span>
                        </div>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-xl font-bold">${leader.points}</p>
                    <p class="text-xs text-gray-400">points</p>
                </div>
            </div>
        `;
    }).join('');
}

// Update challenge timer
function updateChallengeTimer() {
    const endOfWeek = new Date();
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
    endOfWeek.setHours(23, 59, 59, 999);
    
    const now = new Date();
    const diff = endOfWeek - now;
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    document.getElementById('challengeTimeLeft').textContent = `${days}d ${hours}h`;
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting app initialization...');
    initializeApp().catch(error => {
        console.error('Failed to initialize app:', error);
        // Show error to user
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-4 left-4 right-4 bg-red-600 text-white p-4 rounded-lg z-50';
        errorDiv.innerHTML = `
            <h3 class="font-bold">Initialization Error</h3>
            <p class="text-sm mt-1">${error.message}</p>
            <button onclick="location.reload()" class="mt-2 px-4 py-2 bg-red-800 rounded hover:bg-red-700">
                Reload Page
            </button>
        `;
        document.body.appendChild(errorDiv);
    });
});