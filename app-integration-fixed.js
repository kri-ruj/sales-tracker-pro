// Fixed Backend Integration for Glassmorphism UI
// This properly connects the UI to the backend

// API Configuration
const API_BASE_URL = window.CONFIG ? window.CONFIG.apiBaseUrl : 'http://localhost:10000/api';

// State Management
window.appState = {
    currentUser: null,
    activities: [],
    leaderboardData: [],
    teamStats: null,
    isLoading: false
};

// Override the demo data loading to use real backend
window.loadDemoData = async function() {
    console.log('🔌 Connecting to backend...');
    
    try {
        // Try to login as demo user
        const response = await fetch(`${API_BASE_URL}/demo/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            const data = await response.json();
            window.appState.currentUser = data.user;
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('token', data.token);
            
            // Update UI with real user data
            updateUIWithUserData(data.user);
            
            // Load activities and leaderboard
            await loadActivities();
            await loadLeaderboard();
        } else {
            console.log('Demo login failed, using fallback data');
            useFallbackData();
        }
    } catch (error) {
        console.error('Backend connection error:', error);
        useFallbackData();
    }
};

// Update UI with user data
function updateUIWithUserData(user) {
    // Update points
    const pointsElements = document.querySelectorAll('.stat-value');
    if (pointsElements[0]) {
        pointsElements[0].textContent = (user.totalPoints || 0).toLocaleString();
    }
    
    // Update streak
    if (pointsElements[1]) {
        pointsElements[1].textContent = `${user.currentStreak || 0} days`;
    }
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
            window.appState.activities = data.activities || [];
            updateActivitiesDisplay();
        }
    } catch (error) {
        console.error('Error loading activities:', error);
    }
}

// Load leaderboard
async function loadLeaderboard() {
    try {
        const response = await fetch(`${API_BASE_URL}/leaderboard/daily`);
        
        if (response.ok) {
            const data = await response.json();
            window.appState.leaderboardData = data.leaderboard || [];
            updateLeaderboardDisplay();
        }
    } catch (error) {
        console.error('Error loading leaderboard:', error);
    }
}

// Update activities display
function updateActivitiesDisplay() {
    const activitiesList = document.getElementById('activities-list');
    if (!activitiesList) return;
    
    activitiesList.innerHTML = '';
    
    if (window.appState.activities.length === 0) {
        activitiesList.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <i class="fas fa-clipboard-list" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <p>No activities yet. Click "Add Activity" to start!</p>
            </div>
        `;
        return;
    }
    
    // Show recent activities
    window.appState.activities.slice(0, 5).forEach(activity => {
        const activityElement = createActivityElement(activity);
        activitiesList.appendChild(activityElement);
    });
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
    
    const timeAgo = getTimeAgo(new Date(activity.createdAt || activity.date));
    
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
    
    return div;
}

// Update leaderboard display  
function updateLeaderboardDisplay() {
    const leaderboardList = document.getElementById('leaderboard-list');
    if (!leaderboardList) return;
    
    leaderboardList.innerHTML = '';
    
    if (window.appState.leaderboardData.length === 0) {
        leaderboardList.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <i class="fas fa-trophy" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <p>No leaderboard data yet.</p>
            </div>
        `;
        return;
    }
    
    // Show top users
    window.appState.leaderboardData.slice(0, 5).forEach((user, index) => {
        const leaderboardElement = createLeaderboardElement(user, index + 1);
        leaderboardList.appendChild(leaderboardElement);
    });
}

// Create leaderboard element
function createLeaderboardElement(user, rank) {
    const div = document.createElement('div');
    div.className = 'leaderboard-item';
    
    const rankClass = rank <= 3 ? `rank-${rank}` : '';
    const initials = getInitials(user.displayName || user.name || 'User');
    
    div.innerHTML = `
        <div class="rank-badge ${rankClass}">${rank}</div>
        <div style="width: 2.5rem; height: 2.5rem; border-radius: 50%; background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.875rem;">
            ${user.pictureUrl ? `<img src="${user.pictureUrl}" style="width: 100%; height: 100%; border-radius: 50%;">` : initials}
        </div>
        <div style="flex: 1;">
            <div style="font-weight: 500;">${user.displayName || user.name}</div>
            <div style="font-size: 0.875rem; color: var(--text-muted);">${user.totalPoints || user.points || 0} points</div>
        </div>
    `;
    
    return div;
}

// Show add activity modal
window.showAddActivityModal = function() {
    const modalHtml = `
        <div class="modal-backdrop" id="add-activity-modal">
            <div class="modal-content">
                <h2 style="margin-bottom: 1.5rem;">Add New Activity</h2>
                
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; color: var(--text-secondary);">Activity Type</label>
                    <select id="activity-type" class="glass-input">
                        <option value="call">Phone Call (20 points)</option>
                        <option value="email">Email (10 points)</option>
                        <option value="meeting">Meeting (50 points)</option>
                        <option value="proposal">Proposal (30 points)</option>
                        <option value="demo">Demo (40 points)</option>
                        <option value="followup">Follow-up (15 points)</option>
                        <option value="deal">Deal Closed (100 points)</option>
                    </select>
                </div>
                
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; color: var(--text-secondary);">Description</label>
                    <input type="text" id="activity-description" class="glass-input" placeholder="Enter activity details..." autofocus>
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
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    setTimeout(() => {
        document.getElementById('add-activity-modal').classList.add('show');
        document.getElementById('activity-description').focus();
    }, 10);
    
    // Handle Enter key
    document.getElementById('activity-description').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submitActivity();
        }
    });
};

