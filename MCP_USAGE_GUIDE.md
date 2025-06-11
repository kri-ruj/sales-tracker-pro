# MCP Servers Usage Guide

## How to Use MCP Servers in Claude

MCP servers extend Claude's capabilities with specialized tools. Once configured, you can use them directly in your conversations.

## Available MCP Servers

### 1. **Sales Tracker** (Custom)
Your custom sales tracking server with these tools:
- `mcp__sales-tracker__get_sales_stats` - Get sales statistics
- `mcp__sales-tracker__check_version` - Check app version
- `mcp__sales-tracker__list_activities` - List recent activities
- `mcp__sales-tracker__generate_report` - Generate reports
- `mcp__sales-tracker__send_line_notification` - Send LINE messages
- `mcp__sales-tracker__analyze_performance` - AI analysis

**Example usage:**
```
"Check the current app version"
"Generate a weekly sales report in markdown format"
"Send a LINE notification about today's achievements"
```

### 2. **Brave Search**
Web search capabilities (requires API key from https://brave.com/search/api/)
- `mcp__brave-search__brave_web_search` - Search the web
- `mcp__brave-search__brave_local_search` - Search local businesses

**To get API key:**
1. Visit https://brave.com/search/api/
2. Sign up for free tier (2000 queries/month)
3. Update config with your API key

### 3. **Memory**
Persistent knowledge graph storage:
- `mcp__memory__create_entities` - Store information
- `mcp__memory__search_nodes` - Search stored data
- `mcp__memory__create_relations` - Link information

**Example usage:**
```
"Remember that our next meeting is on Friday at 3 PM"
"What did I tell you about the project deadline?"
```

### 4. **Filesystem**
File operations in your project directory:
- `mcp__filesystem__read_file` - Read files
- `mcp__filesystem__write_file` - Create/update files
- `mcp__filesystem__list_directory` - Browse folders
- `mcp__filesystem__search_files` - Find files

### 5. **GitHub**
GitHub repository management:
- `mcp__github__create_issue` - Create issues
- `mcp__github__create_pull_request` - Create PRs
- `mcp__github__search_repositories` - Search repos

**Needs:** GitHub Personal Access Token

### 6. **Puppeteer**
Browser automation:
- `mcp__puppeteer__puppeteer_navigate` - Go to URL
- `mcp__puppeteer__puppeteer_screenshot` - Take screenshots
- `mcp__puppeteer__puppeteer_click` - Click elements
- `mcp__puppeteer__puppeteer_fill` - Fill forms

### 7. **LINE Bot**
Send LINE messages directly:
- Already configured with your channel token
- Can send messages to users/groups

### 8. **Context7**
Advanced context management for conversations

### 9. **Taskmaster AI**
Task and project management with AI assistance

### 10. **Figma**
Access and manage Figma designs

### 11. **Notion**
Read/write Notion pages and databases

### 12. **HuggingFace**
Access AI models and datasets

## How to Use in Conversation

Simply ask Claude to use any of these capabilities naturally:

**Examples:**
- "Search the web for the latest AI news"
- "Take a screenshot of google.com"
- "Create a GitHub issue about the bug we found"
- "Remember this information for later"
- "Read the package.json file"
- "Send a LINE message to notify about deployment"

## Setting Up API Keys

For servers that need API keys:

1. **Brave Search**: 
   - Get key from https://brave.com/search/api/
   - Update in config: `"BRAVE_API_KEY": "your-key"`

2. **GitHub**:
   - Create token at https://github.com/settings/tokens
   - Update: `"GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token"`

3. **Exa**:
   - Get key from https://exa.ai/
   - Update URL: `exaApiKey=your-key`

## Troubleshooting

1. **Server not responding**: Restart Claude Desktop
2. **Permission errors**: Check file/folder permissions
3. **API errors**: Verify API keys are valid
4. **Tools not available**: Ensure MCP server is in config

## Quick Test Commands

Test if MCP servers are working:
```
"Check sales tracker version"
"Read the README.md file"
"Search my memory for recent tasks"
"Take a screenshot of this conversation"
```