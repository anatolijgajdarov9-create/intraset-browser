// router.js - Main Reticulum Router
// Central coordinator for all Reticulum protocol components

const EventEmitter = require('events');
const Identity = require('./identity');
const Destination = require('./destination');
const PathTable = require('./pathTable');
const AnnounceSystem = require('./announce');
const Transport = require('./transport');
const Packet = require('./packet');
const { Link, LINK_STATES } = require('./link');
const TCPInterface = require('./interfaces/tcp');
const UDPInterface = require('./interfaces/udp');

class Router extends EventEmitter {
    constructor(options = {}) {
        super();

        // Store original options
        this.options = options;

        // Identity
        this.identity = null;
        this.identityPath = options.identityPath || './data/reticulum_identity';
        
        // Core components — transport will get identity after load
        this.pathTable = new PathTable(options.pathTable || {});
        this.announceSystem = new AnnounceSystem(options.announce || {});
        this.transport = null; // Will be initialized after identity load
        
        // Interfaces
        this.interfaces = new Map(); // interfaceId -> Interface
        
        // Configuration
        this.config = {
            autoStart: options.autoStart !== false,
            announceOnStart: options.announceOnStart !== false,
            announceInterval: options.announceInterval || 60 * 1000,
            enableTCP: options.enableTCP !== false,
            enableUDP: options.enableUDP !== false,
            tcpPort: options.tcpPort || 3849,
            udpPort: options.udpPort || 3850,
            tcpHost: options.tcpHost || '0.0.0.0',
            ...options
        };
        
        // Router state
        this.running = false;
        this.startTime = null;
        this.announceTimer = null;
        
        // Packet queue for processing
        this.packetQueue = [];
        this.processing = false;

        // Loop prevention — dedup cache with 60s TTL
        this.processedPackets = new Map(); // packetId -> timestamp
        this.packetDedupTTL = 60000; // 60 seconds

        // Statistics
        this.stats = {
            packetsReceived: 0,
            packetsSent: 0,
            packetsForwarded: 0,
            packetsDropped: 0,
            announcesReceived: 0,
            announcesSent: 0
        };
    }

    /**
     * Initialize and start the router
     */
    async start() {
        if (this.running) {
            throw new Error('Router already running');
        }

        console.log('[Router] Starting Reticulum router...');

        // Load or create identity
        await this.loadIdentity();

        // Initialize transport with identity now that we have it
        this.transport = new Transport({
            ...(this.options.transport || {}),
            identity: this.identity
        });

        // Setup components
        this.setupTransport();
        this.setupAnnounceSystem();
        
        // Start interfaces
        await this.startInterfaces();
        
        // Start announce system
        if (this.config.announceOnStart) {
            await this.announce();
        }
        
        // Start periodic announce
        this.startAnnounceTimer();
        
        // Start packet processor
        this.startPacketProcessor();
        
        this.running = true;
        this.startTime = Date.now();
        
        console.log('[Router] Reticulum router started');
        console.log('[Router] Address:', this.identity.address);
        
        this.emit('started');
    }

    /**
     * Load or create identity
     */
    async loadIdentity() {
        this.identity = await Identity.createOrLoad(this.identityPath);
        console.log('[Router] Identity loaded:', this.identity.address);
    }

    /**
     * Setup transport event handlers
     */
    setupTransport() {
        this.transport.on('link-setup-initiated', (data) => {
            this.emit('link-setup', data);
        });
        
        this.transport.on('link-established', (data) => {
            console.log('[Router] Link established:', data.linkId);
            this.emit('link-established', data);
        });
        
        this.transport.on('link-data', (data) => {
            this.emit('link-data', data);
        });
        
        this.transport.on('send-packet', (packet) => {
            this.sendPacket(packet);
        });
    }

    /**
     * Setup announce system event handlers
     */
    setupAnnounceSystem() {
        this.announceSystem.on('announce-received', (info) => {
            this.stats.announcesReceived++;
            console.log('[Router] Announce received from:', info.address);

            // Add to path table
            this.pathTable.addPath(
                { address: info.address },
                info.sourceNode || info.sourceInterface,
                info.sourceInterface,
                info.hops
            );

            this.emit('announce', info);
        });
    }

