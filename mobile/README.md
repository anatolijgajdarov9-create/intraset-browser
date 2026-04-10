# 📱 Intra Browser Mobile

Мобильная версия интранет-ориентированного браузера **Intra Browser** для Android (APK).

---

## ✨ Возможности

- 🌐 **WebView-браузер** — навигация по веб-страницам с вкладками
- 🔒 **Приватные вкладки** — изолированные сессии
- 📥 **Менеджер загрузок** — отслеживание скачанных файлов
- 🔖 **Закладки** — сохранение избранных сайтов
- 📜 **История** — журнал посещений с поиском
- 🌐 **Интранет-фильтр** — режим работы только с локальными сетями
- 🔍 **Поиск** — Яндекс, Google, DuckDuckGo, Bing

---

## 🏗️ Архитектура

```
mobile/
├── src/
│   ├── components/     ← UI-компоненты
│   ├── screens/        ← Экраны приложения
│   │   ├── HomeScreen.jsx
│   │   ├── BrowserScreen.jsx
│   │   ├── TabsScreen.jsx
│   │   ├── BookmarksScreen.jsx
│   │   ├── HistoryScreen.jsx
│   │   └── DownloadsScreen.jsx
│   ├── navigation/     ← React Navigation
│   ├── store/          ← Zustand (вкладки, настройки)
│   ├── utils/
│   │   ├── storage.js  ← AsyncStorage обёртки
│   │   ├── url.js      ← URL-утилиты
│   │   └── theme.js    ← Цвета и размеры
│   └── config/
│       └── intranet.js ← Конфиг интранет-доменов
├── App.js              ← Точка входа
└── package.json
```

### Технологии

| Слой | Технология |
|------|-----------|
| Фреймворк | React Native (Expo SDK 54) |
| WebView | react-native-webview |
| Навигация | React Navigation 6 |
| Хранилище | AsyncStorage |
| State | Zustand |

---

## 🚀 Быстрый старт

```bash
# Установка зависимостей
npm install

# Запуск в режиме разработки
npm start

# Запуск на Android-эмуляторе
npm run android

# Сборка APK (через EAS Build)
npx eas build --platform android --profile preview
```

**Требования:** Node.js 18+, npm 9+, Android Studio (для эмулятора)

---

## 📦 Сборка APK

### Локальная сборка

```bash
# Генерация нативных файлов
npx expo prebuild --platform android

# Сборка через Gradle
cd android
./gradlew assembleRelease

# APK будет в android/app/build/outputs/apk/release/
```

### Через EAS Build (облако)

```bash
# Установка EAS CLI
npm install -g eas-cli

# Авторизация
eas login

# Сборка
eas build --platform android --profile preview
```

---

## 🔧 Конфигурация

### Интранет-домены

Отредактируйте `src/config/intranet.js`:

```js
const intranetDomains = ['.local', '.intra', '.corporate'];
```

### Поисковая система

По умолчанию: Яндекс. Изменяется в настройках приложения.

---

## 📄 Лицензия

MIT
