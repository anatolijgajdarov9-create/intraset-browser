import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../hooks/useTheme';
import { SIZES } from '../utils/theme';
import { useIntranetStore } from '../store/intranetStore';

const TABS = [
  { key: 'status', label: 'Статус',   icon: 'pulse-outline' },
  { key: 'nodes',  label: 'Узлы',     icon: 'git-network-outline' },
  { key: 'chat',   label: 'Чат',      icon: 'chatbubbles-outline' },
  { key: 'files',  label: 'Файлы',    icon: 'folder-outline' },
  { key: 'settings', label: 'Настройки', icon: 'settings-outline' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (!bytes) return '0 Б';
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' МБ';
  return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' ГБ';
}

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function shortId(id) {
  return id ? id.slice(0, 8) + '...' : '—';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color, theme, styles }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SectionHeader({ title, theme, styles }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

// ─── Tab: Статус ─────────────────────────────────────────────────────────────

function StatusTab({ store, theme, styles }) {
  const { connectedNode, networkNodes, files, meshStatus } = store;
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await store.refresh();
    setRefreshing(false);
  }, [store]);

  const uptime = meshStatus?.uptime
    ? (meshStatus.uptime < 3600
        ? Math.floor(meshStatus.uptime / 60) + ' мин'
        : Math.floor(meshStatus.uptime / 3600) + ' ч ' + Math.floor((meshStatus.uptime % 3600) / 60) + ' мин')
    : '—';

  return (
    <ScrollView
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
    >
      <SectionHeader title="Подключённый узел" theme={theme} styles={styles} />
      <View style={styles.infoCard}>
        <InfoRow label="Имя" value={connectedNode.nodeName} styles={styles} />
        <InfoRow label="Адрес" value={`${connectedNode.host}:${connectedNode.port}`} styles={styles} />
        <InfoRow label="Локальный IP" value={connectedNode.localIp || connectedNode.host} styles={styles} />
        <InfoRow label="ID узла" value={shortId(connectedNode.nodeId)} styles={styles} />
      </View>

      <SectionHeader title="Сеть" theme={theme} styles={styles} />
      <View style={styles.statsRow}>
        <StatCard label="Узлов" value={networkNodes.length} icon="git-network-outline" color={theme.primary} theme={theme} styles={styles} />
        <StatCard label="Файлов" value={files.length} icon="folder-outline" color={theme.success} theme={theme} styles={styles} />
        <StatCard label="Онлайн" value={networkNodes.filter(n => n.online).length} icon="radio-outline" color={theme.info} theme={theme} styles={styles} />
        <StatCard label="Аптайм" value={uptime} icon="time-outline" color={theme.warning} theme={theme} styles={styles} />
      </View>

      <SectionHeader title="Ваш мобильный узел" theme={theme} styles={styles} />
      <View style={styles.infoCard}>
        <InfoRow label="Имя" value={store.mobileNodeName} styles={styles} />
        <InfoRow label="ID" value={shortId(store.mobileNodeId)} styles={styles} />
        <InfoRow label="Тип" value="Мобильный клиент" styles={styles} />
        <View style={[styles.badge, { backgroundColor: theme.success + '22', borderColor: theme.success }]}>
          <View style={[styles.dot, { backgroundColor: theme.success }]} />
          <Text style={[styles.badgeText, { color: theme.success }]}>Подключён к сети</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value, styles }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value || '—'}</Text>
    </View>
  );
}

// ─── Tab: Узлы ───────────────────────────────────────────────────────────────