// Submit activity
window.submitActivity = async function() {
    const type = document.getElementById('activity-type').value;
    const description = document.getElementById('activity-description').value;
    
    if (!description.trim()) {
        alert('Please enter a description for the activity.');
        return;
    }
    
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
            
            // Reload data
            await loadActivities();
            await loadLeaderboard();
            
            // Update points display
            if (window.appState.currentUser) {
                window.appState.currentUser.totalPoints += data.activity.points;
                updateUIWithUserData(window.appState.currentUser);
            }
            
            // Close modal
            closeModal('add-activity-modal');
            
            // Show success
            showSuccess('Activity added successfully!');
        } else {
            throw new Error('Failed to add activity');
        }
    } catch (error) {
        console.error('Error adding activity:', error);
        alert('Failed to add activity. Please try again.');
    }
};

// Close modal
window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
};

// Show success message
function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        background: linear-gradient(135deg, var(--success) 0%, #34d399 100%);
        color: white;
        padding: 1rem 2rem;
        border-radius: 0.5rem;
        font-weight: 500;
        box-shadow: 0 4px 20px rgba(16, 185, 129, 0.3);
        z-index: 2000;
        animation: slideIn 0.3s ease-out;
    `;
    successDiv.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        successDiv.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            successDiv.remove();
        }, 300);
    }, 3000);
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

// Fallback data if backend is not available
function useFallbackData() {
    console.log('Using fallback demo data');
    
    window.user = {
        id: 'demo',
        displayName: 'Demo User',
        totalPoints: 3250,
        currentStreak: 15
    };
    
    window.activities = [
        { id: 1, type: 'meeting', description: 'Client Meeting', points: 50, completed: true, createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
        { id: 2, type: 'proposal', description: 'Proposal Sent', points: 30, completed: true, createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000) },
        { id: 3, type: 'call', description: 'Follow-up Call', points: 20, completed: false, createdAt: new Date() }
    ];
    
    window.appState.activities = window.activities;
    updateActivitiesDisplay();
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🚀 Backend integration loaded');
        // Re-initialize with backend
        loadDemoData();
    });
} else {
    // Already loaded, initialize now
    console.log('🚀 Backend integration loaded (immediate)');
    loadDemoData();
}

// Export for debugging
window.backendAPI = {
    loadActivities,
    loadLeaderboard,
    appState: window.appState
};