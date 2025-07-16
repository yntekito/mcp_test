const express = require('express');
const { Server } = require('socket.io');
const { createServer } = require('http');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const server = createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static('public'));

// MCP Server instance
let mcpProcess = null;

// Start MCP server
function startMCPServer() {
  if (mcpProcess) {
    mcpProcess.kill();
  }
  
  mcpProcess = spawn('node', ['mcp-server.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: __dirname
  });

  mcpProcess.stderr.on('data', (data) => {
    console.log('MCP Server:', data.toString());
  });

  mcpProcess.on('close', (code) => {
    console.log(`MCP Server exited with code ${code}`);
  });

  return mcpProcess;
}

// Handle MCP requests
async function sendMCPRequest(request) {
  return new Promise((resolve, reject) => {
    if (!mcpProcess) {
      startMCPServer();
    }

    let response = '';
    let errorOutput = '';

    const timeout = setTimeout(() => {
      reject(new Error('MCP request timeout'));
    }, 10000);

    mcpProcess.stdout.on('data', (data) => {
      response += data.toString();
      try {
        const jsonResponse = JSON.parse(response);
        clearTimeout(timeout);
        resolve(jsonResponse);
      } catch (e) {
        // Still receiving data
      }
    });

    mcpProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    mcpProcess.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    mcpProcess.stdin.write(JSON.stringify(request) + '\n');
  });
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Handle chat messages
  socket.on('chat_message', async (data) => {
    const { message } = data;
    console.log('Received message:', message);

    try {
      // Parse the message to determine the action
      const response = await parseAndExecuteCommand(message);
      
      socket.emit('chat_response', {
        type: 'success',
        message: response
      });
    } catch (error) {
      socket.emit('chat_response', {
        type: 'error',
        message: `エラー: ${error.message}`
      });
    }
  });

  // Handle direct MCP requests
  socket.on('mcp_request', async (request) => {
    try {
      const response = await sendMCPRequest(request);
      socket.emit('mcp_response', response);
    } catch (error) {
      socket.emit('mcp_response', {
        error: error.message
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Parse natural language commands and execute MCP calls
async function parseAndExecuteCommand(message) {
  const lowerMessage = message.toLowerCase();

  try {
    // List available tools
    if (lowerMessage.includes('ツール') || lowerMessage.includes('機能') || lowerMessage.includes('help')) {
      const toolsRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      };
      
      const response = await sendMCPRequest(toolsRequest);
      if (response.result && response.result.tools) {
        return `利用可能なツール:\n\n${response.result.tools.map(tool => 
          `• ${tool.name}: ${tool.description}`
        ).join('\n')}`;
      }
    }

    // Get EC2 CPU metrics
    if (lowerMessage.includes('ec2') && lowerMessage.includes('cpu')) {
      const instanceIdMatch = message.match(/i-[a-zA-Z0-9]+/);
      const instanceId = instanceIdMatch ? instanceIdMatch[0] : 'i-1234567890abcdef0';
      
      const hoursMatch = message.match(/(\d+)\s*時間/);
      const hours = hoursMatch ? parseInt(hoursMatch[1]) : 1;

      const mcpRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'get_ec2_cpu_metrics',
          arguments: {
            instanceId: instanceId,
            hours: hours
          }
        }
      };

      const response = await sendMCPRequest(mcpRequest);
      if (response.result && response.result.content) {
        return response.result.content[0].text;
      }
    }

    // List CloudWatch metrics
    if (lowerMessage.includes('メトリクス') && lowerMessage.includes('一覧')) {
      const namespaceMatch = message.match(/AWS\/[A-Z0-9]+/i);
      const namespace = namespaceMatch ? namespaceMatch[0] : undefined;

      const mcpRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'list_cloudwatch_metrics',
          arguments: {
            ...(namespace && { namespace })
          }
        }
      };

      const response = await sendMCPRequest(mcpRequest);
      if (response.result && response.result.content) {
        return response.result.content[0].text;
      }
    }

    // Get specific CloudWatch metrics
    if (lowerMessage.includes('cloudwatch') || lowerMessage.includes('メトリクス')) {
      const namespaceMatch = message.match(/AWS\/[A-Z0-9]+/i);
      const namespace = namespaceMatch ? namespaceMatch[0] : 'AWS/EC2';
      
      const metricMatch = message.match(/([A-Z][a-zA-Z]+)/);
      const metricName = metricMatch ? metricMatch[0] : 'CPUUtilization';

      const mcpRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'get_cloudwatch_metrics',
          arguments: {
            namespace: namespace,
            metricName: metricName
          }
        }
      };

      const response = await sendMCPRequest(mcpRequest);
      if (response.result && response.result.content) {
        return response.result.content[0].text;
      }
    }

    // Default response
    return `理解できませんでした。以下のコマンドを試してください:\n\n` +
           `• "EC2のCPU使用率を取得して" または "EC2 i-1234567890abcdef0 のCPU 2時間"\n` +
           `• "CloudWatchメトリクス一覧" または "AWS/EC2 メトリクス一覧"\n` +
           `• "CloudWatch AWS/EC2 CPUUtilization メトリクス"\n` +
           `• "利用可能なツール" または "help"`;

  } catch (error) {
    throw new Error(`コマンド実行エラー: ${error.message}`);
  }
}

// Start MCP server on startup
startMCPServer();

// Start web server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  if (mcpProcess) {
    mcpProcess.kill();
  }
  process.exit(0);
});