function NodesTab({ store, theme, styles }) {
  const { networkNodes } = store;
  const [host, setHost] = useState('');
  const [port, setPort] = useState('3847');
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await store.refresh();
    setRefreshing(false);
  }, [store]);

  const handleAdd = async () => {
    if (!host.trim()) return;
    setAdding(true);
    try {
      await store.addManualNode(host.trim(), parseInt(port) || 3847, name.trim() || host.trim());
      setHost(''); setPort('3847'); setName(''); setShowAdd(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <ScrollView
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
    >
      <TouchableOpacity
        style={[styles.addBtn, { borderColor: theme.primary }]}
        onPress={() => setShowAdd(v => !v)}
      >
        <Ionicons name={showAdd ? 'chevron-up' : 'add-circle-outline'} size={18} color={theme.primary} />
        <Text style={[styles.addBtnText, { color: theme.primary }]}>
          {showAdd ? 'Скрыть' : 'Добавить узел вручную'}
        </Text>
      </TouchableOpacity>

      {showAdd && (
        <View style={styles.addForm}>
          <TextInput
            style={styles.input}
            placeholder="IP-адрес"
            placeholderTextColor={theme.textTertiary}
            value={host}
            onChangeText={setHost}
            keyboardType="numeric"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Порт (3847)"
            placeholderTextColor={theme.textTertiary}
            value={port}
            onChangeText={setPort}
            keyboardType="numeric"
          />
          <TextInput
            style={styles.input}
            placeholder="Имя (необязательно)"
            placeholderTextColor={theme.textTertiary}
            value={name}
            onChangeText={setName}
          />
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
            onPress={handleAdd}
            disabled={adding}
          >
            {adding
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.primaryBtnText}>Добавить</Text>}
          </TouchableOpacity>
        </View>
      )}

      <SectionHeader title={`Узлы сети (${networkNodes.length})`} theme={theme} styles={styles} />

      {networkNodes.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="git-network-outline" size={40} color={theme.textTertiary} />
          <Text style={styles.emptyText}>Нет узлов в сети</Text>
        </View>
      ) : (
        networkNodes.map((node) => (
          <View key={node.id} style={styles.nodeCard}>
            <View style={[styles.nodeStatus, { backgroundColor: node.online ? theme.success : theme.error }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.nodeName}>{node.name || node.host}</Text>
              <Text style={styles.nodeAddr}>{node.host}:{node.port}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: node.online ? theme.success + '22' : theme.error + '22', borderColor: node.online ? theme.success : theme.error }]}>
              <Text style={[styles.badgeText, { color: node.online ? theme.success : theme.error }]}>
                {node.online ? 'Онлайн' : 'Офлайн'}
              </Text>
            </View>
          </View>
        ))
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ─── Tab: Чат ────────────────────────────────────────────────────────────────

function ChatTab({ store, theme, styles }) {
  const { contacts, networkNodes, messages, mobileNodeId, connectedNode } = store;
  const [activeContact, setActiveContact] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const listRef = useRef(null);

  const openContact = useCallback(async (nodeId) => {
    setActiveContact(nodeId);
    await store.loadMessages(nodeId);
  }, [store]);

  useEffect(() => {
    if (!activeContact) return;
    const id = setInterval(() => store.loadMessages(activeContact), 4000);
    return () => clearInterval(id);
  }, [activeContact, store]);

  const handleSend = async () => {
    if (!text.trim() || !activeContact) return;
    setSending(true);
    try {
      await store.sendMessage(activeContact, text.trim());
      setText('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setSending(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await store.refresh();
    setRefreshing(false);
  }, [store]);

  const getNodeName = (id) => {
    if (id === connectedNode?.nodeId) return connectedNode.nodeName;
    const n = networkNodes.find(n => n.id === id);
    return n ? (n.name || n.host) : shortId(id);
  };

  if (activeContact) {
    const msgs = messages[activeContact] || [];
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => setActiveContact(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.chatHeaderTitle} numberOfLines={1}>{getNodeName(activeContact)}</Text>
        </View>

        <FlatList
          ref={listRef}
          data={msgs}
          keyExtractor={(_, i) => String(i)}
          style={styles.tabContent}
          contentContainerStyle={{ padding: SIZES.paddingMd, paddingBottom: SIZES.paddingXl }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const isMe = item.sender_id === mobileNodeId || item.senderId === mobileNodeId;
            return (
              <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                <Text style={[styles.bubbleText, { color: isMe ? '#fff' : theme.text }]}>
                  {item.content}
                </Text>
                <Text style={[styles.bubbleTime, { color: isMe ? 'rgba(255,255,255,0.7)' : theme.textTertiary }]}>
                  {formatTime(item.timestamp || item.created_at)}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={40} color={theme.textTertiary} />
              <Text style={styles.emptyText}>Нет сообщений</Text>
            </View>
          }
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.chatInput}
            placeholder="Сообщение..."
            placeholderTextColor={theme.textTertiary}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: text.trim() ? theme.primary : theme.backgroundTertiary }]}
            onPress={handleSend}
            disabled={sending || !text.trim()}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={18} color={text.trim() ? '#fff' : theme.textTertiary} />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Contacts list
  const chatNodes = networkNodes.filter(n => n.source !== 'mobile');

  return (
    <ScrollView
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
    >
      <SectionHeader title="Начать переписку" theme={theme} styles={styles} />
      {chatNodes.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={40} color={theme.textTertiary} />
          <Text style={styles.emptyText}>Нет доступных узлов для чата</Text>
        </View>
      ) : (
        chatNodes.map((node) => {
          const contact = contacts.find(c => c.nodeId === node.id);
          const unread = contact?.unread || 0;
          return (
            <TouchableOpacity
              key={node.id}
              style={styles.contactRow}
              onPress={() => openContact(node.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.contactAvatar, { backgroundColor: theme.primaryLight }]}>
                <Text style={[styles.contactAvatarText, { color: theme.primary }]}>
                  {(node.name || node.host).charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>{node.name || node.host}</Text>
                <Text style={styles.contactAddr}>{node.host}:{node.port}</Text>
              </View>
              {unread > 0 && (
                <View style={[styles.unreadBadge, { backgroundColor: theme.primary }]}>
                  <Text style={styles.unreadText}>{unread}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
            </TouchableOpacity>
          );
        })
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ─── Tab: Файлы ──────────────────────────────────────────────────────────────

function FilesTab({ store, theme, styles }) {
  const { files, connectedNode } = store;
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await store.refresh();
    setRefreshing(false);
  }, [store]);

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setUploading(true);
      const { uploadFile } = await import('../utils/intranetApi');
      await uploadFile(connectedNode.host, connectedNode.port, asset.uri, asset.name, asset.mimeType);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await store.refresh();
    } catch (e) {
      Alert.alert('Ошибка загрузки', e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (file) => {
    try {
      const url = `http://${connectedNode.host}:${connectedNode.port}/api/files/${file.id}`;
      const dest = FileSystem.cacheDirectory + (file.name || file.id);
      const { uri } = await FileSystem.downloadAsync(url, dest);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: file.mime_type || 'application/octet-stream' });
      } else {
        Alert.alert('Файл сохранён', uri);
      }
    } catch (e) {
      Alert.alert('Ошибка скачивания', e.message);
    }
  };

  return (
    <ScrollView
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
    >
      <TouchableOpacity
        style={[styles.addBtn, { borderColor: theme.primary }]}
        onPress={handleUpload}
        disabled={uploading}
      >
        {uploading
          ? <ActivityIndicator size="small" color={theme.primary} />
          : <Ionicons name="cloud-upload-outline" size={18} color={theme.primary} />}
        <Text style={[styles.addBtnText, { color: theme.primary }]}>
          {uploading ? 'Загрузка...' : 'Загрузить файл'}
        </Text>
      </TouchableOpacity>

      <SectionHeader title={`Файлы в сети (${files.length})`} theme={theme} styles={styles} />

      {files.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="folder-open-outline" size={40} color={theme.textTertiary} />
          <Text style={styles.emptyText}>Нет файлов</Text>
        </View>
      ) : (
        files.map((file) => (
          <TouchableOpacity
            key={file.id}
            style={styles.fileRow}
            onPress={() => handleDownload(file)}
            activeOpacity={0.7}
          >
            <Ionicons name="document-outline" size={22} color={theme.primary} style={{ marginRight: SIZES.paddingMd }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
              <Text style={styles.fileMeta}>
                {formatBytes(file.size)}
                {file._sourceNode ? '  •  ' + file._sourceNode : ''}
              </Text>
            </View>
            <Ionicons name="download-outline" size={18} color={theme.primary} />
          </TouchableOpacity>
        ))
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ─── Tab: Настройки ──────────────────────────────────────────────────────────

function SettingsTab({ store, theme, styles }) {
  const { connectedNode, mobileNodeId, mobileNodeName } = store;
  const [name, setName] = useState(mobileNodeName);
  const [saving, setSaving] = useState(false);

  const handleSaveName = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await store.setMobileNodeName(name.trim());
    setSaving(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDisconnect = () => {
    Alert.alert('Отключиться?', 'Вы выйдете из сети Интрасети на этом устройстве.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Отключиться', style: 'destructive', onPress: () => store.disconnect() },
    ]);
  };

  return (
    <ScrollView style={styles.tabContent}>
      <SectionHeader title="Ваш мобильный узел" theme={theme} styles={styles} />
      <View style={styles.infoCard}>
        <Text style={styles.fieldLabel}>Имя узла</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            value={name}
            onChangeText={setName}
            placeholder="Мобильный"
            placeholderTextColor={theme.textTertiary}
          />
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: theme.primary }]}
            onPress={handleSaveName}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.saveBtnText}>Сохранить</Text>}
          </TouchableOpacity>
        </View>
        <InfoRow label="ID устройства" value={mobileNodeId ? shortId(mobileNodeId) : '—'} styles={styles} />
      </View>

      <SectionHeader title="Подключение" theme={theme} styles={styles} />
      <View style={styles.infoCard}>
        <InfoRow label="Узел" value={connectedNode.nodeName} styles={styles} />
        <InfoRow label="Адрес" value={`${connectedNode.host}:${connectedNode.port}`} styles={styles} />
        <InfoRow label="WebSocket" value={`ws://${connectedNode.host}:${connectedNode.wsPort}`} styles={styles} />
        <InfoRow label="mDNS" value={connectedNode.mdnsEnabled ? 'Включён' : 'Выключен'} styles={styles} />
      </View>

      <TouchableOpacity style={[styles.dangerBtn, { borderColor: theme.error }]} onPress={handleDisconnect}>
        <Ionicons name="log-out-outline" size={18} color={theme.error} />
        <Text style={[styles.dangerBtnText, { color: theme.error }]}>Отключиться от сети</Text>
      </TouchableOpacity>
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ─── Not-connected screen ─────────────────────────────────────────────────────

function NotConnectedView({ store, theme, styles }) {
  const { isScanning, scanProgress, discoveredNodes, connectionError } = store;
  const [manualHost, setManualHost] = useState('');
  const [manualPort, setManualPort] = useState('3847');
  const [showManual, setShowManual] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async (host, port) => {
    setConnecting(true);
    try {
      await store.connect(host, parseInt(port) || 3847);
    } catch (e) {
      Alert.alert('Не удалось подключиться', e.message || 'Проверьте IP-адрес и убедитесь, что устройства в одной WiFi-сети.');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <ScrollView style={styles.tabContent} contentContainerStyle={{ padding: SIZES.paddingLg }}>
      <View style={styles.heroCard}>
        <Ionicons name="git-network-outline" size={52} color={theme.primary} />
        <Text style={styles.heroTitle}>Интрасеть</Text>
        <Text style={styles.heroSub}>
          Mesh-сеть для устройств в одной WiFi-сети. Чат, файлы, автономное общение без интернета.
        </Text>
      </View>

      {connectionError ? (
        <View style={[styles.errorCard, { borderColor: theme.error }]}>
          <Ionicons name="alert-circle-outline" size={18} color={theme.error} />
          <Text style={[styles.errorText, { color: theme.error }]}>{connectionError}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: theme.primary, marginBottom: SIZES.paddingMd }]}
        onPress={store.scan}
        disabled={isScanning}
      >
        {isScanning ? (
          <>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.primaryBtnText}>Сканирование {scanProgress}%</Text>
          </>
        ) : (
          <>
            <Ionicons name="wifi" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Сканировать WiFi-сеть</Text>
          </>
        )}
      </TouchableOpacity>

      {isScanning && (
        <View style={[styles.progressBarOuter, { backgroundColor: theme.backgroundTertiary }]}>
          <View style={[styles.progressBarInner, { width: `${scanProgress}%`, backgroundColor: theme.primary }]} />
        </View>
      )}

      {discoveredNodes.length > 0 && (
        <>
          <Text style={[styles.sectionHeader, { marginTop: SIZES.paddingLg }]}>
            Найдено узлов: {discoveredNodes.length}
          </Text>
          {discoveredNodes.map((node, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.discoveredNode}
              onPress={() => handleConnect(node.host, node.port)}
              disabled={connecting}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.nodeName}>{node.nodeName || node.host}</Text>
                <Text style={styles.nodeAddr}>{node.host}:{node.port}</Text>
              </View>
              <Ionicons name="arrow-forward-circle-outline" size={24} color={theme.primary} />
            </TouchableOpacity>
          ))}
        </>
      )}

      <TouchableOpacity
        style={[styles.addBtn, { borderColor: theme.primary, marginTop: SIZES.paddingLg }]}
        onPress={() => setShowManual(v => !v)}
      >
        <Ionicons name={showManual ? 'chevron-up' : 'keypad-outline'} size={18} color={theme.primary} />
        <Text style={[styles.addBtnText, { color: theme.primary }]}>
          {showManual ? 'Скрыть' : 'Подключиться вручную'}
        </Text>
      </TouchableOpacity>

      {showManual && (
        <View style={styles.addForm}>
          <TextInput
            style={styles.input}
            placeholder="IP-адрес узла (напр. 192.168.1.5)"
            placeholderTextColor={theme.textTertiary}
            value={manualHost}
            onChangeText={setManualHost}
            keyboardType="numeric"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Порт (3847)"
            placeholderTextColor={theme.textTertiary}
            value={manualPort}
            onChangeText={setManualPort}
            keyboardType="numeric"
          />
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
            onPress={() => handleConnect(manualHost, manualPort)}
            disabled={connecting || !manualHost.trim()}
          >
            {connecting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.primaryBtnText}>Подключиться</Text>}
          </TouchableOpacity>
        </View>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Connected view with tabs ─────────────────────────────────────────────────

function ConnectedView({ store, theme, styles }) {
  const [tab, setTab] = useState('status');

  const renderTab = () => {
    switch (tab) {
      case 'status':   return <StatusTab   store={store} theme={theme} styles={styles} />;
      case 'nodes':    return <NodesTab    store={store} theme={theme} styles={styles} />;
      case 'chat':     return <ChatTab     store={store} theme={theme} styles={styles} />;
      case 'files':    return <FilesTab    store={store} theme={theme} styles={styles} />;
      case 'settings': return <SettingsTab store={store} theme={theme} styles={styles} />;
      default:         return null;
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabBar, { borderBottomColor: theme.border }]}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabItem, tab === t.key && { borderBottomColor: theme.primary }]}
            onPress={() => { setTab(t.key); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <Ionicons name={t.icon} size={16} color={tab === t.key ? theme.primary : theme.textTertiary} />
            <Text style={[styles.tabLabel, { color: tab === t.key ? theme.primary : theme.textTertiary }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={{ flex: 1 }}>{renderTab()}</View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function IntranetScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, insets), [theme, insets]);
  const store = useIntranetStore();

  useEffect(() => {
    store.init();
  }, []);

  const { connectedNode, isConnecting } = store;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: SIZES.paddingMd }}>
          <Text style={styles.headerTitle}>Интрасеть</Text>
          {connectedNode && (
            <Text style={styles.headerSub} numberOfLines={1}>
              {connectedNode.nodeName}  •  {connectedNode.host}
            </Text>
          )}
        </View>
        {connectedNode && (
          <View style={[styles.onlineIndicator, { backgroundColor: theme.success }]} />
        )}
      </View>

      {/* Body */}
      {isConnecting ? (
        <View style={styles.centerView}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.connectingText}>Подключение...</Text>
        </View>
      ) : connectedNode ? (
        <ConnectedView store={store} theme={theme} styles={styles} />
      ) : (
        <NotConnectedView store={store} theme={theme} styles={styles} />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (theme, insets) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.paddingLg,
    paddingVertical: SIZES.paddingMd,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    backgroundColor: theme.tabBarBg,
  },
  headerTitle: { fontSize: SIZES.textLg, fontWeight: '700', color: theme.text },
  headerSub: { fontSize: SIZES.textXs, color: theme.textSecondary, marginTop: 1 },
  onlineIndicator: { width: 10, height: 10, borderRadius: 5 },

  centerView: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SIZES.paddingMd },
  connectingText: { fontSize: SIZES.textMd, color: theme.textSecondary },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    maxHeight: 48,
    backgroundColor: theme.tabBarBg,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.paddingMd,
    paddingVertical: SIZES.paddingMd,
    gap: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: { fontSize: SIZES.textSm, fontWeight: '500' },
  tabContent: { flex: 1, backgroundColor: theme.background },

  sectionHeader: {
    fontSize: SIZES.textXs,
    fontWeight: '700',
    color: theme.textTertiary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: SIZES.paddingLg,
    paddingTop: SIZES.paddingLg,
    paddingBottom: SIZES.paddingSm,
  },

  infoCard: {
    marginHorizontal: SIZES.paddingLg,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: SIZES.radiusLg,
    padding: SIZES.paddingMd,
    borderWidth: 1,
    borderColor: theme.border,
    gap: SIZES.paddingXs,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SIZES.paddingXs,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  infoLabel: { fontSize: SIZES.textSm, color: theme.textSecondary },
  infoValue: { fontSize: SIZES.textSm, color: theme.text, fontWeight: '500', maxWidth: '55%' },

  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SIZES.paddingMd,
    gap: SIZES.paddingSm,
    marginBottom: SIZES.paddingSm,
  },
  statCard: {
    flex: 1,
    minWidth: '43%',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: SIZES.radiusLg,
    padding: SIZES.paddingMd,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'flex-start',
    gap: 2,
  },
  statValue: { fontSize: SIZES.textXl, fontWeight: '700', color: theme.text },
  statLabel: { fontSize: SIZES.textXs, color: theme.textSecondary },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SIZES.paddingSm,
    paddingVertical: 4,
    borderRadius: SIZES.radiusFull,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginTop: SIZES.paddingXs,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: SIZES.textXs, fontWeight: '600' },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.paddingSm,
    margin: SIZES.paddingLg,
    marginBottom: SIZES.paddingSm,
    padding: SIZES.paddingMd,
    borderRadius: SIZES.radiusLg,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  addBtnText: { fontSize: SIZES.textMd, fontWeight: '600' },

  addForm: {
    marginHorizontal: SIZES.paddingLg,
    marginBottom: SIZES.paddingMd,
    gap: SIZES.paddingSm,
  },
  input: {
    backgroundColor: theme.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.paddingMd,
    color: theme.text,
    fontSize: SIZES.textMd,
    marginBottom: SIZES.paddingXs,
  },
  fieldLabel: {
    fontSize: SIZES.textSm,
    color: theme.textSecondary,
    marginBottom: SIZES.paddingXs,
    fontWeight: '500',
  },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SIZES.paddingSm,
    padding: SIZES.paddingMd,
    borderRadius: SIZES.radiusMd,
  },
  primaryBtnText: { color: '#fff', fontSize: SIZES.textMd, fontWeight: '600' },

  nodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SIZES.paddingLg,
    marginBottom: SIZES.paddingSm,
    padding: SIZES.paddingMd,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: SIZES.radiusLg,
    borderWidth: 1,
    borderColor: theme.border,
    gap: SIZES.paddingMd,
  },
  nodeStatus: { width: 8, height: 8, borderRadius: 4 },
  nodeName: { fontSize: SIZES.textMd, fontWeight: '600', color: theme.text },
  nodeAddr: { fontSize: SIZES.textSm, color: theme.textSecondary },

  emptyState: {
    alignItems: 'center',
    paddingVertical: SIZES.paddingXl * 2,
    gap: SIZES.paddingMd,
  },
  emptyText: { fontSize: SIZES.textMd, color: theme.textTertiary },

  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.paddingMd,
    padding: SIZES.paddingMd,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    backgroundColor: theme.tabBarBg,
  },
  chatHeaderTitle: { flex: 1, fontSize: SIZES.textLg, fontWeight: '600', color: theme.text },

  bubble: {
    maxWidth: '80%',
    padding: SIZES.paddingMd,
    borderRadius: SIZES.radiusLg,
    marginBottom: SIZES.paddingSm,
  },
  bubbleMe: {
    alignSelf: 'flex-end',
    backgroundColor: '#2563eb',
    borderBottomRightRadius: SIZES.radiusSm,
  },
  bubbleThem: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    borderBottomLeftRadius: SIZES.radiusSm,
  },
  bubbleText: { fontSize: SIZES.textMd },
  bubbleTime: { fontSize: SIZES.textXs, marginTop: 2, textAlign: 'right' },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: SIZES.paddingSm,
    gap: SIZES.paddingSm,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: theme.tabBarBg,
  },
  chatInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: SIZES.radiusLg,
    paddingHorizontal: SIZES.paddingMd,
    paddingVertical: SIZES.paddingSm,
    color: theme.text,
    fontSize: SIZES.textMd,
    borderWidth: 1,
    borderColor: theme.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.paddingLg,
    paddingVertical: SIZES.paddingMd,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
    gap: SIZES.paddingMd,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactAvatarText: { fontSize: SIZES.textLg, fontWeight: '700' },
  contactName: { fontSize: SIZES.textMd, fontWeight: '600', color: theme.text },
  contactAddr: { fontSize: SIZES.textSm, color: theme.textSecondary },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  unreadText: { color: '#fff', fontSize: SIZES.textXs, fontWeight: '700' },

  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.paddingLg,
    paddingVertical: SIZES.paddingMd,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  fileName: { fontSize: SIZES.textMd, color: theme.text, fontWeight: '500' },
  fileMeta: { fontSize: SIZES.textSm, color: theme.textSecondary },

  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SIZES.paddingSm,
    margin: SIZES.paddingLg,
    padding: SIZES.paddingMd,
    borderRadius: SIZES.radiusLg,
    borderWidth: 1.5,
  },
  dangerBtnText: { fontSize: SIZES.textMd, fontWeight: '600' },
  saveBtn: {
    paddingHorizontal: SIZES.paddingMd,
    paddingVertical: SIZES.paddingSm,
    borderRadius: SIZES.radiusMd,
    marginLeft: SIZES.paddingSm,
  },
  saveBtnText: { color: '#fff', fontSize: SIZES.textSm, fontWeight: '600' },

  // Not-connected
  heroCard: {
    alignItems: 'center',
    padding: SIZES.paddingXl,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: SIZES.radiusXl,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: SIZES.paddingLg,
    gap: SIZES.paddingMd,
  },
  heroTitle: { fontSize: SIZES.text2Xl, fontWeight: '700', color: theme.text },
  heroSub: { fontSize: SIZES.textSm, color: theme.textSecondary, textAlign: 'center', lineHeight: 20 },

  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.paddingSm,
    padding: SIZES.paddingMd,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    backgroundColor: '#fef2f2',
    marginBottom: SIZES.paddingMd,
  },
  errorText: { flex: 1, fontSize: SIZES.textSm },

  progressBarOuter: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: SIZES.paddingMd,
  },
  progressBarInner: { height: 4, borderRadius: 2 },

  discoveredNode: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.paddingMd,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: SIZES.radiusLg,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: SIZES.paddingSm,
    gap: SIZES.paddingMd,
  },
});
