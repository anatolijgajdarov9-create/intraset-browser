const Bonjour = require('bonjour');
const config = require('../config');
const { v4: uuidv4 } = require('uuid');
const { networkInterfaces } = require('os');

class DiscoveryService {
  constructor(db) {
    this.db = db;
    this.bonjour = null;
    this.publishedService = null;
    this.manualPeers = [];
    this.nodes = new Map();
    this.pingTimer = null;

    if (config.network.mdnsEnabled) this.initMdns();
  }

  initMdns() {
    try {
      this.bonjour = new Bonjour();
      console.log('[Discovery] mDNS initialized');
    } catch (err) {
      console.error('[Discovery] mDNS init error:', err.message);
    }
  }

  // Pick the best local IP for LAN connectivity.
  // Prefers physical WiFi/Ethernet over VPNs and virtual adapters.
  getLocalIp() {
    const nets = networkInterfaces();
    const preferred = [];
    const fallback = [];

    for (const [name, addrs] of Object.entries(nets)) {
      for (const iface of addrs) {
        if (iface.family !== 'IPv4' || iface.internal) continue;
        const addr = iface.address;

        // Skip link-local (169.254.x.x)
        if (addr.startsWith('169.254.')) continue;

        // Skip Tailscale / CGNAT range (100.64.0.0/10 = 100.64–100.127)
        const parts = addr.split('.').map(Number);
        if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) continue;

        // Prefer obvious physical adapters by interface name
        const lname = name.toLowerCase();
        const isPhysical =
          lname.includes('wi-fi') || lname.includes('wifi') ||
          lname.includes('wireless') || lname.includes('wlan') ||
          lname.includes('ethernet') || lname.includes('local area') ||
          lname === 'en0' || lname === 'en1' || lname === 'eth0' ||
          // Russian Windows interface names
          lname.includes('беспроводная') || lname.includes('сеть') ||
          lname.includes('ethernet') || lname.includes('подключение');

        // Also prefer 192.168.x.x / 10.x.x.x private ranges
        const isPrivate =
          addr.startsWith('192.168.') ||
          addr.startsWith('10.') ||
          (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31);

        if (isPhysical || isPrivate) {
          preferred.push(addr);
        } else {
          fallback.push(addr);
        }
      }
    }

    return preferred[0] || fallback[0] || '127.0.0.1';
  }

  publishService() {
    if (!this.bonjour) return;
    const ip = this.getLocalIp();
    const service = this.bonjour.publish({
      name: config.nodeName,
      type: 'intranet',
      port: config.port,
      txt: { nodeId: config.nodeId, wsPort: String(config.wsPort), version: '1.0.0' }
    });
    this.publishedService = service;
    console.log('[Discovery] Published mDNS service:', config.nodeName, 'at', ip + ':' + config.port);
  }

  startDiscovery() {
    if (!this.bonjour) return;
    const browser = this.bonjour.find({ type: 'intranet' });

    browser.on('up', (service) => {
      if (service.txt && service.txt.nodeId === config.nodeId) return;
      const nodeInfo = {
        id: service.txt?.nodeId || service.name,
        name: service.name,
        host: service.ipv4 || service.host,
        port: service.port,
        wsPort: service.txt?.wsPort || config.wsPort,
        online: true,
        lastSeen: Date.now(),
        source: 'mdns'
      };
      this.registerNode(nodeInfo);
      console.log('[Discovery] Node discovered via mDNS:', nodeInfo.name, nodeInfo.host);
    });

    browser.on('down', (service) => {
      if (service.txt?.nodeId) {
        this.setNodeOffline(service.txt.nodeId);
        console.log('[Discovery] Node gone via mDNS:', service.name);
      }
    });

    console.log('[Discovery] mDNS browser started');
  }

  addManualPeer(host, port, name) {
    const peer = {
      id: uuidv4(),
      name: name || host,
      host,
      port: port || config.port,
      wsPort: config.wsPort,
      online: false,
      lastSeen: 0,
      source: 'manual'
    };
    this.manualPeers.push(peer);
    this.registerNode(peer);
    console.log('[Discovery] Manual peer added:', peer.name, peer.host);
    return peer;
  }

  removeManualPeer(nodeId) {
    this.manualPeers = this.manualPeers.filter(p => p.id !== nodeId);
    this.nodes.delete(nodeId);
    console.log('[Discovery] Manual peer removed:', nodeId);
  }

  registerNode(nodeInfo) {
    const existing = this.nodes.get(nodeInfo.id);
    this.nodes.set(nodeInfo.id, { ...nodeInfo, online: true, lastSeen: Date.now() });

    try {
      this.db.nodes.insert({
        id: nodeInfo.id,
        name: nodeInfo.name,
        host: nodeInfo.host,
        port: nodeInfo.port,
        wsPort: nodeInfo.wsPort,
        online: 1,
        lastSeen: Date.now(),
        metadata: JSON.stringify(nodeInfo)
      });
    } catch (err) {
      console.error('[Discovery] DB insert error:', err.message);
    }

    if (!existing || !existing.online) {
      this.onNodeJoin?.(nodeInfo);
      this.syncNodeFiles(nodeInfo);
    }
  }

  async syncNodeFiles(nodeInfo) {
    try {
      const resp = await fetch('http://' + nodeInfo.host + ':' + nodeInfo.port + '/api/sync/files', {
        signal: AbortSignal.timeout(5000)
      });
      if (!resp.ok) return;
      const data = await resp.json();
      console.log('[Discovery] Synced ' + data.count + ' files from ' + nodeInfo.name);
      for (const file of (data.files || [])) {
        try {
          if (!this.db.files.getById(file.id)) {
            this.db.files.insert({ id: file.id, nodeId: file.node_id, name: file.name, path: '', size: file.size, mime_type: file.mime_type, hash: '', shared: 1 });
          }
        } catch (_) {}
      }
    } catch (err) {
      console.log('[Discovery] Could not sync files from ' + nodeInfo.name + ':', err.message);
    }
  }

  setNodeOffline(nodeId) {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.online = false;
      node.lastSeen = Date.now();
      try { this.db.nodes.updateOnline(0, Date.now(), nodeId); } catch (_) {}
      this.onNodeLeave?.(node);
    }
  }

  startPing() {
    this.pingTimer = setInterval(() => {
      this.nodes.forEach((node) => {
        if (node.source === 'manual') this.pingNode(node);
      });
    }, config.network.pingInterval);
    console.log('[Discovery] Ping timer started, interval:', config.network.pingInterval);
  }

  async pingNode(node) {
    try {
      const response = await fetch(`http://${node.host}:${node.port}/api/ping`, {
        signal: AbortSignal.timeout(5000)
      });
      if (response.ok) this.registerNode({ ...node, online: true });
      else this.setNodeOffline(node.id);
    } catch (_) {
      this.setNodeOffline(node.id);
    }
  }

  getNodes() { return Array.from(this.nodes.values()); }
  getOnlineNodes() { return Array.from(this.nodes.values()).filter(n => n.online); }
  getNode(nodeId) { return this.nodes.get(nodeId); }

  stopDiscovery() {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
    if (this.publishedService) { try { this.publishedService.stop(); } catch (_) {} this.publishedService = null; }
    console.log('[Discovery] Discovery stopped');
  }

  destroy() {
    this.stopDiscovery();
    if (this.bonjour) this.bonjour.destroy();
    console.log('[Discovery] Service destroyed');
  }
}

module.exports = DiscoveryService;
