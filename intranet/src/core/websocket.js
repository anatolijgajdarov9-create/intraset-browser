const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const BINARY_TYPES = { FILE_CHUNK: 0x01, FILE_CHUNK_ACK: 0x02, FILE_COMPLETE: 0x03 };
const CHUNK_SIZE = 64 * 1024;

class WebSocketServer {
  constructor(port, services) {
    this.wss = null;
    this.port = port;
    this.services = services;
    this.clients = new Map();
    this.messageHandlers = [];
    this.activeDownloads = new Map();
    this.activeUploads = new Map();
  }

  start() {
    this.wss = new WebSocket.Server({ port: this.port });
    this.wss.on('connection', (ws, req) => {
      const clientId = uuidv4();
      console.log('[WS] New connection:', clientId);

      // Check auth token from URL query param (?token=xxx)
      try {
        const url = new URL(req.url, 'http://localhost:' + this.port);
        const authToken = url.searchParams.get('token');

        if (this.services.config.security.authRequired && authToken) {
          const authEntry = require('./auth').validateToken(authToken);
          if (!authEntry) {
            console.log('[WS] Auth rejected for', clientId);
            ws.send(JSON.stringify({ type: 'auth-error', error: 'Invalid token' }));
            ws.close(4001, 'Unauthorized');
            return;
          }
          ws.authenticated = true;
          ws.authNode = authEntry;
          console.log('[WS] Auth OK:', authEntry.nodeName);
        }
      } catch (e) { /* URL parse error — continue without auth */ }

      ws.clientId = clientId;
      ws.isAlive = true;
      ws.subscriptions = new Set();
      this.clients.set(clientId, ws);
      ws.send(JSON.stringify({ type: 'welcome', clientId, nodeId: this.services.config.nodeId, nodeName: this.services.config.nodeName, authRequired: this.services.config.security.authRequired }));
      ws.on('message', (data, isBinary) => {
        if (isBinary || (data instanceof Buffer && data[0] <= 0x0F)) {
          this.handleBinaryMessage(ws, Buffer.from(data));
          return;
        }
        try { this.handleMessage(ws, JSON.parse(data.toString())); }
        catch (err) { console.error('[WS] Parse error:', err.message); }
      });
      ws.on('pong', () => { ws.isAlive = true; });
      ws.on('close', () => { this.clients.delete(clientId); this.services.discovery.onNodeLeave?.({ id: clientId }); });
      ws.on('error', (err) => { console.error('[WS] Error:', err.message); });
    });
    console.log('[WS] WebSocket server started on port', this.port);
    this.startHeartbeat();
  }

  handleBinaryMessage(ws, buffer) {
    if (buffer.length < 45) return;
    const msgType = buffer.readUInt8(0);
    const fileId = buffer.subarray(1, 37).toString();
    const chunkIndex = buffer.readUInt32BE(37);
    const totalChunks = buffer.readUInt32BE(41);
    const chunkData = buffer.subarray(45);
    if (msgType === BINARY_TYPES.FILE_CHUNK) this.handleFileChunk(ws, { fileId, chunkIndex, totalChunks, data: chunkData });
    else if (msgType === BINARY_TYPES.FILE_CHUNK_ACK) this.handleFileChunkAck(ws, { fileId, chunkIndex, totalChunks });
    else if (msgType === BINARY_TYPES.FILE_COMPLETE) this.handleFileComplete(ws, { fileId });
  }

  handleFileChunk(ws, { fileId, chunkIndex, totalChunks, data }) {
    const dl = this.activeDownloads.get(fileId);
    if (!dl) return;
    try {
      data.copy(dl.buffer, chunkIndex * CHUNK_SIZE);
      dl.chunksReceived = Math.max(dl.chunksReceived || 0, chunkIndex + 1);
      ws.send(this.buildBinaryFrame(BINARY_TYPES.FILE_CHUNK_ACK, fileId, chunkIndex, totalChunks));
      if (dl.chunksReceived >= totalChunks) this.finalizeDownload(dl);
    } catch (err) { console.error('[WS] File chunk error:', err.message); }
  }

