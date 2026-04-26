// mesh-integration.js - Integrates intraset-network with LocalServer (Reticulum)
// Creates unified mesh network architecture

const ReticulumBridge = require('./services/reticulumBridge');
const net = require('net');
const { v4: uuidv4 } = require('uuid');

class MeshIntegration {
    constructor(intrasetServer, options = {}) {
        this.intraset = intrasetServer;
        this.options = {
            // Enable Reticulum protocol compatibility
            reticulumEnabled: options.reticulumEnabled !== false,
            // LocalServer endpoint
            localserverHost: options.localserverHost || 'localhost',
            localserverPort: options.localserverPort || 3847,
            // Auto-sync interval
            syncInterval: options.syncInterval || 30000,
            // Enable mesh routing
            meshRouting: options.meshRouting !== false,
            ...options
        };
        
        this.reticulum = null;
        this.syncTimer = null;
        this.meshNodes = new Map();
    }
    
    async initialize() {
        console.log('[Mesh] Initializing mesh integration...');
        
        if (this.options.reticulumEnabled) {
            await this.initReticulum();
        }
        
        this.startMeshSync();
        
        console.log('[Mesh] Integration initialized');
        return this;
    }
    
    async initReticulum() {
        const config = this.intraset.services.config;
        
        this.reticulum = new ReticulumBridge({
            host: this.options.localserverHost,
            port: this.options.localserverPort,
            nodeId: config.nodeId,
            nodeName: config.nodeName + '-Mesh',
            reconnectInterval: 5000,
            pingInterval: 30000
        });
        
        this.reticulum.on('connected', () => {
            console.log('[Mesh] Reticulum bridge connected');
            
            // Announce this node to reticulum
            this.reticulum.announceNode().catch(err => {
                console.error('[Mesh] Announce error:', err.message);
            });
        });
        
        this.reticulum.on('disconnected', () => {
            console.log('[Mesh] Reticulum bridge disconnected');
        });
        
        this.reticulum.on('nodes-updated', (nodes) => {
            this.syncMeshNodes(nodes);
        });
        
        this.reticulum.on('peer-discovered', (peer) => {
            this.addMeshNode(peer);
        });
        
        try {
            await this.reticulum.connect();
        } catch (err) {
            console.error('[Mesh] Reticulum connection failed:', err.message);
            console.log('[Mesh] LocalServer may not be running on port', this.options.localserverPort);
        }
    }
    
    startMeshSync() {
        this.syncTimer = setInterval(async () => {
            await this.syncWithReticulum();
            await this.broadcastMeshState();
        }, this.options.syncInterval);
    }
    
    async syncWithReticulum() {
        if (!this.reticulum || !this.reticulum.isConnected()) return;
        
        try {
            // Get nodes from reticulum
            await this.reticulum.getNodes();
            
            // Get routes
            const routes = this.reticulum.getRoutes();
            
            // Sync with intraset network
            if (this.intraset.services.discovery) {
                const reticulumNodes = this.reticulum.getConnectedNodes();
                
                for (const node of reticulumNodes) {
                    this.intraset.services.discovery.addManualPeer(
                        node.host || 'localhost',
                        node.port || this.options.localserverPort,
                        node.name || node.id
                    );
                }
            }
            
        } catch (err) {
            console.error('[Mesh] Sync error:', err.message);
        }
    }
    
    syncMeshNodes(reticulumNodes) {
        for (const node of reticulumNodes) {
            const meshNode = {
                id: node.id || node.node_id,
                name: node.name || node.node_name,
                host: node.host,
                port: node.port || this.options.localserverPort,
                source: 'reticulum',
                protocol: 'reticulum',
                online: true,
                lastSeen: Date.now()
            };
            
            this.meshNodes.set(meshNode.id, meshNode);
        }
        
        console.log('[Mesh] Synced', this.meshNodes.size, 'nodes from reticulum');
    }
    
