// crypto.js - Cryptographic primitives for Reticulum protocol
// Implements Ed25519, X25519, AES-256-CBC, HMAC-SHA256 as per Reticulum spec

const nacl = require('tweetnacl');
const { encode: encodeBase64, decode: decodeBase64 } = require('tweetnacl-util');
const CryptoJS = require('crypto-js');

// Constants
const RETICULUM_CRYPTO_VERSION = 1;
const AES_KEY_SIZE = 32; // 256 bits
const HMAC_KEY_SIZE = 32; // 256 bits
const NONCE_SIZE = 16; // 128 bits for AES-CBC IV

/**
 * Generate a new Reticulum Identity (512-bit keypair)
 * Ed25519 for signatures + X25519 for key exchange
 */
function generateIdentity() {
    // Ed25519 signing keypair
    const signingKey = nacl.sign.keyPair();
    
    // X25519 keypair for key exchange
    const exchangeKey = nacl.box.keyPair();
    
    return {
        version: RETICULUM_CRYPTO_VERSION,
        signing: {
            publicKey: Buffer.from(signingKey.publicKey),
            secretKey: Buffer.from(signingKey.secretKey)
        },
        exchange: {
            publicKey: Buffer.from(exchangeKey.publicKey),
            secretKey: Buffer.from(exchangeKey.secretKey)
        },
        // Derive address from public keys (hash)
        get address() {
            return deriveAddress(this.signing.publicKey, this.exchange.publicKey);
        }
    };
}

/**
 * Derive a Reticulum address from public keys
 * Uses SHA-256 hash of concatenated public keys
 */
function deriveAddress(signingPub, exchangePub) {
    const hash = CryptoJS.SHA256(
        CryptoJS.lib.WordArray.create(
            Buffer.concat([signingPub, exchangePub])
        )
    );
    
    // Return first 10 bytes as hex string (Reticulum address format)
    return hash.toString(CryptoJS.enc.Hex).substring(0, 20);
}

/**
 * Sign data with Ed25519
 */
function signData(identity, data) {
    const message = typeof data === 'string' ? Buffer.from(data) : data;
    const signedMessage = nacl.sign.detached(message, identity.signing.secretKey);
    return Buffer.from(signedMessage);
}

/**
 * Verify Ed25519 signature
 */
function verifySignature(publicKey, data, signature) {
    const message = typeof data === 'string' ? Buffer.from(data) : data;
    return nacl.sign.detached.verify(message, signature, publicKey);
}

/**
 * Perform ECDH key exchange (X25519)
 */
function ecdh(localExchangeSecret, remoteExchangePub) {
    const sharedKey = nacl.box.before(remoteExchangePub, localExchangeSecret);
    return Buffer.from(sharedKey);
}

/**
 * Derive session keys from ECDH shared secret using HKDF
 */
function deriveSessionKeys(sharedSecret) {
    // Simplified HKDF using SHA-256
    const info = Buffer.from('reticulum-session-keys');
    
    // Extract
    const prk = CryptoJS.HmacSHA256(
        CryptoJS.lib.WordArray.create(sharedSecret),
        CryptoJS.lib.WordArray.create(info)
    );
    
    // Expand to get AES key and HMAC key
    const expandInfo = Buffer.from('reticulum-expand');
    const okm = CryptoJS.HmacSHA256(
        CryptoJS.lib.WordArray.create(
            Buffer.concat([Buffer.from(prk.toString(CryptoJS.enc.Hex), 'hex'), expandInfo])
        ),
        CryptoJS.lib.WordArray.create(Buffer.from('aes-key'))
    );
    
    const aesKey = Buffer.from(okm.toString(CryptoJS.enc.Hex).substring(0, 64), 'hex');
    
    const okmHmac = CryptoJS.HmacSHA256(
        CryptoJS.lib.WordArray.create(
            Buffer.concat([Buffer.from(prk.toString(CryptoJS.enc.Hex), 'hex'), expandInfo])
        ),
        CryptoJS.lib.WordArray.create(Buffer.from('hmac-key'))
    );
    
    const hmacKey = Buffer.from(okmHmac.toString(CryptoJS.enc.Hex).substring(0, 64), 'hex');
    
    return {
        aesKey: aesKey.slice(0, AES_KEY_SIZE),
        hmacKey: hmacKey.slice(0, HMAC_KEY_SIZE)
    };
}

/**
 * Encrypt data using AES-256-CBC + HMAC-SHA256 (Fernet-like)
 * As per Reticulum spec: AES-CBC with PKCS7 padding, HMAC for authentication
 */