  handleFileChunkAck(ws, { fileId, chunkIndex }) {
    const up = this.activeUploads.get(fileId);
    if (!up) return;
    const next = chunkIndex + 1;
    if (next >= up.totalChunks) {
      ws.send(JSON.stringify({ type: 'file-complete', payload: { fileId, fileName: up.fileName, fileSize: up.fileSize } }));
      this.activeUploads.delete(fileId);
      console.log('[WS] Upload complete:', up.fileName);
      return;
    }
    const start = next * CHUNK_SIZE;
    const chunk = up.fileBuffer.subarray(start, Math.min(start + CHUNK_SIZE, up.fileBuffer.length));
    ws.send(this.buildBinaryFrame(BINARY_TYPES.FILE_CHUNK, fileId, next, up.totalChunks, chunk));
  }

  handleFileComplete(ws, { fileId }) { this.activeUploads.delete(fileId); }

  buildBinaryFrame(type, fileId, chunkIndex, totalChunks, data) {
    const header = Buffer.alloc(45);
    header.writeUInt8(type, 0);
    Buffer.from(fileId.padEnd(36, '\0')).copy(header, 1);
    header.writeUInt32BE(chunkIndex, 37);
    header.writeUInt32BE(totalChunks, 41);
    return data ? Buffer.concat([header, data]) : header;
  }

  async startFileTransfer(targetWs, fileId) {
    const file = this.services.fileService.getFile(fileId);
    if (!file) { targetWs.send(JSON.stringify({ type: 'file-error', payload: { fileId, error: 'File not found' } })); return; }
    if (!fs.existsSync(file.path)) { targetWs.send(JSON.stringify({ type: 'file-error', payload: { fileId, error: 'File not on disk' } })); return; }
    try {
      const fileBuffer = fs.readFileSync(file.path);
      const totalChunks = Math.ceil(fileBuffer.length / CHUNK_SIZE);
      this.activeUploads.set(fileId, { fileName: file.name, fileSize: fileBuffer.length, totalChunks, fileBuffer });
      targetWs.send(JSON.stringify({ type: 'file-transfer-start', payload: { fileId, fileName: file.name, fileSize: fileBuffer.length, totalChunks } }));
      targetWs.send(this.buildBinaryFrame(BINARY_TYPES.FILE_CHUNK, fileId, 0, totalChunks, fileBuffer.subarray(0, Math.min(CHUNK_SIZE, fileBuffer.length))));
      console.log('[WS] File transfer started:', file.name, '(' + totalChunks, 'chunks)');
    } catch (err) { console.error('[WS] File transfer error:', err.message); }
  }

  requestFileFromNode(sourceNodeId, fileId) {
    const sw = this.clients.get(sourceNodeId);
    if (!sw || sw.readyState !== WebSocket.OPEN) return;
    sw.send(JSON.stringify({ type: 'file-download-request', payload: { fileId, requesterId: this.services.config.nodeId } }));
  }

  finalizeDownload(dl) {
    try {
      const ext = path.extname(dl.fileName || '');
      const filePath = path.join(this.services.fileService.storageDir, dl.fileId + (ext || ''));
      fs.writeFileSync(filePath, dl.buffer.subarray(0, dl.fileSize));
      const stats = fs.statSync(filePath);
      this.services.fileService.db.files.insert({ id: dl.fileId, nodeId: this.services.config.nodeId, name: dl.fileName || 'file', path: filePath, size: stats.size, mimeType: this.services.fileService.getMimeType(ext || '.bin'), hash: '', shared: 1 });
      if (dl.clientWs && dl.clientWs.readyState === WebSocket.OPEN) dl.clientWs.send(JSON.stringify({ type: 'file-download-complete', payload: { fileId: dl.fileId, fileName: dl.fileName, fileSize: stats.size } }));
      this.activeDownloads.delete(dl.fileId);
      console.log('[WS] File downloaded:', dl.fileName);
    } catch (err) { console.error('[WS] Finalize download error:', err.message); }
  }

