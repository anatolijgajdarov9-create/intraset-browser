# 🌐 Intra Browser

**Интранет-ориентированный браузер**, разработанный для удобной работы с локальными сетями с поддержкой выхода в общий Интернет. Легко расширяемый через vibe-coding.

---

## 🏗️ Архитектура

```
intra-browser/
├── main.js              ← Electron main process (окно, BrowserView, IPC)
├── preload.js           ← Безопасный мост между UI и Electron
├── package.json
│
├── src/
│   ├── index.js         ← React точка входа
│   ├── index.css        ← Глобальные стили (CSS переменные)
│   ├── App.jsx          ← Корневой компонент, управление состоянием табов
│   │
│   ├── config/
│   │   └── intranet.js  ← ⚡ ГЛАВНЫЙ КОНФИГ (ссылки, домены, закладки)
│   │
│   └── components/
│       ├── TitleBar.jsx       ← Кастомный заголовок + управление окном
│       ├── TabBar.jsx         ← Панель вкладок
│       ├── NavBar.jsx         ← Адресная строка + кнопки навигации
│       ├── BookmarksBar.jsx   ← Панель закладок
│       └── HomePage.jsx       ← Домашняя страница (новая вкладка)
│
└── public/
    └── index.html
```

### Ключевые технологии
| Слой | Технология | Роль |
|------|-----------|------|
| Оболочка | **Electron 27** | Нативное окно, BrowserView для рендеринга страниц |
| UI | **React 18** | Интерфейс браузера (адресная строка, табы и т.д.) |
| IPC | contextBridge | Безопасная связь UI ↔ Electron |
| Стили | CSS variables | Легко меняемая тема |
| Сборка | electron-builder | Пакет для Windows/Linux/Mac |

### Как работает рендеринг страниц
Браузер использует **Electron BrowserView** для отображения веб-страниц. Это отдельный процесс Chromium, который вставляется поверх окна React-интерфейса. Каждая вкладка — отдельный BrowserView.

---

## 🚀 Быстрый старт

```bash
# 1. Установка зависимостей
npm install

# 2. Разработка (React dev server + Electron)
npm start

# 3. Сборка в исполняемый файл
npm run build
```

> **Требования:** Node.js 18+, npm 9+

---

## ⚡ Кастомизация (vibe-coding friendly)

### Добавить ссылки на домашней странице
Открой `src/config/intranet.js` и отредактируй `quickLinks`:

```js
{
  category: 'Мои сервисы',
  icon: '🚀',
  links: [
    { title: 'Мой сервис', url: 'http://192.168.1.50', icon: '🔧', description: 'Описание' }
  ]
}
```

### Добавить закладки
В том же файле, массив `bookmarks`:
```js
{ title: 'Jenkins', url: 'http://ci.local:8080' }
```

### Изменить поисковую систему
```js
defaultSearch: 'https://google.com/search?q='
// или
defaultSearch: 'https://duckduckgo.com/?q='
```

### Добавить интранет-домены для автодетекции
```js
intranetDomains: ['.local', '.intra', '.mycompany']
```

---

## 🔧 Расширение функциональности

### Добавить новый компонент в панель
1. Создай `src/components/MyPanel.jsx`
2. Импортируй в `App.jsx`
3. Вставь в JSX

### Добавить новую IPC команду
1. В `preload.js` добавь: `myAction: (data) => ipcRenderer.invoke('my-action', data)`
2. В `main.js` добавь: `ipcMain.handle('my-action', (event, data) => { ... })`
3. В компоненте вызывай: `window.electronAPI.myAction(data)`

---

## 🗺️ Дорожная карта (идеи для расширения)
- [ ] Менеджер закладок с папками
- [ ] История посещений
- [ ] Менеджер загрузок
- [ ] Поддержка расширений
- [ ] DevTools панель
- [ ] VPN/Proxy переключатель
- [ ] Темы оформления
- [ ] Сканер доступности интранет-ресурсов (ping)
- [ ] Сохранение паролей
- [ ] Режим "только интранет" (блокировка внешних сайтов)
