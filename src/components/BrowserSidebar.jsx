import React from 'react';
import IntranetPanel from './IntranetPanel';

const isElectron = typeof window.electronAPI !== 'undefined';

function applyUiPrefs({ animations, compact }) {
  let el = document.getElementById('intra-ui-style');
  if (!el) { el = document.createElement('style'); el.id = 'intra-ui-style'; document.head.appendChild(el); }
  el.textContent = !animations
    ? '*, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }'
    : '';
  document.body.classList.toggle('intra-compact', Boolean(compact));
}

function SBtn({ id, panel, title, icon, onToggle }) {
  const [hov, setHov] = React.useState(false);
  const isActive = panel === id;
  return (
    <button
      onClick={() => onToggle(id)}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 9, border: 'none', cursor: 'pointer',
        background: isActive ? '#eff6ff' : hov ? '#f8fafc' : 'transparent',
        color: isActive ? '#2563eb' : hov ? '#2563eb' : '#64748b',
        borderLeft: `3px solid ${isActive ? '#2563eb' : 'transparent'}`,
        transition: 'background 0.15s, color 0.15s, border-color 0.15s',
      }}
    >{icon}</button>
  );
}

const PANEL_META = {
  bookmarks: {
    title: 'Закладки',
    icon: <svg width="14" height="14" fill="none" stroke="#2563eb" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>,
  },
  history: {
    title: 'История',
    icon: <svg width="14" height="14" fill="none" stroke="#2563eb" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  },
  downloads: {
    title: 'Загрузки',
    icon: <svg width="14" height="14" fill="none" stroke="#2563eb" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>,
  },
  intranet: {
    title: 'Интрасеть',
    icon: <svg width="14" height="14" fill="none" stroke="#2563eb" viewBox="0 0 24 24" strokeWidth="2"><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><circle cx="12" cy="12" r="1.5" fill="#2563eb"/><line x1="12" y1="7" x2="12" y2="10.5" strokeLinecap="round"/><line x1="12" y1="10.5" x2="7" y2="17" strokeLinecap="round"/><line x1="12" y1="10.5" x2="17" y2="17" strokeLinecap="round"/><line x1="7" y1="19" x2="17" y2="19" strokeLinecap="round"/></svg>,
  },
  ai: {
    title: 'AI Модель',
    icon: <svg width="14" height="14" fill="none" stroke="#2563eb" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>,
  },
  settings: {
    title: 'Настройки',
    icon: <svg width="14" height="14" fill="none" stroke="#2563eb" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
  },
};

function GlobeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 100 100" fill="none" style={{ display: 'block' }}>
      <defs>
        <radialGradient id="sgc" cx="35%" cy="35%" r="65%"><stop offset="0%" stopColor="#60c8ff"/><stop offset="100%" stopColor="#1565c0"/></radialGradient>
        <radialGradient id="sgn" cx="30%" cy="30%" r="70%"><stop offset="0%" stopColor="#80d4ff"/><stop offset="100%" stopColor="#1976d2"/></radialGradient>
      </defs>
      <circle cx="50" cy="50" r="46" stroke="url(#sgc)" strokeWidth="3" fill="none"/>
      <ellipse cx="50" cy="50" rx="28" ry="46" stroke="url(#sgc)" strokeWidth="2" fill="none"/>
      <ellipse cx="50" cy="50" rx="46" ry="22" stroke="url(#sgc)" strokeWidth="2" fill="none"/>
      <line x1="50" y1="4" x2="50" y2="96" stroke="url(#sgc)" strokeWidth="2"/>
      <line x1="4" y1="50" x2="96" y2="50" stroke="url(#sgc)" strokeWidth="2"/>
      {[[50,4],[50,96],[4,50],[96,50],[50,27],[50,73],[22,28],[78,28],[22,72],[78,72],[50,50]].map(([cx,cy],i)=>(
        <circle key={i} cx={cx} cy={cy} r={i===10?5:3} fill="url(#sgn)"/>
      ))}
    </svg>
  );
}

