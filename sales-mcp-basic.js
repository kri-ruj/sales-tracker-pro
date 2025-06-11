#!/usr/bin/env node

// Simple MCP Server for Sales Tracker
// This follows the JSON-RPC protocol for MCP

const log = (msg) => console.error(`[Sales MCP] ${msg}`);

// Send JSON-RPC response
const send = (response) => {
  const msg = JSON.stringify(response);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n${msg}`);
};

// Handle incoming requests
const handle = async (request) => {
  const { method, params, id } = request;
  
  try {
    if (method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'sales-mcp', version: '1.0.0' }
        }
      };
    }
    
    if (method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: [
            {
              name: 'sales_stats',
              description: 'Get sales statistics',
              inputSchema: {
                type: 'object',
                properties: {
                  period: { type: 'string', enum: ['daily', 'weekly', 'monthly'] }
                },
                required: ['period']
              }
            },
            {
              name: 'version',
              description: 'Check app version',
              inputSchema: { type: 'object', properties: {} }
            }
          ]
        }
      };
    }
    
    if (method === 'tools/call') {
      const { name, arguments: args } = params;
      
      if (name === 'sales_stats') {
        const text = `📊 Sales Stats (${args.period})\n\nTop Performers:\n1. John: 450 pts\n2. Jane: 380 pts\n3. Bob: 320 pts`;
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text }] }
        };
      }
      
      if (name === 'version') {
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: 'Version: 3.6.4' }] }
        };
      }
    }
    
    throw new Error(`Unknown method: ${method}`);
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32603, message: error.message }
    };
  }
};

// Main server
let buffer = '';
process.stdin.on('data', async (chunk) => {
  buffer += chunk;
  
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) break;
    
    const header = buffer.slice(0, headerEnd);
    const match = header.match(/Content-Length: (\d+)/);
    if (!match) break;
    
    const len = parseInt(match[1]);
    const start = headerEnd + 4;
    const end = start + len;
    
    if (buffer.length < end) break;
    
    const msg = buffer.slice(start, end);
    buffer = buffer.slice(end);
    
    try {
      const req = JSON.parse(msg);
      const res = await handle(req);
      send(res);
    } catch (e) {
      log(`Error: ${e.message}`);
    }
  }
});

log('Started');