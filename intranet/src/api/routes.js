const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const createReticulumApi = require('../reticulum/reticulum-api');
const auth = require('../core/auth');

function createApiRouter(app, config, services, reticulumBridge = null) {
  const { db, discovery, fileService, chatService } = services;
  const router = express.Router();

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.files.maxFileSize * 1024 * 1024 }
  });

  // Global rate limiter
  router.use(auth.rateLimit({ maxRequests: 200, windowMs: 60000 }));

  // ========== Auth endpoints (no auth required) ==========

  router.post('/api/auth/login', (req, res) => {
    const { nodeName, password } = req.body;
    const nodeId = req.body.nodeId || config.nodeId;

    // Simple auth: if password set in config, verify it; otherwise auto-grant
    if (config.security.authRequired && password !== (config.security.adminPassword || '')) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const { token } = auth.createToken(nodeId, nodeName || 'Anonymous');
    res.json({ token, nodeId, nodeName: nodeName || 'Anonymous' });
  });

  router.get('/api/auth/stats', (req, res) => {
    res.json(auth.getTokenStats());
  });

  router.post('/api/auth/revoke', (req, res) => {
    const token = req.headers['x-auth-token'] || req.body.token;
    if (token) {
      auth.revokeToken(token);
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Token required' });
    }
  });

  // Protected routes middleware
  const protect = config.security.authRequired ? auth.requireAuth : (req, res, next) => next();

  router.get('/api/status', (req, res) => {
    res.json({
      nodeId: config.nodeId,
      nodeName: config.nodeName,
      online: true,
      uptime: process.uptime(),
      peers: discovery.getOnlineNodes().length,
      files: fileService.getAllFiles().length,
      version: '1.0.0',
      port: config.port,
      wsPort: config.wsPort,
      localIp: discovery.getLocalIp(),
      mdnsEnabled: config.network.mdnsEnabled,
    });
  });
  
  router.get('/api/ping', (req, res) => {
    res.json({ pong: true, timestamp: Date.now() });
  });
  
  // Reticulum-compatible API endpoints
  router.get('/.nodeid', (req, res) => {
    res.json({
      node_id: config.nodeId,
      node_name: config.nodeName,
      protocol: 'reticulum',
      version: '1.0.0'
    });
  });
  
  router.get('/api/reticulum/node', (req, res) => {
    res.json({
      node_id: config.nodeId,
      node_name: config.nodeName,
      port: config.port,
      capabilities: ['http', 'ws', ' reticulum', 'mesh'],
      protocols: ['reticulum', 'nomadnet'],
      timestamp: Date.now()
    });
  });
  
  router.get('/api/reticulum/peers', (req, res) => {
    const nodes = discovery.getOnlineNodes();
    res.json({
      peers: nodes.map(n => ({
        node_id: n.id,
        node_name: n.name,
        host: n.host,
        port: n.port
      })),
      count: nodes.length,
      timestamp: Date.now()
    });
  });
  
  router.get('/api/reticulum/ping', (req, res) => {
    res.json({
      status: 'pong',
      node_id: config.nodeId,
      timestamp: Date.now()
    });
  });
  
  router.get('/api/reticulum/announce', (req, res) => {
    res.json({
      status: 'announced',
      node_id: config.nodeId,
      timestamp: Date.now()
    });
  });
  
  router.get('/api/nodes', (req, res) => {
    const nodes = discovery.getNodes().map(n => ({
      id: n.id,
      name: n.name,
      host: n.host,
      port: n.port,
      wsPort: n.wsPort,
      online: n.online,
      lastSeen: n.lastSeen,
      source: n.source
    }));
    res.json({ nodes });
  });
  
  router.get('/api/nodes/:id', (req, res) => {
    const node = discovery.getNode(req.params.id);
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }
    res.json(node);
  });

  router.get('/api/nodes/:id/ping', async (req, res) => {
    const node = discovery.getNode(req.params.id);
    if (!node) {
      return res.status(404).json({ error: 'Node not found', reachable: false });
    }
    
    const start = Date.now();
    try {
      const response = await fetch(`http://${node.host}:${node.port}/api/ping`, {
        signal: AbortSignal.timeout(3000)
      });
      const latency = Date.now() - start;
      res.json({ 
        reachable: response.ok, 
        latency,
        online: response.ok,
        timestamp: Date.now()
      });
    } catch (err) {
      res.json({ 
        reachable: false, 
        error: err.message,
        online: false,
        timestamp: Date.now()
      });
    }
  });
  
  router.post('/api/nodes', (req, res) => {
    const { host, port, name } = req.body;
    if (!host) {
      return res.status(400).json({ error: 'Host is required' });
    }
    
    const peer = discovery.addManualPeer(host, port, name);
    res.json({ success: true, node: peer });
  });
  
  router.delete('/api/nodes/:id', (req, res) => {
    discovery.removeManualPeer(req.params.id);
    res.json({ success: true });
  });

  // ========== Mesh control ==========

  router.get('/api/mesh/status', (req, res) => {
    res.json({
      running: true,
      nodeId: config.nodeId,
      nodeName: config.nodeName,
      host: discovery.getLocalIp(),
      port: config.port,
      wsPort: config.wsPort,
      peers: discovery.getOnlineNodes().length,
      totalNodes: discovery.getNodes().length,
      mdnsEnabled: config.network.mdnsEnabled,
      uptime: process.uptime(),
      version: '1.0.0'
    });
  });

  router.post('/api/mesh/start', (req, res) => {
    try {
      discovery.startDiscovery();
      discovery.publishService();
      discovery.startPing();
      res.json({ success: true, message: 'Mesh discovery started' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/api/mesh/stop', (req, res) => {
    try {
      discovery.stopDiscovery?.();
      res.json({ success: true, message: 'Mesh discovery stopped' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.put('/api/settings/node', (req, res) => {
    const { nodeName } = req.body;
    if (!nodeName || typeof nodeName !== 'string' || !nodeName.trim()) {
      return res.status(400).json({ error: 'nodeName is required' });
    }
    config.nodeName = nodeName.trim();
    try {
      const db = services.db;
      if (db && db.settings) {
        db.settings.set('nodeName', config.nodeName);
      }
    } catch (_) {}
    res.json({ success: true, nodeName: config.nodeName });
  });

  router.get('/api/files', async (req, res) => {
    const all = req.query.all === 'true';
    const localFiles = fileService.getAllFiles();

    if (!all) {
      return res.json({ files: localFiles });
    }

    // Merge files from all known nodes
    const allFiles = [...localFiles];
    const nodes = discovery.getOnlineNodes();

    await Promise.all(nodes.map(async (node) => {
      try {
        const resp = await fetch(`http://${node.host}:${node.port}/api/files`, {
          signal: AbortSignal.timeout(3000)
        });
        if (resp.ok) {
          const data = await resp.json();
          (data.files || []).forEach(f => {
            f._sourceNode = node.name || node.id;
            f._sourceHost = node.host;
            f._sourcePort = node.port;
            allFiles.push(f);
          });
        }
      } catch (err) {
        // Node unreachable, skip
      }
    }));

    res.json({ files: allFiles, local: localFiles.length, remote: allFiles.length - localFiles.length });
  });
  
  router.get('/api/files/:id', (req, res) => {
    const file = fileService.getFile(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const filePath = file.path;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }
    
    res.download(filePath, file.name);
  });
  
  router.post('/api/files/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    try {
      const fileInfo = await fileService.saveFile(
        req.file.buffer,
        req.file.originalname,
        config.nodeId
      );
      
      res.json({ success: true, file: fileInfo });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  router.delete('/api/files/:id', (req, res) => {
    const success = fileService.deleteFile(req.params.id);
    res.json({ success });
  });

  // Proxy download from remote node
  router.get('/api/files/proxy', async (req, res) => {
    const { host, port, fileId } = req.query;
    if (!host || !port || !fileId) {
      return res.status(400).json({ error: 'host, port, fileId required' });
    }
    try {
      const resp = await fetch(`http://${host}:${port}/api/files/${fileId}`);
      if (!resp.ok) return res.status(resp.status).json({ error: 'Remote file not found' });

      const disposition = resp.headers.get('content-disposition');
      const contentType = resp.headers.get('content-type') || 'application/octet-stream';
      const contentLength = resp.headers.get('content-length');

      res.setHeader('Content-Type', contentType);
      if (disposition) res.setHeader('Content-Disposition', disposition);
      if (contentLength) res.setHeader('Content-Length', contentLength);

      const buffer = await resp.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });
  
  router.get('/api/files/stats', (req, res) => {
    res.json(fileService.getStats());
  });
  
  router.get('/api/messages', (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const messages = chatService.getAllMessages(limit);
    res.json({ messages });
  });
  
  router.get('/api/messages/contacts', (req, res) => {
    const contacts = chatService.getContacts(config.nodeId);
    res.json({ contacts });
  });
  
  router.get('/api/messages/:nodeId', (req, res) => {
    const messages = chatService.getConversation(config.nodeId, req.params.nodeId);
    res.json({ messages });
  });
  
  router.post('/api/messages', (req, res) => {
    const { receiverId, content, type, senderId } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    const effectiveSenderId = senderId || config.nodeId;
    const message = chatService.sendMessage(effectiveSenderId, receiverId, content, type || 'text');
    res.json({ success: true, message });
  });

  // Mobile node registration — stores the phone as a participant without needing a server
  router.post('/api/mobile/register', (req, res) => {
    const { mobileId, mobileName } = req.body;
    if (!mobileId) return res.status(400).json({ error: 'mobileId required' });
    const nodeInfo = {
      id: mobileId,
      name: mobileName || 'Mobile',
      host: 'mobile',
      port: 0,
      wsPort: 0,
      online: true,
      lastSeen: Date.now(),
      source: 'mobile',
    };
    discovery.nodes.set(mobileId, nodeInfo);
    try {
      db.nodes.updateOnline(1, Date.now(), mobileId);
    } catch (_) {
      try {
        db.nodes.insert({
          id: mobileId,
          name: mobileName || 'Mobile',
          host: 'mobile',
          port: 0,
          wsPort: 0,
          online: 1,
          lastSeen: Date.now(),
          metadata: JSON.stringify(nodeInfo),
        });
      } catch (__) {}
    }
    res.json({ success: true, nodeId: mobileId, nodeName: mobileName });
  });
  
  router.post('/api/messages/broadcast', (req, res) => {
    const { content, type } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    const message = chatService.broadcast(config.nodeId, content, type || 'text');
    res.json({ success: true, message });
  });
  
  router.post('/api/messages/read/:nodeId', (req, res) => {
    chatService.markAsRead(req.params.nodeId);
    res.json({ success: true });
  });

  // ========== Sync endpoints ==========

  // Sync messages since a given timestamp
  router.get('/api/sync/messages', async (req, res) => {
    const since = parseInt(req.query.since) || 0;
    const limit = parseInt(req.query.limit) || 500;

    const all = chatService.getAllMessages(limit);
    const newer = all.filter(m => m.timestamp > since);

    res.json({
      messages: newer,
      count: newer.length,
      since,
      nodeId: config.nodeId
    });
  });

  // Sync file catalog (metadata only)
  router.get('/api/sync/files', (req, res) => {
    const since = parseInt(req.query.since) || 0;
    const files = fileService.getAllFiles();
    const newer = files.filter(f => (f.created_at || 0) > since);

    res.json({
      files: newer.map(f => ({
        id: f.id,
        name: f.name,
        size: f.size,
        mime_type: f.mime_type,
        node_id: f.node_id,
        created_at: f.created_at
      })),
      count: newer.length,
      nodeId: config.nodeId
    });
  });

  // Node info endpoint for discovery sync
  router.get('/api/sync/node-info', (req, res) => {
    res.json({
      nodeId: config.nodeId,
      nodeName: config.nodeName,
      host: discovery.getLocalIp(),
      port: config.port,
      wsPort: config.wsPort,
      fileCount: fileService.getAllFiles().length,
      version: '1.0.0',
      timestamp: Date.now()
    });
  });

  router.get('/intra/nodes', (req, res) => {
    const nodes = discovery.getNodes();
    res.send(renderIntraPage('nodes', { nodes, nodeId: config.nodeId }));
  });
  
  router.get('/intra/chat', (req, res) => {
    const contacts = chatService.getContacts(config.nodeId);
    res.send(renderIntraPage('chat', { contacts, nodeId: config.nodeId }));
  });
  
  router.get('/intra/files', (req, res) => {
    const files = fileService.getAllFiles();
    res.send(renderIntraPage('files', { files, nodeId: config.nodeId }));
  });
  
  router.get('/intra/my', (req, res) => {
    const stats = fileService.getStats();
    const nodeInfo = {
      id: config.nodeId,
      name: config.nodeName,
      host: discovery.getLocalIp(),
      port: config.port,
      wsPort: config.wsPort
    };
    res.send(renderIntraPage('my', { node: nodeInfo, stats }));
  });
  
  router.get('/intra/settings', (req, res) => {
    res.send(renderIntraPage('settings', { 
      nodeName: config.nodeName,
      manualPeers: discovery.manualPeers,
      mdnsEnabled: config.network.mdnsEnabled
    }));
  });
  
  router.get('/intra/', (req, res) => {
    res.send(renderIntraPage('home', { 
      nodeId: config.nodeId,
      nodeName: config.nodeName,
      peerCount: discovery.getOnlineNodes().length,
      fileCount: fileService.getAllFiles().length
    }));
  });
  
  return router;
}

function safe(val, fallback = '') {
  return val ?? fallback;
}

function safeArray(arr) {
  return Array.isArray(arr) ? arr : [];
}

function safeMap(arr, fn) {
  return safeArray(arr).map(fn).join('');
}

function renderIntraPage(page, data) {
  const pages = {
    home: `
      <h1>Интрасеть</h1>
      <p>Добро пожаловать в автономную mesh-сеть!</p>
      <div class="stats">
        <div class="stat">
          <span class="label">Узел:</span>
          <span class="value">${safe(data?.nodeName)}</span>
        </div>
        <div class="stat">
          <span class="label">ID:</span>
          <span class="value">${(safe(data?.nodeId) || '').slice(0, 8)}...</span>
        </div>
        <div class="stat">
          <span class="label">Узлов в сети:</span>
          <span class="value">${safe(data?.peerCount, 0)}</span>
        </div>
        <div class="stat">
          <span class="label">Файлов:</span>
          <span class="value">${safe(data?.fileCount, 0)}</span>
        </div>
      </div>
      <nav>
        <a href="/intra/my">Мой узел</a>
        <a href="/intra/nodes">Узлы</a>
        <a href="/intra/chat">Чат</a>
        <a href="/intra/files">Файлы</a>
        <a href="/intra/settings">Настройки</a>
      </nav>
    `,
    my: `
      <h1>Мой узел</h1>
      <div class="info">
        <p><strong>Имя:</strong> ${safe(data?.node?.name)}</p>
        <p><strong>ID:</strong> ${safe(data?.node?.id)}</p>
        <p><strong>IP:</strong> ${safe(data?.node?.host)}</p>
        <p><strong>Порт API:</strong> ${safe(data?.node?.port)}</p>
        <p><strong>Порт WS:</strong> ${safe(data?.node?.wsPort)}</p>
      </div>
      <div class="storage">
        <h2>Хранилище</h2>
        <p>Файлов: ${safe(data?.stats?.fileCount, 0)}</p>
        <p>Использовано: ${formatBytes(safe(data?.stats?.totalSize, 0))}</p>
      </div>
      <nav>
        <a href="/intra/">Главная</a>
        <a href="/intra/settings">Настройки</a>
      </nav>
    `,
    nodes: `
      <h1>Узлы сети</h1>
      ${safeArray(data?.nodes).length === 0 ? '<p>Нет доступных узлов</p>' : ''}
      <ul class="nodes">
        ${safeMap(data?.nodes, n => `
          <li class="${n.online ? 'online' : 'offline'}">
            <strong>${safe(n.name)}</strong>
            <span>${safe(n.host)}:${safe(n.port)}</span>
            <span class="status">${n.online ? 'Онлайн' : 'Офлайн'}</span>
          </li>
        `)}
      </ul>
      <nav>
        <a href="/intra/">Главная</a>
      </nav>
    `,
    chat: `
      <h1>Чат Интрасети</h1>
      <p>Выберите узел для начала разговора</p>
      ${safeArray(data?.contacts).length === 0 ? '<p>Нет сообщений</p>' : ''}
      <ul class="contacts">
        ${safeMap(data?.contacts, c => `
          <li>
            <a href="/intra/chat/${safe(c?.nodeId)}">${(safe(c?.nodeId) || '').slice(0, 8)}...</a>
            <span class="preview">${(safe(c?.lastMessage?.content) || '').slice(0, 50)}</span>
            ${safe(c?.unread, 0) > 0 ? `<span class="unread">${c.unread}</span>` : ''}
          </li>
        `)}
      </ul>
      <nav>
        <a href="/intra/">Главная</a>
      </nav>
    `,
    files: `
      <h1>Файлы</h1>
      ${safeArray(data?.files).length === 0 ? '<p>Нет общих файлов</p>' : ''}
      <ul class="files">
        ${safeMap(data?.files, f => `
          <li>
            <a href="/api/files/${f.id}">${safe(f.name)}</a>
            <span>${formatBytes(safe(f.size, 0))}</span>
            <span>${(safe(f.node_id) || '').slice(0, 8)}</span>
          </li>
        `)}
      </ul>
      <form action="/api/files/upload" method="post" enctype="multipart/form-data">
        <input type="file" name="file">
        <button type="submit">Загрузить</button>
      </form>
      <nav>
        <a href="/intra/">Главная</a>
      </nav>
    `,
    settings: `
      <h1>Настройки Интрасети</h1>
      <form action="/api/settings" method="post">
        <label>Имя узла: <input type="text" name="nodeName" value="${safe(data?.nodeName)}"></label>
        <label>
          <input type="checkbox" ${data?.mdnsEnabled ? 'checked' : ''} disabled> mDNS discovery
        </label>
        <button type="submit">Сохранить</button>
      </form>
      <h2>Ручные узлы</h2>
      <ul class="peers">
        ${safeMap(data?.manualPeers, p => `<li>${safe(p.name)} - ${safe(p.host)}:${safe(p.port)}</li>`)}
      </ul>
      <nav>
        <a href="/intra/">Главная</a>
      </nav>
    `
  };
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Интрасеть - ${page}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    h1 { color: #333; }
    nav { margin-top: 20px; padding: 10px; background: #fff; border-radius: 8px; }
    nav a { margin-right: 15px; color: #0066cc; text-decoration: none; }
    nav a:hover { text-decoration: underline; }
    .stats, .info, .storage { background: #fff; padding: 15px; border-radius: 8px; margin: 10px 0; }
    .stat { margin: 5px 0; }
    .stat .label { font-weight: bold; color: #666; }
    ul { list-style: none; padding: 0; }
    li { background: #fff; margin: 5px 0; padding: 10px; border-radius: 4px; }
    .online { border-left: 4px solid #4caf50; }
    .offline { border-left: 4px solid #f44336; opacity: 0.7; }
    .status { float: right; }
    form { background: #fff; padding: 15px; border-radius: 8px; }
    input[type="text"], input[type="file"] { padding: 8px; margin: 5px 0; width: 100%; box-sizing: border-box; }
    button { padding: 8px 16px; background: #0066cc; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
    button:hover { background: #0055aa; }
  </style>
</head>
<body>
  ${pages[page] || '<p>Страница не найдена</p>'}
</body>
</html>`;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = createApiRouter;
