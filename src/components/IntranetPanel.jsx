import React, { useState, useEffect, useRef, useCallback } from 'react';

const isElectron = typeof window.electronAPI !== 'undefined';
const INTRA_URL = 'http://localhost:3847';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatUptime(seconds) {
  if (!seconds) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}ч ${m}м` : `${m}м`;
}

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

// ─── Главный компонент ────────────────────────────────────────────────────────

export default function IntranetPanel({ onClose, onNavigate }) {
  const [serverRunning, setServerRunning] = useState(false);
  const [serverStarting, setServerStarting] = useState(false);
  const [serverStopping, setServerStopping] = useState(false);

  const [status, setStatus] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [files, setFiles] = useState([]);
  const [contacts, setContacts] = useState([]);

  const [activeTab, setActiveTab] = useState('status');
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState(null);

  const [selectedNode, setSelectedNode] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);

  const pollRef = useRef(null);

  // ── Подписка на события процесса ─────────────────────────────────────────
  useEffect(() => {
    if (!isElectron) return;

    // Получить текущий статус процесса
    window.electronAPI.intraGetProcessStatus?.().then(s => {
      setServerRunning(!!s.running);
      setServerStarting(!!s.starting);
    }).catch(() => {});

    const off = window.electronAPI.onIntraProcessStatus?.(({ running }) => {
      setServerRunning(running);
      if (running) {
        // Дать серверу момент прогреться, затем загрузить данные
        setTimeout(() => loadAll(true), 600);
      } else {
        setStatus(null);
        setNodes([]);
        setFiles([]);
        setContacts([]);
      }
    });

    return () => off?.();
  }, []); // eslint-disable-line

  // ── Polling данных ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!serverRunning) {
      setLoading(false);
      return;
    }
    loadAll(true);
    pollRef.current = setInterval(() => loadAll(false), 10000);
    return () => clearInterval(pollRef.current);
  }, [serverRunning]); // eslint-disable-line

  const loadAll = useCallback(async (showLoader = false) => {
    if (!isElectron) { setLoading(false); return; }
    if (showLoader) setLoading(true);
    try {
      const [s, n, f, c] = await Promise.all([
        window.electronAPI.intraGetStatus(),
        window.electronAPI.intraGetNodes(),
        window.electronAPI.intraGetFiles(),
        window.electronAPI.intraGetContacts(),
      ]);
      if (s.error) {
        setDataError(s.error);
        setStatus(null);
      } else {
        setStatus(s);
        setDataError(null);
      }
      if (n.nodes) setNodes(n.nodes);
      if (f.files) setFiles(f.files);
      if (c.contacts) setContacts(c.contacts);
    } catch (err) {
      setDataError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (contactId) => {
    try {
      const d = await window.electronAPI.intraGetMessages(contactId);
      if (d.messages) setChatMessages(d.messages);
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (selectedNode && activeTab === 'chat') loadMessages(selectedNode.id);
  }, [selectedNode, activeTab, loadMessages]);

  // ── Действия с сервером ───────────────────────────────────────────────────
  async function startServer() {
    if (!isElectron || serverStarting || serverRunning) return;
    setServerStarting(true);
    try {
      const r = await window.electronAPI.intraStart();
      if (!r.success && !r.already) {
        alert('Ошибка запуска: ' + (r.error || 'Неизвестная'));
      }
    } catch (err) {
      alert('Ошибка: ' + err.message);
    } finally {
      setServerStarting(false);
    }
  }

  async function stopServer() {
    if (!isElectron || serverStopping) return;
    setServerStopping(true);
    try {
      await window.electronAPI.intraStop();
    } catch (err) {
      alert('Ошибка остановки: ' + err.message);
    } finally {
      setServerStopping(false);
    }
  }

  // ── Действия с узлами ─────────────────────────────────────────────────────
  async function addNode() {
    const host = prompt('IP адрес узла:');
    if (!host) return;
    const port = prompt('Порт (3847):', '3847');
    const name = prompt('Имя узла (опционально):');
    try {
      const r = await window.electronAPI.intraAddNode(host, parseInt(port) || 3847, name || null);
      if (r.success) loadAll();
      else alert('Ошибка: ' + (r.error || 'Неизвестная'));
    } catch (err) {
      alert('Ошибка: ' + err.message);
    }
  }

  async function deleteNode(nodeId) {
    if (!confirm('Удалить узел?')) return;
    try {
      await window.electronAPI.intraDeleteNode(nodeId);
      loadAll();
      if (selectedNode?.id === nodeId) setSelectedNode(null);
    } catch (err) {
      alert('Ошибка: ' + err.message);
    }
  }

  async function pingNode(node) {
    try {
      const r = await window.electronAPI.intraPingNode(node.id);
      alert(r.reachable ? `${node.name}: ${r.latency}мс` : `${node.name}: недоступен`);
    } catch (err) {
      alert('Ошибка ping: ' + err.message);
    }
  }

  // ── Файлы ─────────────────────────────────────────────────────────────────
  async function uploadFile() {
    if (!isElectron) return;
    try {
      const r = await window.electronAPI.showOpenDialog({ title: 'Выберите файл', properties: ['openFile'] });
      if (r.canceled || !r.filePaths?.length) return;
      const u = await window.electronAPI.intraUploadFile(r.filePaths[0]);
      if (u.success) loadAll();
      else alert('Ошибка загрузки: ' + (u.error || 'Неизвестная'));
    } catch (err) {
      alert('Ошибка: ' + err.message);
    }
  }

  async function downloadFile(file) {
    try {
      const r = await window.electronAPI.intraDownloadFile(file.id, file.name);
      if (r.success) alert('Файл сохранён: ' + r.path);
      else if (!r.canceled) alert('Ошибка: ' + (r.error || 'Неизвестная'));
    } catch (err) {
      alert('Ошибка: ' + err.message);
    }
  }

  async function deleteFile(fileId) {
    if (!confirm('Удалить файл?')) return;
    try {
      await window.electronAPI.intraDeleteFile(fileId);
      loadAll();
    } catch (err) {
      alert('Ошибка: ' + err.message);
    }
  }

  // ── Чат ───────────────────────────────────────────────────────────────────
  async function sendMessage() {
    if (!chatInput.trim() || !selectedNode || sending) return;
    setSending(true);
    try {
      const r = await window.electronAPI.intraSendMessage(selectedNode.id, chatInput.trim());
      if (r.success) { setChatInput(''); loadMessages(selectedNode.id); loadAll(); }
    } catch (_) {}
    setSending(false);
  }

  // ── Рендер ────────────────────────────────────────────────────────────────

  // Экран «сервер не запущен»
  if (!serverRunning && !serverStarting) {
    return (
      <OfflineScreen
        onStart={startServer}
        starting={serverStarting}
        isElectron={isElectron}
      />
    );
  }

  // Экран загрузки при старте
  if (serverStarting || (serverRunning && loading)) {
    return <StartingScreen starting={serverStarting} />;
  }

  const tabs = [
    { id: 'status',   label: 'Статус' },
    { id: 'nodes',    label: `Узлы${nodes.length ? ` (${nodes.length})` : ''}` },
    { id: 'files',    label: `Файлы${files.length ? ` (${files.length})` : ''}` },
    { id: 'chat',     label: 'Чат' },
    { id: 'settings', label: 'Настройки' },
  ];

  const unreadTotal = contacts.reduce((a, c) => a + (c.unread || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Хедер с кнопкой стоп */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: '1px solid #e2e8f0',
        background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
        color: 'white', flexShrink: 0
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Интрасеть</div>
          <div style={{ fontSize: 10, opacity: 0.8 }}>{status?.nodeName || '...'}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{
            fontSize: 10, background: 'rgba(255,255,255,0.2)', borderRadius: 10,
            padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 4
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
            Активна
          </div>
          <button
            onClick={stopServer}
            disabled={serverStopping}
            title="Остановить Интрасеть"
            style={{
              padding: '4px 10px', fontSize: 11, fontWeight: 600,
              background: 'rgba(239,68,68,0.85)', color: 'white',
              border: 'none', borderRadius: 6, cursor: serverStopping ? 'default' : 'pointer',
              opacity: serverStopping ? 0.6 : 1
            }}
          >
            {serverStopping ? '...' : 'Стоп'}
          </button>
        </div>
      </div>

      {/* Табы */}
      <div style={{
        display: 'flex', gap: 2, padding: '6px 10px',
        borderBottom: '1px solid #e2e8f0', background: '#f8fafc', flexShrink: 0, overflowX: 'auto'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '5px 10px', borderRadius: 6, border: 'none', whiteSpace: 'nowrap',
              background: activeTab === tab.id ? '#2563eb' : 'transparent',
              color: activeTab === tab.id ? 'white' : '#64748b',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', position: 'relative'
            }}
          >
            {tab.label}
            {tab.id === 'chat' && unreadTotal > 0 && (
              <span style={{
                position: 'absolute', top: 2, right: 2,
                background: '#ef4444', color: 'white', borderRadius: 8,
                padding: '0 4px', fontSize: 9, lineHeight: '14px'
              }}>{unreadTotal}</span>
            )}
          </button>
        ))}
      </div>

      {/* Контент */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {dataError && (
          <div style={{ padding: 10, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, marginBottom: 10, fontSize: 11, color: '#c2410c' }}>
            {dataError}
          </div>
        )}
        {activeTab === 'status' && (
          <StatusTab status={status} nodes={nodes} files={files} onRefresh={() => loadAll(true)} />
        )}
        {activeTab === 'nodes' && (
          <NodesTab
            nodes={nodes}
            onAdd={addNode}
            onDelete={deleteNode}
            onPing={pingNode}
            onSelect={(n) => { setSelectedNode(n); setActiveTab('chat'); }}
          />
        )}
        {activeTab === 'files' && (
          <FilesTab
            files={files}
            nodes={nodes}
            onUpload={uploadFile}
            onDownload={downloadFile}
            onDelete={deleteFile}
          />
        )}
        {activeTab === 'chat' && (
          <ChatTab
            contacts={contacts}
            selectedNode={selectedNode}
            messages={chatMessages}
            input={chatInput}
            sending={sending}
            onSelectContact={(n) => { setSelectedNode(n); loadMessages(n.id || n.nodeId); }}
            onInputChange={setChatInput}
            onSend={sendMessage}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsTab status={status} onSaved={() => loadAll(true)} />
        )}
      </div>

      {/* Футер */}
      <div style={{
        padding: '6px 10px', borderTop: '1px solid #e2e8f0',
        display: 'flex', gap: 6, flexShrink: 0
      }}>
        <button onClick={() => loadAll(true)} style={btnStyle('#f1f5f9', '#64748b')}>
          Обновить
        </button>
        <button
          onClick={() => onNavigate && onNavigate(`${INTRA_URL}/ui/nodes`)}
          style={btnStyle('#eff6ff', '#2563eb')}
        >
          Открыть WebUI
        </button>
      </div>
    </div>
  );
}

function btnStyle(bg, color) {
  return {
    flex: 1, padding: '7px 8px', background: bg, color,
    border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer'
  };
}

// ─── Экраны ───────────────────────────────────────────────────────────────────

function OfflineScreen({ onStart, starting, isElectron }) {
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      {/* Hero */}
      <div style={{
        padding: 20, borderRadius: 14, textAlign: 'center',
        background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)', color: 'white'
      }}>
        <MeshIcon />
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 10 }}>Интрасеть</div>
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
          Автономная mesh-сеть для локальной связи
        </div>
      </div>

      {/* Возможности */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          ['Обнаружение узлов', 'Автоматический поиск устройств в локальной сети через mDNS'],
          ['Файлообмен', 'Делитесь файлами напрямую без интернета'],
          ['Mesh-чат', 'Общайтесь с узлами сети в реальном времени'],
          ['Автономность', 'Работает без интернета и центральных серверов'],
        ].map(([title, desc]) => (
          <div key={title} style={{
            padding: '10px 12px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0',
            display: 'flex', gap: 10, alignItems: 'flex-start'
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2563eb', marginTop: 5, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{title}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Кнопка запуска */}
      {isElectron && (
        <button
          onClick={onStart}
          disabled={starting}
          style={{
            padding: '14px 20px',
            background: starting ? '#94a3b8' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: 'white', border: 'none', borderRadius: 10, fontSize: 14,
            fontWeight: 700, cursor: starting ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: starting ? 'none' : '0 4px 14px rgba(37,99,235,0.4)',
            transition: 'all 0.2s'
          }}
        >
          {starting ? (
            <>
              <SpinIcon />
              Запуск...
            </>
          ) : (
            <>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" fill="white" stroke="none" />
              </svg>
              Запустить Интрасеть
            </>
          )}
        </button>
      )}

      {!isElectron && (
        <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, fontSize: 12, color: '#991b1b', textAlign: 'center' }}>
          Только в Intra Browser (Electron)
        </div>
      )}
    </div>
  );
}

function StartingScreen({ starting }) {
  return (
    <div style={{ padding: 40, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <SpinIcon size={32} color="#2563eb" />
      <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
        {starting ? 'Запуск Интрасети...' : 'Загрузка данных...'}
      </div>
      <div style={{ fontSize: 12, color: '#64748b' }}>
        {starting ? 'Инициализация сервера и обнаружение узлов' : 'Подключение к серверу'}
      </div>
    </div>
  );
}

// ─── Вкладки ─────────────────────────────────────────────────────────────────

function StatusTab({ status, nodes, files, onRefresh }) {
  const online = nodes.filter(n => n.online).length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <StatCard label="Онлайн" value={online} color="#22c55e" />
        <StatCard label="Всего узлов" value={nodes.length} color="#2563eb" />
        <StatCard label="Файлов" value={files.length} color="#8b5cf6" />
        <StatCard label="Аптайм" value={formatUptime(status?.uptime)} color="#64748b" />
      </div>

      <InfoBlock title="Мой узел">
        <Row label="Имя" value={status?.nodeName || '—'} bold />
        <Row label="ID" value={(status?.nodeId || '').slice(0, 16) + '...'} mono />
        <Row label="HTTP" value={`localhost:${status?.port || 3847}`} />
        <Row label="WebSocket" value={`localhost:${status?.wsPort || 3848}`} />
      </InfoBlock>

      <InfoBlock title="Mesh-сеть">
        <Row label="Узлов онлайн" value={online} />
        <Row label="mDNS" value={status?.mdnsEnabled !== false ? 'Включён' : 'Выключен'} />
        <Row label="Версия" value={status?.version || '1.0.0'} />
      </InfoBlock>
    </div>
  );
}

function NodesTab({ nodes, onAdd, onDelete, onPing, onSelect }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button onClick={onAdd} style={{
        padding: '10px 16px', background: '#22c55e', color: 'white',
        border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer'
      }}>
        + Добавить узел вручную
      </button>

      {nodes.length === 0 ? (
        <EmptyState text="Нет узлов. Ожидание автообнаружения (mDNS)..." />
      ) : (
        nodes.map(node => (
          <div key={node.id} style={{
            padding: 12, borderRadius: 8, background: '#f8fafc',
            borderLeft: `3px solid ${node.online ? '#22c55e' : '#94a3b8'}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{node.name}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{node.host}:{node.port}</div>
                {node.source && <div style={{ fontSize: 10, color: '#94a3b8' }}>via {node.source}</div>}
              </div>
              <StatusBadge online={node.online} />
            </div>
            <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
              <Btn onClick={() => onPing(node)} color="#f1f5f9" textColor="#64748b">Ping</Btn>
              <Btn onClick={() => onSelect(node)} color="#eff6ff" textColor="#2563eb">Чат</Btn>
              <Btn onClick={() => onDelete(node.id)} color="#fef2f2" textColor="#dc2626">✕</Btn>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function FilesTab({ files, nodes, onUpload, onDownload, onDelete }) {
  const getNodeName = id => nodes.find(n => n.id === id)?.name || id?.slice(0, 8) + '...';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button onClick={onUpload} style={{
        padding: '10px 16px', background: '#22c55e', color: 'white',
        border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer'
      }}>
        ↑ Поделиться файлом
      </button>
      {files.length === 0 ? (
        <EmptyState text="Нет общих файлов в сети" />
      ) : (
        files.map(file => (
          <div key={file.id} style={{ padding: 10, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {file.name}
            </div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
              {formatBytes(file.size)} · {getNodeName(file.node_id)}
            </div>
            <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
              <Btn onClick={() => onDownload(file)} color="#eff6ff" textColor="#2563eb" flex>Скачать</Btn>
              <Btn onClick={() => onDelete(file.id)} color="#fef2f2" textColor="#dc2626">✕</Btn>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ChatTab({ contacts, selectedNode, messages, input, sending, onSelectContact, onInputChange, onSend }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  return (
    <div style={{ display: 'flex', gap: 8, height: '100%', minHeight: 300 }}>
      {/* Список контактов */}
      <div style={{ width: 110, flexShrink: 0, borderRight: '1px solid #e2e8f0', paddingRight: 8 }}>
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6, fontWeight: 700 }}>КОНТАКТЫ</div>
        {contacts.length === 0 ? (
          <div style={{ fontSize: 10, color: '#94a3b8' }}>Нет контактов</div>
        ) : (
          contacts.map(c => (
            <div
              key={c.nodeId}
              onClick={() => onSelectContact(c)}
              style={{
                padding: '7px 6px', borderRadius: 6, cursor: 'pointer', marginBottom: 3,
                background: selectedNode?.id === c.nodeId ? '#eff6ff' : 'transparent',
                fontSize: 11
              }}
            >
              <div style={{ fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {(c.nodeId || '').slice(0, 8)}...
              </div>
              {c.unread > 0 && (
                <span style={{
                  fontSize: 9, color: 'white', background: '#ef4444',
                  borderRadius: 8, padding: '0 5px', marginTop: 2, display: 'inline-block'
                }}>{c.unread}</span>
              )}
            </div>
          ))
        )}
      </div>

      {/* Чат */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!selectedNode ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12 }}>
            Выберите контакт
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#2563eb', marginBottom: 6, padding: '2px 0' }}>
              {selectedNode.name || (selectedNode.id || '').slice(0, 12) + '...'}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {messages.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: 11, textAlign: 'center', marginTop: 20 }}>Нет сообщений</div>
              ) : (
                messages.map((msg, i) => {
                  const isSelf = msg.sender_id === 'self' || msg.senderId === 'self';
                  return (
                    <div key={i} style={{
                      alignSelf: isSelf ? 'flex-end' : 'flex-start',
                      background: isSelf ? '#dcfce7' : '#f1f5f9',
                      padding: '7px 10px', borderRadius: 10, maxWidth: '85%', fontSize: 12
                    }}>
                      <div>{msg.content}</div>
                      <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>
                        {formatTime(msg.timestamp || msg.created_at)}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={endRef} />
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <input
                type="text"
                value={input}
                onChange={e => onInputChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !sending && onSend()}
                placeholder="Сообщение..."
                style={{
                  flex: 1, padding: '7px 10px', border: '1px solid #e2e8f0',
                  borderRadius: 8, fontSize: 12, outline: 'none'
                }}
              />
              <button
                onClick={onSend}
                disabled={sending || !input.trim()}
                style={{
                  padding: '7px 14px', fontSize: 11, fontWeight: 600,
                  background: (sending || !input.trim()) ? '#94a3b8' : '#2563eb',
                  color: 'white', border: 'none', borderRadius: 8,
                  cursor: sending ? 'default' : 'pointer'
                }}
              >
                {sending ? '...' : '→'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SettingsTab({ status, onSaved }) {
  const [nodeName, setNodeName] = useState(status?.nodeName || '');
  const [serverPath, setServerPath] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pathLoaded, setPathLoaded] = useState(false);

  useEffect(() => {
    if (!isElectron) return;
    window.electronAPI.intraGetServerPath?.().then(r => {
      if (r?.serverPath) setServerPath(r.serverPath);
      setPathLoaded(true);
    }).catch(() => setPathLoaded(true));
  }, []);

  useEffect(() => {
    setNodeName(status?.nodeName || '');
  }, [status?.nodeName]);

  async function saveNodeName() {
    if (!nodeName.trim() || saving) return;
    setSaving(true);
    try {
      const r = await window.electronAPI.intraUpdateSettings({ nodeName: nodeName.trim() });
      if (r.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        onSaved?.();
      } else {
        alert('Ошибка: ' + (r.error || 'Неизвестная'));
      }
    } catch (err) {
      alert('Ошибка: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveServerPath() {
    if (!serverPath.trim()) return;
    try {
      const r = await window.electronAPI.intraSetServerPath?.(serverPath.trim());
      if (r?.success) alert('Путь сохранён. Применится при следующем запуске.');
      else alert('Ошибка: ' + (r?.error || 'Неизвестная'));
    } catch (err) {
      alert('Ошибка: ' + err.message);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InfoBlock title="Имя узла">
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
          Отображается другим узлам в сети
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            value={nodeName}
            onChange={e => setNodeName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveNodeName()}
            placeholder="Имя узла"
            maxLength={32}
            style={{
              flex: 1, padding: '8px 10px', border: '1px solid #e2e8f0',
              borderRadius: 7, fontSize: 12, outline: 'none'
            }}
          />
          <button
            onClick={saveNodeName}
            disabled={saving || !nodeName.trim()}
            style={{
              padding: '8px 14px', fontSize: 12, fontWeight: 600,
              background: saved ? '#22c55e' : '#2563eb',
              color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer',
              minWidth: 60, transition: 'background 0.2s'
            }}
          >
            {saving ? '...' : saved ? '✓' : 'Сохранить'}
          </button>
        </div>
      </InfoBlock>

      <InfoBlock title="Параметры сервера">
        <Row label="HTTP порт" value={status?.port || 3847} mono />
        <Row label="WebSocket порт" value={status?.wsPort || 3848} mono />
        <Row label="Узел ID" value={(status?.nodeId || '').slice(0, 20) + '...'} mono />
      </InfoBlock>

      {isElectron && pathLoaded && (
        <InfoBlock title="Путь к серверу">
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
            Путь к файлу src/server.js пакета intraset-network
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={serverPath}
              onChange={e => setServerPath(e.target.value)}
              placeholder="...intraset-network/src/server.js"
              style={{
                flex: 1, padding: '7px 10px', border: '1px solid #e2e8f0',
                borderRadius: 7, fontSize: 11, outline: 'none', fontFamily: 'monospace'
              }}
            />
            <button
              onClick={saveServerPath}
              style={{
                padding: '7px 12px', fontSize: 11, fontWeight: 600,
                background: '#f1f5f9', color: '#64748b',
                border: 'none', borderRadius: 7, cursor: 'pointer'
              }}
            >
              ОК
            </button>
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 6 }}>
            Применится при следующем запуске Интрасети
          </div>
        </InfoBlock>
      )}

      <InfoBlock title="Mesh-сеть">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Row label="Протокол обнаружения" value="mDNS (Bonjour)" />
          <Row label="Тип сети" value="Mesh P2P" />
          <Row label="Шифрование" value="Нет (LAN)" />
        </div>
      </InfoBlock>
    </div>
  );
}

// ─── UI-компоненты ────────────────────────────────────────────────────────────

function StatCard({ label, value, color }) {
  return (
    <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', textAlign: 'center', border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function InfoBlock({ title, children }) {
  return (
    <div style={{ padding: 12, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, bold, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <span style={{ fontSize: 11, color: '#64748b' }}>{label}</span>
      <span style={{
        fontSize: 11, color: '#1e293b',
        fontWeight: bold ? 600 : 400,
        fontFamily: mono ? 'monospace' : 'inherit'
      }}>{value}</span>
    </div>
  );
}

function StatusBadge({ online }) {
  return (
    <div style={{
      fontSize: 10, padding: '2px 8px', borderRadius: 10,
      color: online ? '#16a34a' : '#94a3b8',
      background: online ? '#dcfce7' : '#f1f5f9'
    }}>
      {online ? 'Онлайн' : 'Офлайн'}
    </div>
  );
}

function Btn({ onClick, color, textColor, children, flex }) {
  return (
    <button onClick={onClick} style={{
      flex: flex ? 1 : undefined,
      padding: '6px 10px', background: color, color: textColor,
      border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer'
    }}>
      {children}
    </button>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
      {text}
    </div>
  );
}

function SpinIcon({ size = 20, color = '#2563eb' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"
      style={{ animation: 'spin 1s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path strokeLinecap="round" d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function MeshIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ margin: '0 auto', display: 'block' }}>
      <circle cx="24" cy="8"  r="5" fill="rgba(255,255,255,0.9)" />
      <circle cx="8"  cy="36" r="5" fill="rgba(255,255,255,0.9)" />
      <circle cx="40" cy="36" r="5" fill="rgba(255,255,255,0.9)" />
      <circle cx="24" cy="26" r="4" fill="rgba(255,255,255,0.7)" />
      <line x1="24" y1="13" x2="24" y2="22" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
      <line x1="24" y1="13" x2="10" y2="31" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      <line x1="24" y1="13" x2="38" y2="31" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      <line x1="24" y1="30" x2="10" y2="33" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      <line x1="24" y1="30" x2="38" y2="33" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      <line x1="13"  y1="36" x2="35" y2="36" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
    </svg>
  );
}
