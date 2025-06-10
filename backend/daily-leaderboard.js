// Daily Leaderboard Generator for LINE Flex Messages
const https = require('https');

// Get today's data for leaderboard
function getTodayLeaderboard(activities) {
    // Get Bangkok timezone date
    const bangkokTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' });
    const today = new Date(bangkokTime).toISOString().split('T')[0];
    
    const todayActivities = activities.filter(a => 
        a.timestamp && a.timestamp.split('T')[0] === today
    );
    
    // Group by user
    const userStats = {};
    todayActivities.forEach(entry => {
        const userId = entry.userId;
        
        if (!userStats[userId]) {
            userStats[userId] = {
                userId: userId,
                userName: entry.userName || 'Unknown',
                totalPoints: 0,
                activityCount: 0,
                activities: {}
            };
        }
        
        // Activities are stored as an array in the entry
        if (entry.activities && Array.isArray(entry.activities)) {
            entry.activities.forEach(act => {
                userStats[userId].totalPoints += act.points || 0;
                userStats[userId].activityCount += 1;
                
                // Count activity types
                const type = act.title || act.type;
                if (type) {
                    userStats[userId].activities[type] = 
                        (userStats[userId].activities[type] || 0) + 1;
                }
            });
        }
    });
    
    // Convert to array and sort by points
    return Object.values(userStats)
        .sort((a, b) => b.totalPoints - a.totalPoints)
        .slice(0, 10); // Top 10
}

// Create Flex Message for daily leaderboard
function createDailyLeaderboardFlex(leaderboard, date) {
    const totalPoints = leaderboard.reduce((sum, user) => sum + user.totalPoints, 0);
    const activeUsers = leaderboard.length;
    
    // Create ranking items
    const rankingItems = leaderboard.map((user, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
        const activitySummary = Object.entries(user.activities)
            .map(([type, count]) => `${count}x ${type}`)
            .join(', ');
        
        return {
            "type": "box",
            "layout": "horizontal",
            "contents": [
                {
                    "type": "text",
                    "text": medal,
                    "size": "lg",
                    "flex": 2,
                    "align": "center",
                    "weight": "bold"
                },
                {
                    "type": "box",
                    "layout": "vertical",
                    "flex": 8,
                    "contents": [
                        {
                            "type": "text",
                            "text": user.userName,
                            "size": "sm",
                            "weight": "bold",
                            "color": index === 0 ? "#FFD700" : "#FFFFFF"
                        },
                        {
                            "type": "text",
                            "text": activitySummary,
                            "size": "xxs",
                            "color": "#999999",
                            "wrap": true
                        }
                    ]
                },
                {
                    "type": "text",
                    "text": `${user.totalPoints} pts`,
                    "size": "md",
                    "flex": 3,
                    "align": "end",
                    "weight": "bold",
                    "color": "#FFD700"
                }
            ],
            "margin": "md",
            "paddingAll": "sm",
            "backgroundColor": index % 2 === 0 ? "#1a1a2e" : "#16213e",
            "cornerRadius": "md"
        };
    });
    
    return {
        "type": "flex",
        "altText": `📊 Daily Leaderboard - ${date}`,
        "contents": {
            "type": "bubble",
            "size": "mega",
            "header": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "text",
                        "text": "🏆 DAILY LEADERBOARD",
                        "weight": "bold",
                        "size": "xl",
                        "color": "#FFFFFF",
                        "align": "center"
                    },
                    {
                        "type": "text",
                        "text": date,
                        "size": "sm",
                        "color": "#999999",
                        "align": "center",
                        "margin": "xs"
                    }
                ],
                "backgroundColor": "#0f3460",
                "paddingAll": "lg"
            },
            "body": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "box",
                        "layout": "horizontal",
                        "contents": [
                            {
                                "type": "box",
                                "layout": "vertical",
                                "contents": [
                                    {
                                        "type": "text",
                                        "text": "Active Users",
                                        "size": "xs",
                                        "color": "#999999"
                                    },
                                    {
                                        "type": "text",
                                        "text": activeUsers.toString(),
                                        "size": "xl",
                                        "weight": "bold",
                                        "color": "#4CAF50"
                                    }
                                ],
                                "flex": 1,
                                "alignItems": "center"
                            },
                            {
                                "type": "separator",
                                "margin": "md"
                            },
                            {
                                "type": "box",
                                "layout": "vertical",
                                "contents": [
                                    {
                                        "type": "text",
                                        "text": "Total Points",
                                        "size": "xs",
                                        "color": "#999999"
                                    },
                                    {
                                        "type": "text",
                                        "text": totalPoints.toString(),
                                        "size": "xl",
                                        "weight": "bold",
                                        "color": "#FFD700"
                                    }
                                ],
                                "flex": 1,
                                "alignItems": "center"
                            }
                        ],
                        "margin": "md",
                        "paddingAll": "md",
                        "backgroundColor": "#1a1a2e",
                        "cornerRadius": "md"
                    },
                    {
                        "type": "separator",
                        "margin": "lg"
                    },
                    ...rankingItems
                ],
                "backgroundColor": "#0a0e27",
                "paddingAll": "md"
            },
            "footer": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "button",
                        "action": {
                            "type": "uri",
                            "label": "📱 Open Sales Tracker",
                            "uri": "https://liff.line.me/2007552096"
                        },
                        "style": "primary",
                        "color": "#FFD700",
                        "height": "sm"
                    },
                    {
                        "type": "text",
                        "text": "Keep up the great work! 💪",
                        "size": "sm",
                        "color": "#999999",
                        "align": "center",
                        "margin": "sm"
                    }
                ],
                "backgroundColor": "#0f3460",
                "paddingAll": "md"
            },
            "styles": {
                "header": {
                    "backgroundColor": "#0f3460"
                },
                "body": {
                    "backgroundColor": "#0a0e27"
                },
                "footer": {
                    "backgroundColor": "#0f3460"
                }
            }
        }
    };
}

// Send Flex Message to LINE
async function sendFlexMessage(flexMessage, channelAccessToken, groupId) {
    const data = JSON.stringify({
        to: groupId,
        messages: [flexMessage]
    });

    const options = {
        hostname: 'api.line.me',
        port: 443,
        path: '/v2/bot/message/push',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${channelAccessToken}`,
            'Content-Length': Buffer.byteLength(data)
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log('Daily leaderboard sent successfully');
                    resolve(true);
                } else {
                    console.error('Failed to send daily leaderboard:', res.statusCode, responseData);
                    resolve(false);
                }
            });
        });

        req.on('error', (error) => {
            console.error('Error sending daily leaderboard:', error);
            resolve(false);
        });

        req.write(data);
        req.end();
    });
}

module.exports = {
    getTodayLeaderboard,
    createDailyLeaderboardFlex,
    sendFlexMessage
};