    /**
     * Start all configured interfaces
     */
    async startInterfaces() {
        // Start TCP interface
        if (this.config.enableTCP) {
            const tcpInterface = new TCPInterface({
                config: {
                    host: this.config.tcpHost,
                    port: this.config.tcpPort
                }
            });
            
            tcpInterface.on('packet-received', (data) => {
                this.handlePacket(data.packet, data.source);
            });
            
            tcpInterface.on('peer-discovered', (data) => {
                this.emit('peer-discovered', data);
            });
            
            tcpInterface.on('error', (err) => {
                console.error('[Router] TCP interface error:', err.message);
            });
            
            await tcpInterface.start();
            this.interfaces.set(tcpInterface.id, tcpInterface);
        }
        
        // Start UDP interface
        if (this.config.enableUDP) {
            const udpInterface = new UDPInterface({
                config: {
                    port: this.config.udpPort
                }
            });
            
            udpInterface.on('packet-received', (data) => {
                this.handlePacket(data.packet, data.source);
            });
            
            udpInterface.on('peer-discovered', (data) => {
                this.emit('peer-discovered', data);
            });
            
            udpInterface.on('error', (err) => {
                console.error('[Router] UDP interface error:', err.message);
            });
            
            await udpInterface.start();
            udpInterface.startDiscovery(this.identity.address, 'Intraset Node');
            
            this.interfaces.set(udpInterface.id, udpInterface);
        }
    }

    /**
     * Start periodic announce
     */
    startAnnounceTimer() {
        if (this.announceTimer) {
            clearInterval(this.announceTimer);
        }
        
        this.announceTimer = setInterval(() => {
            this.announce();
        }, this.config.announceInterval);
    }

    /**
     * Announce this node to the network
     */
    async announce(appData = null) {
        if (!this.running) {
            return;
        }
        
        const announcePacket = this.announceSystem.createAnnounce(this.identity, appData);
        this.stats.announcesSent++;
        
        console.log('[Router] Broadcasting announce');
        
        // Send through all interfaces
        await this.broadcastPacket(announcePacket);
        
        this.emit('announced');
    }

    /**
     * Start packet processor
     */
    startPacketProcessor() {
        if (this.processInterval) {
            clearInterval(this.processInterval);
        }
        
        this.processInterval = setInterval(() => {
            this.processPacketQueue();
        }, 10);
    }

    /**
     * Process packet queue
     */
    async processPacketQueue() {
        if (this.processing || this.packetQueue.length === 0) {
            return;
        }
        
        this.processing = true;
        
        while (this.packetQueue.length > 0) {
            const { packet, source } = this.packetQueue.shift();
            await this.processPacket(packet, source);
        }
        
        this.processing = false;
    }

    /**
     * Handle incoming packet
     */
    handlePacket(packet, source) {
        this.stats.packetsReceived++;

        // Reverse path learning — learn route back to source
        if (packet.source && source.interface) {
            const sourceAddr = packet.source.address || packet.source;
            if (sourceAddr) {
                this.pathTable.addPath(
                    { address: sourceAddr },
                    sourceAddr,
                    source.interface,
                    packet.hops || 1
                );
            }
        }

        // Loop prevention — check for duplicates
        const packetId = this.getPacketId(packet);
        if (packetId && this.checkDuplicate(packetId)) {
            this.stats.packetsDropped++;
            return; // Duplicate, drop
        }

        this.packetQueue.push({ packet, source });
    }

    /**
     * Generate packet ID for dedup
     */
    getPacketId(packet) {
        // Use source + destination + hops + type as identifier
        const src = packet.source ? (packet.source.address || '') : '';
        const dst = packet.destination ? (packet.destination.address || '') : '';
        return `${src}-${dst}-${packet.type}-${packet.hops}-${packet.timestamp}`;
    }

