# Запусти этот скрипт из папки intraset-browser
# PowerShell: .\setup.ps1

$base = $PSScriptRoot

# 1. Создаём структуру папок
New-Item -ItemType Directory -Force -Path "$base\src\components"
New-Item -ItemType Directory -Force -Path "$base\src\config"
New-Item -ItemType Directory -Force -Path "$base\public"

# 2. Перемещаем компоненты в src\components\
Move-Item -Force "$base\App.jsx"          "$base\src\App.jsx"
Move-Item -Force "$base\BookmarksBar.jsx" "$base\src\components\BookmarksBar.jsx"
Move-Item -Force "$base\HomePage.jsx"     "$base\src\components\HomePage.jsx"
Move-Item -Force "$base\NavBar.jsx"       "$base\src\components\NavBar.jsx"
Move-Item -Force "$base\TabBar.jsx"       "$base\src\components\TabBar.jsx"
Move-Item -Force "$base\TitleBar.jsx"     "$base\src\components\TitleBar.jsx"

# 3. Перемещаем конфиг в src\config\
Move-Item -Force "$base\intranet.js"      "$base\src\config\intranet.js"

# 4. Создаём недостающие файлы

# src\index.js
@"
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
"@ | Set-Content -Encoding UTF8 "$base\src\index.js"

# src\index.css
@"
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --brand-cyan: #00c8ff;
  --brand-blue: #1a6fff;
  --brand-navy: #0d1b3e;
  --bg-primary: #080d1a;
  --bg-secondary: #0e1525;
  --bg-tertiary: #141e33;
  --bg-hover: #1a2640;
  --bg-active: #1e2d4a;
  --border-subtle: rgba(255,255,255,0.06);
  --border-normal: rgba(255,255,255,0.1);
  --border-accent: rgba(0, 200, 255, 0.3);
  --text-primary: #e8edf8;
  --text-secondary: #8fa0c0;
  --text-muted: #4a5a7a;
  --text-accent: #00c8ff;
  --status-ok: #00e5a0;
  --status-warn: #ffaa00;
  --status-err: #ff4466;
  --titlebar-height: 40px;
  --tabbar-height: 38px;
  --toolbar-height: 50px;
  --bookmarks-height: 32px;
  --font-ui: 'Manrope', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}

html, body, #root {
  height: 100%;
  overflow: hidden;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-ui);
  font-size: 13px;
  -webkit-font-smoothing: antialiased;
  user-select: none;
}

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border-normal); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--border-accent); }

::selection { background: rgba(0, 200, 255, 0.3); color: white; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(0,200,255,0); } 50% { box-shadow: 0 0 12px 2px rgba(0,200,255,0.3); } }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
"@ | Set-Content -Encoding UTF8 "$base\src\index.css"

# public\index.html
@"
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Intra Browser</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>
"@ | Set-Content -Encoding UTF8 "$base\public\index.html"

# package.json
@"
{
  "name": "intra-browser",
  "version": "1.0.0",
  "description": "Intra — браузер для интранет сетей",
  "main": "main.js",
  "scripts": {
    "start": "concurrently \"cross-env BROWSER=none react-scripts start\" \"wait-on http://localhost:3000 && electron .\"",
    "react": "react-scripts start",
    "build": "react-scripts build && electron-builder",
    "electron": "electron ."
  },
  "homepage": "./",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1"
  },
  "devDependencies": {
    "concurrently": "^8.2.0",
    "cross-env": "^7.0.3",
    "electron": "^27.0.0",
    "electron-builder": "^24.6.4",
    "wait-on": "^7.2.0"
  },
  "build": {
    "appId": "com.intra.browser",
    "productName": "Intra Browser",
    "directories": { "output": "dist" },
    "win": { "target": "nsis" },
    "linux": { "target": "AppImage" }
  },
  "browserslist": {
    "production": [">0.2%", "not dead", "not op_mini all"],
    "development": ["last 1 chrome version"]
  }
}
"@ | Set-Content -Encoding UTF8 "$base\package.json"

# Удаляем мусорный package-lock.json (он был создан без package.json, невалиден)
Remove-Item -Force "$base\package-lock.json" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "✅ Структура проекта готова!" -ForegroundColor Green
Write-Host ""
Write-Host "Теперь выполни:" -ForegroundColor Cyan
Write-Host "  npm install" -ForegroundColor Yellow
Write-Host "  npm start" -ForegroundColor Yellow
Write-Host ""
