// LINE Webhook Route Handler
const express = require('express');
const router = express.Router();
const line = require('@line/bot-sdk');
const { handleMessage, handlePostback, lineConfig, client } = require('../line-chatbot');

// Middleware to verify LINE signature
const lineMiddleware = line.middleware(lineConfig);

// LINE Webhook endpoint
router.post('/webhook', lineMiddleware, async (req, res) => {
    try {
        const events = req.body.events;
        
        // Get services from app
        const lineClient = req.app.get('lineClient') || client;
        const firestoreService = req.app.get('firestoreService');
        
        // Process all events
        await Promise.all(events.map(async (event) => {
            console.log('LINE Event:', event);
            
            switch (event.type) {
                case 'message':
                    if (event.message.type === 'text') {
                        const { replyToken, source, message } = event;
                        
                        // Handle group registration
                        if (message.text === '/register' && source.type === 'group') {
                            const groupId = source.groupId;
                            const userId = source.userId;
                            
                            // Register the group
                            await firestoreService.registerGroup(groupId, null, userId);
                            
                            await lineClient.replyMessage(replyToken, {
                                type: 'text',
                                text: '✅ Group registered successfully!\nActivity notifications will be sent to this group.'
                            });
                        } 
                        // Handle notification toggle
                        else if (message.text === '/toggle' && source.type === 'group') {
                            const groupId = source.groupId;
                            const newStatus = await firestoreService.toggleGroupNotifications(groupId);
                            
                            await lineClient.replyMessage(replyToken, {
                                type: 'text',
                                text: newStatus 
                                    ? '🔔 Notifications enabled' 
                                    : '🔕 Notifications disabled'
                            });
                        }
                        // Handle other messages with chatbot
                        else {
                            await handleMessage(event, firestoreService);
                        }
                    }
                    break;
                    
                case 'postback':
                    await handlePostback(event, firestoreService);
                    break;
                    
                case 'follow':
                    // User added the bot
                    console.log('New follower:', event.source.userId);
                    break;
                    
                case 'unfollow':
                    // User blocked the bot
                    console.log('Unfollowed by:', event.source.userId);
                    break;
                    
                case 'join':
                    // Bot joined a group
                    console.log('Joined group:', event.source.groupId);
                    break;
                    
                case 'leave':
                    // Bot left a group
                    console.log('Left group:', event.source.groupId);
                    break;
            }
        }));
        
        res.json({ success: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Verify webhook endpoint for LINE
router.get('/webhook', (req, res) => {
    res.json({ 
        status: 'LINE Webhook is ready',
        timestamp: new Date().toISOString()
    });
});

// Send broadcast message to all users
router.post('/broadcast', async (req, res) => {
    try {
        const { message } = req.body;
        const db = req.app.get('db');
        
        // Get all users with LINE ID
        const users = await db.all('SELECT lineUserId FROM users WHERE lineUserId IS NOT NULL');
        
        // Send message to each user
        const results = await Promise.allSettled(
            users.map(user => 
                client.pushMessage(user.lineUserId, {
                    type: 'text',
                    text: message
                })
            )
        );
        
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        
        res.json({
            success: true,
            sent: successful,
            failed: failed,
            total: users.length
        });
    } catch (error) {
        console.error('Broadcast error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Rich Menu Management
router.post('/richmenu/create', async (req, res) => {
    try {
        const richMenu = {
            size: {
                width: 2500,
                height: 1686
            },
            selected: true,
            name: 'Sales Tracker Pro Menu',
            chatBarText: 'Menu',
            areas: [
                {
                    bounds: { x: 0, y: 0, width: 833, height: 843 },
                    action: {
                        type: 'message',
                        text: '/stats'
                    }
                },
                {
                    bounds: { x: 833, y: 0, width: 834, height: 843 },
                    action: {
                        type: 'message',
                        text: '/add'
                    }
                },
                {
                    bounds: { x: 1667, y: 0, width: 833, height: 843 },
                    action: {
                        type: 'message',
                        text: '/leaderboard'
                    }
                },
                {
                    bounds: { x: 0, y: 843, width: 833, height: 843 },
                    action: {
                        type: 'uri',
                        uri: `https://liff.line.me/${process.env.LIFF_ID}`
                    }
                },
                {
                    bounds: { x: 833, y: 843, width: 834, height: 843 },
                    action: {
                        type: 'message',
                        text: '/help'
                    }
                },
                {
                    bounds: { x: 1667, y: 843, width: 833, height: 843 },
                    action: {
                        type: 'uri',
                        uri: 'https://line.me/R/nv/settings'
                    }
                }
            ]
        };
        
        // Create rich menu
        const richMenuId = await client.createRichMenu(richMenu);
        
        // Upload rich menu image (you need to create this image)
        // await client.setRichMenuImage(richMenuId, fs.createReadStream('./richmenu.jpg'));
        
        // Set as default
        await client.setDefaultRichMenu(richMenuId);
        
        res.json({
            success: true,
            richMenuId
        });
    } catch (error) {
        console.error('Rich menu error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;