import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as api from '../utils/intranetApi';

function genUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const useIntranetStore = create((set, get) => ({
  // Connection
  connectedNode: null,   // { host, port, nodeId, nodeName, localIp, wsPort }
  isConnecting: false,
  connectionError: null,

  // Discovery
  discoveredNodes: [],
  isScanning: false,
  scanProgress: 0,

  // Network data (from connected node)
  networkNodes: [],
  contacts: [],
  messages: {},          // { [nodeId]: Message[] }
  files: [],
  meshStatus: null,

  // Mobile identity
  mobileNodeId: null,
  mobileNodeName: 'Мобильный',

  // ─── Init ──────────────────────────────────────────────────────────────

  init: async () => {
    try {
      const [savedId, savedName] = await Promise.all([
        AsyncStorage.getItem('intranet_mobile_id'),
        AsyncStorage.getItem('intranet_mobile_name'),
      ]);
      const mobileNodeId = savedId || genUUID();
      if (!savedId) await AsyncStorage.setItem('intranet_mobile_id', mobileNodeId);
      set({ mobileNodeId, mobileNodeName: savedName || 'Мобильный' });

      // Restore last connection silently
      const lastNode = await AsyncStorage.getItem('intranet_last_node');
      if (lastNode) {
        const node = JSON.parse(lastNode);
        get().connect(node.host, node.port, true);
      }
    } catch (e) {
      console.error('[IntranetStore] Init error:', e);
    }
  },

  // ─── Discovery ─────────────────────────────────────────────────────────

  scan: async () => {
    if (get().isScanning) return;
    set({ isScanning: true, scanProgress: 0, discoveredNodes: [], connectionError: null });

    try {
      const netState = await NetInfo.fetch();
      const ip = netState?.details?.ipAddress;
      if (!ip) {
        set({ isScanning: false, connectionError: 'Не удалось определить IP устройства. Проверьте подключение к WiFi.' });
        return;
      }

      const parts = ip.split('.');
      if (parts.length !== 4) {
        set({ isScanning: false, connectionError: 'Неверный формат IP-адреса.' });
        return;
      }

      const subnet = parts.slice(0, 3).join('.');
      const found = await api.scanSubnet(subnet, 3847, (progress) => {
        set({ scanProgress: progress });
      });

      // Fetch node info for each responding host
      const withInfo = await Promise.all(
        found.map(async ({ host, port }) => {
          try {
            const status = await api.getStatus(host, port);
            return { host, port, nodeId: status.nodeId, nodeName: status.nodeName || host, localIp: status.localIp };
          } catch {
            return { host, port, nodeId: null, nodeName: host };
          }
        })
      );

      set({ discoveredNodes: withInfo, isScanning: false, scanProgress: 100 });
    } catch (e) {
      set({ isScanning: false, connectionError: e.message });
    }
  },

  // ─── Connection ────────────────────────────────────────────────────────

  connect: async (host, port, silent = false) => {
    if (!silent) set({ isConnecting: true, connectionError: null });

    try {
      const status = await api.getStatus(host, port);
      const connectedNode = {
        host,
        port,
        nodeId: status.nodeId,
        nodeName: status.nodeName,
        localIp: status.localIp,
        wsPort: status.wsPort,
      };

      set({ connectedNode, isConnecting: false, connectionError: null });
      await AsyncStorage.setItem('intranet_last_node', JSON.stringify({ host, port }));

      // Register mobile as a network participant
      const { mobileNodeId, mobileNodeName } = get();
      if (mobileNodeId) {
        api.registerMobile(host, port, mobileNodeId, mobileNodeName).catch(() => {});
      }

      await get().refresh();
    } catch (e) {
      set({ isConnecting: false, connectionError: e.message || 'Не удалось подключиться' });
      if (!silent) throw e;
    }
  },

  disconnect: async () => {
    set({
      connectedNode: null,
      networkNodes: [],
      contacts: [],
      files: [],
      meshStatus: null,
      messages: {},
      connectionError: null,
    });
    await AsyncStorage.removeItem('intranet_last_node');
  },

  // ─── Data loading ──────────────────────────────────────────────────────

  refresh: async () => {
    const { connectedNode } = get();
    if (!connectedNode) return;
    const { host, port } = connectedNode;

    const [nodes, contacts, files, meshStatus] = await Promise.allSettled([
      api.getNodes(host, port),
      api.getContacts(host, port),
      api.getFiles(host, port),
      api.getMeshStatus(host, port),
    ]);

    set({
      networkNodes: nodes.status === 'fulfilled' ? nodes.value : [],
      contacts: contacts.status === 'fulfilled' ? contacts.value : [],
      files: files.status === 'fulfilled' ? files.value : [],
      meshStatus: meshStatus.status === 'fulfilled' ? meshStatus.value : null,
    });
  },

  loadMessages: async (nodeId) => {
    const { connectedNode } = get();
    if (!connectedNode) return;
    try {
      const msgs = await api.getMessages(connectedNode.host, connectedNode.port, nodeId);
      set((state) => ({ messages: { ...state.messages, [nodeId]: msgs } }));
    } catch (e) {
      console.error('[IntranetStore] loadMessages error:', e);
    }
  },

  sendMessage: async (receiverId, content) => {
    const { connectedNode, mobileNodeId } = get();
    if (!connectedNode) throw new Error('Нет подключения');
    await api.sendMessage(connectedNode.host, connectedNode.port, mobileNodeId, receiverId, content);
    await get().loadMessages(receiverId);
  },

  broadcastMessage: async (content) => {
    const { connectedNode, mobileNodeId } = get();
    if (!connectedNode) throw new Error('Нет подключения');
    await api.broadcastMessage(connectedNode.host, connectedNode.port, mobileNodeId, content);
  },

  addManualNode: async (host, port, name) => {
    const { connectedNode } = get();
    if (!connectedNode) throw new Error('Нет подключения');
    const result = await api.addNode(connectedNode.host, connectedNode.port, host, port, name);
    await get().refresh();
    return result;
  },

  setMobileNodeName: async (name) => {
    set({ mobileNodeName: name });
    await AsyncStorage.setItem('intranet_mobile_name', name);
    // Re-register with new name if connected
    const { connectedNode, mobileNodeId } = get();
    if (connectedNode && mobileNodeId) {
      api.registerMobile(connectedNode.host, connectedNode.port, mobileNodeId, name).catch(() => {});
    }
  },
}));