  handleMessage(ws, message) {
    const { type, payload } = message;
    if (type === 'register' && payload.nodeId) {
      const oldId = ws.clientId;
      ws.clientId = payload.nodeId; ws.nodeName = payload.nodeName;
      this.clients.delete(oldId); this.clients.set(payload.nodeId, ws);
      this.services.discovery.onNodeJoin?.({ id: payload.nodeId, name: payload.nodeName, host: ws._socket?.remoteAddress, port: this.services.config.port, wsPort: this.port });
    } else if (type === 'subscribe' && payload.channel) { ws.subscriptions.add(payload.channel); ws.send(JSON.stringify({ type: 'subscribed', channel: payload.channel })); }
    else if (type === 'unsubscribe' && payload.channel) ws.subscriptions.delete(payload.channel);
    else if (type === 'ping') ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
    else if (type === 'message') this.handleChatMessage(ws, payload);
    else if (type === 'broadcast') this.broadcast({ type: 'broadcast', senderId: ws.clientId, senderName: ws.nodeName, content: payload.content, channel: payload.channel }, ws);
    else if (type === 'file-request') this.handleFileRequest(ws, payload);
    else if (type === 'file-offer') this.handleFileOffer(ws, payload);
    else if (type === 'file-accept') this.startFileTransfer(ws, payload.fileId);
    else if (type === 'file-download-request') this.handleFileDownloadRequest(ws, payload);
  }

  handleChatMessage(ws, payload) {
    const msg = this.services.chatService.sendMessage(ws.clientId, payload.receiverId, payload.content, payload.type || 'text');
    if (payload.receiverId) { const rw = this.clients.get(payload.receiverId); if (rw && rw.readyState === WebSocket.OPEN) rw.send(JSON.stringify({ type: 'message', message: msg })); }
    ws.send(JSON.stringify({ type: 'message-sent', message: msg }));
  }

  handleFileRequest(ws, payload) {
    const file = this.services.fileService.getFile(payload.fileId);
    if (!file) { ws.send(JSON.stringify({ type: 'file-error', error: 'File not found' })); return; }
    const ow = this.clients.get(file.node_id);
    if (ow && ow.readyState === WebSocket.OPEN) ow.send(JSON.stringify({ type: 'file-offer', payload: { fileId: payload.fileId, fileName: file.name, fileSize: file.size, requesterId: ws.clientId, requesterName: ws.nodeName } }));
  }

  handleFileOffer(ws, payload) {
    const rw = this.clients.get(payload.requesterId);
    if (rw && rw.readyState === WebSocket.OPEN) rw.send(JSON.stringify({ type: 'file-offer', payload: { fileId: payload.fileId, fileName: payload.fileName, fileSize: payload.fileSize, ownerId: ws.clientId, ownerName: ws.nodeName } }));
  }

  handleFileDownloadRequest(ws, payload) {
    const rw = this.clients.get(payload.requesterId);
    if (rw && rw.readyState === WebSocket.OPEN) this.startFileTransfer(rw, payload.fileId);
    else ws.send(JSON.stringify({ type: 'file-error', payload: { fileId: payload.fileId, error: 'Requester not connected' } }));
  }

  broadcast(message, excludeWs) {
    const data = JSON.stringify(message);
    this.clients.forEach((ws) => { if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) ws.send(data); });
  }

  sendTo(nodeId, message) { const ws = this.clients.get(nodeId); if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message)); }

  startHeartbeat() {
    setInterval(() => { this.wss.clients.forEach((ws) => { if (ws.isAlive === false) return ws.terminate(); ws.isAlive = false; ws.ping(); }); }, 30000);
  }

  getClients() { return Array.from(this.clients.values()); }
  getClientCount() { return this.clients.size; }

  stop() { if (this.wss) { this.wss.close(); console.log('[WS] WebSocket server stopped'); } }
}

module.exports = WebSocketServer;
