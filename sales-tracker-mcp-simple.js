#!/usr/bin/env node

import { z } from 'zod';

// Simple logging to stderr
const log = (message) => {
  console.error(`[Sales Tracker MCP] ${message}`);
};

// Read from stdin
const readInput = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString();
};

// Send response to stdout
const sendResponse = (response) => {
  const message = JSON.stringify(response);
  console.log(`Content-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`);
};

// Handle JSON-RPC requests
const handleRequest = async (request) => {
  const { method, params, id } = request;
  
  log(`Handling method: ${method}`);
  
  try {
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: 'sales-tracker-mcp',
              version: '1.0.0'
            }
          }
        };
        
      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: [
              {
                name: 'get_sales_stats',
                description: 'Get sales statistics for a specific period',
                inputSchema: {
                  type: 'object',
                  properties: {
                    period: {
                      type: 'string',
                      enum: ['daily', 'weekly', 'monthly'],
                      description: 'Time period for statistics'
                    }
                  },
                  required: ['period']
                }
              },
              {
                name: 'check_version',
                description: 'Check current app version',
                inputSchema: {
                  type: 'object',
                  properties: {}
                }
              }
            ]
          }
        };
        
      case 'tools/call':
        const { name, arguments: args } = params;
        
        if (name === 'get_sales_stats') {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: `📊 Sales Statistics - ${args.period.toUpperCase()}\n\n🏆 Top Performers:\n1. John Doe: 450 points (15 activities)\n2. Jane Smith: 380 points (12 activities)\n3. Bob Johnson: 320 points (10 activities)\n\n📈 Team Totals: 1,150 points from 37 activities`
                }
              ]
            }
          };
        }
        
        if (name === 'check_version') {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: 'Current app version: 3.6.4'
                }
              ]
            }
          };
        }
        
        throw new Error(`Unknown tool: ${name}`);
        
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: error.message
      }
    };
  }
};

// Main server loop
const main = async () => {
  log('Sales Tracker MCP Server starting...');
  
  let buffer = '';
  
  process.stdin.on('data', async (chunk) => {
    buffer += chunk.toString();
    
    // Look for complete messages
    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;
      
      // Parse content length
      const header = buffer.slice(0, headerEnd);
      const contentLengthMatch = header.match(/Content-Length: (\d+)/);
      if (!contentLengthMatch) {
        log('No content length found');
        break;
      }
      
      const contentLength = parseInt(contentLengthMatch[1]);
      const messageStart = headerEnd + 4;
      const messageEnd = messageStart + contentLength;
      
      if (buffer.length < messageEnd) break;
      
      // Extract and parse message
      const messageStr = buffer.slice(messageStart, messageEnd);
      buffer = buffer.slice(messageEnd);
      
      try {
        const message = JSON.parse(messageStr);
        log(`Received: ${JSON.stringify(message)}`);
        
        const response = await handleRequest(message);
        sendResponse(response);
      } catch (error) {
        log(`Error processing message: ${error.message}`);
      }
    }
  });
  
  process.stdin.on('end', () => {
    log('Server shutting down');
    process.exit(0);
  });
};

// Start server
main().catch((error) => {
  log(`Fatal error: ${error.message}`);
  process.exit(1);
});