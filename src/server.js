const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load VPN configuration
const vpnConfig = require('../config/vpn-ranges');

const app = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Session names configuration
const SESSION_NAMES_FILE = path.join(__dirname, '../config/session-names.json');

// Load session names
function loadSessionNames() {
  try {
    if (fs.existsSync(SESSION_NAMES_FILE)) {
      const data = fs.readFileSync(SESSION_NAMES_FILE, 'utf8');
      return JSON.parse(data).session_names || {};
    }
  } catch (error) {
    console.error('Error loading session names:', error);
  }
  return {};
}

// Save session names
function saveSessionNames(sessionNames) {
  try {
    const data = { session_names: sessionNames };
    fs.writeFileSync(SESSION_NAMES_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving session names:', error);
    return false;
  }
}
const PORT = process.env.PORT || 3000;

// Function to check if IP is in allowed ranges
function isIPAllowed(ip) {
    // If VPN control is disabled, allow all IPs
    if (!vpnConfig.ENABLE_VPN_CONTROL) {
        return true;
    }
    
    // Always allow localhost
    if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
        return true;
    }
    
    // Check specific allowed IPs
    if (vpnConfig.ALLOWED_IPS.includes(ip)) {
        return true;
    }
    
    // Check IP ranges (simplified implementation)
    const ipParts = ip.split('.').map(Number);
    
    return vpnConfig.ALLOWED_IP_RANGES.some(range => {
        if (range.includes('/')) {
            // CIDR notation - simplified check
            const [rangeIP, mask] = range.split('/');
            const rangeParts = rangeIP.split('.').map(Number);
            const maskNum = parseInt(mask);
            
            // Simple CIDR check (you might want a more robust implementation)
            if (maskNum >= 24) {
                // /24 or smaller - check first 3 octets
                return ipParts[0] === rangeParts[0] && 
                       ipParts[1] === rangeParts[1] && 
                       ipParts[2] === rangeParts[2];
            } else if (maskNum >= 16) {
                // /16 - check first 2 octets
                return ipParts[0] === rangeParts[0] && 
                       ipParts[1] === rangeParts[1];
            } else if (maskNum >= 8) {
                // /8 - check first octet
                return ipParts[0] === rangeParts[0];
            }
        } else {
            // Exact IP match
            return ip === range;
        }
        return false;
    });
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// VPN access control middleware
app.use((req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket?.remoteAddress;
    
    if (vpnConfig.LOG_ACCESS_ATTEMPTS) {
        console.log(`Access attempt from IP: ${clientIP}`);
    }
    
    if (!isIPAllowed(clientIP)) {
        if (vpnConfig.LOG_DENIED_ACCESS) {
            console.log(`Access denied for IP: ${clientIP}`);
        }
        return res.status(403).json({
            success: false,
            error: vpnConfig.ERROR_MESSAGES.ACCESS_DENIED,
            message: vpnConfig.ERROR_MESSAGES.VPN_REQUIRED
        });
    }
    
    if (vpnConfig.LOG_ACCESS_ATTEMPTS) {
        console.log(`Access granted for IP: ${clientIP}`);
    }
    next();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Utility function to execute shell commands
function executeCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject({ error: error.message, stderr });
      } else {
        resolve({ stdout: stdout.trim(), stderr });
      }
    });
  });
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/api', (req, res) => {
  res.json({
    message: 'Hello World from tmux-util service!',
    version: '1.0.0',
    endpoints: {
      '/': 'Web interface',
      '/api': 'This help message',
      '/health': 'Health check endpoint',
      '/tmux/sessions': 'List all tmux sessions',
      '/tmux/sessions/:session': 'Get info about specific tmux session',
      '/tmux/create/:session': 'Create a new tmux session',
      '/tmux/kill/:session': 'Kill a tmux session'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Tmux utility endpoints
app.get('/tmux/sessions', async (req, res) => {
  try {
    const result = await executeCommand('tmux list-sessions -F "#{session_name}:#{session_windows}:#{session_created}:#{session_attached}"');
    const sessionNames = loadSessionNames();
    
    const sessions = result.stdout.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [name, windows, created, attached] = line.split(':');
        return {
          name,
          friendly_name: sessionNames[name] || null,
          windows: parseInt(windows),
          created: new Date(parseInt(created) * 1000).toISOString(),
          attached: attached === '1'
        };
      });
    
    // Get basic window information for each session
    for (let session of sessions) {
      try {
        const windowResult = await executeCommand(`tmux list-windows -t ${session.name} -F "#{window_index}:#{window_name}:#{pane_current_command}" | head -1`);
        if (windowResult.stdout) {
          const [index, name, command] = windowResult.stdout.trim().split(':');
          
          // Try to get more detailed command information for the active window
          let detailedCommand = command || 'No command running';
          
          // Always try to get more detailed command information for any command
          try {
            // Get the active pane PID for this window
            const activePaneResult = await executeCommand(`tmux list-panes -t ${session.name}:${index} -F "#{pane_pid}:#{pane_active}" | grep ":1$" | head -1`);
            if (activePaneResult.stdout) {
              const [panePid] = activePaneResult.stdout.trim().split(':');
              if (panePid) {
                // First try to get child processes (this often gives us the full command)
                const childProcessResult = await executeCommand(`ps --ppid ${panePid} -o args= --no-headers 2>/dev/null | head -1`);
                if (childProcessResult.stdout && childProcessResult.stdout.trim()) {
                  detailedCommand = childProcessResult.stdout.trim();
                } else {
                  // If no child processes, try to get the process args directly
                  const processResult = await executeCommand(`ps -p ${panePid} -o args= --no-headers 2>/dev/null || echo "${command}"`);
                  if (processResult.stdout && processResult.stdout.trim() && processResult.stdout.trim() !== command) {
                    detailedCommand = processResult.stdout.trim();
                  }
                }
              }
            }
          } catch (processError) {
            // Fall back to the original command
            detailedCommand = command;
          }
          
          session.active_window = {
            index: parseInt(index),
            name: name || `Window ${index}`,
            command: detailedCommand
          };
        }
      } catch (windowError) {
        session.active_window = {
          index: 0,
          name: 'Window 0',
          command: 'Unknown'
        };
      }
    }
    
    res.json({
      success: true,
      sessions,
      count: sessions.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.error || 'Failed to list tmux sessions',
      details: error.stderr
    });
  }
});

app.get('/tmux/sessions/:session', async (req, res) => {
  const { session } = req.params;
  
  try {
    const result = await executeCommand(`tmux list-sessions -F "#{session_name}:#{session_windows}:#{session_created}:#{session_attached}" | grep "^${session}:"`);
    
    if (!result.stdout) {
      return res.status(404).json({
        success: false,
        error: `Session '${session}' not found`
      });
    }
    
    const [name, windows, created, attached] = result.stdout.split(':');
    
    // Get detailed session information including active processes
    const sessionNames = loadSessionNames();
    let sessionInfo = {
      name,
      friendly_name: sessionNames[name] || null,
      windows: parseInt(windows),
      created: new Date(parseInt(created) * 1000).toISOString(),
      attached: attached === '1',
      windows_info: []
    };
    
    // Get information about each window in the session
    try {
      const windowsResult = await executeCommand(`tmux list-windows -t ${session} -F "#{window_index}:#{window_name}:#{window_active}:#{pane_current_command}"`);
      
      if (windowsResult.stdout) {
        const windowLines = windowsResult.stdout.trim().split('\n');
        sessionInfo.windows_info = [];
        
        for (const line of windowLines) {
          const [index, name, active, command] = line.split(':');
          
          // Try to get more detailed command information for this window
          let detailedCommand = command || 'No command running';
          
          // Always try to get more detailed command information for any command
          try {
            // Get the active pane PID for this window
            const activePaneResult = await executeCommand(`tmux list-panes -t ${session}:${index} -F "#{pane_pid}:#{pane_active}" | grep ":1$" | head -1`);
            if (activePaneResult.stdout) {
              const [panePid] = activePaneResult.stdout.trim().split(':');
              if (panePid) {
                // First try to get child processes (this often gives us the full command)
                const childProcessResult = await executeCommand(`ps --ppid ${panePid} -o args= --no-headers 2>/dev/null | head -1`);
                if (childProcessResult.stdout && childProcessResult.stdout.trim()) {
                  detailedCommand = childProcessResult.stdout.trim();
                } else {
                  // If no child processes, try to get the process args directly
                  const processResult = await executeCommand(`ps -p ${panePid} -o args= --no-headers 2>/dev/null || echo "${command}"`);
                  if (processResult.stdout && processResult.stdout.trim() && processResult.stdout.trim() !== command) {
                    detailedCommand = processResult.stdout.trim();
                  }
                }
              }
            }
          } catch (processError) {
            // Fall back to the original command
            detailedCommand = command;
          }
          
          const windowInfo = {
            index: parseInt(index),
            name: name || `Window ${index}`,
            active: active === '1',
            command: detailedCommand,
            panes: []
          };
          
          // Get detailed pane information for this window
          try {
            const panesResult = await executeCommand(`tmux list-panes -t ${session}:${index} -F "#{pane_index}:#{pane_active}:#{pane_current_command}:#{pane_current_path}:#{pane_pid}:#{pane_title}:#{pane_left}:#{pane_top}:#{pane_width}:#{pane_height}"`);
            
            if (panesResult.stdout) {
              const paneLines = panesResult.stdout.trim().split('\n');
              windowInfo.panes = [];
              
              for (const paneLine of paneLines) {
                const [paneIndex, paneActive, paneCommand, panePath, panePid, paneTitle, paneLeft, paneTop, paneWidth, paneHeight] = paneLine.split(':');
                
                // Try to get more detailed command information
                let detailedCommand = paneCommand || 'No command running';
                
                // Always try to get more detailed command information for any command
                try {
                  // First try to get child processes (this often gives us the full command)
                  const childProcessResult = await executeCommand(`ps --ppid ${panePid} -o args= --no-headers 2>/dev/null | head -1`);
                  if (childProcessResult.stdout && childProcessResult.stdout.trim()) {
                    detailedCommand = childProcessResult.stdout.trim();
                  } else {
                    // If no child processes, try to get the process args directly
                    const processResult = await executeCommand(`ps -p ${panePid} -o args= --no-headers 2>/dev/null || echo "${paneCommand}"`);
                    if (processResult.stdout && processResult.stdout.trim() && processResult.stdout.trim() !== paneCommand) {
                      detailedCommand = processResult.stdout.trim();
                    }
                  }
                } catch (processError) {
                  // Fall back to the original command
                  detailedCommand = paneCommand;
                }
                
                windowInfo.panes.push({
                  index: parseInt(paneIndex),
                  active: paneActive === '1',
                  command: detailedCommand,
                  path: panePath || 'Unknown path',
                  pid: parseInt(panePid) || 0,
                  name: paneTitle || `Pane ${paneIndex}`,
                  left: parseInt(paneLeft) || 0,
                  top: parseInt(paneTop) || 0,
                  width: parseInt(paneWidth) || 0,
                  height: parseInt(paneHeight) || 0
                });
              }
            }
          } catch (paneError) {
            console.log(`Could not get pane info for window ${index}:`, paneError.error);
            // Add a default pane if we can't get pane info
            windowInfo.panes = [{
              index: 0,
              active: true,
              command: command || 'No command running',
              path: 'Unknown path',
              pid: 0
            }];
          }
          
          sessionInfo.windows_info.push(windowInfo);
        }
      }
    } catch (windowError) {
      console.log(`Could not get window info for session ${session}:`, windowError.error);
      // Continue without window info
    }
    
    res.json({
      success: true,
      session: sessionInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.error || 'Failed to get session info',
      details: error.stderr
    });
  }
});

app.post('/tmux/create/:session', async (req, res) => {
  const { session } = req.params;
  
  try {
    await executeCommand(`tmux new-session -d -s ${session}`);
    res.json({
      success: true,
      message: `Session '${session}' created successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.error || 'Failed to create session',
      details: error.stderr
    });
  }
});

app.delete('/tmux/kill/:session', async (req, res) => {
  const { session } = req.params;
  
  try {
    await executeCommand(`tmux kill-session -t ${session}`);
    res.json({
      success: true,
      message: `Session '${session}' killed successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.error || 'Failed to kill session',
      details: error.stderr
    });
  }
});

// Stream pane content
app.get('/tmux/sessions/:session/windows/:window/panes/:pane/stream', async (req, res) => {
  const { session, window, pane } = req.params;
  
  try {
    // Set headers for Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    let previousContent = '';
    let updateCount = 0;

    // Function to capture pane content with diff detection
    const capturePaneContent = async () => {
      try {
        const result = await executeCommand(`tmux capture-pane -t ${session}:${window}.${pane} -p`);
        const currentContent = result.stdout || '';
        
        if (currentContent !== previousContent) {
          // Determine the type of update
          let updateType = 'full';
          let content = currentContent;
          let startIndex = 0;
          
          if (currentContent.startsWith(previousContent)) {
            // It's an append
            updateType = 'append';
            content = currentContent.substring(previousContent.length);
            startIndex = previousContent.length;
          } else if (currentContent.length < previousContent.length) {
            // Content was truncated
            updateType = 'truncate';
          } else {
            // Find common prefix for partial update
            const commonPrefix = findCommonPrefix(previousContent, currentContent);
            if (commonPrefix.length > previousContent.length * 0.5) {
              updateType = 'partial';
              content = currentContent.substring(commonPrefix.length);
              startIndex = commonPrefix.length;
            }
          }
          
          res.write(`data: ${JSON.stringify({
            content: content,
            fullContent: currentContent,
            updateType: updateType,
            startIndex: startIndex,
            timestamp: new Date().toISOString(),
            updateCount: ++updateCount
          })}\n\n`);
          
          previousContent = currentContent;
        }
      } catch (error) {
        res.write(`data: ${JSON.stringify({
          error: 'Failed to capture pane content',
          details: error.error
        })}\n\n`);
      }
    };

    // Helper function to find common prefix
    const findCommonPrefix = (str1, str2) => {
      const minLength = Math.min(str1.length, str2.length);
      let commonLength = 0;
      
      for (let i = 0; i < minLength; i++) {
        if (str1[i] === str2[i]) {
          commonLength++;
        } else {
          break;
        }
      }
      
      return str1.substring(0, commonLength);
    };

    // Initial capture
    await capturePaneContent();

    // Set up periodic capture (every 1 second for more responsive updates)
    const interval = setInterval(async () => {
      try {
        await capturePaneContent();
      } catch (error) {
        clearInterval(interval);
        res.end();
      }
    }, 1000);

    // Handle client disconnect
    req.on('close', () => {
      clearInterval(interval);
      res.end();
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.error || 'Failed to stream pane content',
      details: error.stderr
    });
  }
});

// Get current pane content (single capture)
app.get('/tmux/sessions/:session/windows/:window/panes/:pane/content', async (req, res) => {
  const { session, window, pane } = req.params;
  
  try {
    const result = await executeCommand(`tmux capture-pane -t ${session}:${window}.${pane} -p`);
    
    res.json({
      success: true,
      content: result.stdout || '',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.error || 'Failed to get pane content',
      details: error.stderr
    });
  }
});

// Session names management
app.get('/tmux/session-names', (req, res) => {
  try {
    const sessionNames = loadSessionNames();
    res.json({
      success: true,
      session_names: sessionNames
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to load session names'
    });
  }
});

app.post('/tmux/session-names/:session', (req, res) => {
  const { session } = req.params;
  const { friendly_name } = req.body;
  
  if (!friendly_name || typeof friendly_name !== 'string' || friendly_name.trim() === '') {
    return res.status(400).json({
      success: false,
      error: 'Friendly name is required and must be a non-empty string'
    });
  }
  
  try {
    const sessionNames = loadSessionNames();
    sessionNames[session] = friendly_name.trim();
    
    if (saveSessionNames(sessionNames)) {
      res.json({
        success: true,
        message: `Friendly name '${friendly_name}' set for session '${session}'`,
        session_names: sessionNames
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to save session name'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update session name'
    });
  }
});

app.delete('/tmux/session-names/:session', (req, res) => {
  const { session } = req.params;
  
  try {
    const sessionNames = loadSessionNames();
    delete sessionNames[session];
    
    if (saveSessionNames(sessionNames)) {
      res.json({
        success: true,
        message: `Friendly name removed for session '${session}'`,
        session_names: sessionNames
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to save session names'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to remove session name'
    });
  }
});

// Generic tmux command execution endpoint
app.post('/tmux/command', (req, res) => {
  const { session, command } = req.body;
  
  if (!session || !command) {
    return res.status(400).json({
      success: false,
      error: 'Session and command are required'
    });
  }
  
  // Validate session exists
  exec(`tmux has-session -t ${session} 2>/dev/null`, (error) => {
    if (error) {
      return res.status(404).json({
        success: false,
        error: `Session '${session}' not found`
      });
    }
    
    // Execute the tmux command
    const fullCommand = `tmux ${command}`;
    exec(fullCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`tmux command error: ${error.message}`);
        return res.status(500).json({
          success: false,
          error: `Command failed: ${stderr || error.message}`
        });
      }
      
      res.json({
        success: true,
        message: 'Command executed successfully',
        output: stdout
      });
    });
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Something went wrong!'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 tmux-util service running on port ${PORT}`);
  console.log(`📖 Web interface available at http://0.0.0.0:${PORT}`);
  console.log(`📖 API documentation available at http://0.0.0.0:${PORT}/api`);
  console.log(`💚 Health check available at http://0.0.0.0:${PORT}/health`);
  console.log(`🌐 Accessible from any machine on the network`);
});

module.exports = app;
