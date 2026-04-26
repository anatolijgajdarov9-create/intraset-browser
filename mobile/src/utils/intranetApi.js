const TIMEOUT = 6000;
const SCAN_TIMEOUT = 1200;

function makeBase(host, port) {
  return `http://${host}:${port}`;
}

async function apiFetch(url, options = {}, timeoutMs = TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return resp;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export async function ping(host, port) {
  try {
    const resp = await apiFetch(`${makeBase(host, port)}/api/ping`, {}, SCAN_TIMEOUT);
    return resp.ok;
  } catch {
    return false;
  }
}

export async function getStatus(host, port) {
  const resp = await apiFetch(`${makeBase(host, port)}/api/status`);
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  return resp.json();
}

export async function getNodes(host, port) {
  const resp = await apiFetch(`${makeBase(host, port)}/api/nodes`);
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const data = await resp.json();
  return data.nodes || [];
}

export async function addNode(host, port, peerHost, peerPort, peerName) {
  const resp = await apiFetch(`${makeBase(host, port)}/api/nodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host: peerHost, port: peerPort, name: peerName }),
  });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  return resp.json();
}

export async function deleteNode(host, port, nodeId) {
  const resp = await apiFetch(`${makeBase(host, port)}/api/nodes/${nodeId}`, { method: 'DELETE' });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  return resp.json();
}

export async function getContacts(host, port) {
  const resp = await apiFetch(`${makeBase(host, port)}/api/messages/contacts`);
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const data = await resp.json();
  return data.contacts || [];
}

export async function getMessages(host, port, nodeId) {
  const resp = await apiFetch(`${makeBase(host, port)}/api/messages/${nodeId}`);
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const data = await resp.json();
  return data.messages || [];
}

export async function sendMessage(host, port, senderId, receiverId, content) {
  const resp = await apiFetch(`${makeBase(host, port)}/api/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senderId, receiverId, content, type: 'text' }),
  });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  return resp.json();
}

export async function broadcastMessage(host, port, senderId, content) {
  const resp = await apiFetch(`${makeBase(host, port)}/api/messages/broadcast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senderId, content, type: 'text' }),
  });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  return resp.json();
}

export async function getFiles(host, port) {
  const resp = await apiFetch(`${makeBase(host, port)}/api/files?all=true`);
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const data = await resp.json();
  return data.files || [];
}

export async function getMeshStatus(host, port) {
  const resp = await apiFetch(`${makeBase(host, port)}/api/mesh/status`);
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  return resp.json();
}

export async function registerMobile(host, port, mobileId, mobileName) {
  const resp = await apiFetch(`${makeBase(host, port)}/api/mobile/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobileId, mobileName }),
  });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  return resp.json();
}

export async function uploadFile(host, port, fileUri, fileName, mimeType) {
  const formData = new FormData();
  formData.append('file', { uri: fileUri, name: fileName, type: mimeType || 'application/octet-stream' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const resp = await fetch(`${makeBase(host, port)}/api/files/upload`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return resp.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// Scan a subnet for intranet nodes. subnet e.g. '192.168.1'
export async function scanSubnet(subnet, port = 3847, onProgress) {
  const found = [];
  const ips = Array.from({ length: 254 }, (_, i) => `${subnet}.${i + 1}`);
  const BATCH = 25;

  for (let i = 0; i < ips.length; i += BATCH) {
    const batch = ips.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (ip) => {
        const ok = await ping(ip, port);
        return ok ? { host: ip, port } : null;
      })
    );
    results.forEach((r) => r && found.push(r));
    onProgress && onProgress(Math.min(99, Math.round(((i + BATCH) / ips.length) * 100)));
  }

  onProgress && onProgress(100);
  return found;
}
