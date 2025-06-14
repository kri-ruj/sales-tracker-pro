// 10X Feature Enhancements for Sales Tracker Pro

// AI-Powered Insights
class AIInsights {
    constructor() {
        this.insights = [];
        this.predictions = {};
    }

    async analyzePerformance(activities, user) {
        // Analyze patterns
        const patterns = this.findPatterns(activities);
        
        // Generate insights
        const insights = {
            bestTimeToCall: this.findBestTime(activities, 'call'),
            mostProductiveDay: this.findMostProductiveDay(activities),
            dealClosingProbability: this.predictDealClosing(activities),
            suggestedActions: this.generateSuggestions(patterns, user)
        };
        
        return insights;
    }

    findPatterns(activities) {
        const patterns = {
            activityTypes: {},
            timePatterns: {},
            clientPatterns: {},
            successRates: {}
        };
        
        activities.forEach(activity => {
            // Count activity types
            patterns.activityTypes[activity.type] = (patterns.activityTypes[activity.type] || 0) + 1;
            
            // Time patterns
            const hour = new Date(activity.createdAt).getHours();
            patterns.timePatterns[hour] = (patterns.timePatterns[hour] || 0) + 1;
            
            // Client patterns
            if (activity.client) {
                patterns.clientPatterns[activity.client] = (patterns.clientPatterns[activity.client] || 0) + 1;
            }
        });
        
        return patterns;
    }

    findBestTime(activities, type) {
        const successfulActivities = activities.filter(a => 
            a.type === type && a.completed && a.outcome === 'successful'
        );
        
        const hourCounts = {};
        successfulActivities.forEach(a => {
            const hour = new Date(a.createdAt).getHours();
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });
        
        const bestHour = Object.entries(hourCounts)
            .sort(([,a], [,b]) => b - a)[0];
        
        return bestHour ? `${bestHour[0]}:00 - ${parseInt(bestHour[0]) + 1}:00` : 'Not enough data';
    }

    findMostProductiveDay(activities) {
        const dayPoints = {};
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        activities.forEach(a => {
            const day = days[new Date(a.createdAt).getDay()];
            dayPoints[day] = (dayPoints[day] || 0) + a.points;
        });
        
        const bestDay = Object.entries(dayPoints)
            .sort(([,a], [,b]) => b - a)[0];
        
        return bestDay ? bestDay[0] : 'Not enough data';
    }

    predictDealClosing(activities) {
        // Simple prediction based on activity patterns
        const recentActivities = activities.slice(0, 10);
        const dealIndicators = ['proposal', 'demo', 'meeting'];
        
        const indicatorCount = recentActivities.filter(a => 
            dealIndicators.includes(a.type)
        ).length;
        
        const probability = Math.min(indicatorCount * 20, 95);
        return `${probability}%`;
    }

    generateSuggestions(patterns, user) {
        const suggestions = [];
        
        // Streak suggestion
        if (user.currentStreak < 7) {
            suggestions.push({
                icon: '🔥',
                text: 'Build your streak! Log activities daily for bonus points',
                priority: 'high'
            });
        }
        
        // Activity balance
        const totalActivities = Object.values(patterns.activityTypes).reduce((a, b) => a + b, 0);
        const callPercentage = (patterns.activityTypes.call || 0) / totalActivities * 100;
        
        if (callPercentage < 20) {
            suggestions.push({
                icon: '📞',
                text: 'Increase phone calls - they have high conversion rates',
                priority: 'medium'
            });
        }
        
        // Time optimization
        const peakHour = Object.entries(patterns.timePatterns)
            .sort(([,a], [,b]) => b - a)[0];
        
        if (peakHour) {
            suggestions.push({
                icon: '⏰',
                text: `Your peak productivity is at ${peakHour[0]}:00. Schedule important tasks then!`,
                priority: 'low'
            });
        }
        
        return suggestions;
    }
}

// Smart Notifications
class SmartNotifications {
    constructor() {
        this.queue = [];
        this.preferences = this.loadPreferences();
    }

    loadPreferences() {
        return JSON.parse(localStorage.getItem('notificationPrefs') || '{}');
    }

    async scheduleNotification(type, data) {
        const notification = {
            id: Date.now(),
            type,
            data,
            scheduledFor: this.calculateOptimalTime(type),
            priority: this.calculatePriority(type, data)
        };
        
        this.queue.push(notification);
        this.processQueue();
    }

