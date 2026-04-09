import React, { useState, useEffect, useRef } from 'react';

const isElectron = typeof window.electronAPI !== 'undefined';

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

function formatTime(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return 'Сегодня ' + formatTime(timestamp);
  }
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ' ' + formatTime(timestamp);
}

export default function IntranetPanel({ onClose, onNavigate }) {
  const [status, setStatus] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [files, setFiles] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [activeTab, setActiveTab] = useState('status');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedNode && activeTab === 'chat') {
      loadMessages(selectedNode.id);
    }
  }, [selectedNode, activeTab]);

  async function loadAll() {
    if (!isElectron) {
      setError('Доступно только в Intra Browser');
      setLoading(false);
      return;
    }

    try {
      const [statusData, nodesData, filesData, contactsData] = await Promise.all([
        window.electronAPI.intraGetStatus(),
        window.electronAPI.intraGetNodes(),
        window.electronAPI.intraGetFiles(),
        window.electronAPI.intraGetContacts()
      ]);

      if (statusData.error) {
        setError(statusData.error + '. Запустите intraset-network.');
        setStatus(null);
      } else {
        setStatus(statusData);
        setError(null);
      }

      if (nodesData.nodes) setNodes(nodesData.nodes);
      if (filesData.files) setFiles(filesData.files);
      if (contactsData.contacts) setContacts(contactsData.contacts);
    } catch (err) {
      setError('Ошибка подключения: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(contactId) {
    try {
      const data = await window.electronAPI.intraGetMessages(contactId);
      if (data.messages) setChatMessages(data.messages);
    } catch (err) {
      console.error('Load messages error:', err);
    }
  }

  async function sendMessage() {
    if (!chatInput.trim() || !selectedNode || sending) return;
    
    setSending(true);
    try {
      const result = await window.electronAPI.intraSendMessage(selectedNode.id, chatInput.trim());
      if (result.success) {
        setChatInput('');
        loadMessages(selectedNode.id);
        loadAll();
      }
    } catch (err) {
      console.error('Send error:', err);
    } finally {
      setSending(false);
    }
  }

  async function addNode() {
    const host = prompt('IP адрес узла:');
    if (!host) return;
    const port = prompt('Порт (3847):', '3847');
    const name = prompt('Имя узла (опционально):');

    try {
      const result = await window.electronAPI.intraAddNode(host, parseInt(port) || 3847, name || null);
      if (result.success) {
        loadAll();
      } else {
        alert('Ошибка: ' + (result.error || 'Неизвестная'));
      }
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
      const result = await window.electronAPI.intraPingNode(node.id);
      if (result.reachable) {
        alert(`${node.name}: ${result.latency}мс`);
      } else {
        alert(`${node.name}: недоступен`);
      }
    } catch (err) {
      alert('Ошибка ping: ' + err.message);
    }
  }

  async function uploadFile() {
    if (!isElectron) return;
    try {
      const result = await window.electronAPI.showOpenDialog({
        title: 'Выберите файл для загрузки',
        properties: ['openFile']
      });
      if (result.canceled || !result.filePaths?.length) return;

      const uploadResult = await window.electronAPI.intraUploadFile(result.filePaths[0]);
      if (uploadResult.success) {
        loadAll();
      } else {
        alert('Ошибка загрузки: ' + (uploadResult.error || 'Неизвестная'));
      }
    } catch (err) {
      alert('Ошибка: ' + err.message);
    }
  }

  async function downloadFile(file) {
    try {
      const result = await window.electronAPI.intraDownloadFile(file.id, file.name);
      if (result.success) {
        alert('Файл сохранён: ' + result.path);
      } else if (!result.canceled) {
        alert('Ошибка: ' + (result.error || 'Неизвестная'));
      }
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

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ color: '#64748b' }}>Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ 
          padding: 16, 
          borderRadius: 10, 
          background: '#fef2f2', 
          border: '1px solid #fecaca',
          marginBottom: 16 
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>
            Интрасеть недоступна
          </div>
          <div style={{ fontSize: 11, color: '#991b1b' }}>{error}</div>
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 16 }}>
          Запустите: <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>cd intraset-network && npm start</code>
        </div>
        <button onClick={loadAll} style={{
          padding: '8px 16px', background: '#2563eb', color: 'white',
          border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12
        }}>Повторить</button>
      </div>
    );
  }

  const tabs = [
    { id: 'status', label: 'Статус' },
    { id: 'nodes', label: 'Узлы' },
    { id: 'files', label: 'Файлы' },
    { id: 'chat', label: 'Чат' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ 
        display: 'flex', 
        gap: 4, 
        padding: '8px 12px', 
        borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: 'none',
              background: activeTab === tab.id ? '#2563eb' : 'transparent',
              color: activeTab === tab.id ? 'white' : '#64748b',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            {tab.label}
            {tab.id === 'chat' && contacts.some(c => c.unread > 0) && (
              <span style={{ 
                marginLeft: 4, 
                background: '#ef4444', 
                color: 'white', 
                borderRadius: 10, 
                padding: '1px 6px',
                fontSize: 10 
              }}>
                {contacts.reduce((a, c) => a + (c.unread || 0), 0)}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {activeTab === 'status' && <StatusTab status={status} nodes={nodes} files={files} />}
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
            onSelectContact={(n) => { setSelectedNode(n); loadMessages(n.id); }}
            onInputChange={setChatInput}
            onSend={sendMessage}
          />
        )}
      </div>

      <div style={{ 
        padding: '8px 12px', 
        borderTop: '1px solid #e2e8f0',
        display: 'flex',
        gap: 8
      }}>
        <button onClick={loadAll} style={{
          flex: 1,
          padding: '8px 12px',
          background: '#f1f5f9',
          color: '#64748b',
          border: 'none',
          borderRadius: 6,
          fontSize: 11,
          cursor: 'pointer'
        }}>
          Обновить
        </button>
        <button onClick={() => onNavigate && onNavigate('intra://nodes')} style={{
          flex: 1,
          padding: '8px 12px',
          background: '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          fontSize: 11,
          cursor: 'pointer'
        }}>
          Открыть в браузере
        </button>
      </div>
    </div>
  );
}

