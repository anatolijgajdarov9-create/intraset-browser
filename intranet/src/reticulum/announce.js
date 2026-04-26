// announce.js - Announce system for Reticulum
// Handles publishing and processing destination announces

const EventEmitter = require('events');
const Packet = require('./packet');
const crypto = require('./crypto');

class AnnounceSystem extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Rate limiting
        this.maxAnnouncesPerMinute = options.maxAnnouncesPerMinute || 10;
        this.announceWindow = 60 * 1000; // 1 minute
        this.receivedAnnounces = new Map(); // address -> timestamp
        this.announceCount = 0;
        
        // Known destinations from announces
        this.knownDestinations = new Map(); // address -> announce info
        
        // Announce queue for rate limiting
        this.announceQueue = [];
        this.processingAnnounces = false;
        
        // Statistics
        this.stats = {
            totalSent: 0,
            totalReceived: 0,
            totalDropped: 0,
            lastAnnounce: 0
        };
    }

    /**
     * Create an announce packet for identity
     */
    createAnnounce(identity, appData = null) {
        return Packet.Packet.createAnnounce(identity, appData);
    }

    /**
     * Process received announce packet
     */
    processAnnounce(packet, sourceInterface, sourceNode) {
        const now = Date.now();
        
        // Check rate limiting
        if (!this.checkRateLimit()) {
            this.stats.totalDropped++;
            this.emit('announce-dropped', { reason: 'rate-limit' });
            return false;
        }
        
        // Extract destination from packet
        const destAddress = packet.destination;
        if (!destAddress) {
            this.emit('announce-error', { reason: 'no-destination' });
            return false;
        }
        
        const addressKey = destAddress.address || destAddress;
        
        // Check if we already know this announce (deduplication)
        if (this.receivedAnnounces.has(addressKey)) {
            const lastSeen = this.receivedAnnounces.get(addressKey);
            if (now - lastSeen < 30 * 1000) { // 30 second dedup window
                return false;
            }
        }
        
        // Parse announce payload
        try {
            const announceInfo = this.parseAnnouncePayload(packet);
            
            // Store announce info
            const info = {
                address: addressKey,
                signingPublicKey: announceInfo.signingPublicKey,
                exchangePublicKey: announceInfo.exchangePublicKey,
                appData: announceInfo.appData,
                sourceInterface: sourceInterface,
                sourceNode: sourceNode,
                hops: packet.hops,
                lastSeen: now,
                firstSeen: this.receivedAnnounces.get(addressKey) || now
            };
            
            this.knownDestinations.set(addressKey, info);
            this.receivedAnnounces.set(addressKey, now);
            
            this.stats.totalReceived++;
            this.stats.lastAnnounce = now;
            
            this.emit('announce-received', info);
            
            return true;
        } catch (err) {
            this.emit('announce-error', { reason: err.message });
            return false;
        }
    }

    /**
     * Parse announce payload
     */
    parseAnnouncePayload(packet) {
        if (!packet.payload) {
            throw new Error('No payload in announce packet');
        }
        
        // Payload format: signing_pub (32) + exchange_pub (32) + app_data (optional)
        const payload = packet.payload;
        
        if (payload.length < 64) {
            throw new Error('Invalid announce payload size');
        }
        
        const signingPublicKey = payload.slice(0, 32);
        const exchangePublicKey = payload.slice(32, 64);
        const appData = payload.length > 64 ? payload.slice(64).toString() : null;
        
        return {
            signingPublicKey,
            exchangePublicKey,
            appData
        };
    }

    /**
     * Check rate limiting
     */
    checkRateLimit() {
        const now = Date.now();
        
        // Clean old entries
        for (const [key, timestamp] of this.receivedAnnounces) {
            if (now - timestamp > this.announceWindow) {
                this.receivedAnnounces.delete(key);
            }
        }
        
        // Check if we exceeded the limit
        if (this.receivedAnnounces.size >= this.maxAnnouncesPerMinute) {
            return false;
        }
        
        return true;
    }

    /**
     * Get known destination info
     */
    getKnownDestination(address) {
        const key = typeof address === 'object' ? address.address : address;
        return this.knownDestinations.get(key);
    }

    /**
     * Get all known destinations
     */
    getAllKnownDestinations() {
        return Array.from(this.knownDestinations.values());
    }

    /**
     * Check if destination is known
     */
    isDestinationKnown(address) {
        const key = typeof address === 'object' ? address.address : address;
        return this.knownDestinations.has(key);
    }

    /**
     * Remove known destination
     */
    removeKnownDestination(address) {
        const key = typeof address === 'object' ? address.address : address;
        this.knownDestinations.delete(key);
        this.receivedAnnounces.delete(key);
    }

    /**
     * Get announce statistics
     */
    getStats() {
        return {
            ...this.stats,
            knownDestinations: this.knownDestinations.size,
            recentAnnounces: this.receivedAnnounces.size
        };
    }

    /**
     * Clear old announces
     */
    cleanup(maxAge = 10 * 60 * 1000) {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, info] of this.knownDestinations) {
            if (now - info.lastSeen > maxAge) {
                this.knownDestinations.delete(key);
                this.receivedAnnounces.delete(key);
                cleaned++;
            }
        }
        
        return cleaned;
    }

    /**
     * Start announce cleanup timer
     */
    startCleanup(interval = 5 * 60 * 1000) {
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
     * Destroy announce system
     */
    destroy() {
        this.stopCleanup();
        this.knownDestinations.clear();
        this.receivedAnnounces.clear();
        this.announceQueue = [];
        this.removeAllListeners();
    }
}

module.exports = AnnounceSystem;
