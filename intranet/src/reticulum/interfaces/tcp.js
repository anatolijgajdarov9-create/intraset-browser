// tcp.js - TCP Interface for Reticulum
// TCP transport for connecting Reticulum nodes

const net = require('net');
const { Interface, INTERFACE_TYPES, INTERFACE_STATES } = require('../interface');
const Packet = require('../packet');

class TCPInterface extends Interface {
    constructor(options = {}) {
        super({
            ...options,
            type: INTERFACE_TYPES.TCP,
            name: options.name || `TCP-${options.config?.host || '0.0.0.0'}:${options.config?.port || 0}`
        });
        
        // TCP specific config
        this.host = options.config?.host || '0.0.0.0';
        this.port = options.config?.port || 3849;
        
        // TCP server and connections
        this.server = null;
        this.connections = new Map(); // socket -> connection info
        
        // Connection pooling
        this.maxConnections = options.config?.maxConnections || 100;
        this.connectionTimeout = options.config?.connectionTimeout || 30000;
        
        // Buffer for incoming data
        this.receiveBuffer = new Map(); // socket -> Buffer
    }

    /**
     * Start TCP interface
     */
    async onStart() {
        return new Promise((resolve, reject) => {
            this.server = net.createServer();
            
            this.server.on('connection', (socket) => {
                this.handleConnection(socket);
            });
            
            this.server.on('error', (err) => {
                console.error(`[TCP-${this.port}] Server error:`, err.message);
                this.stats.errors++;
                this.emit('error', err);
            });
            
            this.server.on('listening', () => {
                console.log(`[TCP-${this.port}] Listening on ${this.host}:${this.port}`);
                resolve();
            });
            
            this.server.listen(this.port, this.host);
        });
    }

    /**
     * Stop TCP interface
     */
    async onStop() {
        // Close all connections
        for (const [socket, info] of this.connections) {
            socket.destroy();
        }
        this.connections.clear();
        
        // Close server
        if (this.server) {
            return new Promise((resolve) => {
                this.server.close(() => {
                    this.server = null;
                    resolve();
                });
            });
        }
    }

