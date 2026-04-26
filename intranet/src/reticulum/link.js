// link.js - Link establishment for Reticulum
// Creates encrypted bidirectional connections between nodes

const EventEmitter = require('events');
const crypto = require('./crypto');
const Packet = require('./packet');

// Link states
const LINK_STATES = {
    CLOSED: 'closed',
    SETUP_SENT: 'setup-sent',
    SETUP_RECEIVED: 'setup-received',
    ESTABLISHED: 'established',
    FAILED: 'failed',
    TEARING_DOWN: 'tearing-down'
};

class Link extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.id = options.id || crypto.randomBytes(8).toString('hex');
        this.identity = options.identity; // Local identity
        this.remoteDestination = options.remoteDestination; // Remote destination
        this.remoteAddress = options.remoteAddress;
        
        this.state = LINK_STATES.CLOSED;
        this.createdAt = Date.now();
        this.establishedAt = null;
        this.lastActivity = Date.now();
        
        // Cryptographic state
        this.ephemeralKeys = null;
        this.sharedSecret = null;
        this.sessionKeys = null;
        this.remoteEphemeralKey = null;
        
        // Link parameters
        this.timeout = options.timeout || 30 * 1000; // 30 seconds
        this.keepAliveInterval = options.keepAliveInterval || 10 * 1000; // 10 seconds
        this.keepAliveTimer = null;
        this.timeoutTimer = null;
        
        // Sequence numbers for reliable delivery
        this.txSequence = 0;
        this.rxSequence = 0;
        
        // Statistics
        this.stats = {
            packetsSent: 0,
            packetsReceived: 0,
            bytesSent: 0,
            bytesReceived: 0,
            keepAlivesSent: 0
        };
    }

    /**
     * Initiate link setup (3-way handshake)
     */
    async initiateSetup() {
        if (this.state !== LINK_STATES.CLOSED) {
            throw new Error('Link not in closed state');
        }
        
        // Generate ephemeral keys for forward secrecy
        this.ephemeralKeys = crypto.generateEphemeralKeys();
        
        // Create link setup packet
        const setupPacket = Packet.Packet.createLinkSetup(
            this.remoteDestination,
            this.ephemeralKeys.publicKey,
            this.identity
        );
        
        this.state = LINK_STATES.SETUP_SENT;
        this.startTimeout();
        
        this.emit('setup-initiated', {
            linkId: this.id,
            packet: setupPacket
        });
        
        return setupPacket;
    }

    /**
     * Process received link setup
     */
    async processSetup(packet) {
        if (this.state !== LINK_STATES.CLOSED && this.state !== LINK_STATES.SETUP_SENT) {
            throw new Error('Cannot process setup in current state');
        }
        
        // Extract ephemeral key from packet
        this.remoteEphemeralKey = packet.payload;
        
        // Generate our ephemeral keys
        this.ephemeralKeys = crypto.generateEphemeralKeys();
        
        // Calculate shared secret
        await this.calculateSharedSecret();
        
        if (this.state === LINK_STATES.SETUP_SENT) {
            // Simultaneous setup - we're both setting up
            this.state = LINK_STATES.ESTABLISHED;
            this.establishedAt = Date.now();
            this.startKeepAlive();
            this.stopTimeout();
            
            this.emit('established', { linkId: this.id });
        } else {
            this.state = LINK_STATES.SETUP_RECEIVED;
            
            // Send setup response
            const responsePacket = Packet.Packet.createLinkSetup(
                this.remoteDestination,
                this.ephemeralKeys.publicKey,
                this.identity
            );
            
            this.emit('setup-response', {
                linkId: this.id,
                packet: responsePacket
            });
            
            return responsePacket;
        }
    }

    /**
     * Process setup response
     */
    async processSetupResponse(packet) {
        if (this.state !== LINK_STATES.SETUP_SENT) {
            throw new Error('Not waiting for setup response');
        }
        
        // Extract remote ephemeral key
        this.remoteEphemeralKey = packet.payload;
        
        // Calculate shared secret
        await this.calculateSharedSecret();
        
        this.state = LINK_STATES.ESTABLISHED;
        this.establishedAt = Date.now();
        this.startKeepAlive();
        this.stopTimeout();
        
        this.emit('established', { linkId: this.id });
    }

    /**
     * Calculate shared secret using ECDH
     */
    async calculateSharedSecret() {
        if (!this.ephemeralKeys || !this.remoteEphemeralKey) {
            throw new Error('Missing ephemeral keys');
        }
        
        // ECDH with ephemeral keys
        this.sharedSecret = crypto.ecdh(
            this.ephemeralKeys.secretKey,
            this.remoteEphemeralKey
        );
        
        // Derive session keys
        this.sessionKeys = crypto.deriveSessionKeys(this.sharedSecret);
    }

    /**
     * Send data over the link
     */
    async send(data) {
        if (this.state !== LINK_STATES.ESTABLISHED) {
            throw new Error('Link not established');
        }
        
        const payload = typeof data === 'string' ? Buffer.from(data) : data;
        
        // Create data packet
        const packet = new Packet.Packet({
            type: Packet.PACKET_TYPES.DATA,
            destination: this.remoteDestination,
            payload: payload
        });
        
        packet.setFlag(Packet.FLAGS.HAS_SOURCE);
        packet.setFlag(Packet.FLAGS.ENCRYPTED);
        
        // Encrypt with session keys
        packet.encrypt(this.sessionKeys.aesKey, this.sessionKeys.hmacKey);
        
        // Update sequence number
        packet.sequence = this.txSequence++;
        
        this.lastActivity = Date.now();
        this.stats.packetsSent++;
        this.stats.bytesSent += payload.length;
        
        this.emit('packet-ready', packet);
        
        return packet;
    }

    /**
     * Process received data packet
     */
    async processPacket(packet) {
        if (this.state !== LINK_STATES.ESTABLISHED) {
            throw new Error('Link not established');
        }
        
        // Decrypt packet
        if (packet.hasFlag(Packet.FLAGS.ENCRYPTED)) {
            packet.decrypt(this.sessionKeys.aesKey, this.sessionKeys.hmacKey);
        }
        
        // Check sequence number
        if (packet.sequence !== undefined) {
            if (packet.sequence < this.rxSequence) {
                this.emit('packet-duplicate', packet);
                return;
            }
            this.rxSequence = packet.sequence + 1;
        }
        
        this.lastActivity = Date.now();
        this.stats.packetsReceived++;
        this.stats.bytesReceived += packet.payload ? packet.payload.length : 0;
        
        this.emit('data', packet.payload);
    }

    /**
     * Send keep alive
     */
    sendKeepAlive() {
        if (this.state !== LINK_STATES.ESTABLISHED) {
            return;
        }
        
        const packet = new Packet.Packet({
            type: Packet.PACKET_TYPES.KEEPALIVE,
            destination: this.remoteDestination
        });
        
        this.lastActivity = Date.now();
        this.stats.keepAlivesSent++;
        
        this.emit('packet-ready', packet);
    }

    /**
     * Start keep alive timer
     */
    startKeepAlive() {
        if (this.keepAliveTimer) {
            clearInterval(this.keepAliveTimer);
        }
        
        this.keepAliveTimer = setInterval(() => {
            this.sendKeepAlive();
        }, this.keepAliveInterval);
    }

    /**
     * Start timeout timer
     */
    startTimeout() {
        this.stopTimeout();
        
        this.timeoutTimer = setTimeout(() => {
            if (this.state !== LINK_STATES.ESTABLISHED) {
                this.fail('timeout');
            }
        }, this.timeout);
    }

    /**
     * Stop timeout timer
     */
    stopTimeout() {
        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
            this.timeoutTimer = null;
        }
    }

    /**
     * Fail the link
     */
    fail(reason) {
        this.state = LINK_STATES.FAILED;
        this.stopKeepAlive();
        this.stopTimeout();
        
        this.emit('failed', { reason });
    }

    /**
     * Tear down the link
     */
    teardown() {
        if (this.state === LINK_STATES.CLOSED || this.state === LINK_STATES.FAILED) {
            return;
        }
        
        this.state = LINK_STATES.TEARING_DOWN;
        
        // Create teardown packet
        const packet = new Packet.Packet({
            type: Packet.PACKET_TYPES.LINK_TEARDOWN,
            destination: this.remoteDestination
        });
        
        this.emit('packet-ready', packet);
        
        // Close after short delay
        setTimeout(() => {
            this.close();
        }, 1000);
    }

    /**
     * Close the link
     */
    close() {
        this.state = LINK_STATES.CLOSED;
        this.stopKeepAlive();
        this.stopTimeout();
        
        // Clear cryptographic material
        this.sharedSecret = null;
        this.sessionKeys = null;
        this.ephemeralKeys = null;
        
        this.emit('closed');
    }

    /**
     * Stop keep alive timer
     */
    stopKeepAlive() {
        if (this.keepAliveTimer) {
            clearInterval(this.keepAliveTimer);
            this.keepAliveTimer = null;
        }
    }

    /**
     * Check if link is active
     */
    isActive() {
        return this.state === LINK_STATES.ESTABLISHED;
    }

    /**
     * Check if link is timed out
     */
    isTimedOut() {
        if (this.state !== LINK_STATES.ESTABLISHED) {
            return true;
        }
        
        return Date.now() - this.lastActivity > this.timeout;
    }

    /**
     * Get link info
     */
    getInfo() {
        return {
            id: this.id,
            state: this.state,
            remoteAddress: this.remoteAddress,
            established: this.establishedAt,
            uptime: this.establishedAt ? Date.now() - this.establishedAt : 0,
            lastActivity: this.lastActivity,
            stats: this.stats
        };
    }

    /**
     * Get link statistics
     */
    getStats() {
        return {
            ...this.stats,
            state: this.state,
            uptime: this.establishedAt ? Date.now() - this.establishedAt : 0
        };
    }

    /**
     * Destroy the link
     */
    destroy() {
        this.close();
        this.removeAllListeners();
    }
}

module.exports = { Link, LINK_STATES };
