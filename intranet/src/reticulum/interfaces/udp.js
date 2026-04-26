// udp.js - UDP Interface for Reticulum
// UDP broadcast/multicast for local network discovery and communication

const dgram = require('dgram');
const { Interface, INTERFACE_TYPES } = require('../interface');
const Packet = require('../packet');

// Reticulum packet version/magic byte check
const RETICULUM_VERSION = 0x01;
const RETICULUM_MIN_SIZE = 17; // header(5) + destination(10) + minimal payload(2)

class UDPInterface extends Interface {
    constructor(options = {}) {
        super({
            ...options,
            type: INTERFACE_TYPES.UDP,
            name: options.name || `UDP-${options.config?.port || 0}`,
            broadcast: true
        });
        
        // UDP specific config
        this.port = options.config?.port || 3850;
        this.broadcastAddress = options.config?.broadcast || '255.255.255.255';
        this.multicastAddress = options.config?.multicast || null;
        this.multicastTTL = options.config?.multicastTTL || 1;
        
        // UDP sockets
        this.socket = null;
        this.broadcastSocket = null;
        
        // Known peers discovered via UDP
        this.discoveredPeers = new Map();
        
        // Discovery settings
        this.discoveryInterval = options.config?.discoveryInterval || 5000;
        this.discoveryTimer = null;
    }

