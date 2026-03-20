import { getStatusColor } from '../../utils/format';

export function ProgressBar({ 
  value = 0, 
  status = 'progressing',
  showLabel = true,
  height = 6,
  animated = true,
  size = 'default'
}) {
  const isIndeterminate = status === 'indeterminate' || (status === 'progressing' && value === 0);
  const isCompleted = status === 'completed';
  const isError = status === 'interrupted' || status === 'cancelled';

  const color = getStatusColor(status);
  const bgColor = isCompleted ? '#dcfce7' : isError ? '#fee2e2' : '#e2e8f0';
  const progressColor = isCompleted ? '#22c55e' : isError ? '#ef4444' : '#2563eb';

  const containerStyle = {
    height: height,
    background: bgColor,
    borderRadius: height / 2,
    overflow: 'hidden',
    position: 'relative',
    width: '100%'
  };

  const fillStyle = {
    height: '100%',
    background: progressColor,
    borderRadius: height / 2,
    transition: animated && !isIndeterminate ? 'width 0.3s ease-out' : 'none',
    position: 'relative'
  };

  if (isIndeterminate) {
    return (
      <div style={containerStyle}>
        <div style={{
          ...fillStyle,
          width: '30%',
          animation: 'progressIndeterminate 1.5s infinite ease-in-out',
          background: `linear-gradient(90deg, transparent, ${progressColor}, transparent)`
        }} />
        <style>{`
          @keyframes progressIndeterminate {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(400%); }
          }
        `}</style>
      </div>
    );
  }

  const gradient = animated && !isCompleted && !isError && value > 0 && value < 100;
  if (gradient) {
    fillStyle.background = `linear-gradient(90deg, ${progressColor}88, ${progressColor})`;
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={containerStyle}>
        <div style={{ ...fillStyle, width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      {showLabel && !isIndeterminate && (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: 2,
          fontSize: 9,
          color: '#94a3b8'
        }}>
          {Math.round(value)}%
        </div>
      )}
    </div>
  );
}

export default ProgressBar;
