// Login Notification Flex Message Generator

// Create Flex Message for login notification
function createLoginFlex(userProfile) {
    const displayName = userProfile?.displayName || 'Someone';
    const pictureUrl = userProfile?.pictureUrl;
    const currentTime = new Date().toLocaleTimeString('th-TH', { 
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    return {
        type: "flex",
        altText: `${displayName} just logged in!`,
        contents: {
            type: "bubble",
            size: "micro",
            header: {
                type: "box",
                layout: "horizontal",
                contents: [
                    {
                        type: "text",
                        text: "🎉 USER LOGGED IN",
                        weight: "bold",
                        size: "sm",
                        color: "#FFFFFF",
                        align: "center",
                        flex: 1
                    }
                ],
                backgroundColor: "#00B900",
                paddingAll: "md"
            },
            body: {
                type: "box",
                layout: "horizontal",
                contents: [
                    pictureUrl ? {
                        type: "image",
                        url: pictureUrl,
                        size: "50px",
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
                        width: "50px",
                        height: "50px",
                        backgroundColor: "#e0e0e0",
                        cornerRadius: "25px",
                        flex: 0,
                        justifyContent: "center"
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            {
                                type: "text",
                                text: displayName,
                                weight: "bold",
                                size: "md",
                                color: "#FFFFFF",
                                wrap: true
                            },
                            {
                                type: "text",
                                text: `Logged in at ${currentTime}`,
                                size: "xs",
                                color: "#999999",
                                margin: "xs"
                            }
                        ],
                        margin: "md",
                        flex: 1
                    }
                ],
                spacing: "sm",
                paddingAll: "md",
                backgroundColor: "#1a1a2e"
            },
            footer: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "button",
                        action: {
                            type: "uri",
                            label: "📱 Start Tracking",
                            uri: "https://liff.line.me/2007552096"
                        },
                        style: "primary",
                        color: "#00B900",
                        height: "sm"
                    },
                    {
                        type: "text",
                        text: "Ready to track activities! 🚀",
                        size: "xs",
                        color: "#999999",
                        align: "center",
                        margin: "sm"
                    }
                ],
                backgroundColor: "#0a0e27",
                paddingAll: "md"
            },
            styles: {
                header: {
                    backgroundColor: "#00B900"
                },
                body: {
                    backgroundColor: "#1a1a2e"
                },
                footer: {
                    backgroundColor: "#0a0e27"
                }
            }
        }
    };
}

module.exports = {
    createLoginFlex
};