    calculateOptimalTime(type) {
        const now = new Date();
        
        switch(type) {
            case 'dailyReminder':
                // 9 AM
                const reminder = new Date(now);
                reminder.setHours(9, 0, 0, 0);
                if (reminder < now) reminder.setDate(reminder.getDate() + 1);
                return reminder;
                
            case 'weeklyReport':
                // Monday 8 AM
                const report = new Date(now);
                report.setHours(8, 0, 0, 0);
                const daysUntilMonday = (8 - report.getDay()) % 7;
                report.setDate(report.getDate() + daysUntilMonday);
                return report;
                
            default:
                return new Date(now.getTime() + 60000); // 1 minute
        }
    }

    calculatePriority(type, data) {
        if (type === 'achievement') return 'high';
        if (type === 'reminder' && data.urgent) return 'high';
        if (type === 'report') return 'low';
        return 'medium';
    }

    processQueue() {
        const now = new Date();
        
        this.queue = this.queue.filter(notification => {
            if (notification.scheduledFor <= now) {
                this.showNotification(notification);
                return false;
            }
            return true;
        });
        
        // Schedule next check
        if (this.queue.length > 0) {
            const nextTime = Math.min(...this.queue.map(n => n.scheduledFor));
            setTimeout(() => this.processQueue(), nextTime - now);
        }
    }

    showNotification(notification) {
        // Browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notification.data.title, {
                body: notification.data.body,
                icon: notification.data.icon,
                badge: notification.data.badge,
                tag: notification.type,
                requireInteraction: notification.priority === 'high'
            });
        }
        
        // In-app notification
        this.showInAppNotification(notification);
    }

    showInAppNotification(notification) {
        const container = document.getElementById('notification-container') || this.createContainer();
        
        const element = document.createElement('div');
        element.className = `notification notification-${notification.priority}`;
        element.innerHTML = `
            <div class="notification-icon">${notification.data.icon || '🔔'}</div>
            <div class="notification-content">
                <div class="notification-title">${notification.data.title}</div>
                <div class="notification-body">${notification.data.body}</div>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        container.appendChild(element);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            element.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => element.remove(), 300);
        }, 10000);
    }

    createContainer() {
        const container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 2000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 400px;
        `;
        document.body.appendChild(container);
        return container;
    }
}

// Advanced Gamification
class AdvancedGamification {
    constructor() {
        this.achievements = this.loadAchievements();
        this.badges = this.loadBadges();
        this.challenges = this.loadChallenges();
    }

    loadAchievements() {
        return [
            { id: 'first_activity', name: 'First Steps', description: 'Complete your first activity', icon: '👣', points: 10 },
            { id: 'week_warrior', name: 'Week Warrior', description: '7-day streak', icon: '🔥', points: 50 },
            { id: 'centurion', name: 'Centurion', description: 'Reach 100 points in a day', icon: '💯', points: 100 },
            { id: 'deal_master', name: 'Deal Master', description: 'Close 5 deals', icon: '💰', points: 200 },
            { id: 'social_butterfly', name: 'Social Butterfly', description: '50 client interactions', icon: '🦋', points: 150 },
            { id: 'email_ninja', name: 'Email Ninja', description: 'Send 100 emails', icon: '🥷', points: 75 },
            { id: 'meeting_maven', name: 'Meeting Maven', description: 'Complete 20 meetings', icon: '🤝', points: 100 },
            { id: 'night_owl', name: 'Night Owl', description: 'Log activities after 10 PM', icon: '🦉', points: 25 },
            { id: 'early_bird', name: 'Early Bird', description: 'Log activities before 7 AM', icon: '🐦', points: 25 },
            { id: 'perfectionist', name: 'Perfectionist', description: '100% completion rate for a week', icon: '✨', points: 150 }
        ];
    }

    loadBadges() {
        return [
            { id: 'bronze', name: 'Bronze', minPoints: 1000, icon: '🥉' },
            { id: 'silver', name: 'Silver', minPoints: 5000, icon: '🥈' },
            { id: 'gold', name: 'Gold', minPoints: 10000, icon: '🥇' },
            { id: 'platinum', name: 'Platinum', minPoints: 25000, icon: '💎' },
            { id: 'diamond', name: 'Diamond', minPoints: 50000, icon: '💠' }
        ];
    }

