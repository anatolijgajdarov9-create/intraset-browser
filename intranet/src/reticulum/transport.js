// transport.js - Transport layer for Reticulum
// Manages reliable sessions and data streams over links

const EventEmitter = require('events');
const { Link, LINK_STATES } = require('./link');

class Transport extends EventEmitter {
    constructor(options = {}) {
        super();

        // Local identity — required for link setup
        this.identity = options.identity || null;

        // Active links
        this.links = new Map(); // linkId -> Link
        this.pendingLinks = new Map(); // remoteAddress -> Link (during setup)
        
        // Sessions (reliable data streams)
        this.sessions = new Map(); // sessionId -> Session
        
        // Configuration
        this.maxLinks = options.maxLinks || 100;
        this.maxSessions = options.maxSessions || 200;
        this.sessionTimeout = options.sessionTimeout || 5 * 60 * 1000; // 5 minutes
        
        // Statistics
        this.stats = {
            totalLinksCreated: 0,
            totalLinksEstablished: 0,
            totalLinksFailed: 0,
            totalSessions: 0,
            totalBytesSent: 0,
            totalBytesReceived: 0
        };
    }

    /**
     * Create a new link to remote destination
     */
    async createLink(options) {
        if (this.links.size >= this.maxLinks) {
            throw new Error('Maximum links reached');
        }
        
        const link = new Link(options);
        this.links.set(link.id, link);
        this.stats.totalLinksCreated++;
        
        // Setup event handlers
        link.on('setup-initiated', (data) => {
            this.emit('link-setup-initiated', { linkId: link.id, packet: data.packet });
        });
        
        link.on('setup-response', (data) => {
            this.emit('link-setup-response', { linkId: link.id, packet: data.packet });
        });
        
        link.on('established', () => {
            this.stats.totalLinksEstablished++;
            this.emit('link-established', { linkId: link.id });
        });
        
        link.on('failed', (data) => {
            this.stats.totalLinksFailed++;
            this.emit('link-failed', { linkId: link.id, reason: data.reason });
        });
        
        link.on('closed', () => {
            this.links.delete(link.id);
            this.emit('link-closed', { linkId: link.id });
        });
        
        link.on('data', (data) => {
            this.emit('link-data', { linkId: link.id, data: data });
        });
        
        link.on('packet-ready', (packet) => {
            this.emit('send-packet', packet);
        });
        
        return link;
    }

    /**
     * Process incoming link setup packet
     */
    async processLinkSetup(packet, source) {
        const remoteAddress = source.address || source.peerId;

        // Check if we already have a pending link
        let link = this.pendingLinks.get(remoteAddress);

        if (!link) {
            // Create new link
            link = await this.createLink({
                remoteAddress: remoteAddress,
                identity: this.identity
            });

            this.pendingLinks.set(remoteAddress, link);
        }

        // Process setup
        const responsePacket = await link.processSetup(packet);

        return responsePacket;
    }

    /**
     * Process incoming link setup response
     */
    async processLinkSetupResponse(packet, source) {
        const remoteAddress = source.address || source.peerId;
        const link = this.pendingLinks.get(remoteAddress);
        
        if (!link) {
            console.warn('[Transport] No pending link for', remoteAddress);
            return;
        }
        
        await link.processSetupResponse(packet);
        
        // Move from pending to established
        this.pendingLinks.delete(remoteAddress);
    }

    /**
     * Send data over a link
     */
    async send(linkId, data) {
        const link = this.links.get(linkId);
        
        if (!link) {
            throw new Error('Link not found');
        }
        
        const packet = await link.send(data);
        this.stats.totalBytesSent += data.length;
        
        return packet;
    }

    /**
     * Create a reliable session
     */
    createSession(linkId, options = {}) {
        const link = this.links.get(linkId);
        
        if (!link || !link.isActive()) {
            throw new Error('Link not active');
        }
        
        if (this.sessions.size >= this.maxSessions) {
            throw new Error('Maximum sessions reached');
        }
        
        const sessionId = `session-${Date.now()}-${this.stats.totalSessions}`;
        
        const session = new Session({
            sessionId: sessionId,
            link: link,
            ...options
        });
        
        this.sessions.set(sessionId, session);
        this.stats.totalSessions++;
        
        // Setup event handlers
        session.on('data', (data) => {
            this.emit('session-data', { sessionId, data });
        });
        
        session.on('closed', () => {
            this.sessions.delete(sessionId);
            this.emit('session-closed', { sessionId });
        });
        
        session.on('error', (err) => {
            this.emit('session-error', { sessionId, error: err });
        });
        
        session.on('send-packet', (packet) => {
            this.emit('send-packet', packet);
        });
        
        return session;
    }

    /**
     * Get link by ID
     */
    getLink(linkId) {
        return this.links.get(linkId);
    }

    /**
     * Get session by ID
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }

    /**
     * Get all active links
     */
    getActiveLinks() {
        return Array.from(this.links.values()).filter(link => link.isActive());
    }

    /**
     * Get all sessions
     */
    getAllSessions() {
        return Array.from(this.sessions.values());
    }

    /**
     * Close a link
     */
    closeLink(linkId) {
        const link = this.links.get(linkId);
        
        if (link) {
            link.teardown();
        }
    }

    /**
     * Close a session
     */
    closeSession(sessionId) {
        const session = this.sessions.get(sessionId);
        
        if (session) {
            session.close();
        }
    }