export default function BrowserSidebar({
  onNavigate, onGoHome, onPanelChange,
  bookmarks, onBookmarksChange,
  activeTab, onOpenAiChat,
  searchEngine, onSearchEngineChange,
  selectionRequest, onSelectionHandled,
  forceOpenAiPanel, onPanelOpened,
  isAiChatTabActive,
  downloads: propDownloads,
  onClearDownloads, onCancelDownload, onRemoveDownload,
}) {
  const [panel, setPanel] = React.useState(null);
  // Для анимации закрытия
  const [panelClosing, setPanelClosing] = React.useState(false);
  const panelCloseTimer = React.useRef(null);

  const [newBm, setNewBm] = React.useState({ title: '', url: '' });
  const [showAddBm, setShowAddBm] = React.useState(false);
  const [histItems, setHistItems] = React.useState([]);
  const [hovAiChat, setHovAiChat] = React.useState(false);
  const [newTabMode, setNewTabMode] = React.useState(() => localStorage.getItem('intra-newtab') || 'home');
  const [uiSettings, setUiSettings] = React.useState(() => ({
    animations: localStorage.getItem('intra-ui-animations') !== 'false',
    compact: localStorage.getItem('intra-ui-compact') !== 'false',
  }));

  React.useEffect(() => { applyUiPrefs(uiSettings); }, []); // eslint-disable-line
  React.useEffect(() => () => clearTimeout(panelCloseTimer.current), []);
  // Reset main-process sidebarPanelOpen on mount — panel always starts closed
  React.useEffect(() => { if (isElectron) window.electronAPI.sidebarPanelToggled(false); }, []); // eslint-disable-line

  const toggleUiSetting = key => {
    setUiSettings(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(`intra-ui-${key}`, String(next[key]));
      applyUiPrefs(next);
      return next;
    });
  };

  // AI GGUF state
  const [aiModel, setAiModel] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('intra-ai-model') || 'null'); } catch { return null; }
  });
  const [aiLoaded, setAiLoaded] = React.useState(false);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [aiChat, setAiChat] = React.useState([]);
  const [aiInput, setAiInput] = React.useState('');
  const [aiChatHistory, setAiChatHistory] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('intra-ai-chat-history') || '[]'); } catch { return []; }
  });
  const [aiShowHistory, setAiShowHistory] = React.useState(false);
  const [aiContextSize, setAiContextSize] = React.useState(() => Number(localStorage.getItem('intra-ai-context')) || 4096);
  const [aiLoadProgress, setAiLoadProgress] = React.useState(null);
  const aiLoadTimerRef = React.useRef(null);
  const [aiStreamedTokens, setAiStreamedTokens] = React.useState(0);
  const aiChatEndRef = React.useRef(null);

  // External AI providers
  const [aiProviders, setAiProviders] = React.useState([]);
  const [activeProvider, setActiveProvider] = React.useState(null);
  const [providerEnabled, setProviderEnabled] = React.useState(false);
  const [selectedModel, setSelectedModel] = React.useState('');
  const [openRouterModels, setOpenRouterModels] = React.useState([]);
  const [aiProcessingStatus, setAiProcessingStatus] = React.useState('');

  const downloads = propDownloads || [];

  // Автоскролл чата
  React.useEffect(() => {
    aiChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiChat]);

  const isAiChatTabActiveRef = React.useRef(isAiChatTabActive);
  React.useEffect(() => { isAiChatTabActiveRef.current = isAiChatTabActive; }, [isAiChatTabActive]);

  // AI status + stream events
  React.useEffect(() => {
    if (!isElectron) return;
    window.electronAPI.aiGetStatus().then(status => {
      if (status.loaded && status.modelName) {
        setAiLoaded(true);
        setAiModel(prev => prev || { name: status.modelName });
        if (status.contextSize) setAiServerContextSize(status.contextSize);
      }
    }).catch(() => {});

    const offToken = window.electronAPI.onAiToken(text => {
      if (isAiChatTabActiveRef.current) return;
      setAiStreamedTokens(n => n + 1);
      setAiChat(prev => {
        const last = prev[prev.length - 1];
        if (last?.streaming) return [...prev.slice(0, -1), { role: 'bot', text: (last.text || '') + text, streaming: true }];
        return [...prev, { role: 'bot', text, streaming: true }];
      });
    });
    const offDone = window.electronAPI.onAiDone(() => {
      if (isAiChatTabActiveRef.current) return;
      setAiLoading(false);
      setAiStreamedTokens(0);
      setAiChat(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, streaming: false } : m));
    });
    const offError = window.electronAPI.onAiError(msg => {
      if (isAiChatTabActiveRef.current) return;
      setAiLoading(false);
      setAiStreamedTokens(0);
      setAiChat(prev => [...prev, { role: 'bot', text: `❌ Ошибка: ${msg}` }]);
    });
    const offLog = window.electronAPI.onAiServerLog?.((text) => {
      setAiChat(prev => {
        if (!prev.length) return prev;
        const last = prev[prev.length - 1];
        if (last?.isServerLog) {
          const lines = (last.text + text).split('\n').slice(-6).join('\n');
          return [...prev.slice(0, -1), { ...last, text: lines }];
        }
        return prev;
      });
    }) ?? (() => {});
    return () => { offToken(); offDone(); offError(); offLog(); };
  }, []); // eslint-disable-line

  // External AI provider events
  React.useEffect(() => {
    if (!isElectron) return;
    const offToken = window.electronAPI.onAiProviderToken(text => {
      if (isAiChatTabActiveRef.current) return;
      setAiStreamedTokens(n => n + 1);
      setAiChat(prev => {
        const last = prev[prev.length - 1];
        if (last?.streaming) return [...prev.slice(0, -1), { role: 'bot', text: (last.text || '') + text, streaming: true }];
        return [...prev, { role: 'bot', text, streaming: true }];
      });
    });
    const offDone = window.electronAPI.onAiProviderDone(() => {
      if (isAiChatTabActiveRef.current) return;
      setAiLoading(false);
      setAiStreamedTokens(0);
      setAiChat(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, streaming: false } : m));
    });
    const offError = window.electronAPI.onAiProviderError(msg => {
      if (isAiChatTabActiveRef.current) return;
      setAiLoading(false);
      setAiStreamedTokens(0);
      setAiChat(prev => [...prev, { role: 'bot', text: `❌ Ошибка: ${msg}` }]);
    });
    return () => { offToken(); offDone(); offError(); };
  }, []); // eslint-disable-line

  // External AI providers init
  React.useEffect(() => {
    if (!isElectron) return;
    window.electronAPI.aiGetProviders().then(data => {
      setAiProviders(data.providers || []);
      setActiveProvider(data.activeProvider);
      setProviderEnabled(data.enabled);
      setSelectedModel(data.activeModel || '');
      if (data.activeProvider === 'openrouter' && data.enabled) {
        window.electronAPI.aiGetOpenRouterModels().then(res => {
          if (res.success && res.models) {
            setOpenRouterModels(res.models);
            if (!data.activeModel || !res.models.find(m => m.id === data.activeModel)) {
              setSelectedModel(res.models[0]?.id || '');
            }
          }
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []); // eslint-disable-line

  // Закрыть панель при смене вкладки
  React.useEffect(() => {
    if (panel !== null) closePanel();
  }, [activeTab?.id]); // eslint-disable-line

  // Force-open AI panel от выделения текста
  React.useEffect(() => {
    if (forceOpenAiPanel && panel !== 'ai') {
      togglePanel('ai');
      onPanelOpened?.();
    } else if (forceOpenAiPanel) {
      onPanelOpened?.();
    }
  }, [forceOpenAiPanel]); // eslint-disable-line

  // Обработать запрос выделения
  React.useEffect(() => {
    if (!selectionRequest || (!aiLoaded && !providerEnabled) || aiLoading) return;
    const { text, label, prompt, promptType } = selectionRequest;
    onSelectionHandled?.();
    analyzeSelectionWith(text, label, prompt, promptType);
  }, [selectionRequest, aiLoaded, providerEnabled]); // eslint-disable-line

  const closePanel = React.useCallback(async () => {
    clearTimeout(panelCloseTimer.current);
    setPanelClosing(true);
    panelCloseTimer.current = setTimeout(() => {
      setPanel(null);
      setPanelClosing(false);
    }, 180);
    if (isElectron) await window.electronAPI.sidebarPanelToggled(false);
    onPanelChange?.(false);
  }, [onPanelChange]);

  const togglePanel = React.useCallback(async (id) => {
    clearTimeout(panelCloseTimer.current);
    if (panel === id) {
      closePanel();
      return;
    }
    // Открываем другую панель: сначала resize BrowserView
    if (isElectron) await window.electronAPI.sidebarPanelToggled(true);
    onPanelChange?.(true);
    if (id === 'history') {
      try { setHistItems(JSON.parse(localStorage.getItem('intra-history') || '[]').slice(0, 100)); } catch { setHistItems([]); }
    }
    setPanelClosing(false);
    setPanel(id);
  }, [panel, closePanel, onPanelChange]);

  const handleLoadModel = async () => {
    if (!isElectron) return;
    const result = await window.electronAPI.showOpenDialog({
      title: 'Выберите GGUF модель',
      filters: [{ name: 'GGUF Models', extensions: ['gguf'] }, { name: 'All Files', extensions: ['*'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths?.length) return;
    const modelPath = result.filePaths[0];
    const modelName = modelPath.replace(/\\/g, '/').split('/').pop();
    setAiLoading(true);
    setAiLoaded(false);
    setAiLoadProgress(0);
    setAiChat([{ role: 'bot', text: `Запуск llama-server с моделью ${modelName}...\nЭто может занять несколько минут.`, isServerLog: true }]);
    let prog = 0;
    aiLoadTimerRef.current = setInterval(() => {
      prog = Math.min(88, prog + (88 - prog) * 0.04 + 0.5);
      setAiLoadProgress(Math.floor(prog));
    }, 400);
    const serverPath = localStorage.getItem('intra-llama-server') || null;
    let res;
    try { res = await window.electronAPI.aiLoadModel(modelPath, serverPath, aiContextSize); }
    catch (err) { res = { success: false, error: err.message }; }
    clearInterval(aiLoadTimerRef.current);
    if (res.success) {
      setAiLoadProgress(100);
      setTimeout(() => setAiLoadProgress(null), 900);
      const model = { name: modelName, path: modelPath };
      setAiModel(model);
      setAiLoaded(true);
      localStorage.setItem('intra-ai-model', JSON.stringify(model));
      setAiChat([{ role: 'bot', text: `Модель "${modelName}" загружена. Задайте вопрос!` }]);
    } else {
      setAiLoadProgress(null);
      setAiLoaded(false);
      setAiChat(prev => [...prev, { role: 'bot', text: `❌ Ошибка: ${res.error}` }]);
    }
    setAiLoading(false);
  };

  const sendAiMessage = () => {
    if (!aiInput.trim() || (!aiLoaded && !providerEnabled) || aiLoading) return;
    const text = aiInput.trim();
    setAiInput('');
    setAiStreamedTokens(0);
    setAiChat(prev => [...prev, { role: 'user', text }]);
    setAiLoading(true);
    if (!aiLoaded && providerEnabled) {
      setAiProcessingStatus('Обработка запроса...');
      window.electronAPI.aiChatWithProvider(text, selectedModel)
        .then(result => { setAiLoading(false); setAiProcessingStatus(''); if (!result?.success && result?.error) setAiChat(prev => [...prev, { role: 'bot', text: `❌ ${result.error}` }]); })
        .catch(() => { setAiLoading(false); setAiProcessingStatus(''); });
      return;
    }
    window.electronAPI.aiChat(text).then(result => {
      setAiLoading(false);
      if (!result?.success && result?.error) setAiChat(prev => [...prev, { role: 'bot', text: `❌ ${result.error}` }]);
    }).catch(() => { setAiLoading(false); });
  };

  const analyzePageWith = async (label, prompt) => {
    if ((!aiLoaded && !providerEnabled) || aiLoading || !isElectron) return;
    setAiProcessingStatus('Чтение страницы...');
    const res = await window.electronAPI.aiGetPageContent();
    if (!res.success) { setAiProcessingStatus(''); setAiChat(prev => [...prev, { role: 'bot', text: `❌ ${res.error}` }]); return; }
    const content = res.content.slice(0, 1500);
    const fullPrompt = `${prompt}\n\nСтраница: "${res.title}"\n\nФрагмент текста:\n${content}\n\nОтвет:`;
    setAiChat(prev => [...prev, { role: 'user', text: label }]);
    setAiLoading(true);
    if (!aiLoaded && providerEnabled) {
      setAiProcessingStatus('Анализ страницы ИИ...');
      window.electronAPI.aiChatWithProvider(fullPrompt, selectedModel)
        .then(result => { setAiLoading(false); setAiProcessingStatus(''); if (!result?.success) setAiChat(prev => [...prev, { role: 'bot', text: `❌ ${result?.error || 'Нет ответа'}` }]); })
        .catch(() => { setAiLoading(false); setAiProcessingStatus(''); });
      return;
    }
    window.electronAPI.aiAnalyzePage(fullPrompt)
      .then(result => { setAiLoading(false); if (!result?.success) setAiChat(prev => [...prev, { role: 'bot', text: `❌ ${result?.error || 'Нет ответа'}` }]); })
      .catch(() => { setAiLoading(false); });
  };

  const analyzeSelectionWith = async (text, label, prompt, promptType) => {
    if ((!aiLoaded && !providerEnabled) || aiLoading || !isElectron) return;
    setAiChat(prev => [...prev, { role: 'user', text: `${label}:\n"${text.slice(0, 200)}${text.length > 200 ? '…' : ''}"` }]);
    setAiLoading(true);
    if (!aiLoaded && providerEnabled) {
      if (promptType === 'search') {
        try {
          setAiProcessingStatus('Поиск в интернете...');
          let searchResult = await window.electronAPI.aiWebSearch(text);
          if (!searchResult.success) searchResult = await window.electronAPI.aiWebSearchBing(text);
          if (!searchResult.success) {
            setAiLoading(false); setAiProcessingStatus('');
            setAiChat(prev => [...prev, { role: 'bot', text: `❌ ${searchResult.error || 'Ошибка поиска'}` }]);
            return;
          }
          setAiProcessingStatus('Обработка результатов ИИ...');
          const searchPrompt = `На основе результатов веб-поиска по запросу "${text}", ответь и укажи источники.\n\nРезультаты:\n${searchResult.results}\n\nИсточники: ${(searchResult.urls || []).join(', ')}`;
          window.electronAPI.aiChatWithProvider(searchPrompt, selectedModel)
            .then(result => { setAiLoading(false); setAiProcessingStatus(''); if (!result?.success) setAiChat(prev => [...prev, { role: 'bot', text: result?.error || 'Нет ответа от API' }]); })
            .catch(() => { setAiLoading(false); setAiProcessingStatus(''); });
          return;
        } catch { setAiLoading(false); setAiProcessingStatus(''); return; }
      }
      setAiProcessingStatus('Анализ текста...');
      const fullPrompt = `${prompt}\n\nТекст:\n"${text.slice(0, 3000)}${text.length > 3000 ? '...' : ''}"`;
      window.electronAPI.aiChatWithProvider(fullPrompt, selectedModel)
        .then(result => { setAiLoading(false); setAiProcessingStatus(''); if (!result?.success) setAiChat(prev => [...prev, { role: 'bot', text: result?.error || 'Нет ответа' }]); })
        .catch(() => { setAiLoading(false); setAiProcessingStatus(''); });
      return;
    }
    window.electronAPI.aiAnalyzeSelection(text, prompt)
      .then(result => { setAiLoading(false); if (!result?.success) setAiChat(prev => [...prev, { role: 'bot', text: result?.error || 'Нет ответа' }]); })
      .catch(() => { setAiLoading(false); });
  };

  // Вычисляемые AI значения
  const aiEstimatedTokens = aiChat.filter(m => !m.isServerLog).reduce((s, m) => s + Math.ceil((m.text || '').length / 4), 0);
  const aiContextUsedPct = aiLoaded && aiContextSize > 0 ? Math.min(100, Math.round(aiEstimatedTokens / aiContextSize * 100)) : 0;
  const aiLastBotMsg = [...aiChat].reverse().find(m => m.role === 'bot' && !m.isServerLog && !m.streaming);

  const isPanelVisible = panel !== null || panelClosing;

  return (
    <>
      {/* Боковая панель иконок */}
      <div style={{
        width: 56, display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '12px 5px', background: 'rgba(255,255,255,0.95)',
        borderRight: '1px solid #e2e8f0', flexShrink: 0, zIndex: 200, height: '100%',
        position: 'relative',
      }}>
        {/* Лого */}
        <div style={{
          marginBottom: 16, padding: 6, borderRadius: 10, background: 'white',
          cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.12)',
          border: '1px solid #e2e8f0', transition: 'transform 0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.07)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          onClick={onGoHome}
        >
          <GlobeIcon />
        </div>

        <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {['bookmarks','history','downloads'].map(id => (
            <SBtn key={id} id={id} panel={panel} title={PANEL_META[id].title}
              icon={<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">{id === 'bookmarks' && <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>}{id === 'history' && <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>}{id === 'downloads' && <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>}</svg>}
              onToggle={togglePanel}
            />
          ))}
          {/* Интрасеть */}
          <SBtn id="intranet" panel={panel} title="Интрасеть"
            icon={
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <circle cx="12" cy="5"  r="2.5"/>
                <circle cx="5"  cy="19" r="2.5"/>
                <circle cx="19" cy="19" r="2.5"/>
                <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>
                <line x1="12" y1="7.5" x2="12" y2="10" strokeLinecap="round"/>
                <line x1="12" y1="10" x2="6.8" y2="16.8" strokeLinecap="round"/>
                <line x1="12" y1="10" x2="17.2" y2="16.8" strokeLinecap="round"/>
                <line x1="7.5" y1="19" x2="16.5" y2="19" strokeLinecap="round"/>
              </svg>
            }
            onToggle={togglePanel}
          />
          <div style={{ height: 1, background: '#e2e8f0', margin: '4px 6px' }} />
          <SBtn id="ai" panel={panel} title="AI Модель"
            icon={<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>}
            onToggle={togglePanel}
          />
          {/* AI Чат */}
          <div style={{ position: 'relative', width: '100%' }}>
            <button
              onClick={onOpenAiChat}
              onMouseEnter={() => setHovAiChat(true)}
              onMouseLeave={() => setHovAiChat(false)}
              title="AI Чат"
              style={{
                width: '100%', height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 9, border: 'none', cursor: 'pointer',
                background: hovAiChat ? '#f0fdf4' : 'transparent',
                color: hovAiChat ? '#16a34a' : '#64748b',
                borderLeft: '3px solid transparent',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
              </svg>
            </button>
            {hovAiChat && (
              <div style={{
                position: 'absolute', left: '110%', top: '50%', transform: 'translateY(-50%)',
                background: '#0f172a', color: 'white', fontSize: 11, fontWeight: 500,
                padding: '4px 10px', borderRadius: 6, whiteSpace: 'nowrap', zIndex: 1000,
                pointerEvents: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              }}>AI Чат</div>
            )}
          </div>
        </div>

        <div style={{ width: '100%' }}>
          <SBtn id="settings" panel={panel} title="Настройки"
            icon={<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>}
            onToggle={togglePanel}
          />
        </div>
      </div>

      {/* Выдвижная панель */}
      {isPanelVisible && (
        <>
          <div
            style={{ position: 'fixed', top: 0, left: 56, bottom: 0, right: 0, zIndex: 300, background: 'rgba(0,0,0,0.12)', opacity: panelClosing ? 0 : 1, transition: 'opacity 0.18s' }}
            onClick={closePanel}
          />
          <div style={{
            position: 'fixed', top: 0, left: 56, bottom: 0, width: 320,
            background: 'white', boxShadow: '4px 0 20px rgba(0,0,0,0.1)',
            zIndex: 301, display: 'flex', flexDirection: 'column',
            animation: panelClosing ? 'sideSlideOut 0.18s ease forwards' : 'sideSlide 0.2s ease',
          }}>
            {/* Шапка панели — скрыта для Интрасети (у неё своя) */}
            {panel !== 'intranet' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  {panel && PANEL_META[panel]?.icon}
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{panel && PANEL_META[panel]?.title}</span>
                </div>
                <button onClick={closePanel} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s, color 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#1e293b'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', padding: panel === 'intranet' ? 0 : 14 }}>
              {/* ── Закладки ── */}
              {panel === 'bookmarks' && (
                <div>
                  <button onClick={() => setShowAddBm(v => !v)} style={{ width: '100%', padding: '7px 0', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>+ Добавить закладку</button>
                  {showAddBm && (
                    <div style={{ background: '#f8fafc', borderRadius: 9, padding: 10, marginBottom: 10, border: '1px solid #e2e8f0', animation: 'fadeIn 0.12s ease' }}>
                      <input value={newBm.title} onChange={e => setNewBm(v => ({ ...v, title: e.target.value }))} placeholder="Название" style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, outline: 'none', marginBottom: 5, boxSizing: 'border-box' }} />
                      <input value={newBm.url} onChange={e => setNewBm(v => ({ ...v, url: e.target.value }))} placeholder="URL (https://...)" style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, outline: 'none', marginBottom: 7, boxSizing: 'border-box' }} />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => {
                          const rawUrl = newBm.url.trim();
                          if (rawUrl) {
                            const finalUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
                            onBookmarksChange(prev => [...prev, { title: newBm.title.trim() || finalUrl, url: finalUrl }]);
                            setNewBm({ title: '', url: '' }); setShowAddBm(false);
                          }
                        }} style={{ flex: 1, padding: '5px 0', background: '#2563eb', color: 'white', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Сохранить</button>
                        <button onClick={() => setShowAddBm(false)} style={{ flex: 1, padding: '5px 0', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 7, fontSize: 11, cursor: 'pointer' }}>Отмена</button>
                      </div>
                    </div>
                  )}
                  {bookmarks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
                      <svg width="32" height="32" fill="none" stroke="#93c5fd" viewBox="0 0 24 24" strokeWidth="1.5" style={{ marginBottom: 8 }}><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
                      <div style={{ fontSize: 12 }}>Нет закладок. Добавьте первую!</div>
                    </div>
                  ) : bookmarks.map((bm, i) => (
                    <BookmarkItem key={i} bm={bm} onNavigate={url => { onNavigate(url); closePanel(); }} onDelete={() => onBookmarksChange(prev => prev.filter((_, j) => j !== i))} />
                  ))}
                </div>
              )}

              {/* ── История ── */}
              {panel === 'history' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>{histItems.length} записей</p>
                    {histItems.length > 0 && (
                      <button onClick={() => { localStorage.removeItem('intra-history'); localStorage.removeItem('intra-visits'); setHistItems([]); }} style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Очистить</button>
                    )}
                  </div>
                  {histItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
                      <svg width="32" height="32" fill="none" stroke="#93c5fd" viewBox="0 0 24 24" strokeWidth="1.5" style={{ marginBottom: 8 }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      <div style={{ fontSize: 12 }}>История пуста</div>
                    </div>
                  ) : histItems.map((item, i) => (
                    <HistoryItem key={i} item={item} onNavigate={url => { onNavigate(url); closePanel(); }} />
                  ))}
                </div>
              )}

              {/* ── Интрасеть ── */}
              {panel === 'intranet' && (
                <div style={{ height: '100%', overflow: 'auto', margin: -14, padding: 0 }}>
                  <IntranetPanel
                    onClose={closePanel}
                    onNavigate={(url) => { onNavigate(url); closePanel(); }}
                  />
                </div>
              )}

              {/* ── Загрузки ── */}
              {panel === 'downloads' && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
                  {downloads.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                      <svg width="36" height="36" fill="none" stroke="#93c5fd" viewBox="0 0 24 24" strokeWidth="1.5" style={{ marginBottom: 10 }}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>Нет загрузок</div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Загрузки ({downloads.length})</span>
                        <button onClick={onClearDownloads} style={{ fontSize: 10, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>Очистить</button>
                      </div>
                      {downloads.map(dl => <DownloadItem key={dl.id} dl={dl} onRemove={onRemoveDownload} />)}
                    </>
                  )}
                </div>
              )}

              {/* ── AI Модель ── */}
              {panel === 'ai' && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
                  {providerEnabled && !aiLoaded && activeProvider === 'openrouter' && openRouterModels.length > 0 && (
                    <div style={{ padding: 12, borderRadius: 10, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', marginBottom: 4 }}>OpenRouter</div>
                      <select value={selectedModel} onChange={e => { setSelectedModel(e.target.value); window.electronAPI.aiSetModel(e.target.value); }}
                        style={{ width: '100%', fontSize: 11, padding: '5px 8px', borderRadius: 6, border: '1px solid #7dd3fc', background: 'white', cursor: 'pointer', marginBottom: 4 }}>
                        {openRouterModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      <div style={{ fontSize: 10, color: '#22c55e' }}>✓ Подключено через API</div>
                    </div>
                  )}
                  {providerEnabled && !aiLoaded && activeProvider !== 'openrouter' && (
                    <div style={{ padding: 12, borderRadius: 10, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', marginBottom: 4 }}>
                        {activeProvider === 'openai' ? 'OpenAI' : activeProvider === 'anthropic' ? 'Anthropic' : activeProvider === 'google' ? 'Google Gemini' : 'AI Provider'}
                      </div>
                      <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Модель: <span style={{ color: '#0369a1', fontWeight: 600 }}>{selectedModel || 'Не выбрана'}</span></div>
                      <div style={{ fontSize: 10, color: '#22c55e' }}>✓ Подключено через API</div>
                    </div>
                  )}
                  <div style={{ padding: 12, borderRadius: 10, background: aiLoaded ? '#f0fdf4' : '#f8fafc', border: `1px solid ${aiLoaded ? '#bbf7d0' : '#e2e8f0'}`, transition: 'background 0.3s, border-color 0.3s' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: aiLoaded ? '#166534' : '#64748b', marginBottom: 4 }}>
                      {aiLoaded ? aiModel?.name : aiLoading ? 'Загрузка...' : 'Модель не выбрана'}
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 8, lineHeight: 1.5 }}>
                      Нужен <b>llama-server.exe</b> из релизов <a href="#" onClick={e => { e.preventDefault(); window.electronAPI?.openExternal('https://github.com/ggml-org/llama.cpp/releases'); }} style={{ color: '#2563eb' }}>llama.cpp</a>. Модели формата <b>.gguf</b>.
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <label style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>Контекст:</label>
                      <select value={aiContextSize} onChange={e => { const v = Number(e.target.value); setAiContextSize(v); localStorage.setItem('intra-ai-context', String(v)); }}
                        style={{ flex: 1, fontSize: 10, padding: '3px 6px', borderRadius: 5, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}>
                        {[2048,4096,8192,16384,32768].map(v => <option key={v} value={v}>{v.toLocaleString()} токенов{v === 4096 ? ' (по умолч.)' : ''}</option>)}
                      </select>
                    </div>
                    <button onClick={handleLoadModel} disabled={aiLoading} style={{ width: '100%', padding: '7px 0', background: aiLoading ? '#e2e8f0' : '#2563eb', color: aiLoading ? '#94a3b8' : 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: aiLoading ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}>
                      {aiLoading ? 'Загрузка модели...' : aiModel ? 'Сменить модель (.gguf)' : 'Выбрать модель (.gguf)'}
                    </button>
                  </div>

                  {/* Прогресс-бар */}
                  {aiLoading && !aiLoaded && aiLoadProgress !== null ? (
                    <div style={{ borderRadius: 8, padding: '10px 12px', background: '#eff6ff', border: '1px solid #dbeafe' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 11, color: '#2563eb', fontWeight: 600 }}>Загрузка модели...</span>
                        <span style={{ fontSize: 11, color: '#2563eb', fontWeight: 700 }}>{aiLoadProgress}%</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: '#dbeafe', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${aiLoadProgress}%`, background: '#2563eb', borderRadius: 3, transition: 'width 0.4s ease' }} />
                      </div>
                    </div>
                  ) : aiLoaded ? (
                    <div style={{ borderRadius: 8, padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 11, color: '#64748b' }}>Использование контекста</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: aiContextUsedPct > 85 ? '#ef4444' : aiContextUsedPct > 60 ? '#f59e0b' : '#64748b' }}>{aiContextUsedPct}%</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: '#e2e8f0', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${aiContextUsedPct}%`, background: aiContextUsedPct > 85 ? '#ef4444' : aiContextUsedPct > 60 ? '#f59e0b' : '#22c55e', borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                      {aiContextUsedPct > 85 && <div style={{ fontSize: 10, color: '#ef4444', marginTop: 4 }}>Контекст почти заполнен — очистите чат.</div>}
                    </div>
                  ) : null}

                  {(aiLoaded || providerEnabled) && activeTab && !activeTab.isHome && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>Действия со страницей:</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {[['Резюмировать','Сделай краткое резюме этой страницы на русском языке.'],['Тезисы','Выдели ключевые тезисы и факты этой страницы в виде списка.'],['Объяснить','Объясни простыми словами, о чём эта страница.'],['Перевести','Переведи содержимое страницы на русский язык.'],['Сократить','Сократи и сделай краткое изложение основных мыслей.'],['Расширить','Добавь больше деталей и контекста к содержанию страницы.']].map(([label, prompt]) => (
                          <button key={label} onClick={() => analyzePageWith(label, prompt)} disabled={aiLoading}
                            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#2563eb', fontSize: 10, fontWeight: 600, cursor: aiLoading ? 'not-allowed' : 'pointer', opacity: aiLoading ? 0.5 : 1, transition: 'opacity 0.15s' }}>{label}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                      {[{id:false,label:'Текущий чат'},{id:true,label:`История${aiChatHistory.length > 0 ? ` (${aiChatHistory.length})` : ''}`}].map(({id,label}) => (
                        <button key={String(id)} onClick={() => setAiShowHistory(id)}
                          style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: 'none', fontSize: 10, fontWeight: 600, background: aiShowHistory === id ? '#2563eb' : '#e2e8f0', color: aiShowHistory === id ? 'white' : '#64748b', cursor: 'pointer', transition: 'background 0.15s, color 0.15s' }}>{label}</button>
                      ))}
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8, minHeight: 80 }}>
                      {aiShowHistory ? (
                        aiChatHistory.length === 0
                          ? <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: 12 }}>История чатов пуста</div>
                          : aiChatHistory.map(conv => (
                            <div key={conv.id} onClick={() => { setAiChat(conv.messages); setAiShowHistory(false); }}
                              style={{ padding: '8px 10px', borderRadius: 9, fontSize: 11, cursor: 'pointer', background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: 4, transition: 'background 0.15s' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                              onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                            >
                              <div style={{ color: '#64748b', marginBottom: 4, fontSize: 10 }}>{new Date(conv.timestamp).toLocaleString('ru-RU')}</div>
                              <div style={{ color: '#374151' }}>{conv.messages[0]?.text?.slice(0, 100)}{conv.messages[0]?.text?.length > 100 ? '...' : ''}</div>
                              <div style={{ color: '#94a3b8', marginTop: 4, fontSize: 10 }}>{conv.messages.length} сообщений</div>
                            </div>
                          ))
                      ) : (
                        <>
                          {aiChat.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: 12 }}>
                              {(aiModel || providerEnabled) ? 'Задайте вопрос модели...' : 'Выберите файл .gguf для чата'}
                            </div>
                          )}
                          {aiChat.map((msg, i) => (
                            <div key={i} style={{
                              padding: '8px 10px', borderRadius: 9, fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                              background: msg.role === 'user' ? '#eff6ff' : '#f8fafc',
                              color: msg.role === 'user' ? '#1e40af' : '#374151',
                              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%',
                              animation: 'fadeUp 0.2s ease',
                            }}>{msg.text}</div>
                          ))}
                          {aiLoading && <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', padding: '4px 10px' }}>Генерация...</div>}
                        </>
                      )}
                      <div ref={aiChatEndRef} />
                    </div>

                    {aiLoading && (aiLoaded || providerEnabled) && (
                      <div style={{ borderRadius: 7, padding: '7px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: '#64748b' }}>{aiStreamedTokens === 0 ? (aiProcessingStatus || 'Ожидание ответа...') : `Генерация... ${aiStreamedTokens} токенов`}</span>
                          {aiStreamedTokens > 0 && <span style={{ fontSize: 11, color: '#2563eb', fontWeight: 600 }}>{Math.min(Math.round(aiStreamedTokens / 10.24), 95)}%</span>}
                        </div>
                        <div style={{ height: 4, borderRadius: 2, background: '#e2e8f0', overflow: 'hidden', position: 'relative' }}>
                          {aiStreamedTokens === 0
                            ? <div className="ai-indeterminate" style={{ position: 'absolute', top: 0, height: '100%', width: '30%', borderRadius: 2, background: '#2563eb' }} />
                            : <div style={{ height: '100%', width: `${Math.min(aiStreamedTokens / 10.24, 95)}%`, background: '#2563eb', borderRadius: 2, transition: 'width 0.15s' }} />
                          }
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                      <input value={aiInput} onChange={e => setAiInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) sendAiMessage(); }}
                        placeholder={(aiLoaded || providerEnabled) ? 'Введите сообщение...' : 'Загрузите модель...'}
                        disabled={(!aiLoaded && !providerEnabled) || aiLoading}
                        style={{ flex: 1, padding: '6px 9px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 12, outline: 'none', transition: 'border-color 0.15s' }}
                        onFocus={e => e.target.style.borderColor = '#3b82f6'}
                        onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                      />
                      <button onClick={sendAiMessage}
                        disabled={(!aiLoaded && !providerEnabled) || !aiInput.trim() || aiLoading}
                        title="Отправить"
                        style={{ width: 32, height: 32, borderRadius: 7, border: 'none', background: (aiLoaded || providerEnabled) && aiInput.trim() && !aiLoading ? '#2563eb' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: (aiLoaded || providerEnabled) && aiInput.trim() && !aiLoading ? 'pointer' : 'not-allowed', flexShrink: 0, transition: 'background 0.2s' }}>
                        <svg width="12" height="12" fill="none" stroke={(aiLoaded || providerEnabled) && aiInput.trim() && !aiLoading ? 'white' : '#94a3b8'} viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                      </button>
                      {aiLastBotMsg && (
                        <button title="Скопировать ответ" onClick={() => navigator.clipboard.writeText(aiLastBotMsg.text)}
                          style={{ width: 32, height: 32, borderRadius: 7, border: 'none', background: '#f1f5f9', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                        </button>
                      )}
                      {aiChat.length > 0 && (
                        <button title="Новый чат" onClick={() => {
                          const userMessages = aiChat.filter(m => m.role === 'user');
                          if (userMessages.length > 0) {
                            const conv = { id: Date.now(), timestamp: new Date().toISOString(), messages: aiChat.filter(m => !m.isServerLog), source: 'sidebar' };
                            setAiChatHistory(hist => { const next = [conv, ...hist].slice(0, 50); localStorage.setItem('intra-ai-chat-history', JSON.stringify(next)); return next; });
                          }
                          setAiChat([]);
                          window.electronAPI?.aiClearHistory?.();
                        }} style={{ width: 32, height: 32, borderRadius: 7, border: 'none', background: '#f1f5f9', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                        </button>
                      )}
                      {aiLoaded && (
                        <button title="Выгрузить модель" onClick={async () => { await window.electronAPI.aiUnloadModel(); setAiModel(null); setAiLoaded(false); setAiChat([]); setAiLoadProgress(null); localStorage.removeItem('intra-ai-model'); }}
                          style={{ width: 32, height: 32, borderRadius: 7, border: 'none', background: '#fff0f0', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 11-12.728 0M12 3v9"/></svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Настройки ── */}
              {panel === 'settings' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <SettingSection title="Поисковая система">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {[{id:'yandex',label:'Яндекс',abbr:'Я'},{id:'google',label:'Google',abbr:'G'},{id:'duckduckgo',label:'DuckDuckGo',abbr:'D'},{id:'bing',label:'Bing',abbr:'B'}].map(e => (
                        <button key={e.id} onClick={() => onSearchEngineChange(e.id)} style={{
                          display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px',
                          borderRadius: 8, border: `1.5px solid ${searchEngine === e.id ? '#2563eb' : '#e2e8f0'}`,
                          background: searchEngine === e.id ? '#eff6ff' : 'white', cursor: 'pointer', fontSize: 12,
                          fontWeight: searchEngine === e.id ? 700 : 500, color: searchEngine === e.id ? '#2563eb' : '#475569', transition: 'all 0.15s',
                        }}>
                          <span style={{ width: 18, height: 18, borderRadius: 5, background: searchEngine === e.id ? '#2563eb' : '#e2e8f0', color: searchEngine === e.id ? 'white' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{e.abbr}</span>{e.label}
                        </button>
                      ))}
                    </div>
                  </SettingSection>

                  <SettingSection title="Новая вкладка">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {[{id:'home',label:'Домашняя страница',desc:'Открывать Dashboard'},{id:'blank',label:'Пустая страница',desc:'Минималистичный старт'}].map(opt => (
                        <button key={opt.id} onClick={() => { localStorage.setItem('intra-newtab', opt.id); setNewTabMode(opt.id); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${newTabMode === opt.id ? '#2563eb' : '#e2e8f0'}`, background: newTabMode === opt.id ? '#eff6ff' : 'white', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                          <div style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, border: `2px solid ${newTabMode === opt.id ? '#2563eb' : '#cbd5e1'}`, background: newTabMode === opt.id ? '#2563eb' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                            {newTabMode === opt.id && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />}
                          </div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: newTabMode === opt.id ? '#2563eb' : '#1e293b' }}>{opt.label}</div>
                            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{opt.desc}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </SettingSection>

                  <SettingSection title="Приватность и данные">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {[
                        {label:'Очистить историю посещений', icon:'clock', action: () => { localStorage.removeItem('intra-history'); localStorage.removeItem('intra-visits'); }},
                        {label:'Очистить все закладки', icon:'bookmark', action: () => onBookmarksChange([])},
                        {label:'Сбросить все данные браузера', icon:'trash', action: () => { Object.keys(localStorage).filter(k => k.startsWith('intra-')).forEach(k => localStorage.removeItem(k)); onBookmarksChange([]); onSearchEngineChange?.('yandex'); setUiSettings({animations:true,compact:false}); applyUiPrefs({animations:true,compact:false}); }, bold: true},
                      ].map(({label, action, bold}) => (
                        <button key={label} onClick={action} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff5f5', cursor: 'pointer', color: '#dc2626', fontSize: 12, fontWeight: bold ? 700 : 600, transition: 'background 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
                          onMouseLeave={e => e.currentTarget.style.background = '#fff5f5'}
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          {label}
                        </button>
                      ))}
                    </div>
                  </SettingSection>

                  <SettingSection title="Интерфейс">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {[{key:'animations',label:'Анимации интерфейса',desc:'Плавные переходы и эффекты'},{key:'compact',label:'Компактный режим',desc:'Уменьшить отступы в панелях'}].map(opt => {
                        const val = uiSettings[opt.key];
                        return (
                          <div key={opt.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white' }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{opt.label}</div>
                              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{opt.desc}</div>
                            </div>
                            <button onClick={() => toggleUiSetting(opt.key)} style={{ width: 38, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', flexShrink: 0, position: 'relative', background: val ? '#2563eb' : '#e2e8f0', transition: 'background 0.2s' }}>
                              <div style={{ position: 'absolute', top: 3, left: val ? 18 : 3, width: 16, height: 16, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </SettingSection>

                  <SettingSection title="О браузере">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {[['Версия','1.2.3'],['Движок','Intra Browser'],['Сборка','Vite 5'],['Автор','Krasoft Labs']].map(([k,v]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 12px', borderRadius: 7, background: '#f8fafc' }}>
                          <span style={{ fontSize: 12, color: '#64748b' }}>{k}</span>
                          <span style={{ fontSize: 12, color: '#1e293b', fontFamily: 'monospace', fontWeight: 600 }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </SettingSection>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function SettingSection({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function BookmarkItem({ bm, onNavigate, onDelete }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 9, cursor: 'pointer', marginBottom: 3, transition: 'background 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ width: 26, height: 26, borderRadius: 6, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {bm.favicon ? <img src={bm.favicon} width={14} height={14} onError={e => e.target.style.display = 'none'} /> : <svg width="12" height="12" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>}
      </div>
      <div onClick={() => onNavigate(bm.url)} style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bm.title}</div>
        <div style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bm.url}</div>
      </div>
      <button onClick={onDelete} style={{ border: 'none', background: '#fee2e2', borderRadius: 6, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444', flexShrink: 0, transition: 'background 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.background = '#fca5a5'}
        onMouseLeave={e => e.currentTarget.style.background = '#fee2e2'}
      >
        <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
  );
}

function HistoryItem({ item, onNavigate }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 9, cursor: 'pointer', marginBottom: 3, transition: 'background 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      onClick={() => onNavigate(item.url)}
    >
      <div style={{ width: 24, height: 24, borderRadius: 6, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {item.favicon ? <img src={item.favicon} width={12} height={12} onError={e => e.target.style.display = 'none'} /> : <svg width="10" height="10" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title || item.url}</div>
        <div style={{ fontSize: 10, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.timestamp ? new Date(item.timestamp).toLocaleString('ru', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''} · {item.url}
        </div>
      </div>
    </div>
  );
}

function DownloadItem({ dl, onRemove }) {
  const pct = dl.totalBytes > 0 ? Math.round(dl.receivedBytes / dl.totalBytes * 100) : 0;
  const isDone = dl.state === 'completed';
  const isError = dl.state === 'interrupted' || dl.state === 'cancelled';
  return (
    <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <svg width="16" height="16" fill="none" stroke={isDone ? '#22c55e' : isError ? '#ef4444' : '#2563eb'} viewBox="0 0 24 24" strokeWidth="1.5">
          {isDone ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/> : isError ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/> : <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>}
        </svg>
        <span style={{ flex: 1, fontSize: 11, fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dl.filename}</span>
        {isDone && <span style={{ fontSize: 10, color: '#22c55e' }}>Готово</span>}
        {isError && <span style={{ fontSize: 10, color: '#ef4444' }}>{dl.state === 'cancelled' ? 'Отменено' : 'Ошибка'}</span>}
      </div>
      {!isDone && !isError && (
        <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: '#2563eb', transition: 'width 0.3s' }} />
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: '#94a3b8' }}>{dl.totalBytes > 0 ? `${(dl.receivedBytes/1024/1024).toFixed(1)} / ${(dl.totalBytes/1024/1024).toFixed(1)} МБ` : 'Загрузка...'}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {isDone && (
            <button onClick={() => window.electronAPI?.showInFolder(dl.id)} title="Открыть папку" style={{ padding: '2px 6px', fontSize: 10, color: '#64748b', background: '#f1f5f9', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <svg width="12" height="12" fill="none" stroke="#64748b" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
            </button>
          )}
          <button onClick={() => onRemove?.(dl.id)} title="Удалить" style={{ padding: '2px 6px', fontSize: 10, color: '#64748b', background: '#f1f5f9', border: 'none', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <svg width="12" height="12" fill="none" stroke="#64748b" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