    /**
     * Check for duplicate packet (loop detection)
     */
    checkDuplicate(packetId) {
        const now = Date.now();

        // Clean old entries
        for (const [id, ts] of this.processedPackets) {
            if (now - ts > this.packetDedupTTL) {
                this.processedPackets.delete(id);
            }
        }

        if (this.processedPackets.has(packetId)) {
            return true;
        }

        this.processedPackets.set(packetId, now);
        return false;
    }

    /**
     * Process a single packet
     */
    async processPacket(packet, source) {
        try {
            switch (packet.type) {
                case Packet.PACKET_TYPES.ANNOUNCE:
                    await this.processAnnouncePacket(packet, source);
                    break;

                case Packet.PACKET_TYPES.DATA:
                    await this.processDataPacket(packet, source);
                    break;

                case Packet.PACKET_TYPES.LINK_SETUP:
                    await this.processLinkSetupPacket(packet, source);
                    break;

                case Packet.PACKET_TYPES.PATH_REQUEST:
                    await this.processPathRequest(packet, source);
                    break;

                case Packet.PACKET_TYPES.PATH_RESPONSE:
                    await this.processPathResponse(packet, source);
                    break;

                case Packet.PACKET_TYPES.KEEPALIVE:
                    // Just update peer
                    break;

                default:
                    console.warn('[Router] Unknown packet type:', packet.type);
            }
        } catch (err) {
            console.error('[Router] Packet processing error:', err.message);
            this.stats.packetsDropped++;
        }
    }

    /**
     * Process announce packet — flood through all interfaces except source
     */
    async processAnnouncePacket(packet, source) {
        const processed = this.announceSystem.processAnnounce(
            packet,
            source.interface,
            source.peerId
        );

        if (processed) {
            // Flood announce to ALL other interfaces (not just the one from pathTable)
            await this.floodAnnounce(packet, source.interface);
        }
    }

    /**
     * Flood announce packet through all interfaces except source
     */
    async floodAnnounce(packet, excludeInterface) {
        // Don't flood if already at max hops
        if (!packet.canForward()) {
            this.stats.packetsDropped++;
            return;
        }

        // Increment hops
        packet.incrementHops();

        let sent = 0;
        for (const [id, iface] of this.interfaces) {
            if (id === excludeInterface) continue;

            try {
                await iface.sendPacket(packet);
                sent++;
            } catch (err) {
                console.error(`[Router] Announce flood error on ${iface.name}:`, err.message);
                this.stats.packetsDropped++;
            }
        }

        if (sent > 0) {
            this.stats.packetsForwarded += sent;
        }
    }

    /**
     * Process data packet
     */
    async processDataPacket(packet, source) {
        // Check if packet is for us
        const destAddress = packet.destination?.address || packet.destination;
        
        if (destAddress === this.identity.address) {
            // Packet is for us
            this.emit('data', { packet, source });
        } else {
            // Try to forward
            await this.forwardPacket(packet, source);
        }
    }

    /**
     * Process link setup packet
     */
    async processLinkSetupPacket(packet, source) {
        // Check if we have a pending link for this source — meaning we initiated
        const remoteAddress = source.address || source.peerId;
        const pendingLink = this.transport.pendingLinks.get(remoteAddress);

        if (pendingLink && pendingLink.state === LINK_STATES.SETUP_SENT) {
            // This is a response to our link request
            await this.transport.processLinkSetupResponse(packet, source);
        } else {
            // This is an incoming link request — process and respond
            await this.transport.processLinkSetup(packet, source);
        }
    }

    /**
     * Forward packet to next hop
     */
    async forwardPacket(packet, source) {
        // Check if we can forward
        if (!packet.canForward()) {
            this.stats.packetsDropped++;
            return;
        }
        
        // Increment hops
        packet.incrementHops();
        
        // Find path for destination
        const destAddress = packet.destination?.address || packet.destination;
        const path = this.pathTable.getPath({ address: destAddress });
        
        if (path) {
            // Forward through appropriate interface
            const iface = this.interfaces.get(path.interface);
            
            if (iface) {
                try {
                    await iface.sendPacket(packet, {
                        peerId: path.nextHop
                    });
                    
                    this.stats.packetsForwarded++;
                } catch (err) {
                    console.error('[Router] Forward error:', err.message);
                    this.stats.packetsDropped++;
                }
            }
        }
    }

