import { useDownloads } from '../../hooks/useDownloads.jsx';
import DownloadItem from './DownloadItem';
import EmptyState from './EmptyState';

export default function DownloadsPanel({ onClose }) {
  const {
    downloads,
    isLoading,
    removeDownload,
    clearDownloads,
    cancelDownload,
    getDownloadSpeed,
    totalCount,
    activeCount
  } = useDownloads();

  const handleOpenFolder = (downloadId) => {
    if (window.electronAPI?.showInFolder) {
      window.electronAPI.showInFolder(downloadId);
    }
  };

  const handleRemove = (downloadId) => {
    removeDownload(downloadId);
  };

  const handleCancel = (downloadId) => {
    cancelDownload(downloadId);
  };

  const handleClear = () => {
    clearDownloads();
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      overflow: 'hidden'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '10px 12px', 
        borderBottom: '1px solid #f1f5f9',
        background: '#f8fafc'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>
            Загрузки
          </span>
          {totalCount > 0 && (
            <span style={{ 
              fontSize: 10, 
              color: '#64748b',
              background: '#e2e8f0',
              padding: '1px 6px',
              borderRadius: 10
            }}>
              {totalCount}
            </span>
          )}
          {activeCount > 0 && (
            <span style={{ 
              fontSize: 10, 
              color: '#2563eb',
              background: '#dbeafe',
              padding: '1px 6px',
              borderRadius: 10
            }}>
              {activeCount} активных
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {totalCount > 0 && (
            <button 
              onClick={handleClear}
              style={{ 
                fontSize: 10, 
                color: '#94a3b8', 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer',
                padding: '4px 8px'
              }}
            >
              Очистить
            </button>
          )}
          {onClose && (
            <button 
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                color: '#94a3b8'
              }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {isLoading && downloads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
            Загрузка...
          </div>
        ) : downloads.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {downloads.map(dl => (
              <DownloadItem
                key={dl.id}
                download={dl}
                onOpenFolder={handleOpenFolder}
                onRemove={handleRemove}
                onCancel={handleCancel}
                getSpeed={getDownloadSpeed}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
