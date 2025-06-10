// Activity Submission Flex Message Generator
const https = require('https');

// Create Flex Message for activity submission
function createActivitySubmissionFlex(userName, activities, totalPoints, teamStats, userProfile, todayLeaderboard) {
    // Count activity types
    const activityCounts = {};
    activities.forEach(act => {
        const type = act.title || act.type;
        activityCounts[type] = (activityCounts[type] || 0) + 1;
    });
    
    // Create activity summary with emojis
    const activityItems = Object.entries(activityCounts).map(([type, count]) => {
        let emoji = '📍';
        if (type === 'โทร' || type === 'call') emoji = '📞';
        else if (type === 'นัด' || type === 'appointment') emoji = '📅';
        else if (type === 'ฟัง' || type === 'listen') emoji = '👂';
        else if (type === 'นำเสนอ' || type === 'present') emoji = '🤗';
        else if (type === 'เริ่มแผน' || type === 'start_plan') emoji = '💚';
        
        return {
            type: "box",
            layout: "horizontal",
            contents: [
                {
                    type: "text",
                    text: emoji,
                    size: "lg",
                    flex: 1,
                    align: "center"
                },
                {
                    type: "text",
                    text: `${count}x ${type}`,
                    size: "md",
                    flex: 4,
                    color: "#FFFFFF"
                },
                {
                    type: "text",
                    text: `+${count * activities.find(a => (a.title || a.type) === type).points} pts`,
                    size: "sm",
                    flex: 2,
                    align: "end",
                    color: "#FFD700"
                }
            ],
            margin: "sm"
        };
    });
    
    // Check for achievements
    const achievements = [];
    if (totalPoints >= 100) {
        achievements.push({
            type: "text",
            text: "🏆 Outstanding Performance! (100+ points)",
            size: "sm",
            color: "#FFD700",
            align: "center",
            margin: "md",
            wrap: true
        });
    }
    
    const hasNewPlan = activities.some(a => 
        a.type === 'start_plan' || a.title === 'เริ่มแผน'
    );
    if (hasNewPlan) {
        achievements.push({
            type: "text",
            text: "💰 New Plan Started! Great job!",
            size: "sm",
            color: "#4CAF50",
            align: "center",
            margin: "sm",
            wrap: true
        });
    }
    
    // Find user's current rank
    let userRank = 0;
    let topPerformer = null;
    if (todayLeaderboard && todayLeaderboard.length > 0) {
        todayLeaderboard.forEach((user, index) => {
            if (user.userId === userProfile?.userId || user.userName === userName) {
                userRank = index + 1;
            }
        });
        topPerformer = todayLeaderboard[0];
    }
    
    const rankEmoji = userRank === 1 ? '🥇' : userRank === 2 ? '🥈' : userRank === 3 ? '🥉' : `#${userRank}`;
    
    return {
        type: "flex",
        altText: `${userName} submitted ${activities.length} activities (+${totalPoints} pts)`,
        contents: {
            type: "bubble",
            size: "mega",
            header: {
                type: "box",
                layout: "horizontal",
                contents: [
                    userProfile?.pictureUrl ? {
                        type: "image",
                        url: userProfile.pictureUrl,
                        size: "60px",
                        aspectMode: "cover",
                        aspectRatio: "1:1",
                        flex: 0
                    } : {
                        type: "box",
                        layout: "vertical",
                        contents: [{
                            type: "text",
                            text: "👤",
                            size: "xl",
                            align: "center"
                        }],
                        width: "60px",
                        height: "60px",
                        backgroundColor: "#e0e0e0",
                        cornerRadius: "30px",
                        flex: 0,
                        justifyContent: "center"
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            {
                                type: "text",
                                text: "📊 ACTIVITY SUBMITTED",
                                weight: "bold",
                                size: "md",
                                color: "#FFFFFF"
                            },
                            {
                                type: "text",
                                text: userName,
                                size: "lg",
                                color: "#FFD700",
                                weight: "bold"
                            },
                            {
                                type: "text",
                                text: userRank > 0 ? `Current Rank: ${rankEmoji}` : "Calculating rank...",
                                size: "xs",
                                color: "#999999"
                            }
                        ],
                        flex: 1,
                        margin: "md"
                    }
                ],
                backgroundColor: "#1a237e",
                paddingAll: "md"
            },
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            {
                                type: "text",
                                text: "Activities",
                                size: "sm",
                                color: "#999999",
                                margin: "sm"
                            },
                            ...activityItems
                        ],
                        paddingAll: "sm",
                        backgroundColor: "#1a1a2e",
                        cornerRadius: "md"
                    },
                    {
                        type: "separator",
                        margin: "md"
                    },
                    {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            {
                                type: "box",
                                layout: "vertical",
                                contents: [
                                    {
                                        type: "text",
                                        text: "Points Earned",
                                        size: "xs",
                                        color: "#999999"
                                    },
                                    {
                                        type: "text",
                                        text: `+${totalPoints}`,
                                        size: "xxl",
                                        weight: "bold",
                                        color: "#FFD700",
                                        align: "center"
                                    }
                                ],
                                flex: 1
                            },
                            {
                                type: "separator",
                                margin: "md"
                            },
                            {
                                type: "box",
                                layout: "vertical",
                                contents: [
                                    {
                                        type: "text",
                                        text: "Team Total",
                                        size: "xs",
                                        color: "#999999"
                                    },
                                    {
                                        type: "text",
                                        text: teamStats.totalPoints.toString(),
                                        size: "lg",
                                        weight: "bold",
                                        color: "#4CAF50",
                                        align: "center"
                                    }
                                ],
                                flex: 1
                            }
                        ],
                        margin: "md",
                        paddingAll: "md"
                    },
                    ...achievements,
                    {
                        type: "separator",
                        margin: "md"
                    },
                    topPerformer && topPerformer.userName !== userName ? {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            {
                                type: "text",
                                text: "🥇 Current Leader:",
                                size: "sm",
                                color: "#999999",
                                flex: 0
                            },
                            {
                                type: "text",
                                text: `${topPerformer.userName} (${topPerformer.totalPoints} pts)`,
                                size: "sm",
                                color: "#FFD700",
                                align: "end",
                                flex: 1,
                                weight: "bold"
                            }
                        ],
                        margin: "md"
                    } : {
                        type: "text",
                        text: "🥇 You are the current leader!",
                        size: "sm",
                        color: "#FFD700",
                        align: "center",
                        margin: "md",
                        weight: "bold"
                    }
                ],
                backgroundColor: "#0a0e27",
                paddingAll: "md"
            },
            footer: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "button",
                        action: {
                            type: "uri",
                            label: "📱 Open Sales Tracker",
                            uri: "https://liff.line.me/2007552096"
                        },
                        style: "primary",
                        color: "#FFD700",
                        height: "sm"
                    },
                    {
                        type: "text",
                        text: new Date().toLocaleTimeString('th-TH', { 
                            timeZone: 'Asia/Bangkok',
                            hour: '2-digit',
                            minute: '2-digit'
                        }),
                        size: "xs",
                        color: "#999999",
                        align: "center",
                        margin: "sm"
                    }
                ],
                backgroundColor: "#1a237e",
                paddingAll: "md"
            },
            styles: {
                header: {
                    backgroundColor: "#1a237e"
                },
                body: {
                    backgroundColor: "#0a0e27"
                },
                footer: {
                    backgroundColor: "#1a237e"
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
                    console.log('Activity flex message sent successfully');
                    resolve(true);
                } else {
                    console.error('Failed to send activity flex message:', res.statusCode, responseData);
                    resolve(false);
                }
            });
        });

        req.on('error', (error) => {
            console.error('Error sending activity flex message:', error);
            resolve(false);
        });

        req.write(data);
        req.end();
    });
}

module.exports = {
    createActivitySubmissionFlex,
    sendFlexMessage
};