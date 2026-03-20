function EmptyState({ icon, title, subtitle }) {
  return (
    <div style={{ 
      textAlign: 'center', 
      padding: '40px 20px',
      color: '#94a3b8'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center',
        marginBottom: 10
      }}>
        {icon || (
          <svg width="36" height="36" fill="none" stroke="#93c5fd" viewBox="0 0 24 24" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
        )}
      </div>
      <div style={{ 
        fontSize: 13, 
        fontWeight: 500, 
        color: '#64748b',
        marginBottom: 4
      }}>
        {title || 'Нет загрузок'}
      </div>
      <div style={{ fontSize: 12 }}>
        {subtitle || 'Скачанные файлы появятся здесь'}
      </div>
    </div>
  );
}

export default EmptyState;
