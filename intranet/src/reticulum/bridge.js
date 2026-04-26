// bridge.js - Bridge between Intraset Network and Reticulum
// Connects the Intraset mesh network with Reticulum protocol

const EventEmitter = require('events');
const Router = require('./router');
const Packet = require('./packet');
const path = require('path');

class ReticulumBridge extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Reticulum router
        this.router = null;
        
        // Intraset server reference
        this.intrasetServer = options.intrasetServer;
        
        // Configuration
        this.config = {
            enabled: options.enabled !== false,
            identityPath: options.identityPath || path.join(__dirname, '../../data/reticulum_identity'),
            tcpPort: options.tcpPort || 3849,
            udpPort: options.udpPort || 3850,
            announceInterval: options.announceInterval || 60000,
            autoStart: options.autoStart !== false,
            ...options
        };
        
        // Bridge state
        this.running = false;
        this.connected = false;
        
        // Message queue
        this.messageQueue = [];
        this.processingQueue = false;
        
        // Statistics
        this.stats = {
            messagesToReticulum: 0,
            messagesFromReticulum: 0,
            bytesToReticulum: 0,
            bytesFromReticulum: 0,
            errors: 0
        };
    }

    /**
     * Initialize the bridge
     */
    async initialize() {
        if (!this.config.enabled) {
            console.log('[ReticulumBridge] Bridge disabled');
            return;
        }
        
        console.log('[ReticulumBridge] Initializing...');
        
        try {
            // Create Reticulum router
            this.router = new Router({
                identityPath: this.config.identityPath,
                tcpPort: this.config.tcpPort,
                udpPort: this.config.udpPort,
                announceInterval: this.config.announceInterval,
                autoStart: false
            });
            
            // Setup event handlers
            this.setupEventHandlers();
            
            // Start router
            await this.router.start();
            
            this.running = true;
            this.connected = true;
            
            console.log('[ReticulumBridge] Initialized successfully');
            console.log('[ReticulumBridge] Reticulum address:', this.router.identity.address);
            
            this.emit('initialized');
            
            return this;
            
        } catch (err) {
            console.error('[ReticulumBridge] Initialization error:', err.message);
            this.emit('error', err);
            throw err;
        }
    }

    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        // Router events
        this.router.on('started', () => {
            this.emit('router-started');
        });
        
        this.router.on('announce', (info) => {
            this.handleRemoteAnnounce(info);
        });
        
        this.router.on('data', (data) => {
            this.handleIncomingData(data);
        });
        
        this.router.on('link-established', (data) => {
            this.emit('link-established', data);
        });
        
        this.router.on('peer-discovered', (data) => {
            this.handlePeerDiscovery(data);
        });
        
        // Intraset WebSocket events
        if (this.intrasetServer && this.intrasetServer.wsServer) {
            this.intrasetServer.wsServer.on('mesh-message', (data) => {
                this.forwardToReticulum(data);
            });
        }
    }

    /**
     * Handle incoming data from Reticulum
     */
    handleIncomingData(data) {
        const { packet, source } = data;
        
        this.stats.messagesFromReticulum++;
        this.stats.bytesFromReticulum += packet.payload ? packet.payload.length : 0;
        
        try {
            // Parse message
            const message = this.parseMessage(packet.payload);
            
            // Forward to Intraset
            if (this.intrasetServer && this.intrasetServer.wsServer) {
                this.intrasetServer.wsServer.broadcast({
                    type: 'reticulum-message',
                    source: source,
                    message: message,
                    timestamp: Date.now()
                });
            }
            
            this.emit('message-received', {
                message: message,
                source: source,
                packet: packet
            });
            
        } catch (err) {
            console.error('[ReticulumBridge] Parse error:', err.message);
            this.stats.errors++;
        }
    }

    /**
     * Handle remote announce
     */
    handleRemoteAnnounce(info) {
        console.log('[ReticulumBridge] Remote announce:', info.address);
        
        // Add to Intraset nodes if connected
        if (this.intrasetServer && this.intrasetServer.services && this.intrasetServer.services.discovery) {
            this.intrasetServer.services.discovery.addManualPeer(
                info.address,
                3847,
                `Reticulum-${info.address.substring(0, 8)}`
            );
        }
        
        this.emit('remote-announce', info);
    }

    /**
     * Handle peer discovery
     */
    handlePeerDiscovery(data) {
        console.log('[ReticulumBridge] Peer discovered:', data.peerId);
        
        this.emit('peer-discovered', data);
    }

    /**
     * Forward message to Reticulum
     */
    async forwardToReticulum(data) {
        if (!this.running || !this.router) return;

        this.stats.messagesToReticulum++;

        try {
            const message = this.createMessage(data);
            const payload = Buffer.from(JSON.stringify(message));
            this.stats.bytesToReticulum += payload.length;

            if (data.targetNode) {
                // Send to specific node via link
                await this.router.sendData(data.targetNode, payload);
            } else {
                // Broadcast — announce + send through all interfaces
                await this.broadcastData(payload);
            }

            this.emit('message-sent', data);
        } catch (err) {
            console.error('[ReticulumBridge] Forward error:', err.message);
            this.stats.errors++;
            this.emit('error', err);
        }
    }

    /**
     * Broadcast data through all Reticulum interfaces
     */
    async broadcastData(payload) {
        // Create a DATA packet with broadcast destination
        const broadcastDest = Packet.Destination ? Packet.Destination.fromHash('ffffffffffffffffff') : null;

        const packet = new Packet.Packet({
            type: Packet.PACKET_TYPES.DATA,
            destination: broadcastDest,
            payload: payload,
            hops: 0
        });

        if (this.router.identity) {
            const Destination = Packet.Destination || require('./destination');
            packet.source = Destination.fromIdentity(this.router.identity);
            packet.setFlag(Packet.FLAGS.HAS_SOURCE);
        }

        // Send through every available interface
        let sent = 0;
        for (const [, iface] of this.router.interfaces) {
            try {
                await iface.sendPacket(packet);
                sent++;
            } catch (err) {
                console.error(`[ReticulumBridge] Broadcast send error on ${iface.name}:`, err.message);
            }
        }

        if (sent > 0) {
            console.log(`[ReticulumBridge] Broadcast via ${sent} interfaces`);
        }
    }

    /**
     * Create message from Intraset data
     */
    createMessage(data) {
        return {
            type: data.type || 'message',
            sender: this.router.identity.address,
            content: data.content,
            timestamp: Date.now(),
            metadata: data.metadata || {}
        };
    }

    /**
     * Parse message from Reticulum payload
     */
    parseMessage(payload) {
        if (!payload) {
            return null;
        }
        
        try {
            return JSON.parse(payload.toString());
        } catch (err) {
            // Return as text
            return {
                type: 'text',
                content: payload.toString()
            };
        }
    }

    /**
     * Send message to specific Reticulum node
     */
    async sendMessage(targetAddress, content, type = 'text') {
        const message = {
            type: type,
            content: content,
            sender: this.router.identity.address,
            timestamp: Date.now()
        };
        
        const payload = Buffer.from(JSON.stringify(message));
        
        return await this.router.sendData(targetAddress, payload);
    }

    /**
     * Broadcast message to network (both Intraset and Reticulum)
     */
    async broadcastMessage(content, type = 'text') {
        // Broadcast through Intraset WebSocket
        if (this.intrasetServer && this.intrasetServer.wsServer) {
            this.intrasetServer.wsServer.broadcast({
                type: 'reticulum-broadcast',
                content: content,
                messageType: type,
                sender: this.router.identity.address,
                timestamp: Date.now()
            });
        }

        // Broadcast through Reticulum
        const message = { type, content, sender: this.router.identity.address, timestamp: Date.now() };
        await this.broadcastData(Buffer.from(JSON.stringify(message)));
    }

    /**
     * Get bridge status
     */
    getStatus() {
        return {
            running: this.running,
            connected: this.connected,
            router: this.router ? this.router.getStatus() : null,
            stats: this.stats
        };
    }

    /**
     * Get Reticulum address
     */
    getAddress() {
        return this.router ? this.router.identity.address : null;
    }

    /**
     * Stop bridge
     */
    async stop() {
        if (!this.running) {
            return;
        }
        
        console.log('[ReticulumBridge] Stopping...');
        
        this.running = false;
        this.connected = false;
        
        if (this.router) {
            await this.router.destroy();
            this.router = null;
        }
        
        console.log('[ReticulumBridge] Stopped');
        this.emit('stopped');
    }

    /**
     * Destroy bridge
     */
    async destroy() {
        await this.stop();
        this.removeAllListeners();
    }
}

module.exports = ReticulumBridge;
