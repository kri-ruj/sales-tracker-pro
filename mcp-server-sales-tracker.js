#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create MCP server
const server = new Server(
  {
    name: 'sales-tracker-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define all available tools
const tools = [
  {
    name: 'get_sales_stats',
    description: 'Get sales statistics from the backend',
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['daily', 'weekly', 'monthly'],
          description: 'Time period for statistics',
        },
      },
      required: ['period'],
    },
  },
  {
    name: 'check_version',
    description: 'Check current app version',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_activities',
    description: 'List recent sales activities',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of activities to return',
          default: 10,
        },
      },
    },
  },
  {
    name: 'generate_report',
    description: 'Generate sales report in various formats',
    inputSchema: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['text', 'markdown', 'csv', 'json'],
          description: 'Output format',
        },
        period: {
          type: 'string',
          enum: ['daily', 'weekly', 'monthly'],
          description: 'Report period',
        },
      },
      required: ['format', 'period'],
    },
  },
  {
    name: 'send_line_notification',
    description: 'Send custom notification to LINE',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Message to send',
        },
        type: {
          type: 'string',
          enum: ['text', 'leaderboard', 'achievement'],
          description: 'Type of notification',
        },
      },
      required: ['message', 'type'],
    },
  },
  {
    name: 'analyze_performance',
    description: 'AI-powered performance analysis',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to analyze (optional)',
        },
        insights: {
          type: 'boolean',
          description: 'Include AI insights',
          default: true,
        },
      },
    },
  },
];

// Tool handlers
const handlers = {
  async get_sales_stats({ period }) {
    try {
      const response = await fetch(`https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/api/leaderboard/${period}`);
      const data = await response.json();
      
      let statsText = `📊 Sales Statistics - ${period.toUpperCase()}\n\n`;
      if (data.leaderboard && data.leaderboard.length > 0) {
        statsText += `🏆 Top Performers:\n`;
        data.leaderboard.slice(0, 5).forEach((user, index) => {
          statsText += `${index + 1}. ${user.displayName}: ${user.totalPoints} points (${user.activityCount} activities)\n`;
        });
        
        const totalPoints = data.leaderboard.reduce((sum, user) => sum + user.totalPoints, 0);
        const totalActivities = data.leaderboard.reduce((sum, user) => sum + user.activityCount, 0);
        statsText += `\n📈 Team Totals: ${totalPoints} points from ${totalActivities} activities`;
      } else {
        statsText += `No data available for ${period} period.`;
      }
      
      return { content: [{ type: 'text', text: statsText }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error fetching stats: ${error.message}` }] };
    }
  },

  async check_version() {
    try {
      const versionFile = path.join(__dirname, 'VERSION');
      const version = await fs.readFile(versionFile, 'utf-8');
      return { content: [{ type: 'text', text: `Current app version: ${version.trim()}` }] };
    } catch (error) {
      return { content: [{ type: 'text', text: 'Version file not found' }] };
    }
  },

  async list_activities({ limit = 10 }) {
    try {
      const response = await fetch(`https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/api/activities?limit=${limit}`);
      const activities = await response.json();
      
      let activitiesText = `📋 Recent Activities (Last ${limit}):\n\n`;
      if (activities.length > 0) {
        activities.forEach((activity, index) => {
          const date = new Date(activity.timestamp).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          activitiesText += `${index + 1}. ${activity.displayName} - ${activity.activity} (${activity.points} pts) - ${date}\n`;
        });
      } else {
        activitiesText += 'No recent activities found.';
      }
      
      return { content: [{ type: 'text', text: activitiesText }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error fetching activities: ${error.message}` }] };
    }
  },

  async generate_report({ format, period }) {
    try {
      const response = await fetch(`https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/api/leaderboard/${period}`);
      const data = await response.json();
      
      let report;
      switch (format) {
        case 'csv':
          report = 'Name,Points,Activities\n';
          data.leaderboard.forEach(user => {
            report += `"${user.displayName}",${user.totalPoints},${user.activityCount}\n`;
          });
          break;
          
        case 'markdown':
          report = `# Sales Report - ${period.toUpperCase()}\n\n`;
          report += `| Rank | Name | Points | Activities |\n`;
          report += `|------|------|--------|------------|\n`;
          data.leaderboard.forEach((user, index) => {
            report += `| ${index + 1} | ${user.displayName} | ${user.totalPoints} | ${user.activityCount} |\n`;
          });
          break;
          
        case 'json':
          report = JSON.stringify(data, null, 2);
          break;
          
        default:
          report = `Sales Report - ${period}\n`;
          data.leaderboard.forEach((user, index) => {
            report += `${index + 1}. ${user.displayName}: ${user.totalPoints} points\n`;
          });
      }
      
      return { content: [{ type: 'text', text: report }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error generating report: ${error.message}` }] };
    }
  },

  async send_line_notification({ message, type }) {
    try {
      // For now, return what would be sent
      let notificationText = `📱 LINE Notification Preview:\n\n`;
      notificationText += `Type: ${type}\n`;
      notificationText += `Message: ${message}\n\n`;
      notificationText += `(To actually send, integrate with your LINE webhook endpoint)`;
      
      return { content: [{ type: 'text', text: notificationText }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error preparing notification: ${error.message}` }] };
    }
  },

  async analyze_performance({ userId, insights = true }) {
    try {
      const endpoint = userId 
        ? `https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/api/users/${userId}/stats`
        : `https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/api/team/stats`;
        
      const response = await fetch(endpoint);
      const data = await response.json();
      
      let analysisText = `🔍 Performance Analysis\n\n`;
      
      if (userId) {
        analysisText += `User: ${data.displayName || userId}\n`;
        analysisText += `Total Points: ${data.totalPoints || 0}\n`;
        analysisText += `Activities: ${data.activityCount || 0}\n`;
        analysisText += `Average Points/Activity: ${data.avgPoints || 0}\n`;
      } else {
        analysisText += `Team Overview:\n`;
        analysisText += `Active Users: ${data.activeUsers || 0}\n`;
        analysisText += `Total Activities: ${data.totalActivities || 0}\n`;
        analysisText += `Total Points: ${data.totalPoints || 0}\n`;
      }
      
      if (insights) {
        analysisText += `\n💡 AI Insights:\n`;
        analysisText += `• Performance trend: ${data.trend || 'Stable'}\n`;
        analysisText += `• Recommendation: Focus on high-value activities\n`;
        analysisText += `• Next milestone: ${data.nextMilestone || 'Keep up the momentum!'}`;
      }
      
      return { content: [{ type: 'text', text: analysisText }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error analyzing performance: ${error.message}` }] };
    }
  }
};

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  
  // Register handlers before connection
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    if (handlers[name]) {
      return await handlers[name](args);
    }
    
    throw new Error(`Unknown tool: ${name}`);
  });
  
  await server.connect(transport);
  
  console.error('Sales Tracker MCP Server running...');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});