    /**
     * Handle new connection
     */
    handleConnection(socket) {
        const remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`;
        const peerId = remoteAddress;
        
        console.log(`[TCP-${this.port}] Connection from ${remoteAddress}`);
        
        // Set socket options
        socket.setKeepAlive(true, 10000);
        socket.setTimeout(this.connectionTimeout);
        
        // Check max connections
        if (this.connections.size >= this.maxConnections) {
            console.log(`[TCP-${this.port}] Max connections reached, rejecting`);
            socket.destroy();
            return;
        }
        
        // Add peer
        this.addPeer(peerId, {
            address: remoteAddress,
            socket: socket,
            type: 'inbound'
        });
        
        // Initialize receive buffer
        this.receiveBuffer.set(socket, Buffer.alloc(0));
        
        // Handle data
        socket.on('data', (data) => {
            this.handleData(socket, data);
        });
        
        socket.on('close', () => {
            this.handleClose(socket);
        });
        
        socket.on('error', (err) => {
            console.error(`[TCP-${this.port}] Socket error from ${remoteAddress}:`, err.message);
            this.stats.errors++;
            this.handleClose(socket);
        });
        
        socket.on('timeout', () => {
            console.log(`[TCP-${this.port}] Connection timeout from ${remoteAddress}`);
            socket.destroy();
        });
    }

    /**
     * Handle incoming data with length-prefix framing
     * Frame format: [length: 4 bytes big-endian] [packet: N bytes]
     */
    handleData(socket, data) {
        // Append to buffer
        const buffer = this.receiveBuffer.get(socket) || Buffer.alloc(0);
        this.receiveBuffer.set(socket, Buffer.concat([buffer, data]));

        const fullBuffer = this.receiveBuffer.get(socket);

        // Process framed packets
        let offset = 0;
        while (offset < fullBuffer.length) {
            try {
                // Need at least 4 bytes for length prefix
                if (fullBuffer.length - offset < 4) {
                    break;
                }

                // Read packet length (4 bytes big-endian)
                const packetLength = fullBuffer.readUInt32BE(offset);

                // Sanity check: packet length should be reasonable
                if (packetLength < 4 || packetLength > 10 * 1024 * 1024) {
                    // Invalid length, skip byte and try to resync
                    console.warn(`[TCP-${this.port}] Invalid packet length: ${packetLength}, resyncing...`);
                    offset++;
                    this.stats.errors++;
                    continue;
                }

                // Check if we have the full packet data
                if (fullBuffer.length - offset < 4 + packetLength) {
                    break; // Wait for more data
                }

                // Extract packet buffer (skip length prefix)
                const packetBuffer = fullBuffer.slice(offset + 4, offset + 4 + packetLength);

                // Parse packet
                const packet = Packet.Packet.fromBuffer(packetBuffer);

                // Handle packet
                const peerId = `${socket.remoteAddress}:${socket.remotePort}`;
                this.handlePacket(packet, {
                    interface: this.id,
                    peerId: peerId,
                    address: peerId
                });

                offset += 4 + packetLength;
            } catch (err) {
                // Invalid packet, skip one byte and try to resync
                console.warn(`[TCP-${this.port}] Packet parse error, resyncing:`, err.message);
                offset++;
                this.stats.errors++;
            }
        }

        // Remove processed data from buffer
        if (offset > 0) {
            this.receiveBuffer.set(socket, fullBuffer.slice(offset));
        }
    }

    /**
     * Handle connection close
     */
    handleClose(socket) {
        const peerId = `${socket.remoteAddress}:${socket.remotePort}`;
        console.log(`[TCP-${this.port}] Connection closed: ${peerId}`);
        
        this.removePeer(peerId);
        this.connections.delete(socket);
        this.receiveBuffer.delete(socket);
    }

    /**
     * Send packet through TCP with length-prefix framing
     */
    async onSendPacket(packet, destination) {
        const packetBuffer = packet.toBuffer();

        // Prepend 4-byte length prefix (big-endian)
        const lengthPrefix = Buffer.alloc(4);
        lengthPrefix.writeUInt32BE(packetBuffer.length, 0);
        const framedBuffer = Buffer.concat([lengthPrefix, packetBuffer]);

        // Find connection for destination
        let socket = null;

        if (destination && destination.peerId) {
            const peer = this.peers.get(destination.peerId);
            if (peer && peer.socket) {
                socket = peer.socket;
            }
        }

        // If no specific destination, broadcast to all connections
        if (!socket) {
            // For now, just send to first available connection
            for (const [sock, info] of this.connections) {
                socket = sock;
                break;
            }
        }

        if (!socket || socket.destroyed) {
            throw new Error('No available TCP connection');
        }

        return new Promise((resolve, reject) => {
            socket.write(framedBuffer, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(framedBuffer.length);
                }
            });
        });
    }

    /**
     * Connect to remote TCP interface
     */
    async connectTo(host, port) {
        return new Promise((resolve, reject) => {
            const socket = new net.Socket();
            const peerId = `${host}:${port}`;
            
            socket.setTimeout(this.connectionTimeout);
            
            socket.on('connect', () => {
                console.log(`[TCP-${this.port}] Connected to ${host}:${port}`);
                
                this.connections.set(socket, {
                    address: peerId,
                    type: 'outbound',
                    connectedAt: Date.now()
                });
                
                this.addPeer(peerId, {
                    address: peerId,
                    socket: socket,
                    type: 'outbound'
                });
                
                this.receiveBuffer.set(socket, Buffer.alloc(0));
                
                socket.on('data', (data) => this.handleData(socket, data));
                socket.on('close', () => this.handleClose(socket));
                socket.on('error', (err) => {
                    console.error(`[TCP-${this.port}] Connection error to ${host}:${port}:`, err.message);
                    reject(err);
                });
                
                resolve(socket);
            });
            
            socket.on('error', (err) => {
                console.error(`[TCP-${this.port}] Connection failed to ${host}:${port}:`, err.message);
                reject(err);
            });
            
            socket.connect(port, host);
        });
    }

    /**
     * Get connected peers
     */
    getPeers() {
        return Array.from(this.peers.entries()).map(([id, info]) => ({
            id,
            address: info.address,
            type: info.type,
            connectedAt: info.connectedAt,
            lastSeen: info.lastSeen
        }));
    }

    /**
     * Get interface info
     */
    getInfo() {
        return {
            id: this.id,
            type: this.type,
            host: this.host,
            port: this.port,
            state: this.state,
            connections: this.connections.size,
            maxConnections: this.maxConnections
        };
    }
}

module.exports = TCPInterface;
