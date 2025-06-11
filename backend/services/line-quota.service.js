const admin = require('firebase-admin');

class LineQuotaService {
    constructor() {
        this.db = admin.firestore();
        this.quotaCollection = 'line_quota';
        this.DAILY_LIMIT = 300; // LINE free tier limit
        this.WARNING_THRESHOLD = 280; // Warn at 280 messages
        this.CRITICAL_THRESHOLD = 295; // Stop non-critical messages at 295
    }

    /**
     * Get current quota usage for today
     */
    async getCurrentUsage() {
        const today = new Date().toISOString().split('T')[0];
        const doc = await this.db.collection(this.quotaCollection).doc(today).get();
        
        if (!doc.exists) {
            return {
                date: today,
                count: 0,
                details: [],
                lastReset: new Date().toISOString()
            };
        }
        
        return doc.data();
    }

    /**
     * Check if we can send a message based on quota
     * @param {string} messageType - Type of message (activity, leaderboard, system)
     * @param {boolean} isCritical - Whether this is a critical message
     */
    async canSendMessage(messageType = 'activity', isCritical = false) {
        const usage = await this.getCurrentUsage();
        
        // Always allow critical system messages
        if (isCritical) {
            return {
                allowed: usage.count < this.DAILY_LIMIT,
                remaining: Math.max(0, this.DAILY_LIMIT - usage.count),
                warning: usage.count >= this.WARNING_THRESHOLD,
                critical: usage.count >= this.CRITICAL_THRESHOLD
            };
        }
        
        // For non-critical messages, stop before hitting the limit
        if (usage.count >= this.CRITICAL_THRESHOLD) {
            console.warn(`LINE quota critical: ${usage.count}/${this.DAILY_LIMIT} messages used today`);
            return {
                allowed: false,
                remaining: Math.max(0, this.DAILY_LIMIT - usage.count),
                warning: true,
                critical: true,
                reason: 'Daily quota nearly exhausted'
            };
        }
        
        return {
            allowed: true,
            remaining: Math.max(0, this.DAILY_LIMIT - usage.count),
            warning: usage.count >= this.WARNING_THRESHOLD,
            critical: false
        };
    }

    /**
     * Record a sent message
     * @param {string} messageType - Type of message sent
     * @param {string} recipient - Recipient ID (user or group)
     * @param {number} messageCount - Number of messages sent (default 1)
     */
    async recordMessage(messageType, recipient, messageCount = 1) {
        const today = new Date().toISOString().split('T')[0];
        const timestamp = new Date().toISOString();
        
        const docRef = this.db.collection(this.quotaCollection).doc(today);
        
        await this.db.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);
            
            if (!doc.exists) {
                transaction.set(docRef, {
                    date: today,
                    count: messageCount,
                    details: [{
                        timestamp,
                        type: messageType,
                        recipient,
                        count: messageCount
                    }],
                    lastReset: timestamp,
                    createdAt: timestamp
                });
            } else {
                const data = doc.data();
                transaction.update(docRef, {
                    count: data.count + messageCount,
                    details: [...data.details, {
                        timestamp,
                        type: messageType,
                        recipient,
                        count: messageCount
                    }]
                });
            }
        });
    }

    /**
     * Get quota statistics
     */
    async getQuotaStats() {
        const usage = await this.getCurrentUsage();
        const percentage = Math.round((usage.count / this.DAILY_LIMIT) * 100);
        
        // Group by message type
        const typeBreakdown = {};
        if (usage.details) {
            usage.details.forEach(detail => {
                if (!typeBreakdown[detail.type]) {
                    typeBreakdown[detail.type] = 0;
                }
                typeBreakdown[detail.type] += detail.count || 1;
            });
        }
        
        return {
            date: usage.date,
            used: usage.count,
            limit: this.DAILY_LIMIT,
            remaining: Math.max(0, this.DAILY_LIMIT - usage.count),
            percentage,
            isWarning: usage.count >= this.WARNING_THRESHOLD,
            isCritical: usage.count >= this.CRITICAL_THRESHOLD,
            breakdown: typeBreakdown,
            willResetAt: this.getNextResetTime()
        };
    }

    /**
     * Get next quota reset time (midnight JST)
     */
    getNextResetTime() {
        const now = new Date();
        const jstOffset = 9 * 60; // JST is UTC+9
        const utcHours = now.getUTCHours();
        const utcMinutes = now.getUTCMinutes();
        const totalMinutes = utcHours * 60 + utcMinutes;
        
        // Calculate minutes until midnight JST
        const midnightJSTinUTC = 15 * 60; // 15:00 UTC is midnight JST
        let minutesUntilReset;
        
        if (totalMinutes < midnightJSTinUTC) {
            minutesUntilReset = midnightJSTinUTC - totalMinutes;
        } else {
            minutesUntilReset = (24 * 60) - totalMinutes + midnightJSTinUTC;
        }
        
        const resetTime = new Date(now.getTime() + minutesUntilReset * 60 * 1000);
        return resetTime.toISOString();
    }

    /**
     * Clean up old quota records (keep last 7 days)
     */
    async cleanupOldRecords() {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const cutoffDate = sevenDaysAgo.toISOString().split('T')[0];
        
        const snapshot = await this.db.collection(this.quotaCollection)
            .where('date', '<', cutoffDate)
            .get();
        
        const batch = this.db.batch();
        snapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        console.log(`Cleaned up ${snapshot.size} old quota records`);
    }
}

module.exports = new LineQuotaService();