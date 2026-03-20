import ProgressBar from './ProgressBar';
import { 
  formatPercent, 
  formatFileSizeProgress, 
  formatSpeed, 
  formatEta,
  getStatusLabel,
  getStatusColor 
} from '../../utils/format';

export default function DownloadItem({ 
  download, 
  onOpenFolder, 
  onRemove, 
  onCancel,
  getSpeed,
  showProgress = true
}) {
  const { 
    id, 
    filename, 
    state, 
    receivedBytes, 
    totalBytes 
  } = download;

  const percent = formatPercent(receivedBytes, totalBytes);
  const sizeText = formatFileSizeProgress(receivedBytes, totalBytes);
  const speed = getSpeed?.(id) || 0;
  const bytesRemaining = totalBytes > 0 ? totalBytes - receivedBytes : 0;
  const eta = formatEta(bytesRemaining, speed);
  const statusColor = getStatusColor(state);
  const isActive = state === 'progressing';
  const isDone = state === 'completed';
  const isError = state === 'interrupted' || state === 'cancelled';

  const statusIcon = () => {
    const stroke = statusColor;
    if (isDone) {
      return (
        <svg width="16" height="16" fill="none" stroke={stroke} viewBox="0 0 24 24" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      );
    }
    if (isError) {
      return (
        <svg width="16" height="16" fill="none" stroke={stroke} viewBox="0 0 24 24" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      );
    }
    return (
      <svg width="16" height="16" fill="none" stroke={stroke} viewBox="0 0 24 24" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
      </svg>
    );
  };

  return (
    <div style={{ 
      padding: '10px 12px', 
      borderBottom: '1px solid #f1f5f9',
      background: 'white'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 8, 
        marginBottom: showProgress && isActive ? 6 : 4 
      }}>
        {statusIcon()}
        <span style={{ 
          flex: 1, 
          fontSize: 11, 
          fontWeight: 500, 
          color: '#1e293b', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap' 
        }}>
          {filename}
        </span>
        <span style={{ 
          fontSize: 10, 
          color: statusColor,
          fontWeight: 500
        }}>
          {getStatusLabel(state)}
        </span>
      </div>

      {showProgress && isActive && (
        <div style={{ marginBottom: 6 }}>
          <ProgressBar 
            value={percent || 0} 
            status={state} 
            height={5}
            showLabel={true}
          />
        </div>
      )}

      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginTop: 4 
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 10, color: '#94a3b8' }}>
            {sizeText || 'Размер неизвестен'}
          </span>
          {isActive && speed > 0 && (
            <span style={{ fontSize: 9, color: '#cbd5e1' }}>
              {formatSpeed(speed)}
              {eta && ` • ${eta}`}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          {isActive && onCancel && (
            <button 
              onClick={() => onCancel(id)} 
              title="Отменить"
              style={{ 
                padding: '3px 6px', 
                fontSize: 10, 
                color: '#ef4444', 
                background: '#fef2f2', 
                border: 'none', 
                borderRadius: 4, 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <svg width="12" height="12" fill="none" stroke="#ef4444" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          )}
          {isDone && onOpenFolder && (
            <button 
              onClick={() => onOpenFolder(id)} 
              title="Открыть папку"
              style={{ 
                padding: '3px 6px', 
                fontSize: 10, 
                color: '#64748b', 
                background: '#f1f5f9', 
                border: 'none', 
                borderRadius: 4, 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <svg width="12" height="12" fill="none" stroke="#64748b" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
              </svg>
            </button>
          )}
          {onRemove && (
            <button 
              onClick={() => onRemove(id)} 
              title="Удалить"
              style={{ 
                padding: '3px 6px', 
                fontSize: 10, 
                color: '#64748b', 
                background: '#f1f5f9', 
                border: 'none', 
                borderRadius: 4, 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <svg width="12" height="12" fill="none" stroke="#64748b" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
