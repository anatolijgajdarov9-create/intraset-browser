// reticulum/index.js - Main entry point for Reticulum protocol implementation
// Provides easy access to all Reticulum components

const Router = require('./router');
const ReticulumBridge = require('./bridge');
const Identity = require('./identity');
const Destination = require('./destination');
const Packet = require('./packet');
const PathTable = require('./pathTable');
const AnnounceSystem = require('./announce');
const { Link, LINK_STATES } = require('./link');
const Transport = require('./transport');
const { Interface, INTERFACE_TYPES, INTERFACE_STATES } = require('./interface');
const TCPInterface = require('./interfaces/tcp');
const UDPInterface = require('./interfaces/udp');
const crypto = require('./crypto');

module.exports = {
    // Main components
    Router,
    ReticulumBridge,
    
    // Core primitives
    Identity,
    Destination,
    Packet,
    PathTable,
    AnnounceSystem,
    Link,
    Transport,
    
    // Interfaces
    Interface,
    TCPInterface,
    UDPInterface,
    
    // Enums
    LINK_STATES,
    INTERFACE_TYPES,
    INTERFACE_STATES,
    
    // Utilities
    crypto,
    
    // Factory function to create a configured router
    createRouter(options = {}) {
        return new Router(options);
    },
    
    // Factory function to create a bridge
    createBridge(intrasetServer, options = {}) {
        return new ReticulumBridge({
            intrasetServer,
            ...options
        });
    }
};
