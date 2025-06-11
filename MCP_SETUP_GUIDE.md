# MCP Sales Tracker Setup Guide

## 🚀 Quick Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Test the MCP Server
```bash
node mcp-server-sales-tracker.js
```

### 3. Restart Claude Desktop
After adding the server to `.mcp.json`, restart Claude Desktop for changes to take effect.

## 📋 Available Commands

Once setup is complete, you can use these commands in Claude:

### Sales Statistics
- "Get daily sales stats"
- "Show me weekly leaderboard"
- "Display monthly performance"

### Activity Tracking
- "List recent activities"
- "Show last 20 activities"
- "What activities happened today?"

### Report Generation
- "Generate CSV report for this week"
- "Create markdown summary of monthly sales"
- "Export daily leaderboard as JSON"
- "Generate sales report in text format for today"

### Performance Analysis
- "Analyze team performance"
- "Show my performance with insights"
- "Analyze performance for user U123456"

### LINE Notifications
- "Send daily leaderboard notification"
- "Create achievement notification for new milestone"
- "Preview LINE message for top performer"

### Version Management
- "Check current app version"
- "What version is deployed?"

## 🔧 Troubleshooting

### If MCP server doesn't appear in Claude:
1. Check that `.mcp.json` is properly formatted
2. Ensure the file path in `.mcp.json` is absolute
3. Restart Claude Desktop completely (not just reload)

### If commands fail:
1. Check that your backend is running
2. Verify API endpoints are accessible
3. Check console for error messages

## 📊 Example Usage

```
You: "Generate a markdown report for this week's sales"

Claude: # Sales Report - WEEKLY

| Rank | Name | Points | Activities |
|------|------|--------|------------|
| 1 | John Doe | 450 | 15 |
| 2 | Jane Smith | 380 | 12 |
| 3 | Bob Johnson | 320 | 10 |
```

```
You: "Analyze team performance with insights"

Claude: 🔍 Performance Analysis

Team Overview:
Active Users: 15
Total Activities: 234
Total Points: 5,670

💡 AI Insights:
• Performance trend: Upward
• Recommendation: Focus on high-value activities
• Next milestone: 6,000 team points!
```

## 🎯 Advanced Features

### Custom Notifications
The MCP server can preview LINE notifications before sending:
- Text messages
- Leaderboard updates
- Achievement announcements

### Data Export
Export data in multiple formats:
- CSV for spreadsheets
- JSON for APIs
- Markdown for documentation
- Plain text for reports

### Performance Insights
Get AI-powered insights on:
- Individual performance
- Team trends
- Activity patterns
- Improvement recommendations

## 🔐 Security Notes

- All API calls go through your backend
- No direct database access
- LINE tokens are kept secure
- User data is protected

---

Happy tracking! 🎉