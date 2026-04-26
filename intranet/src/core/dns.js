const dgram = require('dgram');

class DNSResolver {
  constructor(discovery, config) {
    this.discovery = discovery;
    this.config = config;
    this.socket = null;
    this.domain = config.dns?.domain || 'intra';
    this.port = config.dns?.port || 5353;
  }

  start() {
    this.socket = dgram.createSocket('udp4');

    this.socket.on('message', (msg, rinfo) => {
      try {
        const response = this.handleQuery(msg);
        if (response) {
          this.socket.send(response, rinfo.port, rinfo.address);
        }
      } catch (err) { /* Ignore malformed queries */ }
    });

    this.socket.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`[DNS] Port ${this.port} in use, DNS resolver disabled`);
      } else {
        console.log('[DNS] Error:', err.message);
      }
    });

    this.socket.bind(this.port, () => {
      console.log(`[DNS] Resolver started on port ${this.port}, domain: .${this.domain}`);
    });
  }

  handleQuery(query) {
    // Parse DNS query
    if (query.length < 12) return null;

    const txId = query.subarray(0, 2);
    const flags = query.readUInt16BE(2);

    // Only handle standard queries (QR=0, OPCODE=0)
    if ((flags >> 15) !== 0) return null; // Not a query

    // Parse question section
    let offset = 12;
    let qname = '';
    while (offset < query.length && query[offset] !== 0) {
      const len = query[offset];
      offset++;
      if (offset + len > query.length) return null;
      if (qname) qname += '.';
      qname += query.subarray(offset, offset + len).toString();
      offset += len;
    }
    offset++; // Skip null terminator

    if (offset + 4 > query.length) return null;
    const qtype = query.readUInt16BE(offset);
    const qclass = query.readUInt16BE(offset + 2);

    // Only handle A records (qtype=1) for our domain
    if (qtype !== 1 || qclass !== 1) return null;

    // Check if query is for our domain
    const suffix = '.' + this.domain;
    if (!qname.endsWith(suffix)) return null;

    const nodeName = qname.substring(0, qname.length - suffix.length);

    // Look up node in discovery
    const nodes = this.discovery.getOnlineNodes();
    const node = nodes.find(n =>
      n.name?.toLowerCase() === nodeName.toLowerCase() ||
      n.id?.toLowerCase() === nodeName.toLowerCase()
    );

    if (!node) return null;

    // Build DNS response
    return this.buildResponse(txId, node.host);
  }

  buildResponse(txId, ip) {
    const parts = ip.split('.').map(Number);

    // Header: txId + flags(0x8180) + questions(1) + answers(1) + auth(0) + additional(0)
    const header = Buffer.alloc(12);
    txId.copy(header, 0);
    header.writeUInt16BE(0x8180, 2); // Response, no error
    header.writeUInt16BE(1, 4); // 1 question
    header.writeUInt16BE(1, 6); // 1 answer

    // Question: repeat query name + type A + class IN
    const questionName = this.encodeName(this.config.dns?.domain || 'intra');
    const question = Buffer.concat([questionName, Buffer.from([0, 1, 0, 1])]); // A, IN

    // Answer: pointer to name + type A + class IN + TTL(60) + rdlength(4) + rdata
    const answer = Buffer.alloc(16);
    answer.writeUInt16BE(0xC00C, 0); // Pointer to name at offset 12
    answer.writeUInt16BE(1, 2); // Type A
    answer.writeUInt16BE(1, 4); // Class IN
    answer.writeUInt32BE(60, 6); // TTL 60s
    answer.writeUInt16BE(4, 10); // rdlength 4
    answer.writeUInt8(parts[0], 12);
    answer.writeUInt8(parts[1], 13);
    answer.writeUInt8(parts[2], 14);
    answer.writeUInt8(parts[3], 15);

    return Buffer.concat([header, question, answer]);
  }

  encodeName(name) {
    const parts = name.split('.');
    const buffers = parts.map(p => {
      const buf = Buffer.alloc(p.length + 1);
      buf.writeUInt8(p.length, 0);
      Buffer.from(p).copy(buf, 1);
      return buf;
    });
    buffers.push(Buffer.from([0])); // Null terminator
    return Buffer.concat(buffers);
  }

  stop() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      console.log('[DNS] Resolver stopped');
    }
  }
}

module.exports = DNSResolver;
