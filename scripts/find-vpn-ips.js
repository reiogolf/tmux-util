#!/usr/bin/env node

/**
 * Script to help identify VPN IP ranges
 * Run this script when connected to VPN to see your IP ranges
 */

const { exec } = require('child_process');
const os = require('os');

console.log('🔍 VPN IP Range Detection Tool');
console.log('==============================\n');

// Get local IP addresses
function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    
    Object.keys(interfaces).forEach(iface => {
        interfaces[iface].forEach(details => {
            if (details.family === 'IPv4' && !details.internal) {
                ips.push({
                    interface: iface,
                    ip: details.address,
                    netmask: details.netmask,
                    cidr: details.cidr
                });
            }
        });
    });
    
    return ips;
}

// Get public IP
function getPublicIP() {
    return new Promise((resolve, reject) => {
        exec('curl -s ifconfig.me', (error, stdout, stderr) => {
            if (error) {
                exec('curl -s ipinfo.io/ip', (error2, stdout2, stderr2) => {
                    if (error2) {
                        resolve('Could not determine public IP');
                    } else {
                        resolve(stdout2.trim());
                    }
                });
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

// Get routing information
function getRoutingInfo() {
    return new Promise((resolve, reject) => {
        exec('ip route show', (error, stdout, stderr) => {
            if (error) {
                // Fallback to netstat
                exec('netstat -rn', (error2, stdout2, stderr2) => {
                    if (error2) {
                        resolve('Could not get routing information');
                    } else {
                        resolve(stdout2);
                    }
                });
            } else {
                resolve(stdout);
            }
        });
    });
}

async function main() {
    console.log('📊 Current Network Information:');
    console.log('--------------------------------');
    
    // Local IPs
    const localIPs = getLocalIPs();
    console.log('\n🌐 Local IP Addresses:');
    localIPs.forEach(ip => {
        console.log(`  Interface: ${ip.interface}`);
        console.log(`  IP: ${ip.ip}`);
        console.log(`  Netmask: ${ip.netmask}`);
        console.log(`  CIDR: ${ip.cidr || 'N/A'}`);
        console.log('');
    });
    
    // Public IP
    const publicIP = await getPublicIP();
    console.log('🌍 Public IP Address:');
    console.log(`  ${publicIP}\n`);
    
    // Routing info
    const routingInfo = await getRoutingInfo();
    console.log('🛣️  Routing Information:');
    console.log(routingInfo);
    
    console.log('\n📝 VPN Configuration Recommendations:');
    console.log('=====================================');
    
    if (localIPs.length > 0) {
        console.log('\nAdd these ranges to your VPN configuration:');
        localIPs.forEach(ip => {
            if (ip.cidr) {
                console.log(`  '${ip.ip}/${ip.cidr.split('/')[1]}',`);
            } else {
                // Calculate CIDR from netmask
                const netmaskParts = ip.netmask.split('.').map(Number);
                const cidr = netmaskParts.reduce((acc, octet) => {
                    return acc + octet.toString(2).split('1').length - 1;
                }, 0);
                console.log(`  '${ip.ip}/${cidr}',`);
            }
        });
    }
    
    console.log('\n💡 Instructions:');
    console.log('1. Connect to your VPN');
    console.log('2. Run this script again');
    console.log('3. Compare the IP addresses to see which ones are VPN-related');
    console.log('4. Add the VPN IP ranges to config/vpn-ranges.js');
    console.log('5. Set ENABLE_VPN_CONTROL: true in the config');
}

main().catch(console.error);