    loadChallenges() {
        return [
            {
                id: 'daily_hundred',
                name: 'Daily Hundred',
                description: 'Earn 100 points today',
                type: 'daily',
                target: 100,
                reward: 50,
                icon: '🎯'
            },
            {
                id: 'weekly_calls',
                name: 'Call Champion',
                description: 'Make 50 calls this week',
                type: 'weekly',
                target: 50,
                reward: 200,
                icon: '📞'
            },
            {
                id: 'monthly_deals',
                name: 'Deal Destroyer',
                description: 'Close 10 deals this month',
                type: 'monthly',
                target: 10,
                reward: 500,
                icon: '💰'
            }
        ];
    }

    checkAchievements(user, activities) {
        const newAchievements = [];
        const userAchievements = user.achievements || [];
        
        this.achievements.forEach(achievement => {
            if (!userAchievements.includes(achievement.id)) {
                if (this.isAchievementUnlocked(achievement, user, activities)) {
                    newAchievements.push(achievement);
                }
            }
        });
        
        return newAchievements;
    }

    isAchievementUnlocked(achievement, user, activities) {
        switch(achievement.id) {
            case 'first_activity':
                return activities.length > 0;
                
            case 'week_warrior':
                return user.currentStreak >= 7;
                
            case 'centurion':
                const today = new Date().toDateString();
                const todayPoints = activities
                    .filter(a => new Date(a.createdAt).toDateString() === today)
                    .reduce((sum, a) => sum + a.points, 0);
                return todayPoints >= 100;
                
            case 'deal_master':
                return activities.filter(a => a.type === 'deal').length >= 5;
                
            case 'social_butterfly':
                return activities.filter(a => ['call', 'meeting', 'email'].includes(a.type)).length >= 50;
                
            // Add more achievement checks...
            
            default:
                return false;
        }
    }

    getCurrentBadge(totalPoints) {
        let currentBadge = null;
        
        this.badges.forEach(badge => {
            if (totalPoints >= badge.minPoints) {
                currentBadge = badge;
            }
        });
        
        return currentBadge;
    }

    getNextBadge(totalPoints) {
        for (const badge of this.badges) {
            if (totalPoints < badge.minPoints) {
                return {
                    badge,
                    pointsNeeded: badge.minPoints - totalPoints,
                    progress: (totalPoints / badge.minPoints) * 100
                };
            }
        }
        return null;
    }

    getActiveChallenges(user, activities) {
        const now = new Date();
        const activeChallenges = [];
        
        this.challenges.forEach(challenge => {
            const progress = this.calculateChallengeProgress(challenge, activities, now);
            
            if (progress < challenge.target) {
                activeChallenges.push({
                    ...challenge,
                    progress,
                    percentComplete: (progress / challenge.target) * 100,
                    timeRemaining: this.getTimeRemaining(challenge.type, now)
                });
            }
        });
        
        return activeChallenges;
    }

    calculateChallengeProgress(challenge, activities, now) {
        let relevantActivities = [];
        
        switch(challenge.type) {
            case 'daily':
                const today = now.toDateString();
                relevantActivities = activities.filter(a => 
                    new Date(a.createdAt).toDateString() === today
                );
                break;
                
            case 'weekly':
                const weekStart = new Date(now);
                weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                relevantActivities = activities.filter(a => 
                    new Date(a.createdAt) >= weekStart
                );
                break;
                
            case 'monthly':
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                relevantActivities = activities.filter(a => 
                    new Date(a.createdAt) >= monthStart
                );
                break;
        }
        
        if (challenge.id === 'daily_hundred') {
            return relevantActivities.reduce((sum, a) => sum + a.points, 0);
        } else if (challenge.id === 'weekly_calls') {
            return relevantActivities.filter(a => a.type === 'call').length;
        } else if (challenge.id === 'monthly_deals') {
            return relevantActivities.filter(a => a.type === 'deal').length;
        }
        
        return 0;
    }

    getTimeRemaining(type, now) {
        switch(type) {
            case 'daily':
                const endOfDay = new Date(now);
                endOfDay.setHours(23, 59, 59, 999);
                return this.formatTimeRemaining(endOfDay - now);
                
            case 'weekly':
                const endOfWeek = new Date(now);
                endOfWeek.setDate(endOfWeek.getDate() + (6 - endOfWeek.getDay()));
                endOfWeek.setHours(23, 59, 59, 999);
                return this.formatTimeRemaining(endOfWeek - now);
                
            case 'monthly':
                const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                endOfMonth.setHours(23, 59, 59, 999);
                return this.formatTimeRemaining(endOfMonth - now);
        }
    }

