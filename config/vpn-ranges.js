// VPN IP ranges configuration
// Modify these ranges to match your VPN network configuration

module.exports = {
    // Allowed IP ranges for VPN access
    ALLOWED_IP_RANGES: [
        // Private network ranges (common VPN ranges)
        '10.0.0.0/8',      // 10.0.0.0 - 10.255.255.255
        '172.16.0.0/12',   // 172.16.0.0 - 172.31.255.255
        '192.168.0.0/16',  // 192.168.0.0 - 192.168.255.255
        
        // Localhost
        '127.0.0.1',       // IPv4 localhost
        '::1',             // IPv6 localhost
        'localhost',       // Hostname localhost
        
        // Add your specific VPN ranges here
        // Example: '203.0.113.0/24',  // Your VPN subnet
        // Example: '198.51.100.0/24', // Another VPN subnet
    ],
    
    // Specific IP addresses to always allow (optional)
    ALLOWED_IPS: [
        // Add specific IP addresses that should always be allowed
        // Example: '192.168.1.100',
        // Example: '10.0.0.50',
    ],
    
    // Enable/disable VPN access control
    ENABLE_VPN_CONTROL: true,
    
    // Logging configuration
    LOG_ACCESS_ATTEMPTS: true,
    LOG_DENIED_ACCESS: true,
    
    // Custom error messages
    ERROR_MESSAGES: {
        ACCESS_DENIED: 'Access denied. VPN connection required.',
        VPN_REQUIRED: 'This service is only accessible through VPN.',
        INVALID_IP: 'Invalid IP address detected.'
    }
};
