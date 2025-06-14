// LINE Chatbot Handler for Sales Tracker Pro
const line = require('@line/bot-sdk');

// LINE Bot configuration
const lineConfig = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(lineConfig);

// Activity types with emojis
const ACTIVITY_TYPES = {
    call: { emoji: '📞', points: 20, name: 'Phone Call' },
    email: { emoji: '📧', points: 10, name: 'Email' },
    meeting: { emoji: '🤝', points: 50, name: 'Meeting' },
    proposal: { emoji: '📄', points: 30, name: 'Proposal' },
    demo: { emoji: '🎯', points: 40, name: 'Demo' },
    deal: { emoji: '💰', points: 100, name: 'Deal Closed' }
};

// Quick Reply Template
const getQuickReply = () => ({
    type: 'text',
    text: 'What would you like to do?',
    quickReply: {
        items: [
            {
                type: 'action',
                action: {
                    type: 'message',
                    label: '📊 My Stats',
                    text: '/stats'
                }
            },
            {
                type: 'action',
                action: {
                    type: 'message',
                    label: '➕ Add Activity',
                    text: '/add'
                }
            },
            {
                type: 'action',
                action: {
                    type: 'message',
                    label: '🏆 Leaderboard',
                    text: '/leaderboard'
                }
            },
            {
                type: 'action',
                action: {
                    type: 'message',
                    label: '📱 Open App',
                    text: '/app'
                }
            }
        ]
    }
});

// Handle incoming messages
async function handleMessage(event, db) {
    const { replyToken, message, source } = event;
    const userId = source.userId;
    const text = message.text?.toLowerCase() || '';

    // Get user from database
    const user = await db.get('SELECT * FROM users WHERE lineUserId = ?', [userId]);

    if (!user) {
        // New user - send welcome message
        return await sendWelcomeMessage(replyToken, userId);
    }

    // Command handling
    if (text.startsWith('/')) {
        return await handleCommand(text, replyToken, user, db);
    }

    // Natural language processing
    if (text.includes('add') || text.includes('log')) {
        return await handleAddActivity(replyToken, user);
    }

    if (text.includes('stats') || text.includes('points') || text.includes('score')) {
        return await sendUserStats(replyToken, user, db);
    }

    if (text.includes('leader') || text.includes('rank')) {
        return await sendLeaderboard(replyToken, db);
    }

    // Default response with quick reply
    return await client.replyMessage(replyToken, getQuickReply());
}

// Handle commands
async function handleCommand(command, replyToken, user, db) {
    switch (command) {
        case '/stats':
            return await sendUserStats(replyToken, user, db);
        
        case '/add':
            return await handleAddActivity(replyToken, user);
        
        case '/leaderboard':
            return await sendLeaderboard(replyToken, db);
        
        case '/app':
            return await sendAppLink(replyToken);
        
        case '/help':
            return await sendHelpMessage(replyToken);
        
        default:
            return await client.replyMessage(replyToken, getQuickReply());
    }
}

// Send welcome message
async function sendWelcomeMessage(replyToken, userId) {
    const message = {
        type: 'flex',
        altText: 'Welcome to Sales Tracker Pro!',
        contents: {
            type: 'bubble',
            hero: {
                type: 'image',
                url: 'https://example.com/welcome-banner.jpg',
                size: 'full',
                aspectRatio: '20:13',
                aspectMode: 'cover'
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: 'Welcome to Sales Tracker Pro! 🎯',
                        weight: 'bold',
                        size: 'xl',
                        margin: 'md'
                    },
                    {
                        type: 'text',
                        text: 'Track your sales activities, earn points, and compete with your team!',
                        size: 'sm',
                        color: '#aaaaaa',
                        wrap: true,
                        margin: 'md'
                    }
                ]
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                spacing: 'sm',
                contents: [
                    {
                        type: 'button',
                        style: 'primary',
                        height: 'sm',
                        action: {
                            type: 'uri',
                            label: 'Start Tracking',
                            uri: `https://liff.line.me/${process.env.LIFF_ID}`
                        },
                        color: '#06C755'
                    },
                    {
                        type: 'button',
                        style: 'link',
                        height: 'sm',
                        action: {
                            type: 'message',
                            label: 'Learn More',
                            text: '/help'
                        }
                    }
                ]
            }
        }
    };

    return await client.replyMessage(replyToken, [message, getQuickReply()]);
}

