# tmux-util

A Node.js-based utility service for managing tmux sessions via HTTP API.

## Features

- 🚀 Hello World service with health checks
- 🌐 Modern web interface for easy session management
- 📋 List all tmux sessions
- 🔍 Get detailed information about specific tmux sessions
- ➕ Create new tmux sessions
- 🗑️ Kill existing tmux sessions
- 💚 Health monitoring endpoint
- 🔄 Auto-refresh and real-time status updates

## Installation

1. Clone or navigate to the project directory:
```bash
cd tmux-util
```

2. Install dependencies:
```bash
npm install
```

3. Configure VPN access (optional):
```bash
# Run VPN detection tool to identify your VPN IP ranges
npm run vpn-detect

# Edit config/vpn-ranges.js to add your VPN IP ranges
# Set ENABLE_VPN_CONTROL: true to enable VPN-only access
```

## Usage

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The service will start on port 3000 by default. You can change this by setting the `PORT` environment variable.

### Web Interface
Once the service is running, open your browser and navigate to:
- **Web Interface**: `http://localhost:3000/` (or your configured port)
- **API Documentation**: `http://localhost:3000/api`

## API Endpoints

### Base URL
- **GET** `/` - Service information and available endpoints

### Health Check
- **GET** `/health` - Service health status

### Tmux Sessions
- **GET** `/tmux/sessions` - List all tmux sessions with active window info
- **GET** `/tmux/sessions/:session` - Get detailed info about a specific session including all windows and panes
- **GET** `/tmux/sessions/:session/windows/:window/panes/:pane/content` - Get current pane content
- **GET** `/tmux/sessions/:session/windows/:window/panes/:pane/stream` - Stream live pane content (SSE)
- **GET** `/tmux/session-names` - Get all friendly session names
- **POST** `/tmux/session-names/:session` - Set friendly name for a session
- **DELETE** `/tmux/session-names/:session` - Remove friendly name for a session
- **POST** `/tmux/create/:session` - Create a new tmux session
- **DELETE** `/tmux/kill/:session` - Kill a tmux session

## Web Interface Features

The web interface provides a modern, responsive UI for managing tmux sessions:

- **Real-time Status**: Live service health monitoring and session count
- **Session Management**: Create, view, and kill sessions with a single click
- **Session Details Panel**: Detailed information panel for each session
- **Window Information**: Shows active windows and running commands
- **Pane Details**: Comprehensive pane information including paths and PIDs
- **Live Pane Streaming**: Click any pane to see its live content stream
- **Friendly Session Names**: Add custom names to tmux sessions for easier identification
- **Process Monitoring**: Displays what scripts/commands are running in each session
- **Visual Indicators**: Clear status indicators for attached/detached sessions
- **Auto-refresh**: Automatic updates every 30 seconds
- **Mobile Responsive**: Works on desktop and mobile devices
- **Error Handling**: User-friendly error messages and confirmations
- **Keyboard Support**: Press Escape to close details panel

## Example Usage

### Web Interface
Open your browser and go to `http://localhost:3000/` to use the web interface.

### API Usage

### Check service status
```bash
curl http://localhost:3000/health
```

### List all tmux sessions
```bash
curl http://localhost:3000/tmux/sessions
```

### Create a new session
```bash
curl -X POST http://localhost:3000/tmux/create/my-session
```

### Get session info
```bash
curl http://localhost:3000/tmux/sessions/my-session
```

### Kill a session
```bash
curl -X DELETE http://localhost:3000/tmux/kill/my-session
```

## Response Format

All endpoints return JSON responses with the following structure:

### Success Response
```json
{
  "success": true,
  "data": "...",
  "message": "..."
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error details"
}
```

## Requirements

- Node.js (v14 or higher)
- tmux installed on the system
- npm or yarn package manager

## Development

### Project Structure
```
tmux-util/
├── src/
│   └── server.js          # Main server file
├── public/
│   └── index.html         # Web interface
├── config/
│   └── vpn-ranges.js      # VPN access configuration
├── scripts/
│   └── find-vpn-ips.js    # VPN IP detection tool
├── package.json           # Project dependencies and scripts
└── README.md             # This file
```

### Available Scripts
- `npm start` - Start the production server
- `npm run dev` - Start the development server with auto-reload
- `npm run vpn-detect` - Detect VPN IP ranges for configuration
- `npm test` - Run tests (to be implemented)

## Configuration

### Session Names

Friendly names for tmux sessions are stored in `config/session-names.json`. This file is automatically created and managed by the service:

```json
{
  "session_names": {
    "session-id-1": "Friendly Name 1",
    "session-id-2": "Friendly Name 2"
  }
}
```

**Features:**
- **Automatic creation**: File is created when first friendly name is set
- **JSON format**: Easy to read and edit manually if needed
- **Persistent storage**: Names survive server restarts
- **Session mapping**: Maps tmux session IDs to friendly names

### VPN Configuration

The service includes VPN-based access control to ensure only authorized users can access the tmux management interface.

### Setting Up VPN Access Control

1. **Detect VPN IP Ranges**:
   ```bash
   npm run vpn-detect
   ```

2. **Configure VPN Ranges**:
   Edit `config/vpn-ranges.js` and add your VPN IP ranges:
   ```javascript
   ALLOWED_IP_RANGES: [
       '10.0.0.0/8',      // Your VPN subnet
       '172.16.0.0/12',   // Your VPN subnet
       '192.168.0.0/16',  // Your VPN subnet
       // Add your specific VPN ranges here
   ],
   ```

3. **Enable VPN Control**:
   Set `ENABLE_VPN_CONTROL: true` in the config file.

4. **Test Configuration**:
   Restart the server and test access from different IP addresses.

### VPN Detection Tool

The `npm run vpn-detect` command helps you identify:
- Current local IP addresses
- Network interfaces
- Public IP address
- Routing information
- Recommended VPN ranges to add

### Access Control Features

- **IP-based filtering**: Restrict access to specific IP ranges
- **VPN-only access**: Ensure only VPN-connected users can access
- **Configurable ranges**: Easy to update VPN IP ranges
- **Logging**: Track access attempts and denied requests
- **Localhost access**: Always allow local access for development

### Pane Monitoring Features

- **Pane-level details**: See information about each pane within windows
- **Current working directory**: Display the path where each pane is running
- **Process IDs**: Show the PID of processes running in each pane
- **Active pane indicators**: Visual indicators for which pane is currently active
- **Command tracking**: Monitor what commands are running in each pane

### Live Streaming Features

- **Real-time pane content**: Click any pane to see its live output stream
- **Server-Sent Events**: Efficient real-time updates using SSE
- **Stream controls**: Pause, resume, and refresh stream functionality
- **Auto-scroll**: Automatically scrolls to show latest content
- **Connection status**: Visual indicators for stream connection status
- **Error handling**: Automatic reconnection on connection errors
- **Mobile responsive**: Stream panel adapts to mobile devices

### Friendly Session Names

- **Custom naming**: Add human-readable names to tmux sessions
- **Persistent storage**: Names are saved in `config/session-names.json`
- **Visual distinction**: Friendly names displayed prominently with original names as subtitles
- **Easy management**: Add, edit, or remove names through the web interface
- **Session identification**: Quickly identify sessions by their purpose or project

## License

ISC

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request
