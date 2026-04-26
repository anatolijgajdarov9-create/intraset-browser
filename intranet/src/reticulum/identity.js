// identity.js - Identity management for Reticulum nodes
// Handles creation, storage, and serialization of node identities

const fs = require('fs').promises;
const path = require('path');
const crypto = require('./crypto');

class Identity {
    constructor(identityData = null) {
        if (identityData) {
            this.identity = identityData;
        } else {
            this.identity = crypto.generateIdentity();
        }
        
        this.createdAt = Date.now();
        this.lastUsed = Date.now();
    }

    /**
     * Get the Reticulum address for this identity
     */
    get address() {
        return this.identity.address;
    }

    /**
     * Get the signing public key
     */
    get signingPublicKey() {
        return this.identity.signing.publicKey;
    }

    /**
     * Get the exchange public key
     */
    get exchangePublicKey() {
        return this.identity.exchange.publicKey;
    }

    /**
     * Sign data
     */
    sign(data) {
        this.lastUsed = Date.now();
        return crypto.signData(this.identity, data);
    }

    /**
     * Verify signature
     */
    verify(data, signature, publicKey) {
        return crypto.verifySignature(publicKey, data, signature);
    }

    /**
     * Perform ECDH with remote peer
     */
    ecdh(remoteExchangePub) {
        return crypto.ecdh(this.identity.exchange.secretKey, remoteExchangePub);
    }

    /**
     * Derive session keys from shared secret
     */
    deriveSessionKeys(sharedSecret) {
        return crypto.deriveSessionKeys(sharedSecret);
    }

    /**
     * Serialize identity to JSON
     */
    toJSON() {
        return {
            version: this.identity.version,
            signing: {
                publicKey: this.identity.signing.publicKey.toString('hex'),
                secretKey: this.identity.signing.secretKey.toString('hex')
            },
            exchange: {
                publicKey: this.identity.exchange.publicKey.toString('hex'),
                secretKey: this.identity.exchange.secretKey.toString('hex')
            },
            createdAt: this.createdAt,
            lastUsed: this.lastUsed
        };
    }

    /**
     * Deserialize identity from JSON
     */
    static fromJSON(json) {
        const data = typeof json === 'string' ? JSON.parse(json) : json;

        const identityData = {
            version: data.version,
            signing: {
                publicKey: Buffer.from(data.signing.publicKey, 'hex'),
                secretKey: Buffer.from(data.signing.secretKey, 'hex')
            },
            exchange: {
                publicKey: Buffer.from(data.exchange.publicKey, 'hex'),
                secretKey: Buffer.from(data.exchange.secretKey, 'hex')
            },
            get address() {
                const crypto = require('./crypto');
                return crypto.deriveAddress(this.signing.publicKey, this.exchange.publicKey);
            }
        };

        const identity = new Identity(identityData);
        identity.createdAt = data.createdAt || Date.now();
        identity.lastUsed = data.lastUsed || Date.now();

        return identity;
    }

    /**
     * Save identity to file
     */
    async saveToFile(filePath) {
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(this.toJSON(), null, 2));
    }

    /**
     * Load identity from file
     */
    static async loadFromFile(filePath) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return Identity.fromJSON(data);
        } catch (err) {
            if (err.code === 'ENOENT') {
                return null;
            }
            throw err;
        }
    }

    /**
     * Create or load identity
     */
    static async createOrLoad(filePath) {
        const existing = await Identity.loadFromFile(filePath);
        if (existing) {
            console.log('[Identity] Loaded existing identity from', filePath);
            return existing;
        }
        
        const identity = new Identity();
        await identity.saveToFile(filePath);
        console.log('[Identity] Created new identity, saved to', filePath);
        return identity;
    }
}

module.exports = Identity;
