// interface.js - Base interface for Reticulum
// Abstract base class for all interface types (TCP, UDP, RNode, etc.)

const EventEmitter = require('events');

// Interface types
const INTERFACE_TYPES = {
    TCP: 'tcp',
    UDP: 'udp',
    RNODE: 'rnode',
    I2P: 'i2p',
    SERIAL: 'serial',
    CUSTOM: 'custom'
};

// Interface states
const INTERFACE_STATES = {
    STOPPED: 'stopped',
    STARTING: 'starting',
    RUNNING: 'running',
    STOPPING: 'stopping',
    ERROR: 'error'
};

class Interface extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.id = options.id || `interface-${Date.now()}`;
        this.type = options.type || INTERFACE_TYPES.CUSTOM;
        this.name = options.name || this.type;
        
        this.state = INTERFACE_STATES.STOPPED;
        this.enabled = options.enabled !== false;
        
        // Interface configuration
        this.config = options.config || {};
        
        // Connected peers
        this.peers = new Map(); // peerId -> peer info
        
        // Packet statistics
        this.stats = {
            packetsIn: 0,
            packetsOut: 0,
            bytesIn: 0,
            bytesOut: 0,
            errors: 0,
            startedAt: null,
            lastActivity: null
        };
        
        // Interface properties
        this.properties = {
            bandwidth: options.bandwidth || null,
            maxTransfer_unit: options.mtu || 1500,
            broadcast_capable: options.broadcast || false,
            full_duplex: options.fullDuplex !== false
        };
    }

    /**
     * Start the interface
     */
    async start() {
        if (this.state !== INTERFACE_STATES.STOPPED) {
            throw new Error('Interface not stopped');
        }
        
        this.state = INTERFACE_STATES.STARTING;
        
        try {
            await this.onStart();
            this.state = INTERFACE_STATES.RUNNING;
            this.stats.startedAt = Date.now();
            
            this.emit('started');
            console.log(`[Interface] ${this.name} started`);
        } catch (err) {
            this.state = INTERFACE_STATES.ERROR;
            this.stats.errors++;
            this.emit('error', err);
            throw err;
        }
    }

    /**
     * Stop the interface
     */
    async stop() {
        if (this.state !== INTERFACE_STATES.RUNNING) {
            return;
        }
        
        this.state = INTERFACE_STATES.STOPPING;
        
        try {
            await this.onStop();
            this.state = INTERFACE_STATES.STOPPED;
            
            this.emit('stopped');
            console.log(`[Interface] ${this.name} stopped`);
        } catch (err) {
            this.state = INTERFACE_STATES.ERROR;
            this.stats.errors++;
            this.emit('error', err);
            throw err;
        }
    }

    /**
     * Send a packet through this interface
     */
    async sendPacket(packet, destination) {
        if (this.state !== INTERFACE_STATES.RUNNING) {
            throw new Error('Interface not running');
        }
        
        try {
            const bytesSent = await this.onSendPacket(packet, destination);
            
            this.stats.packetsOut++;
            this.stats.bytesOut += bytesSent || packet.toBuffer().length;
            this.stats.lastActivity = Date.now();
            
            this.emit('packet-sent', { packet, destination });
            
            return bytesSent;
        } catch (err) {
            this.stats.errors++;
            this.emit('error', err);
            throw err;
        }
    }

    /**
     * Handle received packet
     */
    handlePacket(packet, source) {
        if (this.state !== INTERFACE_STATES.RUNNING) {
            return;
        }
        
        this.stats.packetsIn++;
        this.stats.bytesIn += packet.toBuffer().length;
        this.stats.lastActivity = Date.now();
        
        this.emit('packet-received', { packet, source });
    }

    /**
     * Add a peer
     */
    addPeer(peerId, peerInfo) {
        this.peers.set(peerId, {
            ...peerInfo,
            connectedAt: Date.now(),
            lastSeen: Date.now()
        });
        
        this.emit('peer-connected', { peerId, peerInfo });
    }

    /**
     * Remove a peer
     */
    removePeer(peerId) {
        const peer = this.peers.get(peerId);
        if (peer) {
            this.peers.delete(peerId);
            this.emit('peer-disconnected', { peerId, peer });
        }
    }

    /**
     * Update peer last seen
     */
    updatePeer(peerId) {
        const peer = this.peers.get(peerId);
        if (peer) {
            peer.lastSeen = Date.now();
        }
    }

    /**
     * Get connected peers
     */
    getPeers() {
        return Array.from(this.peers.entries()).map(([id, info]) => ({
            id,
            ...info
        }));
    }

    /**
     * Check if peer is connected
     */
    hasPeer(peerId) {
        return this.peers.has(peerId);
    }

    /**
     * Get peer info
     */
    getPeer(peerId) {
        return this.peers.get(peerId);
    }

    /**
     * Get interface statistics
     */
    getStats() {
        return {
            ...this.stats,
            id: this.id,
            type: this.type,
            name: this.name,
            state: this.state,
            peers: this.peers.size,
            properties: this.properties
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            packetsIn: 0,
            packetsOut: 0,
            bytesIn: 0,
            bytesOut: 0,
            errors: 0,
            startedAt: this.stats.startedAt,
            lastActivity: this.stats.lastActivity
        };
    }

    /**
     * Abstract methods to be implemented by subclasses
     */
    async onStart() {
        throw new Error('onStart() must be implemented by subclass');
    }

    async onStop() {
        throw new Error('onStop() must be implemented by subclass');
    }

    async onSendPacket(packet, destination) {
        throw new Error('onSendPacket() must be implemented by subclass');
    }

    /**
     * Destroy the interface
     */
    async destroy() {
        await this.stop();
        this.peers.clear();
        this.removeAllListeners();
    }
}

module.exports = { Interface, INTERFACE_TYPES, INTERFACE_STATES };
