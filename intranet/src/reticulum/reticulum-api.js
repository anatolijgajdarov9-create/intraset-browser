// reticulum-api.js - REST API endpoints for Reticulum protocol
// Provides HTTP endpoints for managing Reticulum network

const express = require('express');

function createReticulumApi(router, bridge) {
    const app = express.Router();

    /**
     * Get Reticulum status
     */
    app.get('/api/reticulum/status', (req, res) => {
        if (!bridge) {
            return res.json({
                enabled: false,
                running: false
            });
        }

        const status = bridge.getStatus();
        res.json({
            enabled: true,
            ...status
        });
    });

    /**
     * Get Reticulum address
     */
    app.get('/api/reticulum/address', (req, res) => {
        if (!bridge) {
            return res.json({ error: 'Reticulum not initialized' });
        }

        res.json({
            address: bridge.getAddress()
        });
    });

    /**
     * Get router information
     */
    app.get('/api/reticulum/router', (req, res) => {
        if (!bridge || !bridge.router) {
            return res.json({ error: 'Router not initialized' });
        }

        res.json({
            address: bridge.router.identity.address,
            status: bridge.router.getStatus()
        });
    });

    /**
     * Get path table
     */
    app.get('/api/reticulum/paths', (req, res) => {
        if (!bridge || !bridge.router || !bridge.router.pathTable) {
            return res.json({ error: 'Path table not available' });
        }

        const paths = bridge.router.pathTable.getAllPaths();
        const stats = bridge.router.pathTable.getStats();

        res.json({
            paths: paths,
            stats: stats
        });
    });

    /**
     * Get announces
     */
    app.get('/api/reticulum/announces', (req, res) => {
        if (!bridge || !bridge.router || !bridge.router.announceSystem) {
            return res.json({ error: 'Announce system not available' });
        }

        const announces = bridge.router.announceSystem.getAllKnownDestinations();
        const stats = bridge.router.announceSystem.getStats();

        res.json({
            announces: announces,
            stats: stats
        });
    });

    /**
     * Get interfaces
     */
    app.get('/api/reticulum/interfaces', (req, res) => {
        if (!bridge || !bridge.router) {
            return res.json({ error: 'Router not initialized' });
        }

        const interfaces = bridge.router.getInterfacesInfo();
        res.json({
            interfaces: interfaces
        });
    });

    /**
     * Get transport stats
     */
    app.get('/api/reticulum/transport', (req, res) => {
        if (!bridge || !bridge.router || !bridge.router.transport) {
            return res.json({ error: 'Transport not available' });
        }

        const stats = bridge.router.transport.getStats();
        res.json(stats);
    });

    /**
     * Send message to Reticulum node
     */
    app.post('/api/reticulum/send', async (req, res) => {
        if (!bridge) {
            return res.json({ error: 'Reticulum not initialized' });
        }

        const { target, content, type } = req.body;

        if (!target || !content) {
            return res.status(400).json({
                error: 'Missing required fields: target, content'
            });
        }

        try {
            await bridge.sendMessage(target, content, type || 'text');
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({
                error: err.message
            });
        }
    });

    /**
     * Broadcast message
     */
    app.post('/api/reticulum/broadcast', async (req, res) => {
        if (!bridge) {
            return res.json({ error: 'Reticulum not initialized' });
        }

        const { content, type } = req.body;

        if (!content) {
            return res.status(400).json({
                error: 'Missing required field: content'
            });
        }

        try {
            await bridge.broadcastMessage(content, type || 'text');
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({
                error: err.message
            });
        }
    });

    /**
     * Announce this node
     */
    app.post('/api/reticulum/announce', async (req, res) => {
        if (!bridge || !bridge.router) {
            return res.json({ error: 'Router not initialized' });
        }

        try {
            await bridge.router.announce(req.body.appData || null);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({
                error: err.message
            });
        }
    });

    /**
     * Get bridge stats
     */
    app.get('/api/reticulum/stats', (req, res) => {
        if (!bridge) {
            return res.json({ error: 'Reticulum not initialized' });
        }

        const status = bridge.getStatus();
        res.json({
            stats: status.stats,
            router: status.router
        });
    });

    /**
     * Reticulum compatibility endpoints (NomadNet style)
     */
    
    // /.nodeid - Return node ID
    app.get('/.nodeid', (req, res) => {
        if (!bridge || !bridge.router) {
            return res.status(503).send('Reticulum not available');
        }

        res.type('text/plain');
        res.send(bridge.router.identity.address);
    });

    // /.nodes - Return known nodes
    app.get('/.nodes', (req, res) => {
        if (!bridge || !bridge.router) {
            return res.json({ nodes: [] });
        }

        const announces = bridge.router.announceSystem.getAllKnownDestinations();
        const nodes = announces.map(a => ({
            address: a.address,
            hops: a.hops,
            lastSeen: a.lastSeen
        }));

        res.json({
            nodes: nodes,
            this_node: bridge.router.identity.address
        });
    });

    // /.identity - Return identity info
    app.get('/.identity', (req, res) => {
        if (!bridge || !bridge.router) {
            return res.json({ error: 'Not available' });
        }

        res.json({
            hash: bridge.router.identity.address,
            type: 'node',
            protocols: ['reticulum', 'intraset']
        });
    });

    return app;
}

module.exports = createReticulumApi;