    /**
     * Start UDP interface
     */
    async onStart() {
        // Create main UDP socket for receiving
        this.socket = dgram.createSocket({
            type: 'udp4',
            reuseAddr: true
        });
        
        this.socket.on('message', (msg, rinfo) => {
            this.handleMessage(msg, rinfo);
        });
        
        this.socket.on('error', (err) => {
            console.error(`[UDP-${this.port}] Socket error:`, err.message);
            this.stats.errors++;
            this.emit('error', err);
        });
        
        this.socket.on('listening', () => {
            const address = this.socket.address();
            console.log(`[UDP-${this.port}] Listening on ${address.address}:${address.port}`);
            
            // Join multicast if configured
            if (this.multicastAddress) {
                this.socket.setMulticastTTL(this.multicastTTL);
                this.socket.addMembership(this.multicastAddress);
                console.log(`[UDP-${this.port}] Joined multicast group ${this.multicastAddress}`);
            }
        });
        
        return new Promise((resolve, reject) => {
            this.socket.bind(this.port, '0.0.0.0', (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Stop UDP interface
     */
    async onStop() {
        this.stopDiscovery();
        
        if (this.socket) {
            if (this.multicastAddress) {
                this.socket.dropMembership(this.multicastAddress);
            }
            
            this.socket.close();
            this.socket = null;
        }
        
        if (this.broadcastSocket) {
            this.broadcastSocket.close();
            this.broadcastSocket = null;
        }
    }

    /**
     * Handle incoming UDP message with validation
     */
    handleMessage(msg, rinfo) {
        const peerId = `${rinfo.address}:${rinfo.port}`;

        // Quick validation: check version byte and minimum size
        if (msg.length < RETICULUM_MIN_SIZE || msg[0] !== RETICULUM_VERSION) {
            // Not a Reticulum packet — try discovery message
            this.handleDiscoveryMessage(msg, rinfo);
            return;
        }

        try {
            // Parse packet
            const packet = Packet.Packet.fromBuffer(msg);

            // Validate packet type
            if (!Object.values(Packet.PACKET_TYPES).includes(packet.type)) {
                this.handleDiscoveryMessage(msg, rinfo);
                return;
            }

            // Update peer
            this.updatePeer(peerId);
            this.addPeer(peerId, {
                address: rinfo.address,
                port: rinfo.port,
                lastSeen: Date.now()
            });

            // Handle packet
            this.handlePacket(packet, {
                interface: this.id,
                peerId: peerId,
                address: rinfo.address,
                port: rinfo.port
            });

        } catch (err) {
            // Might be a discovery message or invalid packet
            this.handleDiscoveryMessage(msg, rinfo);
        }
    }

    /**
     * Handle discovery message
     */
    handleDiscoveryMessage(msg, rinfo) {
        try {
            const message = JSON.parse(msg.toString());
            
            if (message.type === 'reticulum-discovery') {
                const peerId = `${rinfo.address}:${rinfo.port}`;
                
                this.discoveredPeers.set(peerId, {
                    address: rinfo.address,
                    port: rinfo.port,
                    nodeId: message.nodeId,
                    nodeName: message.nodeName,
                    lastSeen: Date.now()
                });
                
                this.emit('peer-discovered', {
                    peerId: peerId,
                    address: rinfo.address,
                    port: rinfo.port,
                    nodeId: message.nodeId,
                    nodeName: message.nodeName
                });
            }
        } catch (err) {
            // Not a discovery message
        }
    }

    /**
     * Send packet through UDP
     */
    async onSendPacket(packet, destination) {
        const buffer = packet.toBuffer();

        let targetAddress = this.broadcastAddress;
        let targetPort = this.port;

        if (destination) {
            if (destination.address) {
                targetAddress = destination.address;
            }
            if (destination.port) {
                targetPort = destination.port;
            }
        }

        // On Windows, broadcast to 255.255.255.255 often blocked — skip if no specific dest
        if (targetAddress === '255.255.255.255' && !destination) {
            return 0;
        }

        return new Promise((resolve, reject) => {
            this.socket.send(buffer, 0, buffer.length, targetPort, targetAddress, (err, bytes) => {
                if (err) {
                    // Gracefully handle permission errors on Windows
                    if (err.code === 'EACCES') {
                        console.log(`[UDP-${this.port}] Broadcast blocked (EACCES), skipping`);
                        resolve(0);
                    } else {
                        reject(err);
                    }
                } else {
                    resolve(bytes);
                }
            });
        });
    }

    /**
     * Broadcast discovery message
     */
    broadcastDiscovery(nodeId, nodeName) {
        // Skip on Windows if broadcast address would fail
        if (this.broadcastAddress === '255.255.255.255') {
            console.log(`[UDP-${this.port}] Discovery broadcast skipped on Windows (EACCES prevention)`);
            return Promise.resolve(0);
        }

        const message = JSON.stringify({
            type: 'reticulum-discovery',
            nodeId: nodeId,
            nodeName: nodeName,
            timestamp: Date.now()
        });

        const buffer = Buffer.from(message);

        return new Promise((resolve, reject) => {
            this.socket.send(buffer, 0, buffer.length, this.port, this.broadcastAddress, (err, bytes) => {
                if (err) {
                    if (err.code === 'EACCES') {
                        console.log(`[UDP-${this.port}] Discovery broadcast blocked (EACCES), skipping`);
                        resolve(0);
                    } else {
                        reject(err);
                    }
                } else {
                    resolve(bytes);
                }
            });
        });
    }

    /**
     * Start periodic discovery
     */
    startDiscovery(nodeId, nodeName) {
        this.stopDiscovery();
        
        // Send initial discovery
        this.broadcastDiscovery(nodeId, nodeName);
        
        // Start periodic discovery
        this.discoveryTimer = setInterval(() => {
            this.broadcastDiscovery(nodeId, nodeName);
        }, this.discoveryInterval);
    }

    /**
     * Stop discovery
     */
    stopDiscovery() {
        if (this.discoveryTimer) {
            clearInterval(this.discoveryTimer);
            this.discoveryTimer = null;
        }
    }

    /**
     * Get discovered peers
     */
    getDiscoveredPeers() {
        return Array.from(this.discoveredPeers.values());
    }

    /**
     * Send to multicast address
     */
    async sendMulticast(packet) {
        if (!this.multicastAddress) {
            throw new Error('Multicast not configured');
        }
        
        const buffer = packet.toBuffer();
        
        return new Promise((resolve, reject) => {
            this.socket.send(buffer, 0, buffer.length, this.port, this.multicastAddress, (err, bytes) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(bytes);
                }
            });
        });
    }

    /**
     * Get interface info
     */
    getInfo() {
        return {
            id: this.id,
            type: this.type,
            port: this.port,
            broadcastAddress: this.broadcastAddress,
            multicastAddress: this.multicastAddress,
            state: this.state,
            discoveredPeers: this.discoveredPeers.size
        };
    }
}

module.exports = UDPInterface;