function StatusTab({ status, nodes, files }) {
  const onlineNodes = nodes.filter(n => n.online).length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ 
        padding: 16, 
        borderRadius: 10, 
        background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', 
        color: 'white'
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Интрасеть</div>
        <div style={{ fontSize: 11, opacity: 0.9 }}>Автономная mesh-сеть</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <StatCard label="Узлов онлайн" value={onlineNodes} color="#22c55e" />
        <StatCard label="Файлов" value={files.length} color="#2563eb" />
        <StatCard label="Время работы" value={formatUptime(status?.uptime)} color="#2563eb" />
        <StatCard label="Всего узлов" value={nodes.length} color="#64748b" />
      </div>

      <div style={{ 
        padding: 12, 
        borderRadius: 8, 
        background: '#f8fafc',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Мой узел</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
          {status?.nodeName || 'Unknown'}
        </div>
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
          ID: {status?.nodeId?.slice(0, 12)}...
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: '#64748b' }}>{label}</div>
    </div>
  );
}

function NodesTab({ nodes, onAdd, onDelete, onPing, onSelect }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button onClick={onAdd} style={{
        padding: '10px 16px',
        background: '#22c55e',
        color: 'white',
        border: 'none',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6
      }}>
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
        </svg>
        Добавить узел
      </button>

      {nodes.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
          Нет доступных узлов
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {nodes.map(node => (
            <div key={node.id} style={{
              padding: 12,
              borderRadius: 8,
              background: '#f8fafc',
              borderLeft: `3px solid ${node.online ? '#22c55e' : '#94a3b8'}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{node.name}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{node.host}:{node.port}</div>
                </div>
                <div style={{ 
                  fontSize: 10, 
                  color: node.online ? '#16a34a' : '#94a3b8',
                  background: node.online ? '#dcfce7' : '#f1f5f9',
                  padding: '2px 8px',
                  borderRadius: 10
                }}>
                  {node.online ? 'Онлайн' : 'Офлайн'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button onClick={() => onPing(node)} style={{
                  flex: 1, padding: '6px 8px', background: '#f1f5f9', color: '#64748b',
                  border: 'none', borderRadius: 6, fontSize: 10, cursor: 'pointer'
                }}>Ping</button>
                <button onClick={() => onSelect(node)} style={{
                  flex: 1, padding: '6px 8px', background: '#eff6ff', color: '#2563eb',
                  border: 'none', borderRadius: 6, fontSize: 10, cursor: 'pointer'
                }}>Чат</button>
                <button onClick={() => onDelete(node.id)} style={{
                  padding: '6px 8px', background: '#fef2f2', color: '#dc2626',
                  border: 'none', borderRadius: 6, fontSize: 10, cursor: 'pointer'
                }}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilesTab({ files, nodes, onUpload, onDownload, onDelete }) {
  const getNodeName = (nodeId) => {
    const node = nodes.find(n => n.id === nodeId);
    return node?.name || nodeId?.slice(0, 8) + '...';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button onClick={onUpload} style={{
        padding: '10px 16px',
        background: '#22c55e',
        color: 'white',
        border: 'none',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6
      }}>
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 8l-4 4m0 0l-4-4m4 4V4"/>
        </svg>
        Загрузить файл
      </button>

      {files.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
          Нет общих файлов
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {files.map(file => (
            <div key={file.id} style={{
              padding: 10,
              borderRadius: 6,
              background: '#f8fafc',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="16" height="16" fill="none" stroke="#64748b" viewBox="0 0 24 24" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>
                    {formatBytes(file.size)} • {getNodeName(file.node_id)}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button onClick={() => onDownload(file)} style={{
                  flex: 1, padding: '6px 8px', background: '#2563eb', color: 'white',
                  border: 'none', borderRadius: 6, fontSize: 10, cursor: 'pointer'
                }}>Скачать</button>
                <button onClick={() => onDelete(file.id)} style={{
                  padding: '6px 8px', background: '#fef2f2', color: '#dc2626',
                  border: 'none', borderRadius: 6, fontSize: 10, cursor: 'pointer'
                }}>Удалить</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatTab({ contacts, selectedNode, messages, input, sending, onSelectContact, onInputChange, onSend }) {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div style={{ display: 'flex', gap: 8, height: '100%', minHeight: 300 }}>
      <div style={{ width: 120, borderRight: '1px solid #e2e8f0', paddingRight: 8 }}>
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8, fontWeight: 600 }}>Контакты</div>
        {contacts.length === 0 ? (
          <div style={{ fontSize: 10, color: '#94a3b8' }}>Нет контактов</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {contacts.map(contact => (
              <div key={contact.nodeId} onClick={() => onSelectContact(contact)} style={{
                padding: '8px 6px',
                borderRadius: 6,
                background: selectedNode?.id === contact.nodeId ? '#eff6ff' : 'transparent',
                cursor: 'pointer',
                fontSize: 11
              }}>
                <div style={{ fontWeight: 500, color: '#1e293b' }}>
                  {(contact.nodeId || '').slice(0, 8)}...
                </div>
                {contact.unread > 0 && (
                  <div style={{ 
                    fontSize: 9, color: 'white', background: '#ef4444',
                    borderRadius: 10, padding: '1px 5px', marginTop: 2, display: 'inline-block'
                  }}>
                    {contact.unread}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!selectedNode ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12 }}>
            Выберите контакт
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>
                {selectedNode.name || selectedNode.id?.slice(0, 8)}
              </div>
              {messages.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: 11, textAlign: 'center', marginTop: 20 }}>
                  Нет сообщений
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} style={{
                    alignSelf: msg.sender_id === 'self' || msg.senderId === 'self' ? 'flex-end' : 'flex-start',
                    background: msg.sender_id === 'self' || msg.senderId === 'self' ? '#dcfce7' : '#f1f5f9',
                    padding: '8px 10px',
                    borderRadius: 10,
                    maxWidth: '80%',
                    fontSize: 12
                  }}>
                    <div>{msg.content}</div>
                    <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>
                      {formatTime(msg.timestamp || msg.created_at)}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                type="text"
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !sending && onSend()}
                placeholder="Сообщение..."
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  fontSize: 12,
                  outline: 'none'
                }}
              />
              <button 
                onClick={onSend} 
                disabled={sending || !input.trim()}
                style={{
                  padding: '8px 16px',
                  background: sending || !input.trim() ? '#94a3b8' : '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: sending ? 'default' : 'pointer'
                }}
              >
                {sending ? '...' : 'Отпр.'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
