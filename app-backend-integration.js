// Backend Integration for Glassmorphism UI
// This connects the beautiful UI to the actual backend

// API Configuration
const API_BASE_URL = window.CONFIG ? window.CONFIG.apiBaseUrl : 'http://localhost:10000/api';

// State Management
let currentUser = null;
let activities = [];
let leaderboardData = [];
let teamStats = null;

// Initialize backend connection
async function initializeBackend() {
    console.log('🔌 Connecting to backend:', API_BASE_URL);
    
    try {
        // Check if user is logged in
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            currentUser = JSON.parse(storedUser);
            await loadUserData();
        } else {
            // For demo purposes, create a demo user
            await loginAsDemo();
        }
    } catch (error) {
        console.error('Backend initialization error:', error);
        // Fall back to demo mode
        showDemoMode();
    }
}

// Login as demo user
async function loginAsDemo() {
    try {
        const response = await fetch(`${API_BASE_URL}/demo/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            localStorage.setItem('user', JSON.stringify(currentUser));
            localStorage.setItem('token', data.token);
            await loadUserData();
        } else {
            showDemoMode();
        }
    } catch (error) {
        console.error('Demo login error:', error);
        showDemoMode();
    }
}

// Load user data from backend
async function loadUserData() {
    console.log('📊 Loading user data...');
    
    // Load activities
    await loadActivities();
    
    // Load leaderboard
    await loadLeaderboard();
    
    // Load team stats
    await loadTeamStats();
    
    // Update UI
    updateStatsDisplay();
    updateActivitiesDisplay();
    updateLeaderboardDisplay();
}

// Load activities from backend
async function loadActivities() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/activities`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            activities = data.activities || [];
        }
    } catch (error) {
        console.error('Error loading activities:', error);
    }
}

// Load leaderboard data
async function loadLeaderboard() {
    try {
        const response = await fetch(`${API_BASE_URL}/leaderboard/daily`);
        
        if (response.ok) {
            const data = await response.json();
            leaderboardData = data.leaderboard || [];
        }
    } catch (error) {
        console.error('Error loading leaderboard:', error);
    }
}

// Load team statistics
async function loadTeamStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/team/stats`);
        
        if (response.ok) {
            teamStats = await response.json();
        }
    } catch (error) {
        console.error('Error loading team stats:', error);
    }
}

// Add new activity
async function addActivity(type, description) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/activities`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                type,
                description,
                date: new Date().toISOString()
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            activities.unshift(data.activity);
            updateActivitiesDisplay();
            updateStatsDisplay();
            
            // Show success animation
            showSuccessAnimation();
        }
    } catch (error) {
        console.error('Error adding activity:', error);
        alert('Failed to add activity. Please try again.');
    }
}

// Update stats display
function updateStatsDisplay() {
    if (!currentUser) return;
    
    // Update total points
    const pointsElement = document.querySelector('.stat-value');
    if (pointsElement) {
        pointsElement.textContent = currentUser.totalPoints?.toLocaleString() || '0';
    }
    
    // Update streak
    const streakElements = document.querySelectorAll('.stat-value');
    if (streakElements[1]) {
        streakElements[1].textContent = `${currentUser.currentStreak || 0} days`;
    }
    
    // Update completion rate (calculate from activities)
    const completedActivities = activities.filter(a => a.completed).length;
    const completionRate = activities.length > 0 
        ? Math.round((completedActivities / activities.length) * 100)
        : 0;
    
    if (streakElements[3]) {
        streakElements[3].textContent = `${completionRate}%`;
    }
}

