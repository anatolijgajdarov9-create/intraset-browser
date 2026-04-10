# 🚀 Инструкция по запуску и сборке

## ✅ Текущий статус

- ✅ Зависимости исправлены (совместимы с Expo SDK 54)
- ✅ Веб-версия запущена (`npm run web`)
- ⚠️ Android SDK не установлен — эмулятор недоступен

---

## 🌐 Вариант 1: Веб-версия (для тестирования)

Уже запущено! Откройте в браузере:
```
http://localhost:8081
```

**Плюсы:**
- Быстрая проверка UI
- Не требует Android SDK
- Работает на любом компьютере

**Минусы:**
- WebView не работает (веб-версия React Native Web)
- Не тестируются нативные функции (файлы, навигация)

---

## 📱 Вариант 2: Установка Android Studio (рекомендуется)

### Шаг 1: Скачайте Android Studio
https://developer.android.com/studio

### Шаг 2: Установите Android SDK
1. Откройте Android Studio
2. `Tools` → `SDK Manager`
3. Установите:
   - Android SDK Platform 35 (или новее)
   - Android SDK Build-Tools
   - Android Emulator
4. Запомните путь к SDK (обычно: `C:\Users\ВАШ_ПОЛЬЗОВАТЕЛЬ\AppData\Local\Android\Sdk`)

### Шаг 3: Создайте виртуальное устройство
1. `Tools` → `Device Manager`
2. `Create Device`
3. Выберите Pixel 5 или любой другой
4. Скачайте системный образ (API 34 или 35)

### Шаг 4: Настройте переменную ANDROID_HOME
```powershell
# PowerShell (добавьте в $PROFILE для постоянства)
$env:ANDROID_HOME = "C:\Users\KrasovskyWorkstation\AppData\Local\Android\Sdk"
$env:PATH += ";$env:ANDROID_HOME\platform-tools"
```

Или через настройки Windows:
1. `Пуск` → `Изменить переменные среды`
2. `Создать...`
   - Имя: `ANDROID_HOME`
   - Значение: `C:\Users\KrasovskyWorkstation\AppData\Local\Android\Sdk`

### Шаг 5: Перезапустите терминал и запустите
```bash
cd f:\MyGitProjects\intraset-browser\mobile
npm run android
```

---

## ☁️ Вариант 3: Облачная сборка APK (EAS Build)

Не требует локального Android SDK. APK собирается на серверах Expo.

### Шаг 1: Установите EAS CLI
```bash
npm install -g eas-cli
```

### Шаг 2: Авторизуйтесь
```bash
eas login
```
(Создайте аккаунт на https://expo.dev если ещё нет)

### Шаг 3: Настройте проект
```bash
eas build:configure
```

### Шаг 4: Создайте профиль сборки
Создайте файл `eas.json`:
```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

### Шаг 5: Запустите сборку
```bash
# APK для тестирования
eas build --platform android --profile preview

# Или App Bundle для Google Play
eas build --platform android --profile production
```

**Результат:** Ссылка на скачивание APK будет доступна в консоли и на https://expo.dev

---

## 🐛 Решение проблем

### "adb not found"
→ Установите Android SDK и настройте ANDROID_HOME (см. Вариант 2)

### "Metro bundler не запускается"
```bash
# Очистите кэш
npx expo start --clear
```

### "Зависимости не совместимы"
```bash
npx expo install --fix
```

### "Белый экран"
- Проверьте консоль на ошибки
- Убедитесь, что все пакеты установлены: `npm install`
- Перезапустите с очисткой кэша: `npx expo start --clear`

---

## 📋 Быстрые команды

```bash
# Запуск веб-версии
npm run web

# Запуск на эмуляторе (нужен Android SDK)
npm run android

# Запуск на устройстве по USB
npm run android -- --device

# Сборка APK локально (нужен Android SDK)
cd android && ./gradlew assembleRelease

# Облачная сборка APK
eas build --platform android --profile preview
```