// Send user stats
async function sendUserStats(replyToken, user, db) {
    // Get user's activities for today
    const today = new Date().toISOString().split('T')[0];
    const todayActivities = await db.all(
        'SELECT * FROM activities WHERE userId = ? AND date(createdAt) = date(?)',
        [user.id, today]
    );

    const todayPoints = todayActivities.reduce((sum, a) => sum + a.points, 0);

    const message = {
        type: 'flex',
        altText: 'Your Stats',
        contents: {
            type: 'bubble',
            size: 'mega',
            header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: 'Your Stats 📊',
                        color: '#ffffff',
                        size: 'xl',
                        weight: 'bold'
                    }
                ],
                backgroundColor: '#06C755',
                paddingAll: '20px'
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'box',
                        layout: 'horizontal',
                        contents: [
                            {
                                type: 'box',
                                layout: 'vertical',
                                contents: [
                                    {
                                        type: 'text',
                                        text: 'Total Points',
                                        size: 'sm',
                                        color: '#555555'
                                    },
                                    {
                                        type: 'text',
                                        text: user.totalPoints.toString(),
                                        size: 'xxl',
                                        weight: 'bold',
                                        color: '#06C755'
                                    }
                                ],
                                flex: 1
                            },
                            {
                                type: 'box',
                                layout: 'vertical',
                                contents: [
                                    {
                                        type: 'text',
                                        text: 'Today',
                                        size: 'sm',
                                        color: '#555555'
                                    },
                                    {
                                        type: 'text',
                                        text: todayPoints.toString(),
                                        size: 'xxl',
                                        weight: 'bold',
                                        color: '#3B82F6'
                                    }
                                ],
                                flex: 1
                            }
                        ],
                        margin: 'lg'
                    },
                    {
                        type: 'separator',
                        margin: 'lg'
                    },
                    {
                        type: 'box',
                        layout: 'horizontal',
                        contents: [
                            {
                                type: 'box',
                                layout: 'vertical',
                                contents: [
                                    {
                                        type: 'text',
                                        text: 'Streak',
                                        size: 'sm',
                                        color: '#555555'
                                    },
                                    {
                                        type: 'text',
                                        text: `${user.currentStreak} days 🔥`,
                                        size: 'lg',
                                        weight: 'bold'
                                    }
                                ],
                                flex: 1
                            },
                            {
                                type: 'box',
                                layout: 'vertical',
                                contents: [
                                    {
                                        type: 'text',
                                        text: 'Level',
                                        size: 'sm',
                                        color: '#555555'
                                    },
                                    {
                                        type: 'text',
                                        text: `Level ${Math.floor(user.totalPoints / 1000) + 1}`,
                                        size: 'lg',
                                        weight: 'bold'
                                    }
                                ],
                                flex: 1
                            }
                        ],
                        margin: 'lg'
                    }
                ]
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'button',
                        action: {
                            type: 'uri',
                            label: 'View Details',
                            uri: `https://liff.line.me/${process.env.LIFF_ID}`
                        },
                        style: 'primary',
                        color: '#06C755'
                    }
                ]
            }
        }
    };

    return await client.replyMessage(replyToken, message);
}

// Handle add activity
async function handleAddActivity(replyToken, user) {
    const message = {
        type: 'flex',
        altText: 'Add Activity',
        contents: {
            type: 'carousel',
            contents: Object.entries(ACTIVITY_TYPES).map(([type, info]) => ({
                type: 'bubble',
                size: 'micro',
                header: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: info.emoji,
                            size: 'xxl',
                            align: 'center'
                        }
                    ],
                    paddingAll: '10px'
                },
                body: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: info.name,
                            weight: 'bold',
                            size: 'sm',
                            align: 'center'
                        },
                        {
                            type: 'text',
                            text: `+${info.points} pts`,
                            size: 'xs',
                            color: '#06C755',
                            align: 'center'
                        }
                    ],
                    spacing: 'sm',
                    paddingAll: '5px'
                },
                footer: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'button',
                            action: {
                                type: 'postback',
                                label: 'Add',
                                data: `action=add&type=${type}`,
                                displayText: `Add ${info.name}`
                            },
                            height: 'sm',
                            style: 'primary',
                            color: '#06C755'
                        }
                    ]
                }
            }))
        }
    };

    return await client.replyMessage(replyToken, message);
}