// Update activities display
function updateActivitiesDisplay() {
    const activitiesList = document.getElementById('activities-list');
    if (!activitiesList) return;
    
    activitiesList.innerHTML = '';
    
    // Display recent activities (max 5)
    const recentActivities = activities.slice(0, 5);
    
    recentActivities.forEach(activity => {
        const activityElement = createActivityElement(activity);
        activitiesList.appendChild(activityElement);
    });
    
    // Add empty state if no activities
    if (activities.length === 0) {
        activitiesList.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <i class="fas fa-clipboard-list" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <p>No activities yet. Start tracking your sales activities!</p>
            </div>
        `;
    }
}

// Create activity element
function createActivityElement(activity) {
    const div = document.createElement('div');
    div.className = `activity-item ${activity.completed ? 'activity-completed' : ''}`;
    
    const icon = activity.completed 
        ? '<i class="fas fa-check-circle" style="color: var(--success);"></i>'
        : '<i class="fas fa-clock" style="color: var(--text-muted);"></i>';
    
    const iconBg = activity.completed
        ? 'rgba(16, 185, 129, 0.2)'
        : 'rgba(156, 163, 175, 0.2)';
    
    const timeAgo = getTimeAgo(new Date(activity.date));
    
    div.innerHTML = `
        <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="width: 2.5rem; height: 2.5rem; border-radius: 50%; background: ${iconBg}; display: flex; align-items: center; justify-content: center;">
                ${icon}
            </div>
            <div style="flex: 1;">
                <div style="font-weight: 500;">${activity.description || activity.type}</div>
                <div style="font-size: 0.875rem; color: var(--text-muted);">${timeAgo}</div>
            </div>
            <div style="text-align: right;">
                <div style="font-weight: 600; color: var(--primary);">+${activity.points}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">points</div>
            </div>
        </div>
    `;
    
    // Add click handler
    div.addEventListener('click', () => {
        if (!activity.completed) {
            completeActivity(activity.id);
        }
    });
    
    return div;
}

// Update leaderboard display
function updateLeaderboardDisplay() {
    const leaderboardList = document.getElementById('leaderboard-list');
    if (!leaderboardList) return;
    
    leaderboardList.innerHTML = '';
    
    // Display top 5 users
    const topUsers = leaderboardData.slice(0, 5);
    
    topUsers.forEach((user, index) => {
        const leaderboardElement = createLeaderboardElement(user, index + 1);
        leaderboardList.appendChild(leaderboardElement);
    });
    
    // Add empty state if no data
    if (leaderboardData.length === 0) {
        leaderboardList.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <i class="fas fa-trophy" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <p>No leaderboard data available yet.</p>
            </div>
        `;
    }
}

// Create leaderboard element
function createLeaderboardElement(user, rank) {
    const div = document.createElement('div');
    div.className = 'leaderboard-item';
    
    const rankClass = rank <= 3 ? `rank-${rank}` : '';
    const initials = getInitials(user.displayName);
    const trend = user.previousRank && user.previousRank > rank ? '↑' : '↓';
    const trendColor = trend === '↑' ? 'var(--success)' : 'var(--danger)';
    
    div.innerHTML = `
        <div class="rank-badge ${rankClass}">${rank}</div>
        <div style="width: 2.5rem; height: 2.5rem; border-radius: 50%; background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.875rem;">
            ${user.pictureUrl ? `<img src="${user.pictureUrl}" style="width: 100%; height: 100%; border-radius: 50%;">` : initials}
        </div>
        <div style="flex: 1;">
            <div style="font-weight: 500;">${user.displayName}</div>
            <div style="font-size: 0.875rem; color: var(--text-muted);">${user.points} points</div>
        </div>
        ${user.previousRank ? `<div style="color: ${trendColor}; font-size: 0.875rem;">${trend}</div>` : ''}
    `;
    
    return div;
}