    /**
     * Send packet
     */
    async sendPacket(packet) {
        this.stats.packetsSent++;

        // Link setup packets: send directly through all interfaces, no path lookup needed
        if (packet.type === Packet.PACKET_TYPES.LINK_SETUP) {
            for (const iface of this.interfaces.values()) {
                try {
                    await iface.sendPacket(packet);
                } catch (err) {
                    console.error(`[Router] Link setup send error on ${iface.name}:`, err.message);
                }
            }
            return;
        }

        // Find path for destination
        const destAddress = packet.destination?.address || packet.destination;
        const path = this.pathTable.getPath({ address: destAddress });

        if (path) {
            const iface = this.interfaces.get(path.interface);

            if (iface) {
                await iface.sendPacket(packet, { peerId: path.nextHop });
            }
        } else {
            // No path - broadcast announce request
            console.log('[Router] No path for destination, requesting path');
            this.requestPath(destAddress);
        }
    }

    /**
     * Broadcast packet through all interfaces
     */
    async broadcastPacket(packet) {
        for (const iface of this.interfaces.values()) {
            try {
                await iface.sendPacket(packet);
            } catch (err) {
                console.error(`[Router] Broadcast error on ${iface.name}:`, err.message);
            }
        }
    }

    /**
     * Request path for destination — broadcast PATH_REQUEST through all interfaces
     */
    requestPath(destination) {
        const destKey = destination.address || destination;

        // Check if we already have a pending request
        if (this.pendingPathRequests && this.pendingPathRequests.has(destKey)) {
            return; // Already requested, wait for response
        }

        // Create PATH_REQUEST packet
        const packet = Packet.Packet.createPathRequest(destination, this.identity);

        console.log('[Router] Broadcasting PATH_REQUEST for', destKey);

        // Send through all interfaces
        for (const [, iface] of this.interfaces) {
            try {
                iface.sendPacket(packet);
            } catch (err) {
                console.error(`[Router] Path request send error on ${iface.name}:`, err.message);
            }
        }

        // Track pending request with timeout
        if (!this.pendingPathRequests) {
            this.pendingPathRequests = new Map();
        }
        this.pendingPathRequests.set(destKey, {
            time: Date.now(),
            timeout: setTimeout(() => {
                this.pendingPathRequests.delete(destKey);
                console.log('[Router] PATH_REQUEST timed out for', destKey);
            }, 10000)
        });
    }

    /**
     * Process incoming PATH_REQUEST
     */
    async processPathRequest(packet, source) {
        if (!packet.payload || packet.payload.length < 10) {
            return;
        }

        const targetHash = packet.payload.slice(0, 10).toString('hex');
        const sourceAddr = packet.source ? (packet.source.address || '') : '';

        // Is this request for US?
        if (targetHash === this.identity.address) {
            // We are the target — send PATH_RESPONSE directly back
            const response = Packet.Packet.createPathResponse(
                this.identity.address,
                this.identity,
                0, // metric = 0 (we are the target)
                sourceAddr ? Buffer.from(sourceAddr, 'hex') : null
            );

            try {
                const iface = this.interfaces.get(source.interface);
                if (iface) {
                    await iface.sendPacket(response, { peerId: source.peerId });
                    console.log('[Router] PATH_RESPONSE sent for', targetHash);
                }
            } catch (err) {
                console.error('[Router] PATH_RESPONSE send error:', err.message);
            }
            return;
        }

        // Not for us — do we know a path to the target?
        const path = this.pathTable.getPath({ address: targetHash });
        if (path) {
            // We know the path — respond with our metric + 1
            const ourAddressBuffer = Buffer.from(this.identity.address, 'hex');
            const response = Packet.Packet.createPathResponse(
                targetHash,
                this.identity,
                path.metric + 1,
                ourAddressBuffer
            );

            try {
                const iface = this.interfaces.get(source.interface);
                if (iface) {
                    await iface.sendPacket(response, { peerId: source.peerId });
                }
            } catch (err) {
                console.error('[Router] PATH_RESPONSE send error:', err.message);
            }
        } else {
            // Don't know path — flood PATH_REQUEST further (with TTL check)
            if (packet.canForward() && packet.hops < 8) {
                packet.incrementHops();

                for (const [id, iface] of this.interfaces) {
                    if (id === source.interface) continue;
                    try {
                        iface.sendPacket(packet);
                    } catch (err) {
                        // ignore
                    }
                }
            }
        }
    }

