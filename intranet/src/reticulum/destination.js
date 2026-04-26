// destination.js - Destination addresses for Reticulum
// Destinations are 10-byte addresses derived from identity + context

const crypto = require('./crypto');

class Destination {
    /**
     * Create a destination address
     * @param {Buffer} signingPub - Signing public key
     * @param {Buffer} exchangePub - Exchange public key
     * @param {string} appData - Optional application data for context
     */
    constructor(signingPub, exchangePub, appData = null) {
        this.signingPublicKey = signingPub;
        this.exchangePublicKey = exchangePub;
        this.appData = appData;
        
        // Calculate destination hash (10 bytes)
        this.hash = this.calculateHash();
        
        // Full address (hex string)
        this.address = this.hash.toString('hex');
    }

    /**
     * Calculate destination hash
     * Hash of signing public key + exchange public key + optional app data
     */
    calculateHash() {
        let dataToHash;
        
        if (this.appData) {
            dataToHash = Buffer.concat([
                this.signingPublicKey,
                this.exchangePublicKey,
                Buffer.from(this.appData)
            ]);
        } else {
            dataToHash = Buffer.concat([
                this.signingPublicKey,
                this.exchangePublicKey
            ]);
        }
        
        const fullHash = crypto.hash256(dataToHash);
        return fullHash.slice(0, 10); // First 10 bytes
    }

    /**
     * Get destination as hex string
     */
    toString() {
        return this.address;
    }

    /**
     * Compare destinations
     */
    equals(other) {
        if (!other || !(other instanceof Destination)) {
            return false;
        }
        return this.address === other.address;
    }

    /**
     * Create destination from address hash
     */
    static fromHash(hash, signingPub, exchangePub, appData = null) {
        const dest = new Destination(signingPub, exchangePub, appData);
        
        if (hash) {
            dest.hash = typeof hash === 'string' ? Buffer.from(hash, 'hex') : hash;
            dest.address = dest.hash.toString('hex');
        }
        
        return dest;
    }

    /**
     * Create destination from identity
     */
    static fromIdentity(identity, appData = null) {
        return new Destination(
            identity.signingPublicKey,
            identity.exchangePublicKey,
            appData
        );
    }

    /**
     * Parse destination from packet data
     */
    static fromPacketData(data, offset = 0) {
        const hash = data.slice(offset, offset + 10);
        return {
            hash: hash,
            address: hash.toString('hex'),
            length: 10
        };
    }

    /**
     * Serialize destination for transmission
     */
    toBuffer() {
        return this.hash;
    }

    /**
     * Deserialize destination from buffer (10-byte hash only)
     * Note: This creates a partial Destination with only the hash,
     * since public keys are not recoverable from the hash alone.
     */
    static fromBuffer(buffer) {
        const dest = Object.create(Destination.prototype);
        dest.hash = buffer;
        dest.address = buffer.toString('hex');
        dest.signingPublicKey = null;
        dest.exchangePublicKey = null;
        dest.appData = null;
        return dest;
    }

    /**
     * Get destination info for logging
     */
    getInfo() {
        return {
            address: this.address,
            appData: this.appData,
            hasPublicKey: !!this.signingPublicKey
        };
    }
}

module.exports = Destination;