function encryptPacket(plaintext, aesKey, hmacKey) {
    const iv = CryptoJS.lib.WordArray.random(NONCE_SIZE);
    
    // Convert keys to WordArray
    const key = CryptoJS.enc.Hex.parse(aesKey.toString('hex'));
    
    // Encrypt
    const encrypted = CryptoJS.AES.encrypt(
        CryptoJS.lib.WordArray.create(plaintext),
        key,
        {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        }
    );
    
    const ciphertext = Buffer.from(encrypted.ciphertext.toString(CryptoJS.enc.Hex), 'hex');
    const ivBuffer = Buffer.from(iv.toString(CryptoJS.enc.Hex), 'hex');
    
    // Calculate HMAC over IV + ciphertext
    const hmacData = CryptoJS.HmacSHA256(
        CryptoJS.lib.WordArray.create(Buffer.concat([ivBuffer, ciphertext])),
        CryptoJS.enc.Hex.parse(hmacKey.toString('hex'))
    );
    
    const hmac = Buffer.from(hmacData.toString(CryptoJS.enc.Hex), 'hex');
    
    return {
        iv: ivBuffer,
        ciphertext: ciphertext,
        hmac: hmac,
        // Packet format: iv (16) + ciphertext + hmac (32)
        toBuffer() {
            return Buffer.concat([this.iv, this.ciphertext, this.hmac]);
        }
    };
}

/**
 * Decrypt data using AES-256-CBC + HMAC-SHA256
 */
function decryptPacket(encryptedData, aesKey, hmacKey) {
    const iv = encryptedData.slice(0, NONCE_SIZE);
    const hmac = encryptedData.slice(encryptedData.length - 32);
    const ciphertext = encryptedData.slice(NONCE_SIZE, encryptedData.length - 32);
    
    // Verify HMAC
    const expectedHmac = CryptoJS.HmacSHA256(
        CryptoJS.lib.WordArray.create(Buffer.concat([iv, ciphertext])),
        CryptoJS.enc.Hex.parse(hmacKey.toString('hex'))
    );
    
    const expectedHmacBuffer = Buffer.from(expectedHmac.toString(CryptoJS.enc.Hex), 'hex');
    
    if (!hmac.equals(expectedHmacBuffer)) {
        throw new Error('HMAC verification failed');
    }
    
    // Decrypt
    const key = CryptoJS.enc.Hex.parse(aesKey.toString('hex'));
    const ivWordArray = CryptoJS.enc.Hex.parse(iv.toString('hex'));
    const ciphertextWordArray = CryptoJS.enc.Hex.parse(ciphertext.toString('hex'));
    
    const decrypted = CryptoJS.AES.decrypt(
        {
            ciphertext: ciphertextWordArray
        },
        key,
        {
            iv: ivWordArray,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        }
    );
    
    return Buffer.from(decrypted.toString(CryptoJS.enc.Utf8), 'utf8');
}

/**
 * Generate ephemeral keypair for forward secrecy
 */
function generateEphemeralKeys() {
    const keyPair = nacl.box.keyPair();
    return {
        publicKey: Buffer.from(keyPair.publicKey),
        secretKey: Buffer.from(keyPair.secretKey)
    };
}

/**
 * Calculate shared secret for a packet using ephemeral keys
 */
function calculatePacketSharedSecret(ephemeralSecret, remotePublic, staticSharedSecret) {
    const ephemeralShared = ecdh(ephemeralSecret, remotePublic);
    
    // Combine with static shared secret
    const combined = Buffer.concat([staticSharedSecret, ephemeralShared]);
    const hash = CryptoJS.SHA256(CryptoJS.lib.WordArray.create(combined));
    
    return Buffer.from(hash.toString(CryptoJS.enc.Hex), 'hex');
}

/**
 * Hash data using SHA-256
 */
function hash256(data) {
    const hash = CryptoJS.SHA256(CryptoJS.lib.WordArray.create(data));
    return Buffer.from(hash.toString(CryptoJS.enc.Hex), 'hex');
}

/**
 * Generate random bytes
 */
function randomBytes(length) {
    return Buffer.from(CryptoJS.lib.WordArray.random(length).toString(CryptoJS.enc.Hex), 'hex');
}

module.exports = {
    generateIdentity,
    deriveAddress,
    signData,
    verifySignature,
    ecdh,
    deriveSessionKeys,
    encryptPacket,
    decryptPacket,
    generateEphemeralKeys,
    calculatePacketSharedSecret,
    hash256,
    randomBytes,
    RETICULUM_CRYPTO_VERSION
};