    formatTimeRemaining(ms) {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
        return `${hours} hour${hours > 1 ? 's' : ''}`;
    }
}

// Team Collaboration Features
class TeamCollaboration {
    constructor() {
        this.teamMembers = [];
        this.sharedGoals = [];
        this.teamChat = [];
    }

    async loadTeamData() {
        try {
            const response = await fetch(`${API_BASE_URL}/team`);
            const data = await response.json();
            
            this.teamMembers = data.members || [];
            this.sharedGoals = data.goals || [];
            this.teamChat = data.recentMessages || [];
        } catch (error) {
            console.error('Error loading team data:', error);
        }
    }

    createSharedGoal(goal) {
        const sharedGoal = {
            id: Date.now(),
            title: goal.title,
            description: goal.description,
            target: goal.target,
            deadline: goal.deadline,
            participants: goal.participants || [],
            progress: 0,
            createdBy: app.user.id,
            createdAt: new Date().toISOString()
        };
        
        this.sharedGoals.push(sharedGoal);
        this.broadcastToTeam('newGoal', sharedGoal);
        
        return sharedGoal;
    }

    updateGoalProgress(goalId, progress) {
        const goal = this.sharedGoals.find(g => g.id === goalId);
        if (goal) {
            goal.progress = progress;
            
            // Check if goal is completed
            if (progress >= goal.target) {
                this.celebrateGoalCompletion(goal);
            }
            
            this.broadcastToTeam('goalProgress', { goalId, progress });
        }
    }

    celebrateGoalCompletion(goal) {
        // Show celebration animation
        const celebration = document.createElement('div');
        celebration.className = 'team-celebration';
        celebration.innerHTML = `
            <div class="celebration-content">
                <div class="celebration-icon">🎊</div>
                <h2>Team Goal Achieved!</h2>
                <p>${goal.title}</p>
                <div class="celebration-participants">
                    ${goal.participants.map(p => `
                        <img src="https://ui-avatars.com/api/?name=${p.name}" alt="${p.name}">
                    `).join('')}
                </div>
            </div>
        `;
        
        document.body.appendChild(celebration);
        
        // Trigger confetti
        if (window.confetti) {
            confetti({
                particleCount: 200,
                spread: 70,
                origin: { y: 0.6 }
            });
        }
        
        setTimeout(() => celebration.remove(), 5000);
    }

    sendTeamMessage(message) {
        const teamMessage = {
            id: Date.now(),
            userId: app.user.id,
            userName: app.user.displayName,
            message: message,
            timestamp: new Date().toISOString(),
            reactions: []
        };
        
        this.teamChat.push(teamMessage);
        this.broadcastToTeam('newMessage', teamMessage);
        
        return teamMessage;
    }

    addReaction(messageId, reaction) {
        const message = this.teamChat.find(m => m.id === messageId);
        if (message) {
            const existingReaction = message.reactions.find(r => r.emoji === reaction);
            
            if (existingReaction) {
                if (!existingReaction.users.includes(app.user.id)) {
                    existingReaction.users.push(app.user.id);
                    existingReaction.count++;
                }
            } else {
                message.reactions.push({
                    emoji: reaction,
                    users: [app.user.id],
                    count: 1
                });
            }
            
            this.broadcastToTeam('reaction', { messageId, reaction });
        }
    }

    broadcastToTeam(type, data) {
        // In a real app, this would use WebSocket or Server-Sent Events
        if (window.teamSocket && window.teamSocket.readyState === WebSocket.OPEN) {
            window.teamSocket.send(JSON.stringify({
                type: `team:${type}`,
                data: data,
                userId: app.user.id,
                timestamp: new Date().toISOString()
            }));
        }
    }
}

// Export enhanced features
window.EnhancedFeatures = {
    AIInsights,
    SmartNotifications,
    AdvancedGamification,
    TeamCollaboration
};

// Initialize features
window.initializeEnhancedFeatures = function() {
    window.aiInsights = new AIInsights();
    window.smartNotifications = new SmartNotifications();
    window.gamification = new AdvancedGamification();
    window.teamCollab = new TeamCollaboration();
    
    console.log('🚀 10X Features Initialized!');
};