    addMeshNode(nodeInfo) {
        const node = {
            id: nodeInfo.id,
            name: nodeInfo.name,
            host: nodeInfo.host,
            port: nodeInfo.port || this.options.localserverPort,
            source: 'reticulum',
            protocol: 'reticulum',
            online: true,
            lastSeen: Date.now()
        };
        
        this.meshNodes.set(node.id, node);
        
        // Add to intraset discovery
        if (this.intraset.services.discovery) {
            this.intraset.services.discovery.addManualPeer(
                node.host,
                node.port,
                node.name
            );
        }
        
        console.log('[Mesh] Added mesh node:', node.name);
    }
    
    async broadcastMeshState() {
        // Broadcast mesh state to all connected intraset nodes
        if (!this.intraset.wsServer) return;
        
        const meshState = {
            type: 'mesh-state',
            timestamp: Date.now(),
            nodes: Array.from(this.meshNodes.values()),
            routes: this.reticulum ? this.reticulum.getRoutes() : [],
            reticulumConnected: this.reticulum ? this.reticulum.isConnected() : false
        };
        
        this.intraset.wsServer.broadcast({
            type: 'mesh-state',
            ...meshState
        });
    }
    
    // Reticulum-compatible API proxy
    
    async proxyReticulumRequest(path) {
        if (!this.reticulum || !this.reticulum.isConnected()) {
            return { error: 'Reticulum not connected' };
        }
        
        switch (path) {
            case '/.nodeid':
                return { node_id: this.options.nodeId };
            case '/.nodes':
                return { 
                    nodes: Array.from(this.meshNodes.values()),
                    this_node: this.options.nodeId 
                };
            case '/.identity':
                return { 
                    hash: this.options.nodeId,
                    name: this.intraset.services.config.nodeName,
                    type: 'node'
                };
            case '/api/info':
                return {
                    node_id: this.options.nodeId,
                    node_name: this.intraset.services.config.nodeName,
                    port: this.intraset.services.config.port,
                    ws_port: this.intraset.services.config.wsPort,
                    capabilities: ['http', 'ws', ' reticulum', 'mesh'],
                    protocols: ['reticulum', 'nomadnet', 'intraset'],
                    version: '1.0.0',
                    mesh_nodes: this.meshNodes.size
                };
            default:
                return { error: 'Unknown endpoint' };
        }
    }
    
    // Forward HTTP requests to reticulum when needed
    async handleRequest(reqPath, res) {
        // Check if it's a reticulum-style request
        if (reqPath.startsWith('/.') || reqPath.startsWith('/api/')) {
            const result = await this.proxyReticulumRequest(reqPath);
            res.json(result);
            return true;
        }
        return false;
    }
    
    // Send message through mesh
    async sendMeshMessage(targetNodeId, content) {
        if (this.reticulum && this.reticulum.isConnected()) {
            return await this.reticulum.sendToNode(targetNodeId, content);
        }
        return false;
    }
    
    // Broadcast to mesh
    async broadcastToMesh(content, type = 'text') {
        // Broadcast to intraset
        if (this.intraset.wsServer) {
            this.intraset.wsServer.broadcast({
                type: 'mesh-broadcast',
                sender: this.options.nodeId,
                senderName: this.intraset.services.config.nodeName,
                content,
                messageType: type,
                timestamp: Date.now()
            });
        }
        
        // Also broadcast to reticulum if connected
        if (this.reticulum && this.reticulum.isConnected()) {
            await this.reticulum.broadcastMessage(content, type);
        }
    }
    
    getMeshNodes() {
        return Array.from(this.meshNodes.values());
    }
    
    isReticulumConnected() {
        return this.reticulum ? this.reticulum.isConnected() : false;
    }
    
    destroy() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
        }
        
        if (this.reticulum) {
            this.reticulum.disconnect();
        }
        
        console.log('[Mesh] Integration destroyed');
    }
}

// Integration middleware for Express
function createMeshMiddleware(meshIntegration) {
    return async (req, res, next) => {
        // Handle reticulum-style requests
        if (req.path.startsWith('/.') || req.path.startsWith('/api/')) {
            const result = await meshIntegration.proxyReticulumRequest(req.path);
            return res.json(result);
        }
        
        // Add mesh info to all responses
        res.set('X-Mesh-Nodes', meshIntegration.getMeshNodes().length);
        res.set('X-Reticulum-Connected', meshIntegration.isReticulumConnected());
        
        next();
    };
}

module.exports = { MeshIntegration, createMeshMiddleware };