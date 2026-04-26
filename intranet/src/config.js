const path = require('path');

// Data directory: passed from Electron main process via env, or fallback for standalone run
const DATA_DIR = process.env.INTRANET_DATA_DIR || path.join(__dirname, '..', 'data');

module.exports = {
  host: '0.0.0.0',
  port: parseInt(process.env.INTRANET_PORT || '3847'),
  wsPort: parseInt(process.env.INTRANET_WS_PORT || '3848'),

  nodeName: process.env.NODE_NAME || 'Мой ПК',
  nodeId: null,

  network: {
    mdnsEnabled: true,
    manualPeers: [],
    pingInterval: 30000,
    peerTimeout: 60000,
  },

  files: {
    storageDir: path.join(DATA_DIR, 'files'),
    maxFileSize: 500,
    sharedFolders: [path.join(DATA_DIR, 'shared')],
  },

  chat: {
    localHistory: true,
    maxHistory: 1000,
  },

  dns: {
    domain: 'intra',
    enabled: true,
  },

  ui: {
    enabled: true,
    staticDir: path.join(__dirname, 'ui'),
  },

  security: {
    allowRemote: true,
    authRequired: false,
  },

  // Expose DATA_DIR for other modules
  dataDir: DATA_DIR,
};