// Complete an activity
async function completeActivity(activityId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/activities/${activityId}/complete`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            // Update local state
            const activity = activities.find(a => a.id === activityId);
            if (activity) {
                activity.completed = true;
            }
            
            // Reload data
            await loadUserData();
            
            // Show success animation
            showSuccessAnimation();
        }
    } catch (error) {
        console.error('Error completing activity:', error);
    }
}

// Show add activity modal
function showAddActivityModal() {
    // Create modal HTML
    const modalHtml = `
        <div class="modal-backdrop" id="add-activity-modal">
            <div class="modal-content">
                <h2 style="margin-bottom: 1.5rem;">Add New Activity</h2>
                
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; color: var(--text-secondary);">Activity Type</label>
                    <select id="activity-type" class="glass-input" style="width: 100%; padding: 0.75rem; background: var(--glass-white-5); border: 1px solid var(--glass-border); border-radius: 0.5rem; color: var(--text-primary);">
                        <option value="call">Phone Call (20 points)</option>
                        <option value="email">Email (10 points)</option>
                        <option value="meeting">Meeting (50 points)</option>
                        <option value="proposal">Proposal (30 points)</option>
                        <option value="demo">Demo (40 points)</option>
                        <option value="deal">Deal Closed (100 points)</option>
                    </select>
                </div>
                
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; color: var(--text-secondary);">Description</label>
                    <input type="text" id="activity-description" class="glass-input" placeholder="Enter activity details..." style="width: 100%; padding: 0.75rem; background: var(--glass-white-5); border: 1px solid var(--glass-border); border-radius: 0.5rem; color: var(--text-primary);">
                </div>
                
                <div style="display: flex; gap: 1rem;">
                    <button class="btn btn-primary" onclick="submitActivity()" style="flex: 1;">
                        <i class="fas fa-plus"></i>
                        Add Activity
                    </button>
                    <button class="btn btn-glass" onclick="closeModal('add-activity-modal')" style="flex: 1;">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Show modal with animation
    setTimeout(() => {
        document.getElementById('add-activity-modal').classList.add('show');
    }, 10);
}

// Submit new activity
async function submitActivity() {
    const type = document.getElementById('activity-type').value;
    const description = document.getElementById('activity-description').value;
    
    if (!description.trim()) {
        alert('Please enter a description for the activity.');
        return;
    }
    
    await addActivity(type, description);
    closeModal('add-activity-modal');
}

// Close modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

// Show success animation
function showSuccessAnimation() {
    // Create confetti or success indicator
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--success);
        color: white;
        padding: 1rem 2rem;
        border-radius: 0.5rem;
        font-weight: 500;
        z-index: 2000;
        animation: successPop 0.5s ease-out;
    `;
    successDiv.innerHTML = '<i class="fas fa-check-circle"></i> Success!';
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        successDiv.remove();
    }, 2000);
}

// Utility functions
function getTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
}

function getInitials(name) {
    return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

// Show demo mode
function showDemoMode() {
    console.log('📱 Running in demo mode');
    
    // Use demo data
    currentUser = {
        id: 'demo',
        displayName: 'Demo User',
        totalPoints: 3250,
        currentStreak: 15,
        level: 12
    };
    
    activities = [
        { id: 1, type: 'meeting', description: 'Client Meeting', points: 50, completed: true, date: new Date(Date.now() - 2 * 60 * 60 * 1000) },
        { id: 2, type: 'proposal', description: 'Proposal Sent', points: 30, completed: true, date: new Date(Date.now() - 4 * 60 * 60 * 1000) },
        { id: 3, type: 'call', description: 'Follow-up Call', points: 20, completed: false, date: new Date() },
        { id: 4, type: 'deal', description: 'Contract Signed', points: 100, completed: true, date: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    ];
    
    leaderboardData = [
        { displayName: 'Sarah Chen', points: 1250, previousRank: 2 },
        { displayName: 'Mike Johnson', points: 1180, previousRank: 1 },
        { displayName: 'Emily Davis', points: 950, previousRank: 4 },
        { displayName: 'Alex Kim', points: 880, previousRank: 3 }
    ];
    
    // Update displays
    updateStatsDisplay();
    updateActivitiesDisplay();
    updateLeaderboardDisplay();
}

// Override the showAddActivity function to use modal
window.showAddActivity = showAddActivityModal;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeBackend);
} else {
    initializeBackend();
}

// Export for debugging
window.backendAPI = {
    addActivity,
    loadActivities,
    loadLeaderboard,
    currentUser,
    activities,
    leaderboardData
};