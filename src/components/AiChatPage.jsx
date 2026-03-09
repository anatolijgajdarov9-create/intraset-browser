import React, { useState, useEffect, useRef } from 'react';

const isElectron = typeof window.electronAPI !== 'undefined';

// Simple inline markdown renderer: **bold**, `code`, ```blocks```, line breaks
function MessageText({ text }) {
  const parts = [];
  let key = 0;
  const codeBlockRegex = /```([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<InlineText key={key++} text={text.slice(lastIndex, match.index)} />);
    }
    parts.push(
      <pre key={key++} style={{
        background: '#1e293b', color: '#e2e8f0', padding: '10px 14px',
        borderRadius: 8, fontSize: 12, fontFamily: 'JetBrains Mono, Consolas, monospace',
        overflowX: 'auto', margin: '6px 0', lineHeight: 1.6
      }}>
        <code>{match[1].trim()}</code>
      </pre>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(<InlineText key={key++} text={text.slice(lastIndex)} />);
  }
  return <>{parts}</>;
}

function InlineText({ text }) {
  const segments = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.startsWith('**') && seg.endsWith('**') && seg.length > 4)
          return <strong key={i}>{seg.slice(2, -2)}</strong>;
        if (seg.startsWith('`') && seg.endsWith('`') && seg.length > 2)
          return (
            <code key={i} style={{
              background: '#f1f5f9', padding: '1px 6px', borderRadius: 4,
              fontFamily: 'JetBrains Mono, Consolas, monospace', fontSize: '0.88em', color: '#1e40af'
            }}>{seg.slice(1, -1)}</code>
          );
        return seg.split('\n').map((line, j, arr) => (
          <React.Fragment key={`${i}-${j}`}>
            {line}{j < arr.length - 1 && <br />}
          </React.Fragment>
        ));
      })}
    </>
  );
}

// ── Stage icons by type ───────────────────────────────────────────────────────
const STAGE_ICONS = {
  think: (color) => (
    <svg width="14" height="14" fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
    </svg>
  ),
  search: (color) => (
    <svg width="13" height="13" fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2.5">
      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
    </svg>
  ),
  read: (color) => (
    <svg width="13" height="13" fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
    </svg>
  ),
  generate: (color) => (
    <svg width="13" height="13" fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
    </svg>
  ),
  model: (color) => (
    <svg width="12" height="12" fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2">
      <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M16.95 16.95l1.41 1.41M5.05 16.95l-1.41 1.41"/>
    </svg>
  ),
  synthesize: (color) => (
    <svg width="13" height="13" fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7"/>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l3 3 3-3"/>
    </svg>
  ),
};

function ProcessingPipeline({ stages, visible, onToggle }) {
  if (!stages.length) return null;
  const activeStage = stages.find(s => s.status === 'active');
  const allDone = stages.every(s => s.status === 'done');

  return (
    <div style={{
      borderBottom: '1px solid #e2e8f0', background: allDone ? '#f0fdf4' : '#f8fafc',
      padding: '10px 20px 12px', flexShrink: 0, transition: 'background 0.4s'
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: visible ? 12 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!allDone && activeStage && (
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              border: '2px solid #2563eb', borderTopColor: 'transparent',
              animation: 'aiSearchSpin 0.7s linear infinite', flexShrink: 0
            }}/>
          )}
          {allDone && (
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }}/>
          )}
          <span style={{ fontSize: 11, fontWeight: 700, color: allDone ? '#15803d' : '#475569' }}>
            {allDone
              ? 'Обработка завершена'
              : activeStage
                ? `${activeStage.label}...`
                : 'Подготовка...'
            }
          </span>
        </div>
        <button
          onClick={onToggle}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 8px',
            fontSize: 10, color: '#94a3b8', fontWeight: 600, borderRadius: 5,
            display: 'flex', alignItems: 'center', gap: 4
          }}
        >
          {visible ? '▲ скрыть' : '▼ показать'}
        </button>
      </div>

      {/* Stages row */}
      {visible && (
        <div style={{ display: 'flex', alignItems: 'flex-start', overflowX: 'auto', paddingBottom: 2 }}>
          {stages.map((stage, si) => {
            const isDone = stage.status === 'done';
            const isActive = stage.status === 'active';
            const isPending = stage.status === 'pending';
            const circleColor = isDone ? '#22c55e' : isActive ? '#2563eb' : '#e2e8f0';
            const iconColor = isDone ? 'white' : isActive ? 'white' : '#cbd5e1';
            const labelColor = isDone ? '#16a34a' : isActive ? '#2563eb' : '#94a3b8';

            return (
              <React.Fragment key={stage.id}>
                {/* Stage node */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 72, flex: 1, maxWidth: 110 }}>
                  {/* Circle */}
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                    background: circleColor,
                    border: isActive ? '3px solid #93c5fd' : isDone ? '3px solid #86efac' : '3px solid #e2e8f0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: isActive ? 'pipelinePulse 1.8s ease-in-out infinite' : 'none',
                    transition: 'all 0.35s ease',
                    position: 'relative', boxSizing: 'border-box',
                  }}>
                    {isDone ? (
                      <svg width="16" height="16" fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                    ) : isActive ? (
                      <div style={{ width: 13, height: 13, borderRadius: '50%', border: '2.5px solid white', borderTopColor: 'transparent', animation: 'aiSearchSpin 0.75s linear infinite' }}/>
                    ) : (
                      (STAGE_ICONS[stage.type] || STAGE_ICONS.generate)(iconColor)
                    )}
                  </div>

                  {/* Label */}
                  <div style={{
                    marginTop: 6, fontSize: 10, fontWeight: 600, color: labelColor,
                    textAlign: 'center', lineHeight: 1.3, maxWidth: 80, wordBreak: 'break-word'
                  }}>
                    {stage.label}
                  </div>

                  {/* Active progress bar */}
                  {isActive && (
                    <div style={{ width: 52, height: 3, background: '#dbeafe', borderRadius: 2, marginTop: 5, overflow: 'hidden', position: 'relative' }}>
                      <div className="ai-indeterminate" style={{
                        position: 'absolute', top: 0, height: '100%', width: '45%',
                        background: 'linear-gradient(90deg,transparent,#2563eb,transparent)',
                        borderRadius: 2
                      }}/>
                    </div>
                  )}
                  {isDone && (
                    <div style={{ width: 52, height: 3, background: '#bbf7d0', borderRadius: 2, marginTop: 5 }}/>
                  )}
                  {isPending && (
                    <div style={{ width: 52, height: 3, background: '#f1f5f9', borderRadius: 2, marginTop: 5 }}/>
                  )}
                </div>

                {/* Connector */}
                {si < stages.length - 1 && (
                  <div style={{
                    width: 20, height: 3, marginTop: 17, flexShrink: 0,
                    background: isDone ? '#86efac' : isActive ? 'linear-gradient(90deg,#93c5fd,#e2e8f0)' : '#e2e8f0',
                    borderRadius: 2, transition: 'background 0.3s'
                  }}/>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AiChatPage({ activeTab, selectionRequest, onSelectionHandled }) {
  const [aiModel, setAiModel] = useState(() => {
    try { return JSON.parse(localStorage.getItem('intra-ai-model') || 'null'); } catch { return null; }
  });
  const [aiLoaded, setAiLoaded] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiChat, setAiChat] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [aiContextSize, setAiContextSize] = useState(() => Number(localStorage.getItem('intra-ai-context')) || 4096);
  const [gpuLayers, setGpuLayers] = useState(() => Number(localStorage.getItem('intra-ai-gpu-layers') ?? 0));
  const [temperature, setTemperature] = useState(() => Number(localStorage.getItem('intra-ai-temperature') || 0.7));
  const [topP, setTopP] = useState(() => Number(localStorage.getItem('intra-ai-top-p') || 0.9));
  const [aiLoadProgress, setAiLoadProgress] = useState(null);
  const aiLoadTimerRef = useRef(null);
  const [aiStreamedTokens, setAiStreamedTokens] = useState(0);
  const [searchMode, setSearchMode] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [deepThinkMode, setDeepThinkMode] = useState(false);
  const cancelledRef = useRef(false);

  // ── Pipeline animation state ──────────────────────────────────────────────
  const [pipelineVisible, setPipelineVisible] = useState(true);
  const [pipelineStages, setPipelineStages] = useState([]); // [{id,label,type,status,detail?}]

  // ── Ensemble mode state ──────────────────────────────────────────────────
  const [ensembleFolder, setEnsembleFolder] = useState(() => localStorage.getItem('intra-ensemble-folder') || '');
  const [ensembleModels, setEnsembleModels] = useState([]);   // [{name, path}]
  const [ensembleMode, setEnsembleMode] = useState(false);
  const [ensembleProgress, setEnsembleProgress] = useState(null); // {phase, modelName, step, total}
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiChat]);

  useEffect(() => {
    if (!isElectron) return;
    window.electronAPI.aiSetParams(temperature, topP).catch(() => {});
  }, [temperature, topP]);

  // Finalize pipeline when generation ends
  useEffect(() => {
    if (!aiLoading && pipelineStages.length > 0) {
      setPipelineStages(prev => prev.map(s => s.status === 'active' ? { ...s, status: 'done' } : s));
    }
  }, [aiLoading]); // eslint-disable-line

  useEffect(() => {
    if (!isElectron) return;
    window.electronAPI.aiGetStatus().then(status => {
      if (status.loaded && status.modelName) {
        setAiLoaded(true);
        setAiModel(prev => prev || { name: status.modelName });
      }
    }).catch(() => {});

    const offToken = window.electronAPI.onAiToken((text) => {
      setAiStreamedTokens(n => n + 1);
      setAiChat(prev => {
        const last = prev[prev.length - 1];
        if (last?.streaming) {
          return [...prev.slice(0, -1), { role: 'bot', text: (last.text || '') + text, streaming: true }];
        }
        return [...prev, { role: 'bot', text, streaming: true }];
      });
    });
    const offDone = window.electronAPI.onAiDone(() => {
      setAiLoading(false);
      setAiStreamedTokens(0);
      setAiChat(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, streaming: false } : m));
    });
    const offError = window.electronAPI.onAiError((msg) => {
      setAiLoading(false);
      setAiStreamedTokens(0);
      setAiChat(prev => [...prev, { role: 'bot', text: `Ошибка: ${msg}` }]);
    });
    const offLog = window.electronAPI.onAiServerLog?.((text) => {
      setAiChat(prev => {
        if (!prev.length) return prev;
        const last = prev[prev.length - 1];
        if (last?.isServerLog) {
          const lines = (last.text + text).split('\n').slice(-8).join('\n');
          return [...prev.slice(0, -1), { ...last, text: lines }];
        }
        return prev;
      });
    }) ?? (() => {});

    const offThinkToken = window.electronAPI.onAiThinkToken?.((text) => {
      setAiChat(prev => {
        // Append to last thinking bubble
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].role === 'thinking') {
            const updated = { ...prev[i], text: (prev[i].text || '') + text, streaming: true };
            return [...prev.slice(0, i), updated, ...prev.slice(i + 1)];
          }
        }
        // No thinking bubble yet — create one
        return [...prev, { role: 'thinking', text, streaming: true, collapsed: false }];
      });
    }) ?? (() => {});

    const offEnsembleProgress = window.electronAPI.onAiEnsembleProgress?.((data) => {
      setEnsembleProgress(data);
      if (data.phase === 'model') {
        setPipelineStages(prev => prev.map((s, i) => {
          if (s.id === `model-${data.step - 1}`) return { ...s, status: 'active', detail: data.modelName };
          if (i < data.step - 1 && s.id.startsWith('model-')) return { ...s, status: 'done' };
          return s;
        }));
        setAiChat(prev => [...prev.filter(m => m.role !== 'status'), {
          role: 'status',
          text: `Модель ${data.step}/${data.total}: ${data.modelName}...`
        }]);
      } else if (data.phase === 'synthesize') {
        setPipelineStages(prev => prev.map(s =>
          s.id === 'synthesize' ? { ...s, status: 'active' } :
          s.id.startsWith('model-') ? { ...s, status: 'done' } : s
        ));
        setAiChat(prev => [...prev.filter(m => m.role !== 'status'), {
          role: 'status', text: 'Синтезирую ответы всех моделей...'
        }]);
      }
    }) ?? (() => {});

    const offEnsembleModelDone = window.electronAPI.onAiEnsembleModelDone?.((data) => {
      setAiChat(prev => [
        ...prev.filter(m => m.role !== 'status'),
        { role: 'ensemble-model', modelName: data.modelName, text: data.response, collapsed: true }
      ]);
    }) ?? (() => {});

    return () => { offToken(); offDone(); offError(); offLog(); offThinkToken(); offEnsembleProgress(); offEnsembleModelDone(); };
  }, []);

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
    try {
      res = await window.electronAPI.aiLoadModel(modelPath, serverPath, aiContextSize, gpuLayers);
    } catch (err) {
      res = { success: false, error: err.message };
    }

    clearInterval(aiLoadTimerRef.current);
    aiLoadTimerRef.current = null;

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
      setAiChat(prev => [...prev, { role: 'bot', text: `Ошибка: ${res.error}` }]);
    }
    setAiLoading(false);
  };

  const handleSelectEnsembleFolder = async () => {
    if (!isElectron) return;
    const result = await window.electronAPI.showOpenDialog({
      title: 'Выберите папку с моделями (.gguf)',
      properties: ['openDirectory'],
    });
    if (result.canceled || !result.filePaths?.length) return;
    const folderPath = result.filePaths[0];
    const scanRes = await window.electronAPI.aiScanModelsFolder(folderPath).catch(() => ({ success: false, models: [] }));
    if (scanRes.success && scanRes.models.length > 0) {
      setEnsembleFolder(folderPath);
      setEnsembleModels(scanRes.models);
      localStorage.setItem('intra-ensemble-folder', folderPath);
    } else {
      setEnsembleModels([]);
      alert(`Файлы .gguf в папке не найдены${scanRes.error ? ': ' + scanRes.error : '.'}`);
    }
  };

  const handleStop = () => {
    cancelledRef.current = true;
    if (isElectron) window.electronAPI.aiAbort();
    setAiLoading(false);
    setIsSearching(false);
    setAiChat(prev => {
      let cleaned = prev
        .filter(m => m.role !== 'status' && !m.isSearchLog)
        .map(m => m.streaming ? { ...m, streaming: false } : m);
      return cleaned;
    });
  };

  const addStatus = (text) => {
    setAiChat(prev => [...prev.filter(m => m.role !== 'status'), { role: 'status', text }]);
  };
  const removeStatus = () => setAiChat(prev => prev.filter(m => m.role !== 'status'));

  // ── Pipeline helpers ──────────────────────────────────────────────────────
  const initPipeline = (stages) => {
    setPipelineStages(stages);
    setPipelineVisible(true);
  };
  const setPipelineStageStatus = (id, status, detail) => {
    setPipelineStages(prev => prev.map(s => s.id === id ? { ...s, status, ...(detail !== undefined ? { detail } : {}) } : s));
  };

  const toggleThinkingMsg = (idx) => {
    setAiChat(prev => prev.map((m, i) => i === idx ? { ...m, collapsed: !m.collapsed } : m));
  };

  // Helper: fetch top web pages and return concatenated content
  const fetchSearchPages = async (urls) => {
    if (!urls || !urls.length || !isElectron) return null;
    const pageContents = [];
    for (const url of urls.slice(0, 3)) {
      if (cancelledRef.current) break;
      try {
        const domain = new URL(url).hostname.replace(/^www\./, '');
        removeStatus();
        addStatus(`Читаю страницу: ${domain}...`);
        const res = await window.electronAPI.aiFetchUrl(url).catch(() => null);
        if (res?.success && res.content) {
          pageContents.push(`[${domain}]\n${res.content.slice(0, 2800)}`);
        }
      } catch (_) {}
    }
    removeStatus();
    return pageContents.length > 0 ? pageContents.join('\n\n---\n\n') : null;
  };

  const sendMessage = async () => {
    const effectivelyLoaded = aiLoaded || (ensembleMode && ensembleModels.length > 0);
    if (!aiInput.trim() || !effectivelyLoaded || aiLoading) return;
    const text = aiInput.trim();
    setAiInput('');
    setAiStreamedTokens(0);
    cancelledRef.current = false;
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    setAiChat(prev => [...prev, { role: 'user', text }]);
    setAiLoading(true);

    if (ensembleMode && ensembleModels.length > 0 && isElectron) {
      // ── Режим ансамбля ────────────────────────────────────────────
      setEnsembleProgress(null);
      const ensStages = ensembleModels.map((m, idx) => ({
        id: `model-${idx}`, label: m.name.replace(/\.gguf$/i,'').slice(0, 18), type: 'model', status: 'pending'
      }));
      ensStages.push({ id: 'synthesize', label: 'Синтез ответов', type: 'synthesize', status: 'pending' });
      initPipeline(ensStages);
      addStatus(`Запускаю ансамбль из ${ensembleModels.length} моделей...`);
      const serverPath = localStorage.getItem('intra-llama-server') || '';
      const result = await window.electronAPI.aiEnsembleChat(
        text, ensembleModels.map(m => m.path), serverPath, aiContextSize, gpuLayers
      ).catch(() => ({ success: false, error: 'Ошибка ансамбля' }));
      setEnsembleProgress(null);
      removeStatus();
      if (!result?.success) {
        setAiLoading(false);
        setAiChat(prev => [...prev, { role: 'bot', text: `Ошибка ансамбля: ${result?.error || ''}` }]);
      }

    } else if (deepThinkMode && isElectron) {
      // ── Init pipeline ─────────────────────────────────────────────
      const dtStages = [{ id: 'think', label: 'Анализ задачи', type: 'think', status: 'active' }];
      if (searchMode) {
        dtStages.push({ id: 'search', label: 'Поиск в сети', type: 'search', status: 'pending' });
        dtStages.push({ id: 'read', label: 'Чтение страниц', type: 'read', status: 'pending' });
      }
      dtStages.push({ id: 'generate', label: 'Генерация ответа', type: 'generate', status: 'pending' });
      initPipeline(dtStages);

      // ── Фаза 1: построение плана ──────────────────────────────────
      addStatus('Анализирую задачу и составляю план...');
      // Добавляем пустой блок мышления заранее, токены придут в него
      setAiChat(prev => [...prev, { role: 'thinking', text: '', streaming: true, collapsed: false }]);

      const planPrompt = `Составь краткий пронумерованный план ответа на вопрос: "${text}"\nТолько план, без лишних слов.`;
      const thinkResult = isElectron
        ? await window.electronAPI.aiThinkResponse(planPrompt).catch(() => ({ success: false, collected: '' }))
        : { success: false, collected: '' };

      if (cancelledRef.current) return;

      // Помечаем мышление как завершённое
      setAiChat(prev => prev.map(m =>
        m.role === 'thinking' && m.streaming ? { ...m, streaming: false, collapsed: false } : m
      ));
      setPipelineStageStatus('think', 'done');
      removeStatus();

      const plan = thinkResult.collected?.trim() || '';

      // ── Фаза 2: поиск + чтение страниц (если включён) ────────────
      let searchResults = null;
      let pageContent = null;
      if (searchMode) {
        setPipelineStageStatus('search', 'active');
        addStatus('Ищу актуальную информацию в интернете...');
        setIsSearching(true);
        try {
          const res = await window.electronAPI.aiWebSearch(text);
          if (cancelledRef.current) return;
          if (res.success && res.results) {
            searchResults = res.results;
            setIsSearching(false);
            setPipelineStageStatus('search', 'done');
            setPipelineStageStatus('read', 'active');
            // Читаем реальные страницы
            pageContent = await fetchSearchPages(res.urls);
            setPipelineStageStatus('read', 'done');
          }
        } catch (_) {}
        if (cancelledRef.current) return;
        setIsSearching(false);
        removeStatus();
      }

      // ── Фаза 3: финальный ответ по плану ─────────────────────────
      setPipelineStageStatus('generate', 'active');
      addStatus('Формирую структурированный ответ...');
      await new Promise(r => setTimeout(r, 180));
      if (cancelledRef.current) return;
      removeStatus();

      let finalPrompt = `Вопрос пользователя: ${text}`;
      if (searchResults) finalPrompt += `\n\nСниппеты из поиска:\n${searchResults}`;
      if (pageContent) finalPrompt += `\n\nСодержимое веб-страниц:\n${pageContent}`;
      if (plan) finalPrompt += `\n\nПлан ответа (следуй строго, каждый пункт — отдельный раздел с заголовком ##):\n${plan}`;
      finalPrompt += `\n\nДай подробный структурированный ответ строго по плану выше. Каждый пункт плана — отдельный раздел. Отвечай на русском языке, чётко и по существу.`;

      window.electronAPI.aiChat(finalPrompt).catch(() => {});

    } else if (searchMode && isElectron) {
      // ── Только поиск + чтение страниц ────────────────────────────
      initPipeline([
        { id: 'search', label: 'Поиск в сети', type: 'search', status: 'active' },
        { id: 'read', label: 'Чтение страниц', type: 'read', status: 'pending' },
        { id: 'generate', label: 'Генерация ответа', type: 'generate', status: 'pending' },
      ]);
      addStatus(`Ищу по запросу: «${text.slice(0, 40)}»...`);
      setIsSearching(true);
      try {
        const res = await window.electronAPI.aiWebSearch(text);
        if (cancelledRef.current) return;
        setIsSearching(false);
        if (res.success && res.results) {
          setPipelineStageStatus('search', 'done');
          setPipelineStageStatus('read', 'active');
          // Читаем реальные страницы
          const pageContent = await fetchSearchPages(res.urls);
          setPipelineStageStatus('read', 'done');
          setPipelineStageStatus('generate', 'active');
          if (cancelledRef.current) return;
          removeStatus();
          let finalPrompt = `Вопрос: ${text}\n\nСниппеты из поиска:\n${res.results}`;
          if (pageContent) finalPrompt += `\n\nСодержимое найденных страниц:\n${pageContent}`;
          finalPrompt += `\n\nОтветь на вопрос, используя найденную информацию. Отвечай на русском языке.`;
          window.electronAPI.aiChat(finalPrompt).catch(() => {});
        } else {
          setPipelineStageStatus('search', 'done');
          setPipelineStageStatus('generate', 'active');
          removeStatus();
          setAiChat(prev => [...prev, { role: 'bot', text: `Поиск не дал результатов (${res.error || ''}). Отвечаю без поиска.` }]);
          window.electronAPI.aiChat(text).catch(() => {});
        }
      } catch {
        if (cancelledRef.current) return;
        setIsSearching(false);
        removeStatus();
        window.electronAPI.aiChat(text).catch(() => {});
      }

    } else {
      // ── Обычный режим ─────────────────────────────────────────────
      initPipeline([{ id: 'generate', label: 'Генерация ответа', type: 'generate', status: 'active' }]);
      window.electronAPI.aiChat(text).then(result => {
        if (!result?.success && result?.error) {
          setAiLoading(false);
          setAiChat(prev => [...prev, { role: 'bot', text: `Ошибка: ${result.error}` }]);
        }
      }).catch(() => { setAiLoading(false); });
    }

    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  // Обработка запроса анализа выделенного текста (из контекстного меню)
  useEffect(() => {
    if (!selectionRequest || !aiLoaded || aiLoading) return;
    const { text, label, prompt } = selectionRequest;
    onSelectionHandled?.();
    analyzeSelectionWith(text, label, prompt);
  }, [selectionRequest, aiLoaded]); // eslint-disable-line

  const analyzeSelectionWith = async (text, label, prompt) => {
    if (!aiLoaded || aiLoading || !isElectron) return;
    setAiChat(prev => [...prev, { role: 'user', text: `${label}:\n"${text.slice(0, 200)}${text.length > 200 ? '…' : ''}"` }]);
    setAiLoading(true);
    window.electronAPI.aiAnalyzeSelection(text, prompt)
      .then(result => {
        if (!result?.success) {
          setAiLoading(false);
          setAiChat(prev => [...prev, { role: 'bot', text: result?.error || 'Нет ответа от модели' }]);
        }
      })
      .catch(() => {
        setAiLoading(false);
        setAiChat(prev => [...prev, { role: 'bot', text: 'Ошибка запроса к модели' }]);
      });
  };

  const analyzePageWith = async (label, prompt) => {
    if (!aiLoaded || aiLoading || !isElectron) return;
    if (!activeTab || activeTab.isHome || activeTab.isAiChat) return;
    const res = await window.electronAPI.aiGetPageContent();
    if (!res.success) {
      setAiChat(prev => [...prev, { role: 'bot', text: `Не удалось получить содержимое: ${res.error}` }]);
      return;
    }
    const content = res.content.slice(0, 1500);
    const fullPrompt = `${prompt}\n\nСтраница: "${res.title}"\n\nФрагмент текста:\n${content}\n\nОтвет:`;
    setAiChat(prev => [...prev, { role: 'user', text: label }]);
    setAiLoading(true);
    window.electronAPI.aiAnalyzePage(fullPrompt)
      .then(result => {
        if (!result?.success) {
          setAiLoading(false);
          setAiChat(prev => [...prev, { role: 'bot', text: `${result?.error || 'Нет ответа от модели'}` }]);
        }
      })
      .catch(() => {
        setAiLoading(false);
        setAiChat(prev => [...prev, { role: 'bot', text: 'Ошибка запроса к модели' }]);
      });
  };

  const aiEstimatedTokens = aiChat
    .filter(m => !m.isServerLog)
    .reduce((s, m) => s + Math.ceil((m.text || '').length / 4), 0);
  const aiContextUsedPct = aiLoaded && aiContextSize > 0
    ? Math.min(100, Math.round(aiEstimatedTokens / aiContextSize * 100))
    : 0;
  const aiLastBotMsg = [...aiChat].reverse().find(m => m.role === 'bot' && !m.isServerLog && !m.streaming);

  return (
    <div style={{ display: 'flex', height: '100%', background: '#f8fafc', overflow: 'hidden' }}>

      {/* ── Left config panel ────────────────────────────────── */}
      <div style={{
        width: 272, background: 'white', borderRight: '1px solid #e2e8f0',
        display: 'flex', flexDirection: 'column', padding: '20px 14px', gap: 14,
        flexShrink: 0, overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#eff6ff,#dbeafe)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            border: '1px solid #bfdbfe'
          }}>
            <svg width="20" height="20" fill="none" stroke="#2563eb" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>AI Чат</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Локальная нейросеть</div>
          </div>
        </div>

        {/* Model status */}
        <div style={{
          borderRadius: 10, padding: '11px 13px',
          background: aiLoaded ? '#f0fdf4' : '#f8fafc',
          border: `1px solid ${aiLoaded ? '#bbf7d0' : '#e2e8f0'}`
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: aiLoaded ? '#166534' : '#64748b', marginBottom: 2 }}>
            {aiLoaded ? `${aiModel?.name}` : aiLoading ? 'Загрузка...' : 'Модель не выбрана'}
          </div>
          <div style={{ fontSize: 11, color: aiLoaded ? '#15803d' : '#94a3b8' }}>
            {aiLoaded ? 'Готов к работе' : aiLoading ? 'Подождите...' : 'Выберите .gguf файл'}
          </div>
        </div>

        {/* Context size select */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 5 }}>
            Размер контекста
          </label>
          <select
            value={aiContextSize}
            onChange={e => { const v = Number(e.target.value); setAiContextSize(v); localStorage.setItem('intra-ai-context', String(v)); }}
            style={{
              width: '100%', fontSize: 12, padding: '6px 10px', borderRadius: 7,
              border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', outline: 'none', color: '#1e293b'
            }}
          >
            <option value={2048}>2 048 токенов</option>
            <option value={4096}>4 096 (по умолч.)</option>
            <option value={8192}>8 192 токенов</option>
            <option value={16384}>16 384 токенов</option>
            <option value={32768}>32 768 токенов</option>
          </select>
        </div>

        {/* GPU layers select */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 5 }}>
            GPU слои (0 = CPU, -1 = все на GPU)
          </label>
          <select
            value={gpuLayers}
            onChange={e => { const v = Number(e.target.value); setGpuLayers(v); localStorage.setItem('intra-ai-gpu-layers', String(v)); }}
            style={{
              width: '100%', fontSize: 12, padding: '6px 10px', borderRadius: 7,
              border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', outline: 'none', color: '#1e293b'
            }}
          >
            <option value={0}>0 — только CPU</option>
            <option value={10}>10 слоёв на GPU</option>
            <option value={20}>20 слоёв на GPU</option>
            <option value={33}>33 слоя (7B оптимально)</option>
            <option value={48}>48 слоёв (13B)</option>
            <option value={-1}>-1 — все слои на GPU</option>
          </select>
        </div>

        {/* Temperature slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Температура</label>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb' }}>{temperature.toFixed(2)}</span>
          </div>
          <input
            type="range" min={0.01} max={2} step={0.01} value={temperature}
            onChange={e => {
              const v = Number(e.target.value);
              setTemperature(v);
              localStorage.setItem('intra-ai-temperature', String(v));
            }}
            style={{ width: '100%', accentColor: '#2563eb', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#cbd5e1', marginTop: 2 }}>
            <span>0.01 — точно</span><span>1.0 — баланс</span><span>2.0 — творч.</span>
          </div>
        </div>

        {/* Top-P slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>Top-P (вероятность)</label>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb' }}>{topP.toFixed(2)}</span>
          </div>
          <input
            type="range" min={0.01} max={1} step={0.01} value={topP}
            onChange={e => {
              const v = Number(e.target.value);
              setTopP(v);
              localStorage.setItem('intra-ai-top-p', String(v));
            }}
            style={{ width: '100%', accentColor: '#2563eb', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#cbd5e1', marginTop: 2 }}>
            <span>0.01 — жёстко</span><span>0.9 — стандарт</span><span>1.0 — всё</span>
          </div>
        </div>

        {/* Load model button */}
        <button
          onClick={handleLoadModel}
          disabled={aiLoading}
          style={{
            width: '100%', padding: '9px 0', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700,
            background: aiLoading ? '#e2e8f0' : '#2563eb',
            color: aiLoading ? '#94a3b8' : 'white',
            cursor: aiLoading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s'
          }}
        >
          {aiLoading ? 'Загрузка...' : aiModel ? 'Сменить модель (.gguf)' : 'Выбрать модель (.gguf)'}
        </button>

        {localStorage.getItem('intra-llama-server') && !aiLoading && (
          <button
            onClick={() => localStorage.removeItem('intra-llama-server')}
            style={{ width: '100%', padding: '4px 0', background: 'none', color: '#94a3b8', border: 'none', fontSize: 11, cursor: 'pointer' }}
          >
            Сбросить путь к llama-server
          </button>
        )}

        {/* ── Ensemble mode ── */}
        <div style={{ borderRadius: 10, border: `1px solid ${ensembleMode ? '#7c3aed' : '#e2e8f0'}`, padding: '10px 12px', background: ensembleMode ? '#faf5ff' : '#f8fafc' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>Ансамбль моделей</div>
          <button
            onClick={handleSelectEnsembleFolder}
            disabled={aiLoading}
            style={{
              width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px dashed #cbd5e1',
              background: 'white', color: '#475569', fontSize: 11, cursor: aiLoading ? 'not-allowed' : 'pointer',
              textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}
          >
            {ensembleModels.length > 0
              ? `📁 ${ensembleModels.length} моделей: ${ensembleFolder.split(/[\\/]/).pop()}`
              : '📁 Выбрать папку с моделями'}
          </button>
          {ensembleModels.length > 0 && (
            <>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 11, color: '#374151', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={ensembleMode}
                    onChange={e => setEnsembleMode(e.target.checked)}
                    style={{ accentColor: '#7c3aed', width: 13, height: 13 }}
                  />
                  Режим ансамбля
                </label>
              </div>
              <div style={{ marginTop: 5, fontSize: 10, color: '#94a3b8', lineHeight: 1.5 }}>
                {ensembleModels.map(m => m.name).join(' · ')}
              </div>
              {ensembleMode && (
                <div style={{ marginTop: 5, fontSize: 10, color: '#7c3aed', fontWeight: 600 }}>
                  Каждая модель обработает запрос, итог синтезируется
                </div>
              )}
            </>
          )}
        </div>

        {/* Load progress */}
        {aiLoading && !aiLoaded && aiLoadProgress !== null && (
          <div style={{ borderRadius: 8, padding: '10px 12px', background: '#eff6ff', border: '1px solid #dbeafe' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: '#2563eb', fontWeight: 600 }}>Загрузка модели...</span>
              <span style={{ fontSize: 11, color: '#2563eb', fontWeight: 700 }}>{aiLoadProgress}%</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: '#dbeafe', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${aiLoadProgress}%`, background: '#2563eb', borderRadius: 3, transition: 'width 0.4s ease' }}/>
            </div>
          </div>
        )}

        {/* Context usage bar */}
        {aiLoaded && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: '#64748b' }}>Контекст использован</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: aiContextUsedPct > 85 ? '#ef4444' : aiContextUsedPct > 60 ? '#f59e0b' : '#22c55e' }}>
                {aiContextUsedPct}%
              </span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: '#e2e8f0', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${aiContextUsedPct}%`, borderRadius: 3, transition: 'width 0.3s',
                background: aiContextUsedPct > 85 ? '#ef4444' : aiContextUsedPct > 60 ? '#f59e0b' : '#22c55e'
              }}/>
            </div>
            {aiContextUsedPct > 85 && (
              <div style={{ fontSize: 10, color: '#ef4444', marginTop: 4 }}>Контекст почти заполнен — очистите чат</div>
            )}
          </div>
        )}

        {/* Page analysis — only when browsing a real page */}
        {aiLoaded && activeTab && !activeTab.isHome && !activeTab.isAiChat && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Анализ текущей страницы</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                ['Резюмировать', 'Сделай краткое резюме этой страницы на русском языке.'],
                ['Ключевые тезисы', 'Выдели ключевые тезисы и факты этой страницы в виде маркированного списка.'],
                ['Объяснить просто', 'Объясни простыми словами, о чём эта страница.'],
              ].map(([label, prompt]) => (
                <button
                  key={label}
                  onClick={() => analyzePageWith(label, prompt)}
                  disabled={aiLoading}
                  style={{
                    padding: '7px 10px', borderRadius: 7, border: '1px solid #bfdbfe',
                    background: '#eff6ff', color: '#2563eb', fontSize: 11, fontWeight: 600,
                    cursor: aiLoading ? 'not-allowed' : 'pointer', textAlign: 'left',
                    opacity: aiLoading ? 0.5 : 1, transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => { if (!aiLoading) { e.currentTarget.style.background = '#dbeafe'; } }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#eff6ff'; }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ flex: 1 }}/>

        {/* Unload button */}
        {aiLoaded && (
          <button
            onClick={async () => {
              await window.electronAPI.aiUnloadModel();
              setAiModel(null); setAiLoaded(false); setAiChat([]);
              setAiLoadProgress(null); localStorage.removeItem('intra-ai-model');
            }}
            style={{
              width: '100%', padding: '7px 0', borderRadius: 8,
              border: '1px solid #fecaca', background: '#fff5f5', color: '#ef4444',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff5f5'; }}
          >
            Выгрузить модель
          </button>
        )}
      </div>

      {/* ── Main chat area ────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Chat header */}
        <div style={{
          padding: '0 20px', height: 52, borderBottom: '1px solid #e2e8f0', background: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
              {aiLoaded ? (aiModel?.name || 'AI Chat') : 'AI Чат'}
            </span>
            {aiLoaded && (
              <span style={{
                fontSize: 10, color: '#16a34a', background: '#dcfce7',
                padding: '2px 8px', borderRadius: 999, fontWeight: 700, letterSpacing: 0.3
              }}>ONLINE</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {aiLastBotMsg && (
              <button
                title="Скопировать последний ответ"
                onClick={() => navigator.clipboard.writeText(aiLastBotMsg.text)}
                style={{
                  padding: '5px 11px', borderRadius: 7, border: '1px solid #e2e8f0',
                  background: '#f8fafc', color: '#64748b', fontSize: 11, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; }}
              >
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
                Копировать
              </button>
            )}
            {pipelineStages.length > 0 && (
              <button
                title={pipelineVisible ? 'Скрыть анимацию обработки' : 'Показать анимацию обработки'}
                onClick={() => setPipelineVisible(v => !v)}
                style={{
                  padding: '5px 11px', borderRadius: 7, border: `1px solid ${pipelineVisible ? '#bfdbfe' : '#e2e8f0'}`,
                  background: pipelineVisible ? '#eff6ff' : '#f8fafc', color: pipelineVisible ? '#2563eb' : '#64748b',
                  fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5
                }}
              >
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M16.95 16.95l1.41 1.41M5.05 16.95l-1.41 1.41"/>
                </svg>
                Процесс
              </button>
            )}
            {aiChat.length > 0 && (
              <button
                title="Очистить чат"
                onClick={() => { setAiChat([]); setPipelineStages([]); window.electronAPI?.aiClearHistory?.(); }}
                style={{
                  padding: '5px 11px', borderRadius: 7, border: '1px solid #e2e8f0',
                  background: '#f8fafc', color: '#64748b', fontSize: 11, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#fecaca'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
              >
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                </svg>
                Очистить
              </button>
            )}
          </div>
        </div>

        {/* Pipeline animation */}
        <ProcessingPipeline
          stages={pipelineStages}
          visible={pipelineVisible}
          onToggle={() => setPipelineVisible(v => !v)}
        />

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '24px 28px',
          display: 'flex', flexDirection: 'column', gap: 18
        }}>
          {/* Empty state */}
          {aiChat.length === 0 && (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: '#94a3b8'
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: 18,
                background: 'linear-gradient(135deg,#eff6ff,#dbeafe)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 20, border: '1px solid #bfdbfe'
              }}>
                <svg width="34" height="34" fill="none" stroke="#2563eb" viewBox="0 0 24 24" strokeWidth="1.3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                </svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
                {aiModel ? 'Начните диалог' : 'Загрузите модель'}
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', maxWidth: 340, lineHeight: 1.7 }}>
                {aiModel
                  ? 'Задайте вопрос — нейросеть ответит локально, без отправки данных в интернет.'
                  : 'Выберите .gguf файл в панели слева, чтобы начать работу с локальной нейросетью.'
                }
              </div>
              {!aiModel && (
                <button
                  onClick={handleLoadModel}
                  style={{
                    marginTop: 20, padding: '9px 20px', borderRadius: 9, border: 'none',
                    background: '#2563eb', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Выбрать модель (.gguf)
                </button>
              )}
            </div>
          )}

          {/* Message bubbles */}
          {aiChat.map((msg, i) => {
            // ── Временный статус-индикатор ──────────────────────────────
            if (msg.role === 'status') {
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'center', margin: '-4px 0' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '5px 16px', borderRadius: 999,
                    background: '#f5f3ff', border: '1px solid #e9d5ff'
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      border: '2px solid #7c3aed', borderTopColor: 'transparent',
                      animation: 'aiSearchSpin 0.7s linear infinite', flexShrink: 0
                    }}/>
                    <span style={{ fontSize: 11, color: '#6d28d9', fontWeight: 600 }}>{msg.text}</span>
                  </div>
                </div>
              );
            }

            // ── Блок мышления (план) ─────────────────────────────────────
            if (msg.role === 'thinking') {
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                    background: 'linear-gradient(135deg,#7c3aed,#5b21b6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="15" height="15" fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth="1.8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                    </svg>
                  </div>
                  <div style={{
                    maxWidth: '72%', borderRadius: '4px 14px 14px 14px',
                    background: '#faf5ff', border: '1px solid #ddd6fe',
                    boxShadow: '0 1px 4px rgba(124,58,237,0.08)', overflow: 'hidden'
                  }}>
                    {/* Header — кликабельный для сворачивания */}
                    <div
                      onClick={() => toggleThinkingMsg(i)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 14px', cursor: 'pointer',
                        borderBottom: msg.collapsed ? 'none' : '1px solid #ede9fe',
                        userSelect: 'none'
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#6d28d9' }}>Мышление</span>
                      {msg.streaming && (
                        <div style={{
                          width: 7, height: 7, borderRadius: '50%',
                          border: '1.5px solid #7c3aed', borderTopColor: 'transparent',
                          animation: 'aiSearchSpin 0.7s linear infinite'
                        }}/>
                      )}
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: '#a78bfa' }}>
                        {msg.collapsed ? '▶ показать' : '▼ свернуть'}
                      </span>
                    </div>
                    {/* Content */}
                    {!msg.collapsed && (
                      <div style={{ padding: '8px 14px 10px', fontSize: 12, color: '#5b21b6', lineHeight: 1.6 }}>
                        {msg.text
                          ? <MessageText text={msg.text} />
                          : <span style={{ color: '#a78bfa', fontStyle: 'italic' }}>Анализирую...</span>
                        }
                        {msg.streaming && (
                          <span style={{
                            display: 'inline-block', width: 6, height: 12, background: '#a78bfa',
                            borderRadius: 2, marginLeft: 3, verticalAlign: 'text-bottom',
                            animation: 'aiCursorBlink 0.8s step-end infinite'
                          }}/>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // ── Ответ одной модели из ансамбля ───────────────────────────
            if (msg.role === 'ensemble-model') {
              return (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '4px 20px' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#0ea5e9,#2563eb)', marginTop: 8 }}>
                    <svg width="13" height="13" fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth="2">
                      <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M16.95 16.95l1.41 1.41M5.05 16.95l-1.41 1.41"/>
                    </svg>
                  </div>
                  <div style={{
                    flex: 1, borderRadius: '4px 14px 14px 14px', padding: '8px 14px',
                    background: '#f0f9ff', border: '1px solid #bae6fd', maxWidth: '90%'
                  }}>
                    <div
                      onClick={() => setAiChat(prev => prev.map((m, j) => j === i ? { ...m, collapsed: !m.collapsed } : m))}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                        fontSize: 11, fontWeight: 700, color: '#0369a1', marginBottom: msg.collapsed ? 0 : 6,
                        userSelect: 'none'
                      }}
                    >
                      <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M16.95 16.95l1.41 1.41M5.05 16.95l-1.41 1.41"/>
                      </svg>
                      {msg.modelName}
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: '#7dd3fc' }}>
                        {msg.collapsed ? '▶ показать' : '▼ свернуть'}
                      </span>
                    </div>
                    {!msg.collapsed && (
                      <div style={{ fontSize: 12, color: '#0c4a6e', lineHeight: 1.6 }}>
                        <MessageText text={msg.text} />
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // ── Обычное сообщение ────────────────────────────────────────
            return (
              <div key={i} style={{
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-start', gap: 10
              }}>
                {/* Avatar */}
                <div style={{
                  width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                  background: msg.role === 'user' ? '#2563eb' : (msg.isServerLog ? '#f1f5f9' : '#1e293b'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: msg.role === 'user' ? 'white' : (msg.isServerLog ? '#64748b' : '#e2e8f0'),
                  fontSize: msg.role === 'user' ? 10 : 13, fontWeight: 700
                }}>
                  {msg.role === 'user'
                    ? <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
                    : (msg.isServerLog ? <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg> : <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>)
                  }
                </div>

                {/* Bubble */}
                <div style={{
                  maxWidth: '72%', padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                  background: msg.role === 'user' ? '#2563eb' : (msg.isServerLog || msg.isSearchLog ? '#f8fafc' : 'white'),
                  color: msg.role === 'user' ? 'white' : (msg.isSearchLog ? '#2563eb' : '#374151'),
                  boxShadow: msg.role === 'user' ? '0 2px 8px rgba(37,99,235,0.2)' : '0 1px 4px rgba(0,0,0,0.06)',
                  border: msg.role === 'user' ? 'none' : (msg.isSearchLog ? '1px solid #dbeafe' : '1px solid #f1f5f9'),
                  fontSize: 13, lineHeight: 1.65
                }}>
                  {msg.isServerLog || msg.isSearchLog || msg.role === 'user' ? (
                    <span style={{
                      whiteSpace: 'pre-wrap',
                      fontFamily: msg.isServerLog ? 'JetBrains Mono, Consolas, monospace' : 'inherit',
                      fontSize: msg.isServerLog ? 11 : 13
                    }}>{msg.text}</span>
                  ) : (
                    <MessageText text={msg.text} />
                  )}
                  {msg.streaming && (
                    <span style={{
                      display: 'inline-block', width: 7, height: 14, background: '#94a3b8',
                      borderRadius: 2, marginLeft: 4, verticalAlign: 'text-bottom',
                      animation: 'aiCursorBlink 0.8s step-end infinite'
                    }}/>
                  )}
                </div>
              </div>
            );
          })}

          {/* Typing dots */}
          {aiLoading && !aiChat.find(m => m.streaming) && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9, background: '#1e293b',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#e2e8f0', flexShrink: 0
              }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
              </div>
              <div style={{
                padding: '12px 16px', borderRadius: '4px 14px 14px 14px',
                background: 'white', border: '1px solid #f1f5f9',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                display: 'flex', gap: 5, alignItems: 'center'
              }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 7, height: 7, borderRadius: '50%', background: '#94a3b8',
                    animation: 'aiDotBounce 1.2s ease-in-out infinite',
                    animationDelay: `${i * 0.2}s`
                  }}/>
                ))}
              </div>
            </div>
          )}

          <div ref={chatEndRef}/>
        </div>

        {/* Token generation progress */}
        {aiLoading && aiLoaded && (
          <div style={{ padding: '6px 28px', borderTop: '1px solid #f1f5f9', background: 'white', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                {aiStreamedTokens === 0 ? 'Ожидание ответа...' : `Генерация... ${aiStreamedTokens} токенов`}
              </span>
              {aiStreamedTokens > 0 && (
                <span style={{ fontSize: 11, color: '#2563eb', fontWeight: 600 }}>
                  {Math.min(Math.round(aiStreamedTokens / 10.24), 95)}%
                </span>
              )}
            </div>
            <div style={{ height: 3, borderRadius: 2, background: '#e2e8f0', overflow: 'hidden', position: 'relative' }}>
              {aiStreamedTokens === 0
                ? <div className="ai-indeterminate" style={{ position: 'absolute', top: 0, height: '100%', width: '30%', borderRadius: 2, background: '#2563eb' }}/>
                : <div style={{ height: '100%', width: `${Math.min(aiStreamedTokens / 10.24, 95)}%`, background: '#2563eb', borderRadius: 2, transition: 'width 0.15s' }}/>
              }
            </div>
          </div>
        )}

        {/* Search-in-progress indicator */}
        {isSearching && (
          <div style={{ padding: '6px 28px', borderTop: '1px solid #f1f5f9', background: '#eff6ff', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #2563eb', borderTopColor: 'transparent', animation: 'aiSearchSpin 0.8s linear infinite', flexShrink: 0 }}/>
              <span style={{ fontSize: 11, color: '#2563eb', fontWeight: 600 }}>Поиск в интернете...</span>
            </div>
          </div>
        )}

        {/* Input area */}
        <div style={{
          padding: '14px 20px 16px', background: 'white',
          borderTop: '1px solid #e2e8f0', flexShrink: 0
        }}>
          {/* Mode toggles row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {/* Search toggle — hidden in ensemble mode */}
            {!ensembleMode && (
            <button
              onClick={() => setSearchMode(v => !v)}
              disabled={!(aiLoaded || (ensembleMode && ensembleModels.length > 0)) || aiLoading}
              title={searchMode ? 'Поиск включён' : 'Включить поиск в интернете'}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 11px', borderRadius: 8,
                border: `1px solid ${searchMode ? '#2563eb' : '#e2e8f0'}`,
                background: searchMode ? '#2563eb' : '#f8fafc',
                color: searchMode ? 'white' : '#64748b',
                fontSize: 11, fontWeight: 600,
                cursor: (aiLoaded && !aiLoading) ? 'pointer' : 'not-allowed',
                opacity: (aiLoaded && !aiLoading) ? 1 : 0.5, transition: 'all 0.15s', flexShrink: 0
              }}
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              Поиск
            </button>
            )}

            {/* Deep Think toggle — hidden in ensemble mode */}
            {!ensembleMode && (
            <button
              onClick={() => setDeepThinkMode(v => !v)}
              disabled={!aiLoaded || aiLoading}
              title={deepThinkMode ? 'Глубокое мышление включено' : 'Включить структурированное мышление'}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 11px', borderRadius: 8,
                border: `1px solid ${deepThinkMode ? '#7c3aed' : '#e2e8f0'}`,
                background: deepThinkMode ? '#7c3aed' : '#f8fafc',
                color: deepThinkMode ? 'white' : '#64748b',
                fontSize: 11, fontWeight: 600,
                cursor: aiLoaded && !aiLoading ? 'pointer' : 'not-allowed',
                opacity: aiLoaded && !aiLoading ? 1 : 0.5, transition: 'all 0.15s', flexShrink: 0
              }}
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
              </svg>
              Глубокое мышление
            </button>
            )}

            {/* Ensemble mode badge */}
            {ensembleMode && ensembleModels.length > 0 && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 11px', borderRadius: 8,
                background: '#7c3aed', color: 'white',
                fontSize: 11, fontWeight: 700, flexShrink: 0
              }}>
                <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M16.95 16.95l1.41 1.41M5.05 16.95l-1.41 1.41"/>
                </svg>
                Ансамбль · {ensembleModels.length} моделей
              </span>
            )}

            {/* Active mode hints */}
            {(searchMode || deepThinkMode) && !ensembleMode && (
              <span style={{ fontSize: 10, color: '#64748b', lineHeight: 1.4 }}>
                {deepThinkMode && searchMode
                  ? 'Поиск + чтение страниц + структурированный анализ'
                  : deepThinkMode
                  ? 'Анализ → план → структурированный ответ'
                  : 'Поиск в интернете + чтение страниц'}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{
              flex: 1, borderRadius: 11,
              border: `1px solid ${ensembleMode ? '#7c3aed' : searchMode ? '#2563eb' : aiInput.trim() ? '#3b82f6' : '#e2e8f0'}`,
              background: '#f8fafc', transition: 'all 0.15s',
              boxShadow: ensembleMode ? '0 0 0 3px rgba(124,58,237,0.12)' : searchMode ? '0 0 0 3px rgba(37,99,235,0.12)' : aiInput.trim() ? '0 0 0 3px rgba(59,130,246,0.1)' : 'none'
            }}>
              <textarea
                ref={textareaRef}
                value={aiInput}
                onChange={e => {
                  setAiInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                }}
                placeholder={
                  !(aiLoaded || (ensembleMode && ensembleModels.length > 0)) ? 'Загрузите модель или выберите папку ансамбля...' :
                  ensembleMode ? 'Введите запрос — все модели ансамбля обработают его...' :
                  searchMode ? 'Введите запрос — ИИ найдёт информацию в интернете и ответит...' :
                  'Введите сообщение... (Enter — отправить, Shift+Enter — новая строка)'
                }
                disabled={!(aiLoaded || (ensembleMode && ensembleModels.length > 0)) || aiLoading}
                rows={1}
                style={{
                  width: '100%', padding: '10px 14px', border: 'none', outline: 'none',
                  background: 'transparent', fontSize: 13, fontFamily: 'inherit',
                  resize: 'none', color: '#1e293b', lineHeight: 1.55,
                  maxHeight: 160, overflowY: 'auto', boxSizing: 'border-box',
                  display: 'block'
                }}
              />
            </div>
            {aiLoading ? (
              /* ── Stop button ── */
              <button
                onClick={handleStop}
                title="Остановить генерацию"
                style={{
                  width: 44, height: 44, borderRadius: 11, border: 'none', flexShrink: 0,
                  background: '#ef4444',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.15s',
                  boxShadow: '0 4px 12px rgba(239,68,68,0.35)'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#dc2626'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#ef4444'; }}
              >
                <svg width="16" height="16" fill="white" viewBox="0 0 24 24">
                  <rect x="5" y="5" width="14" height="14" rx="2"/>
                </svg>
              </button>
            ) : (
              /* ── Send button ── */
              <button
                onClick={sendMessage}
                disabled={!(aiLoaded || (ensembleMode && ensembleModels.length > 0)) || !aiInput.trim()}
                style={{
                  width: 44, height: 44, borderRadius: 11, border: 'none', flexShrink: 0,
                  background: (aiLoaded || (ensembleMode && ensembleModels.length > 0)) && aiInput.trim()
                    ? (ensembleMode ? '#7c3aed' : deepThinkMode ? '#7c3aed' : '#2563eb')
                    : '#e2e8f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: (aiLoaded || (ensembleMode && ensembleModels.length > 0)) && aiInput.trim() ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s',
                  boxShadow: (aiLoaded || (ensembleMode && ensembleModels.length > 0)) && aiInput.trim()
                    ? `0 4px 12px ${(ensembleMode || deepThinkMode) ? 'rgba(124,58,237,0.35)' : 'rgba(37,99,235,0.35)'}`
                    : 'none'
                }}
              >
                {ensembleMode ? (
                  <svg width="14" height="14" fill="none" stroke={(aiLoaded || (ensembleMode && ensembleModels.length > 0)) && aiInput.trim() ? 'white' : '#94a3b8'} viewBox="0 0 24 24" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M16.95 16.95l1.41 1.41M5.05 16.95l-1.41 1.41"/>
                  </svg>
                ) : searchMode && !deepThinkMode ? (
                  <svg width="16" height="16" fill="none" stroke={aiLoaded && aiInput.trim() ? 'white' : '#94a3b8'} viewBox="0 0 24 24" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                ) : deepThinkMode ? (
                  <svg width="15" height="15" fill="none" stroke={aiLoaded && aiInput.trim() ? 'white' : '#94a3b8'} viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" fill="none" stroke={aiLoaded && aiInput.trim() ? 'white' : '#94a3b8'} viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                  </svg>
                )}
              </button>
            )}
          </div>
          <div style={{ marginTop: 7, fontSize: 11, color: '#cbd5e1', textAlign: 'center' }}>
            {ensembleMode
              ? `Ансамбль · ${ensembleModels.length} моделей обработают запрос и синтезируют ответ`
              : deepThinkMode && searchMode
              ? 'Глубокое мышление + поиск · DuckDuckGo + чтение страниц, ответ локально'
              : deepThinkMode
              ? 'Глубокое мышление · Структурированный ответ по плану, всё локально'
              : searchMode
              ? 'Поиск включён · DuckDuckGo + чтение страниц, ответ генерируется локально'
              : 'Все вычисления выполняются локально · Данные не покидают ваше устройство'
            }
          </div>
        </div>
      </div>

      <style>{`
        @keyframes aiCursorBlink { 0%,100% { opacity:1; } 50% { opacity:0; } }
        @keyframes aiDotBounce { 0%,80%,100% { transform:translateY(0); } 40% { transform:translateY(-6px); } }
        @keyframes aiSearchSpin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        @keyframes pipelinePulse { 0%,100% { box-shadow:0 0 0 0 rgba(37,99,235,0.35); } 50% { box-shadow:0 0 0 7px rgba(37,99,235,0); } }
        @keyframes ai-indeterminate-move { 0% { left:-45%; } 100% { left:100%; } }
        .ai-indeterminate { animation: ai-indeterminate-move 1.4s linear infinite; }
      `}</style>
    </div>
  );
}
