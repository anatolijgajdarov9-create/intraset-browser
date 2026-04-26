// reticulum-bridge.js - Bridge module to connect intraset-network with LocalServer
// Provides Reticulum+ protocol compatibility

const EventEmitter = require('events');
const net = require('net');

class ReticulumBridge extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            // LocalServer (reticulum) endpoint
            host: config.host || 'localhost',
            port: config.port || 3847,
            
            // This node info
            nodeId: config.nodeId || 'intra-bridge-001',
            nodeName: config.nodeName || 'IntraBridge',
            
            // Connection settings
            reconnectInterval: config.reconnectInterval || 5000,
            pingInterval: config.pingInterval || 30000,
            
            // Enable reticulum protocol
            reticulumEnabled: config.reticulumEnabled !== false,
            
            ...config
        };
        
        this.client = null;
        this.connected = false;
        this.lastPing = 0;
        this.reconnectTimer = null;
        this.pingTimer = null;
        
        // Mesh network state
        this.nodes = new Map();
        this.routes = new Map();
    }
    
    async connect() {
        return new Promise((resolve, reject) => {
            this.client = new net.Socket();
            
            this.client.setTimeout(10000);
            
            this.client.on('connect', () => {
                console.log('[ReticulumBridge] Connected to LocalServer at', this.config.host + ':' + this.config.port);
                this.connected = true;
                
                // Register with reticulum server
                this.sendCommand(`register ${this.config.nodeId} ${this.config.nodeName}`);
                
                this.startPing();
                this.emit('connected');
                resolve();
            });
            
            this.client.on('data', (data) => {
                this.handleData(data.toString());
            });
            
            this.client.on('close', () => {
                console.log('[ReticulumBridge] Connection closed');
                this.connected = false;
                this.stopPing();
                this.scheduleReconnect();
                this.emit('disconnected');
            });
            
            this.client.on('error', (err) => {
                console.error('[ReticulumBridge] Error:', err.message);
                this.emit('error', err);
                reject(err);
            });
            
            this.client.on('timeout', () => {
                console.log('[ReticulumBridge] Connection timeout');
                this.client.destroy();
            });
            
            this.client.connect(this.config.port, this.config.host);
        });
    }
    
    handleData(data) {
        const lines = data.split('\n').filter(l => l.trim());
        
        for (const line of lines) {
            console.log('[ReticulumBridge] Received:', line.substring(0, 100));
            
            // Parse reticulum-style responses
            if (line.startsWith('Nodes:')) {
                this.parseNodes(line);
            }
            else if (line.startsWith('Peer:')) {
                this.parsePeer(line);
            }
            else if (line.startsWith('Route:')) {
                this.parseRoute(line);
            }
            else if (line.includes('pong')) {
                this.lastPing = Date.now();
            }
            
            this.emit('data', line);
        }
    }
    
    parseNodes(line) {
        // Parse nodes list from reticulum
        try {
            const json = line.substring(6).trim();
            const data = JSON.parse(json);
            
            if (data.nodes) {
                for (const node of data.nodes) {
                    this.nodes.set(node.id || node.node_id, node);
                }
            }
            
            this.emit('nodes-updated', Array.from(this.nodes.values()));
        } catch (err) {
            console.error('[ReticulumBridge] Parse nodes error:', err.message);
        }
    }
    
    parsePeer(line) {
        // Parse peer info
        const parts = line.substring(5).split(' ');
        if (parts.length >= 2) {
            const peerId = parts[0];
            const peerName = parts.slice(1).join(' ');
            this.emit('peer-discovered', { id: peerId, name: peerName });
        }
    }
    
    parseRoute(line) {
        // Parse route information
        const json = line.substring(6).trim();
        try {
            const route = JSON.parse(json);
            this.routes.set(route.destination, route);
            this.emit('route-updated', route);
        } catch (err) {}
    }
    
    sendCommand(cmd) {
        if (this.client && this.connected) {
            this.client.write(cmd + '\n');
            return true;
        }
        return false;
    }
    
    // Reticulum-compatible API methods
    
    async getNodeId() {
        return this.sendCommand('GET /.nodeid');
    }
    
    async getNodes() {
        return this.sendCommand('GET /.nodes');
    }
    
    async getIdentity() {
        return this.sendCommand('GET /.identity');
    }
    
    async getInfo() {
        return this.sendCommand('GET /api/info');
    }
    
    async ping() {
        return this.sendCommand('GET /api/ping');
    }
    
    async announce() {
        return this.sendCommand('GET /api/announce');
    }
    
    async getPeers() {
        return this.sendCommand('GET /api/peers');
    }
    
    async getStatus() {
        return this.sendCommand('GET /api/status');
    }
    
    // Mesh network methods
    
    async broadcastMessage(content, type = 'text') {
        const msg = {
            type: 'broadcast',
            sender: this.config.nodeId,
            senderName: this.config.nodeName,
            content,
            messageType: type,
            timestamp: Date.now()
        };
        
        return this.sendCommand('BROADCAST ' + JSON.stringify(msg));
    }
    
    async sendToNode(nodeId, content) {
        const msg = {
            type: 'message',
            sender: this.config.nodeId,
            senderName: this.config.nodeName,
            target: nodeId,
            content,
            timestamp: Date.now()
        };
        
        return this.sendCommand('SEND ' + nodeId + ' ' + JSON.stringify(msg));
    }
    
    // Request file from reticulum node
    async requestFile(fileId, fromNodeId) {
        return this.sendCommand('FILE-REQUEST ' + fromNodeId + ' ' + fileId);
    }
    
    // Announce this node to the mesh
    async announceNode() {
        const announcement = {
            node_id: this.config.nodeId,
            node_name: this.config.nodeName,
            port: this.config.port,
            capabilities: ['http', 'ws', ' reticulum', 'mesh'],
            protocols: ['reticulum', 'nomadnet'],
            version: '1.0.0',
            timestamp: Date.now()
        };
        
        return this.sendCommand('ANNOUNCE ' + JSON.stringify(announcement));
    }
    
    startPing() {
        this.pingTimer = setInterval(() => {
            this.ping();
        }, this.config.pingInterval);
    }
    
    stopPing() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
    }
    
    scheduleReconnect() {
        if (this.reconnectTimer) return;
        
        this.reconnectTimer = setTimeout(() => {
            console.log('[ReticulumBridge] Reconnecting...');
            this.reconnectTimer = null;
            this.connect().catch(err => {
                console.error('[ReticulumBridge] Reconnect failed:', err.message);
            });
        }, this.config.reconnectInterval);
    }
    
    disconnect() {
        this.stopPing();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.client) {
            this.client.destroy();
            this.client = null;
        }
        this.connected = false;
    }
    
    getConnectedNodes() {
        return Array.from(this.nodes.values());
    }
    
    getRoutes() {
        return Array.from(this.routes.values());
    }
    
    isConnected() {
        return this.connected;
    }
}

module.exports = ReticulumBridge;