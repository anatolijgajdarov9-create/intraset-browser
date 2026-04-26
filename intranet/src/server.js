const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const os = require('os');

const config = require('./config');
const dbModule = require('./core/database');
const DiscoveryService = require('./core/discovery');
const WebSocketServer = require('./core/websocket');
const DNSResolver = require('./core/dns');
const FileService = require('./services/fileService');
const ChatService = require('./services/chatService');
const createApiRouter = require('./api/routes');
const ReticulumBridge = require('./reticulum/bridge');

let reticulumBridge = null;

async function startServer() {
  await dbModule.initDatabase();

  function getOrCreateNodeId() {
    try {
      const stored = dbModule.settings.get('nodeId');
      if (stored) return stored.value;
    } catch (_) {}
    const nodeId = uuidv4();
    try { dbModule.settings.set('nodeId', nodeId); } catch (_) {}
    return nodeId;
  }

  config.nodeId = getOrCreateNodeId();

  try {
    const savedName = dbModule.settings.get('nodeName');
    if (savedName && savedName.value) config.nodeName = savedName.value;
  } catch (_) {}

  console.log('[Server] =======================================');
  console.log('[Server] Интрасеть v1.0.0');
  console.log('[Server] Node ID:', config.nodeId);
  console.log('[Server] Node Name:', config.nodeName);
  console.log('[Server] Data Dir:', config.dataDir);
  console.log('[Server] =======================================');

  const discovery = new DiscoveryService(dbModule);
  const fileService = new FileService(dbModule);
  const chatService = new ChatService(dbModule);

  const services = { config, db: dbModule, discovery, fileService, chatService };

  try {
    reticulumBridge = new ReticulumBridge({
      intrasetServer: { services, wsServer: null },
      enabled: true,
      tcpPort: 3849,
      udpPort: 3850,
      announceInterval: 60000,
      identityPath: path.join(config.dataDir, 'reticulum_identity')
    });
    await reticulumBridge.initialize();
    console.log('[Server] Reticulum bridge initialized');
  } catch (err) {
    console.error('[Server] Reticulum bridge initialization failed:', err.message);
    console.log('[Server] Continuing without Reticulum support');
  }

  const app = express();
  const server = http.createServer(app);

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // intra:// protocol redirect
  app.use((req, res, next) => {
    const host = req.headers.host || '';
    if (host === 'intra' || host.startsWith('intra:')) {
      const p = req.path === '/' ? '/nodes' : req.path;
      return res.redirect('http://localhost:' + config.port + '/ui/' + p);
    }
    next();
  });

  app.use('/ui', express.static(path.join(__dirname, 'ui')));

  app.get('/ui/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'ui/dashboard.html')));
  app.get('/ui/forum', (req, res) => res.sendFile(path.join(__dirname, 'ui/forum.html')));
  app.get('/ui/wiki', (req, res) => res.sendFile(path.join(__dirname, 'ui/wiki.html')));
  app.get('/ui/nodes', (req, res) => res.sendFile(path.join(__dirname, 'ui/index.html')));
  app.get('/ui/chat', (req, res) => res.sendFile(path.join(__dirname, 'ui/index.html')));
  app.get('/ui/files', (req, res) => res.sendFile(path.join(__dirname, 'ui/index.html')));
  app.get('/ui/settings', (req, res) => res.sendFile(path.join(__dirname, 'ui/index.html')));

  app.use('/sites', express.static(path.join(config.dataDir, 'sites')));

  app.get('/site/:name(*)', (req, res) => {
    const sitePath = path.join(config.dataDir, 'sites', req.params.name || 'index');
    res.sendFile(sitePath, { dotfiles: 'allow' }, (err) => {
      if (err) res.status(404).send('Site not found: ' + req.params.name);
    });
  });

  app.use(createApiRouter(app, config, services, reticulumBridge));

  app.get('/', (req, res) => {
    res.json({ name: 'Интрасеть', version: '1.0.0', nodeId: config.nodeId });
  });

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((err, req, res, next) => {
    console.error('[Server] Error:', err);
    res.status(500).json({ error: err.message });
  });

  server.listen(config.port, config.host, () => {
    console.log('[Server] HTTP server started on', config.host + ':' + config.port);
    console.log('[Server] Local IP:', discovery.getLocalIp());
    console.log('[Server]   - HTTP: http://localhost:' + config.port);
    console.log('[Server]   - LAN:  http://' + discovery.getLocalIp() + ':' + config.port);
    console.log('[Server]   - UI:   http://localhost:' + config.port + '/ui/nodes');

    discovery.startDiscovery();
    discovery.publishService();
    discovery.startPing();

    if (config.dns?.enabled) {
      const dnsResolver = new DNSResolver(discovery, config);
      dnsResolver.start();
      console.log(`[Server] DNS resolver active: <name>.${config.dns.domain} → IP`);
    }
  });

  const wsServer = new WebSocketServer(config.wsPort, services);
  wsServer.start();

  if (reticulumBridge) reticulumBridge.intrasetServer.wsServer = wsServer;

  function shutdown() {
    console.log('\n[Server] Shutting down...');
    if (reticulumBridge) reticulumBridge.destroy();
    wsServer.stop();
    discovery.destroy();
    dbModule.closeDatabase();
    server.close(() => { console.log('[Server] Goodbye!'); process.exit(0); });
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch(err => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});