    /**
     * Cleanup inactive links and sessions
     */
    cleanup() {
        let cleaned = 0;
        const now = Date.now();
        
        // Cleanup timed out links
        for (const [id, link] of this.links) {
            if (link.isTimedOut()) {
                link.close();
                cleaned++;
            }
        }
        
        // Cleanup timed out sessions
        for (const [id, session] of this.sessions) {
            if (now - session.lastActivity > this.sessionTimeout) {
                session.close();
                cleaned++;
            }
        }
        
        // Clear old pending links
        for (const [address, link] of this.pendingLinks) {
            if (now - link.createdAt > 60000) { // 1 minute timeout
                link.fail('timeout');
                this.pendingLinks.delete(address);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            this.emit('cleanup', { cleaned });
        }
        
        return cleaned;
    }

    /**
     * Get transport statistics
     */
    getStats() {
        return {
            ...this.stats,
            activeLinks: this.getActiveLinks().length,
            pendingLinks: this.pendingLinks.size,
            activeSessions: this.sessions.size
        };
    }

    /**
     * Start periodic cleanup
     */
    startCleanup(interval = 30 * 1000) {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, interval);
        
        return this;
    }

    /**
     * Stop cleanup timer
     */
    stopCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    /**
     * Destroy transport
     */
    destroy() {
        this.stopCleanup();
        
        // Close all links
        for (const link of this.links.values()) {
            link.destroy();
        }
        
        // Close all sessions
        for (const session of this.sessions.values()) {
            session.close();
        }
        
        this.links.clear();
        this.pendingLinks.clear();
        this.sessions.clear();
        this.removeAllListeners();
    }
}

/**
 * Session - Reliable data stream over a link
 */
class Session extends EventEmitter {
    constructor(options) {
        super();
        
        this.sessionId = options.sessionId;
        this.link = options.link;
        this.compression = options.compression !== false;
        
        // Sequence numbers
        this.txSequence = 0;
        this.rxSequence = 0;
        
        // Buffer for out-of-order packets
        this.receiveBuffer = new Map();
        this.expectedSequence = 0;
        
        // Fragment support
        this.maxFragmentSize = options.maxFragmentSize || 1024;
        this.fragments = new Map(); // fragmentId -> { chunks, total }
        
        this.lastActivity = Date.now();
        this.createdAt = Date.now();
    }

    /**
     * Send data through session
     */
    async send(data) {
        const payload = typeof data === 'string' ? Buffer.from(data) : data;
        
        // Fragment if too large
        if (payload.length > this.maxFragmentSize) {
            return this.sendFragmented(payload);
        }
        
        // Create packet with sequence number
        const packet = await this.link.send(Buffer.concat([
            Buffer.from([0x01]), // Data type
            Buffer.from([this.txSequence & 0xFF]), // Sequence number
            payload
        ]));
        
        this.txSequence = (this.txSequence + 1) & 0xFF;
        this.lastActivity = Date.now();
        
        return packet;
    }

    /**
     * Send fragmented data
     */
    async sendFragmented(data) {
        const fragmentId = Math.floor(Math.random() * 65536);
        const totalFragments = Math.ceil(data.length / this.maxFragmentSize);
        
        for (let i = 0; i < totalFragments; i++) {
            const start = i * this.maxFragmentSize;
            const end = Math.min(start + this.maxFragmentSize, data.length);
            const chunk = data.slice(start, end);
            
            // Fragment header: type (1) + fragment_id (2) + fragment_num (2) + total (2)
            const header = Buffer.concat([
                Buffer.from([0x02]), // Fragment type
                Buffer.from([(fragmentId >> 8) & 0xFF, fragmentId & 0xFF]),
                Buffer.from([(i >> 8) & 0xFF, i & 0xFF]),
                Buffer.from([(totalFragments >> 8) & 0xFF, totalFragments & 0xFF])
            ]);
            
            await this.link.send(Buffer.concat([header, chunk]));
        }
    }

    /**
     * Process received packet
     */
    processPacket(packet) {
        this.lastActivity = Date.now();
        
        if (!packet.payload || packet.payload.length < 2) {
            return;
        }
        
        const type = packet.payload[0];
        
        if (type === 0x01) {
            // Regular data
            const sequence = packet.payload[1];
            const data = packet.payload.slice(2);
            
            // Check for duplicates
            if (sequence < this.expectedSequence) {
                return;
            }
            
            this.expectedSequence = (sequence + 1) & 0xFF;
            
            this.emit('data', data);
            
        } else if (type === 0x02) {
            // Fragmented data
            this.processFragment(packet.payload);
        }
    }

    /**
     * Process fragment
     */
    processFragment(data) {
        if (data.length < 7) {
            return;
        }
        
        const fragmentId = (data[1] << 8) | data[2];
        const fragmentNum = (data[3] << 8) | data[4];
        const total = (data[5] << 8) | data[6];
        const chunk = data.slice(7);
        
        if (!this.fragments.has(fragmentId)) {
            this.fragments.set(fragmentId, {
                chunks: new Array(total),
                received: 0,
                total: total
            });
        }
        
        const frag = this.fragments.get(fragmentId);
        frag.chunks[fragmentNum] = chunk;
        frag.received++;
        
        // Check if all fragments received
        if (frag.received === frag.total) {
            const complete = Buffer.concat(frag.chunks);
            this.fragments.delete(fragmentId);
            this.emit('data', complete);
        }
    }

    /**
     * Close session
     */
    close() {
        this.emit('closed');
        this.removeAllListeners();
    }
}

module.exports = Transport;
