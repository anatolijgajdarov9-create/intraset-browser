// packet.js - Packet format and encryption for Reticulum protocol
// Implements the wire format: header + context + destination + encrypted payload

const crypto = require('./crypto');

// Packet types
const PACKET_TYPES = {
    ANNOUNCE: 0x00,
    DATA: 0x01,
    LINK_SETUP: 0x02,
    LINK_TEARDOWN: 0x03,
    PATH_REQUEST: 0x04,
    PATH_RESPONSE: 0x05,
    PROOF: 0x06,
    KEEPALIVE: 0x07
};

// Header flags
const FLAGS = {
    HAS_SOURCE: 0x01,
    ENCRYPTED: 0x02,
    SIGNED: 0x04,
    COMPRESSED: 0x08,
    FRAGMENT: 0x10,
    FORWARDING: 0x20
};

// Maximum hop count
const MAX_HOPS = 16;

class Packet {
    constructor(options = {}) {
        this.version = 1;
        this.type = options.type || PACKET_TYPES.DATA;
        this.hops = options.hops || 0;
        this.flags = options.flags || 0;
        this.context = options.context || 0;
        this.destination = options.destination || null;
        this.source = options.source || null;
        this.payload = options.payload || null;
        this.signature = options.signature || null;
        this.timestamp = options.timestamp || Date.now();
        
        // Encrypted packet fields
        this.ephemeralKey = options.ephemeralKey || null;
        this.iv = options.iv || null;
        this.hmac = options.hmac || null;
    }

    /**
     * Set flag
     */
    setFlag(flag) {
        this.flags |= flag;
    }

    /**
     * Check if flag is set
     */
    hasFlag(flag) {
        return (this.flags & flag) !== 0;
    }

    /**
     * Mark packet as encrypted
     */
    markEncrypted() {
        this.setFlag(FLAGS.ENCRYPTED);
    }

    /**
     * Mark packet as signed
     */
    markSigned() {
        this.setFlag(FLAGS.SIGNED);
    }

    /**
     * Increment hop count
     */
    incrementHops() {
        this.hops++;
        return this.hops < MAX_HOPS;
    }

    /**
     * Check if packet can be forwarded
     */
    canForward() {
        return this.hops < MAX_HOPS;
    }

    /**
     * Encrypt packet payload
     */
    encrypt(aesKey, hmacKey) {
        if (!this.payload) {
            throw new Error('No payload to encrypt');
        }

        const encrypted = crypto.encryptPacket(this.payload, aesKey, hmacKey);
        
        this.ephemeralKey = encrypted.ephemeralKey || null;
        this.iv = encrypted.iv;
        this.ciphertext = encrypted.ciphertext;
        this.hmac = encrypted.hmac;
        this.payload = null;
        
        this.markEncrypted();
        
        return this;
    }

    /**
     * Decrypt packet payload
     */
    decrypt(aesKey, hmacKey) {
        if (!this.hasFlag(FLAGS.ENCRYPTED)) {
            throw new Error('Packet is not encrypted');
        }

        if (!this.iv || !this.ciphertext || !this.hmac) {
            throw new Error('Missing encryption data');
        }

        const encryptedData = Buffer.concat([this.iv, this.ciphertext, this.hmac]);
        this.payload = crypto.decryptPacket(encryptedData, aesKey, hmacKey);
        
        return this;
    }

    /**
     * Sign packet
     */
    sign(identity) {
        const dataToSign = this.getDataToSign();
        this.signature = identity.sign(dataToSign);
        this.markSigned();
        return this;
    }

    /**
     * Verify packet signature
     */
    verifySignature(publicKey) {
        if (!this.signature) {
            return false;
        }
        
        const dataToSign = this.getDataToSign();
        return crypto.verifySignature(publicKey, dataToSign, this.signature);
    }

