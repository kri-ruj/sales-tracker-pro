// Compact Activity Submission Flex Message Generator
const https = require('https');

// Create COMPACT Flex Message for activity submission (5x smaller height)
function createActivitySubmissionFlex(userName, activities, totalPoints, teamStats, userProfile, todayLeaderboard) {
    // Count activity types
    const activityCounts = {};
    activities.forEach(act => {
        const type = act.title || act.type;
        activityCounts[type] = (activityCounts[type] || 0) + 1;
    });
    
    // Create compact activity summary
    const activitySummary = Object.entries(activityCounts).map(([type, count]) => {
        let emoji = '📍';
        if (type === 'โทร' || type === 'call') emoji = '📞';
        else if (type === 'นัด' || type === 'appointment') emoji = '📅';
        else if (type === 'ฟัง' || type === 'listen') emoji = '👂';
        else if (type === 'นำเสนอ' || type === 'present') emoji = '🤗';
        else if (type === 'เริ่มแผน' || type === 'start_plan') emoji = '💚';
        
        return `${emoji}${count}`;
    }).join(' ');
    
    // Get user rank
    const userRank = todayLeaderboard ? 
        todayLeaderboard.findIndex(u => u.userId === userProfile.userId) + 1 : 0;
    
    // Compact flex message
    const flexMessage = {
        type: "flex",
        altText: `${userName} +${totalPoints}pts ${activitySummary}`,
        contents: {
            type: "bubble",
            size: "nano", // Smallest size
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    // Compact header with user info and points
                    {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            {
                                type: "text",
                                text: userName,
                                size: "sm",
                                weight: "bold",
                                color: "#FFFFFF",
                                flex: 3
                            },
                            {
                                type: "text",
                                text: `+${totalPoints}pts`,
                                size: "sm",
                                weight: "bold",
                                color: "#FFD700",
                                align: "end",
                                flex: 2
                            }
                        ]
                    },
                    // Activity summary in one line
                    {
                        type: "text",
                        text: activitySummary,
                        size: "xs",
                        color: "#CCCCCC",
                        margin: "xs"
                    },
                    // Stats in one line
                    {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            {
                                type: "text",
                                text: userRank > 0 ? `#${userRank}` : "-",
                                size: "xxs",
                                color: "#FFD700",
                                flex: 1
                            },
                            {
                                type: "text",
                                text: `Team: ${teamStats.activeUsers}👥 ${teamStats.totalPoints}pts`,
                                size: "xxs",
                                color: "#AAAAAA",
                                align: "end",
                                flex: 3
                            }
                        ],
                        margin: "sm"
                    }
                ],
                spacing: "xs",
                paddingAll: "md",
                backgroundColor: "#1B1B1B"
            },
            styles: {
                body: {
                    separator: false
                }
            }
        }
    };
    
    return flexMessage;
}

// Send flex message to LINE
async function sendFlexMessage(flexMessage, channelAccessToken, targetId) {
    const data = JSON.stringify({
        to: targetId,
        messages: [flexMessage]
    });

    const options = {
        hostname: 'api.line.me',
        path: '/v2/bot/message/push',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length,
            'Authorization': `Bearer ${channelAccessToken}`
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = '';
            
            res.on('data', (chunk) => {
                body += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve({ success: true });
                } else {
                    console.error('LINE API Error:', res.statusCode, body);
                    reject(new Error(`LINE API Error: ${res.statusCode} - ${body}`));
                }
            });
        });

        req.on('error', (error) => {
            console.error('Request error:', error);
            reject(error);
        });

        req.write(data);
        req.end();
    });
}

module.exports = {
    createActivitySubmissionFlex,
    sendFlexMessage
};