    /**
     * Process incoming PATH_RESPONSE
     */
    async processPathResponse(packet, source) {
        if (!packet.payload || packet.payload.length < 21) {
            return;
        }

        const targetHash = packet.payload.slice(0, 10).toString('hex');
        const nextHopHash = packet.payload.slice(10, 20).toString('hex');
        const metric = packet.payload[20];

        // Add path to table: target → next hop is the source of this response
        const sourceAddr = packet.source ? (packet.source.address || '') : source.peerId;
        this.pathTable.addPath(
            { address: targetHash },
            sourceAddr,
            source.interface,
            metric + 1
        );

        console.log(`[Router] PATH_RESPONSE: route to ${targetHash} via ${sourceAddr} (metric: ${metric + 1})`);

        // Clean up pending request
        if (this.pendingPathRequests) {
            const pending = this.pendingPathRequests.get(targetHash);
            if (pending) {
                clearTimeout(pending.timeout);
                this.pendingPathRequests.delete(targetHash);
            }
        }

        // Also add reverse path to the responder
        if (sourceAddr) {
            this.pathTable.addPath(
                { address: sourceAddr },
                sourceAddr,
                source.interface,
                1
            );
        }

        this.emit('path-discovered', {
            destination: targetHash,
            nextHop: sourceAddr,
            metric: metric + 1,
            interface: source.interface
        });
    }

    /**
     * Send data to destination
     */
    async sendData(destination, data) {
        // Create link if needed
        let link = this.transport.getActiveLinks().find(
            l => l.remoteAddress === destination
        );
        
        if (!link) {
            link = await this.transport.createLink({
                identity: this.identity,
                remoteAddress: destination
            });
            
            await link.initiateSetup();
        }
        
        return await link.send(data);
    }

    /**
     * Get router status
     */
    getStatus() {
        return {
            running: this.running,
            address: this.identity?.address,
            uptime: this.startTime ? Date.now() - this.startTime : 0,
            interfaces: this.interfaces.size,
            stats: {
                ...this.stats,
                transport: this.transport.getStats(),
                paths: this.pathTable.getStats(),
                announces: this.announceSystem.getStats()
            }
        };
    }

    /**
     * Get all interfaces info
     */
    getInterfacesInfo() {
        return Array.from(this.interfaces.values()).map(iface => iface.getInfo());
    }

    /**
     * Stop router
     */
    async stop() {
        if (!this.running) {
            return;
        }
        
        console.log('[Router] Stopping router...');
        
        this.running = false;
        
        // Stop timers
        if (this.announceTimer) {
            clearInterval(this.announceTimer);
        }
        
        if (this.processInterval) {
            clearInterval(this.processInterval);
        }
        
        // Stop interfaces
        for (const iface of this.interfaces.values()) {
            await iface.destroy();
        }
        this.interfaces.clear();
        
        // Cleanup
        this.pathTable.destroy();
        this.announceSystem.destroy();
        this.transport.destroy();
        
        console.log('[Router] Router stopped');
        this.emit('stopped');
    }

    /**
     * Destroy router
     */
    async destroy() {
        await this.stop();
        this.removeAllListeners();
    }
}

module.exports = Router;