    /**
     * Get data that was signed
     */
    getDataToSign() {
        return Buffer.concat([
            Buffer.from([this.type]),
            Buffer.from([this.hops]),
            Buffer.from([this.flags]),
            Buffer.from([this.context]),
            this.destination ? this.destination.toBuffer() : Buffer.alloc(0),
            this.payload || Buffer.alloc(0)
        ]);
    }

    /**
     * Serialize packet to buffer
     */
    toBuffer() {
        const parts = [];
        
        // Header: version (1) + type (1) + hops (1) + flags (1)
        parts.push(Buffer.from([this.version]));
        parts.push(Buffer.from([this.type]));
        parts.push(Buffer.from([this.hops]));
        parts.push(Buffer.from([this.flags]));
        
        // Context (1 byte)
        parts.push(Buffer.from([this.context]));
        
        // Destination (10 bytes)
        if (this.destination) {
            parts.push(this.destination.toBuffer());
        } else {
            parts.push(Buffer.alloc(10));
        }
        
        // Source (optional, 10 bytes)
        if (this.hasFlag(FLAGS.HAS_SOURCE) && this.source) {
            parts.push(this.source.toBuffer());
        }
        
        // Payload or encrypted data
        if (this.hasFlag(FLAGS.ENCRYPTED)) {
            // IV (16) + ciphertext + HMAC (32)
            if (this.iv && this.ciphertext && this.hmac) {
                parts.push(this.iv);
                parts.push(this.ciphertext);
                parts.push(this.hmac);
            }
        } else if (this.payload) {
            parts.push(this.payload);
        }
        
        // Signature (if signed)
        if (this.hasFlag(FLAGS.SIGNED) && this.signature) {
            parts.push(this.signature);
        }
        
        return Buffer.concat(parts);
    }

    /**
     * Deserialize packet from buffer
     */
    static fromBuffer(buffer) {
        const Destination = require('./destination');
        let offset = 0;

        // Header
        const version = buffer[offset++];
        const type = buffer[offset++];
        const hops = buffer[offset++];
        const flags = buffer[offset++];

        // Context
        const context = buffer[offset++];

        // Destination (10 bytes)
        const destBuffer = buffer.slice(offset, offset + 10);
        offset += 10;

        // Source (optional, 10 bytes)
        let source = null;
        if (flags & FLAGS.HAS_SOURCE) {
            const sourceBuffer = buffer.slice(offset, offset + 10);
            source = Destination.fromBuffer(sourceBuffer);
            offset += 10;
        }

        // Create packet
        const packet = new Packet({
            type,
            hops,
            flags,
            context,
            destination: destBuffer
        });

        if (source) {
            packet.source = source;
        }

        // Determine remaining payload area
        let payloadStart = offset;
        let payloadEnd = buffer.length;

        // If signed, signature is at the end (64 bytes for Ed25519)
        if (flags & FLAGS.SIGNED) {
            payloadEnd = buffer.length - 64;
            packet.signature = buffer.slice(payloadEnd, buffer.length);
        }

        // Parse payload or encrypted data
        const remaining = buffer.slice(payloadStart, payloadEnd);

        if (flags & FLAGS.ENCRYPTED) {
            // IV (16 bytes) + ciphertext + HMAC (32 bytes)
            if (remaining.length >= 48) {
                packet.iv = remaining.slice(0, 16);
                packet.hmac = remaining.slice(remaining.length - 32);
                packet.ciphertext = remaining.slice(16, remaining.length - 32);
            }
        } else {
            packet.payload = remaining.length > 0 ? remaining : null;
        }

        return packet;
    }

    /**
     * Create an announce packet
     */
    static createAnnounce(identity, appData = null) {
        const dest = require('./destination').fromIdentity(identity, appData);
        
        const packet = new Packet({
            type: PACKET_TYPES.ANNOUNCE,
            destination: dest,
            source: dest
        });
        
        packet.setFlag(FLAGS.HAS_SOURCE);
        
        // Payload: public keys + app data
        const payload = Buffer.concat([
            identity.signingPublicKey,
            identity.exchangePublicKey,
            appData ? Buffer.from(appData) : Buffer.alloc(0)
        ]);
        
        packet.payload = payload;
        packet.sign(identity);
        
        return packet;
    }

