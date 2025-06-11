#!/usr/bin/env node

/**
 * Firestore MCP Server
 * Allows Claude to connect to your Google Cloud Firestore database
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'salesappfkt',
    databaseId: 'sales-tracker-db'
  });
}

// Get Firestore instance
const db = admin.firestore();

// Collection references
const collections = {
  users: db.collection('users'),
  activities: db.collection('activities'),
  groups: db.collection('groups'),
  cache: db.collection('cache'),
  stats: db.collection('stats')
};

// Create MCP server
const server = new Server({
  name: "firestore-sales-tracker",
  version: "1.0.0",
}, {
  capabilities: {
    tools: {}
  }
});

// Tool: Query users
server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "query_users": {
      try {
        const { limit = 10, userId } = args;
        
        if (userId) {
          const doc = await collections.users.doc(userId).get();
          if (!doc.exists) {
            return { content: [{ type: "text", text: "User not found" }] };
          }
          return { 
            content: [{ 
              type: "text", 
              text: JSON.stringify({ id: doc.id, ...doc.data() }, null, 2) 
            }] 
          };
        }
        
        const snapshot = await collections.users.limit(limit).get();
        const users = [];
        snapshot.forEach(doc => {
          users.push({ id: doc.id, ...doc.data() });
        });
        
        return { 
          content: [{ 
            type: "text", 
            text: JSON.stringify(users, null, 2) 
          }] 
        };
      } catch (error) {
        return { 
          content: [{ 
            type: "text", 
            text: `Error querying users: ${error.message}` 
          }] 
        };
      }
    }

    case "query_activities": {
      try {
        const { userId, date, limit = 20 } = args;
        
        let query = collections.activities;
        
        if (userId) {
          query = query.where('lineUserId', '==', userId);
        }
        
        if (date) {
          query = query.where('date', '==', date);
        }
        
        query = query.orderBy('createdAt', 'desc').limit(limit);
        
        const snapshot = await query.get();
        const activities = [];
        
        snapshot.forEach(doc => {
          activities.push({ id: doc.id, ...doc.data() });
        });
        
        return { 
          content: [{ 
            type: "text", 
            text: JSON.stringify(activities, null, 2) 
          }] 
        };
      } catch (error) {
        return { 
          content: [{ 
            type: "text", 
            text: `Error querying activities: ${error.message}` 
          }] 
        };
      }
    }

    case "get_leaderboard": {
      try {
        const { period = 'daily', date = null } = args;
        const targetDate = date || new Date().toISOString().split('T')[0];
        
        let startDate, endDate;
        
        switch (period) {
          case 'daily':
            startDate = targetDate;
            endDate = targetDate;
            break;
          case 'weekly':
            const d = new Date(targetDate);
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            startDate = new Date(d.setDate(diff)).toISOString().split('T')[0];
            endDate = new Date(d.setDate(diff + 6)).toISOString().split('T')[0];
            break;
          case 'monthly':
            startDate = targetDate.substring(0, 7) + '-01';
            const lastDay = new Date(targetDate.substring(0, 4), targetDate.substring(5, 7), 0);
            endDate = lastDay.toISOString().split('T')[0];
            break;
        }
        
        let query = collections.activities;
        if (period === 'daily') {
          query = query.where('date', '==', startDate);
        } else {
          query = query
            .where('date', '>=', startDate)
            .where('date', '<=', endDate);
        }
        
        const snapshot = await query.get();
        const userStats = {};
        
        snapshot.forEach(doc => {
          const activity = doc.data();
          if (!userStats[activity.lineUserId]) {
            userStats[activity.lineUserId] = {
              points: 0,
              activities: 0
            };
          }
          userStats[activity.lineUserId].points += activity.points || 0;
          userStats[activity.lineUserId].activities++;
        });
        
        const leaderboard = [];
        for (const [userId, stats] of Object.entries(userStats)) {
          const userDoc = await collections.users.doc(userId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            leaderboard.push({
              userId,
              displayName: userData.displayName,
              ...stats
            });
          }
        }
        
        leaderboard.sort((a, b) => b.points - a.points);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              period,
              startDate,
              endDate,
              leaderboard: leaderboard.slice(0, 10)
            }, null, 2)
          }]
        };
      } catch (error) {
        return { 
          content: [{ 
            type: "text", 
            text: `Error getting leaderboard: ${error.message}` 
          }] 
        };
      }
    }

    case "get_team_stats": {
      try {
        const today = new Date().toISOString().split('T')[0];
        const stats = {
          totalUsers: 0,
          totalPoints: 0,
          totalActivities: 0,
          todayPoints: 0,
          todayActivities: 0
        };
        
        const usersSnapshot = await collections.users.get();
        stats.totalUsers = usersSnapshot.size;
        
        const activitiesSnapshot = await collections.activities.get();
        
        activitiesSnapshot.forEach(doc => {
          const activity = doc.data();
          stats.totalActivities++;
          stats.totalPoints += activity.points || 0;
          
          if (activity.date === today) {
            stats.todayActivities++;
            stats.todayPoints += activity.points || 0;
          }
        });
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(stats, null, 2)
          }]
        };
      } catch (error) {
        return { 
          content: [{ 
            type: "text", 
            text: `Error getting team stats: ${error.message}` 
          }] 
        };
      }
    }

    case "add_activity": {
      try {
        const { userId, activity, points, customerName, date } = args;
        
        if (!userId || !activity || !points) {
          return {
            content: [{
              type: "text",
              text: "Error: userId, activity, and points are required"
            }]
          };
        }
        
        const activityData = {
          lineUserId: userId,
          activity,
          points: parseInt(points),
          customerName: customerName || '',
          date: date || new Date().toISOString().split('T')[0],
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        const docRef = await collections.activities.add(activityData);
        
        return {
          content: [{
            type: "text",
            text: `Activity added successfully with ID: ${docRef.id}`
          }]
        };
      } catch (error) {
        return { 
          content: [{ 
            type: "text", 
            text: `Error adding activity: ${error.message}` 
          }] 
        };
      }
    }

    default:
      return {
        content: [{
          type: "text",
          text: `Unknown tool: ${name}`
        }]
      };
  }
});

// List available tools
server.setRequestHandler("tools/list", async () => {
  return {
    tools: [
      {
        name: "query_users",
        description: "Query users from Firestore",
        inputSchema: {
          type: "object",
          properties: {
            userId: {
              type: "string",
              description: "Specific user ID to query (optional)"
            },
            limit: {
              type: "number",
              description: "Maximum number of users to return (default: 10)"
            }
          }
        }
      },
      {
        name: "query_activities",
        description: "Query sales activities from Firestore",
        inputSchema: {
          type: "object",
          properties: {
            userId: {
              type: "string",
              description: "Filter by user ID (optional)"
            },
            date: {
              type: "string",
              description: "Filter by date YYYY-MM-DD (optional)"
            },
            limit: {
              type: "number",
              description: "Maximum number of activities to return (default: 20)"
            }
          }
        }
      },
      {
        name: "get_leaderboard",
        description: "Get sales leaderboard",
        inputSchema: {
          type: "object",
          properties: {
            period: {
              type: "string",
              enum: ["daily", "weekly", "monthly"],
              description: "Leaderboard period (default: daily)"
            },
            date: {
              type: "string",
              description: "Target date YYYY-MM-DD (default: today)"
            }
          }
        }
      },
      {
        name: "get_team_stats",
        description: "Get overall team statistics",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "add_activity",
        description: "Add a new sales activity",
        inputSchema: {
          type: "object",
          properties: {
            userId: {
              type: "string",
              description: "LINE user ID"
            },
            activity: {
              type: "string",
              description: "Activity description"
            },
            points: {
              type: "number",
              description: "Points for the activity"
            },
            customerName: {
              type: "string",
              description: "Customer name (optional)"
            },
            date: {
              type: "string",
              description: "Activity date YYYY-MM-DD (default: today)"
            }
          },
          required: ["userId", "activity", "points"]
        }
      }
    ]
  };
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Firestore MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});