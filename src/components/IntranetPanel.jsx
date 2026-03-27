import React, { useState, useEffect } from 'react';

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

export default function IntranetPanel({ onClose, onNavigate }) {
  const [status, setStatus] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('status');

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    if (!isElectron) {
      setError('Доступно только в Intra Browser');
      setLoading(false);
      return;
    }

    try {
      const statusData = await window.electronAPI.intraGetStatus();
      if (statusData.error) {
        setError(statusData.error + '. Запустите intraset-network.');
        setStatus(null);
      } else {
        setStatus(statusData);
        setError(null);
      }

      const nodesData = await window.electronAPI.intraGetNodes();
      if (nodesData.nodes) {
        setNodes(nodesData.nodes);
      }

      const filesData = await window.electronAPI.intraGetFiles();
      if (filesData.files) {
        setFiles(filesData.files);
      }
    } catch (err) {
      setError('Ошибка подключения: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function addPeer() {
    const host = prompt('Введите IP адрес узла:');
    if (!host) return;

    const port = prompt('Введите порт (по умолчанию 3847):', '3847');
    const name = prompt('Введите имя узла (опционально):');

    try {
      const result = await window.electronAPI.intraAddNode(host, parseInt(port) || 3847, name || null);
      if (result.success) {
        alert('Узел добавлен!');
        loadData();
      } else {
        alert('Ошибка: ' + (result.error || 'Неизвестная ошибка'));
      }
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
          <div style={{ fontSize: 11, color: '#991b1b' }}>
            {error}
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 16 }}>
          Для запуска Интрасети выполните:<br/>
          <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
            cd intraset-network && npm install && npm start
          </code>
        </div>
        <button onClick={loadData} style={{
          padding: '8px 16px', background: '#2563eb', color: 'white',
          border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12
        }}>
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ 
        display: 'flex', 
        gap: 4, 
        padding: '8px 12px', 
        borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc'
      }}>
        {[
          { id: 'status', label: 'Статус' },
          { id: 'nodes', label: 'Узлы' },
          { id: 'files', label: 'Файлы' },
        ].map(tab => (
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
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {activeTab === 'status' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ 
              padding: 16, 
              borderRadius: 10, 
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', 
              color: 'white'
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                Интрасеть
              </div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>
                Автономная mesh-сеть
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#2563eb' }}>
                  {status?.peers || 0}
                </div>
                <div style={{ fontSize: 10, color: '#64748b' }}>Узлов онлайн</div>
              </div>
              <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#2563eb' }}>
                  {files.length}
                </div>
                <div style={{ fontSize: 10, color: '#64748b' }}>Файлов</div>
              </div>
              <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#2563eb' }}>
                  {formatUptime(status?.uptime)}
                </div>
                <div style={{ fontSize: 10, color: '#64748b' }}>Время работы</div>
              </div>
              <div style={{ padding: 12, borderRadius: 8, background: '#f8fafc', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#2563eb' }}>
                  {status?.nodeName || 'Unknown'}
                </div>
                <div style={{ fontSize: 10, color: '#64748b' }}>Имя узла</div>
              </div>
            </div>

            <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center' }}>
              ID: {status?.nodeId?.slice(0, 12)}...
            </div>
          </div>
        )}

        {activeTab === 'nodes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={addPeer} style={{
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
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                      {node.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      {node.host}:{node.port}
                    </div>
                    <div style={{ 
                      fontSize: 10, 
                      color: node.online ? '#16a34a' : '#94a3b8',
                      marginTop: 4 
                    }}>
                      {node.online ? 'Онлайн' : 'Офлайн'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'files' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <svg width="16" height="16" fill="none" stroke="#64748b" viewBox="0 0 24 24" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>
                        {formatBytes(file.size)} • {file.node_id?.slice(0, 8)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ 
        padding: '8px 12px', 
        borderTop: '1px solid #e2e8f0',
        display: 'flex',
        gap: 8
      }}>
        <button onClick={loadData} style={{
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