    /**
     * Create a data packet
     */
    static createData(destination, payload, identity = null) {
        const Destination = require('./destination');
        const packet = new Packet({
            type: PACKET_TYPES.DATA,
            destination: destination,
            payload: typeof payload === 'string' ? Buffer.from(payload) : payload
        });

        if (identity) {
            // Source must be the sender's destination (from identity), NOT the remote destination
            packet.source = Destination.fromIdentity(identity);
            packet.setFlag(FLAGS.HAS_SOURCE);
            packet.sign(identity);
        }

        return packet;
    }

    /**
     * Create a link setup packet
     */
    static createLinkSetup(destination, ephemeralPub, identity) {
        const Destination = require('./destination');
        const packet = new Packet({
            type: PACKET_TYPES.LINK_SETUP,
            destination: destination,
            payload: ephemeralPub
        });

        packet.setFlag(FLAGS.HAS_SOURCE);
        // Source must be the sender's destination (from identity)
        packet.source = Destination.fromIdentity(identity);
        packet.sign(identity);

        return packet;
    }

    /**
     * Create a path request packet
     * Payload: target destination hash (10 bytes)
     */
    static createPathRequest(targetHash, identity) {
        const Destination = require('./destination');
        const packet = new Packet({
            type: PACKET_TYPES.PATH_REQUEST,
            destination: typeof targetHash === 'string'
                ? Destination.fromHash(Buffer.from(targetHash, 'hex'))
                : targetHash,
            payload: typeof targetHash === 'string'
                ? Buffer.from(targetHash, 'hex')
                : targetHash.hash || targetHash
        });

        if (identity) {
            packet.source = Destination.fromIdentity(identity);
            packet.setFlag(FLAGS.HAS_SOURCE);
            packet.sign(identity);
        }

        return packet;
    }

    /**
     * Create a path response packet
     * Payload: target hash (10) + next hop hash (10) + metric (1 byte)
     */
    static createPathResponse(targetHash, identity, metric, nextHopHash = null) {
        const Destination = require('./destination');
        const payload = Buffer.alloc(21); // target(10) + nextHop(10) + metric(1)

        const target = typeof targetHash === 'string'
            ? Buffer.from(targetHash, 'hex')
            : (targetHash.hash || targetHash);

        target.copy(payload, 0);

        if (nextHopHash) {
            const nextHop = typeof nextHopHash === 'string'
                ? Buffer.from(nextHopHash, 'hex')
                : (nextHopHash.hash || nextHopHash);
            nextHop.copy(payload, 10);
        }

        payload[20] = metric;

        const packet = new Packet({
            type: PACKET_TYPES.PATH_RESPONSE,
            destination: target,
            payload: payload
        });

        if (identity) {
            packet.source = Destination.fromIdentity(identity);
            packet.setFlag(FLAGS.HAS_SOURCE);
            packet.sign(identity);
        }

        return packet;
    }

    /**
     * Get packet info for logging
     */
    getInfo() {
        const typeNames = Object.entries(PACKET_TYPES)
            .find(([name, value]) => value === this.type)?.[0] || 'UNKNOWN';
        
        return {
            type: typeNames,
            hops: this.hops,
            encrypted: this.hasFlag(FLAGS.ENCRYPTED),
            signed: this.hasFlag(FLAGS.SIGNED),
            destination: this.destination ? this.destination.toString() : 'none',
            payloadSize: this.payload ? this.payload.length : 0
        };
    }
}

module.exports = {
    Packet,
    PACKET_TYPES,
    FLAGS,
    MAX_HOPS
};