// Send leaderboard
async function sendLeaderboard(replyToken, db) {
    const topUsers = await db.all(
        'SELECT displayName, totalPoints FROM users ORDER BY totalPoints DESC LIMIT 5'
    );

    const leaderboardContents = topUsers.map((user, index) => ({
        type: 'box',
        layout: 'horizontal',
        contents: [
            {
                type: 'text',
                text: `${index + 1}.`,
                size: 'lg',
                weight: 'bold',
                color: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : '#555555',
                flex: 0
            },
            {
                type: 'text',
                text: user.displayName,
                size: 'md',
                flex: 3,
                margin: 'md'
            },
            {
                type: 'text',
                text: `${user.totalPoints} pts`,
                size: 'md',
                weight: 'bold',
                color: '#06C755',
                align: 'end',
                flex: 2
            }
        ],
        margin: 'md'
    }));

    const message = {
        type: 'flex',
        altText: 'Leaderboard',
        contents: {
            type: 'bubble',
            size: 'mega',
            header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: 'Leaderboard 🏆',
                        color: '#ffffff',
                        size: 'xl',
                        weight: 'bold'
                    }
                ],
                backgroundColor: '#06C755',
                paddingAll: '20px'
            },
            body: {
                type: 'box',
                layout: 'vertical',
                contents: leaderboardContents
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'button',
                        action: {
                            type: 'uri',
                            label: 'View Full Leaderboard',
                            uri: `https://liff.line.me/${process.env.LIFF_ID}?tab=leaderboard`
                        },
                        style: 'primary',
                        color: '#06C755'
                    }
                ]
            }
        }
    };

    return await client.replyMessage(replyToken, message);
}

// Send app link
async function sendAppLink(replyToken) {
    const message = {
        type: 'flex',
        altText: 'Open Sales Tracker Pro',
        contents: {
            type: 'bubble',
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: 'Sales Tracker Pro 📱',
                        weight: 'bold',
                        size: 'xl',
                        margin: 'md'
                    },
                    {
                        type: 'text',
                        text: 'Track activities, earn points, and climb the leaderboard!',
                        size: 'sm',
                        color: '#aaaaaa',
                        wrap: true,
                        margin: 'md'
                    }
                ]
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'button',
                        style: 'primary',
                        action: {
                            type: 'uri',
                            label: 'Open App',
                            uri: `https://liff.line.me/${process.env.LIFF_ID}`
                        },
                        color: '#06C755'
                    }
                ]
            }
        }
    };

    return await client.replyMessage(replyToken, message);
}

// Send help message
async function sendHelpMessage(replyToken) {
    const message = {
        type: 'text',
        text: `Sales Tracker Pro - Commands 📖

/stats - View your points and stats
/add - Log a new activity
/leaderboard - See top performers
/app - Open the app
/help - Show this help

You can also just tell me what you did!
Example: "Just had a meeting with client"

Happy tracking! 🎯`
    };

    return await client.replyMessage(replyToken, [message, getQuickReply()]);
}

// Handle postback (from activity selection)
async function handlePostback(event, db) {
    const { replyToken, postback, source } = event;
    const userId = source.userId;
    const data = new URLSearchParams(postback.data);
    
    if (data.get('action') === 'add') {
        const type = data.get('type');
        const activityInfo = ACTIVITY_TYPES[type];
        
        // For Firestore integration, we need to use the Firestore service
        // This handler will be updated when integrated with the main server
        
        // Send confirmation
        const message = {
            type: 'flex',
            altText: 'Activity Added!',
            contents: {
                type: 'bubble',
                size: 'kilo',
                body: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: 'Activity Added! ✅',
                            weight: 'bold',
                            size: 'lg',
                            color: '#06C755'
                        },
                        {
                            type: 'text',
                            text: `${activityInfo.emoji} ${activityInfo.name}`,
                            size: 'md',
                            margin: 'md'
                        },
                        {
                            type: 'text',
                            text: `+${activityInfo.points} points earned`,
                            size: 'sm',
                            color: '#06C755',
                            margin: 'sm'
                        }
                    ]
                }
            }
        };
        
        return await client.replyMessage(replyToken, [message, getQuickReply()]);
    }
}

// Export handlers
module.exports = {
    handleMessage,
    handlePostback,
    lineConfig,
    client
};