# 📱 Инструкция: Сборка Intra Browser в Android Studio

## 1️⃣ Установка Android Studio

1. Скачайте Android Studio с [developer.android.com/studio](https://developer.android.com/studio)
2. Запустите установщик, следуйте инструкциям
3. При установке выберите **"Custom"** и отметьте:
   - ✅ Android SDK
   - ✅ Android SDK Platform
   - ✅ Android Virtual Device (если нужен эмулятор)

---

## 2️⃣ Установка SDK компонентов

После установки откройте Android Studio:

1. **Откройте SDK Manager:**
   - `Tools` → `SDK Manager` (или иконка 📦 в toolbar)

2. **Вкладка "SDK Platforms" — установите:**
   - ✅ Android 15.0 ("VanillaIceCream") — API Level 36
   - ✅ Android SDK Platform 36

3. **Вкладка "SDK Tools" — установите:**
   - ✅ Android SDK Build-Tools 36.0.0
   - ✅ Android SDK Command-line Tools
   - ✅ NDK (Side by side) — версия 27.1.12297006
   - ✅ Android Emulator (если нужен эмулятор)

4. Нажмите **Apply** → **OK** и дождитесь установки

---

## 3️⃣ Настройка переменных окружения

Откройте **PowerShell** и выполните:

```powershell
# Путь к Android SDK (по умолчанию)
$androidSdkPath = "$env:LOCALAPPDATA\Android\Sdk"

# Проверьте, что папка существует
if (Test-Path $androidSdkPath) {
    Write-Host "Android SDK found at: $androidSdkPath"
} else {
    Write-Host "Android SDK not found! Please install it first."
}

# Установка ANDROID_HOME
[System.Environment]::SetEnvironmentVariable('ANDROID_HOME', $androidSdkPath, 'User')
[System.Environment]::SetEnvironmentVariable('ANDROID_SDK_ROOT', $androidSdkPath, 'User')

# Добавление инструментов в PATH
$currentPath = [System.Environment]::GetEnvironmentVariable('PATH', 'User')
$newPaths = @(
    "$androidSdkPath\platform-tools",
    "$androidSdkPath\tools",
    "$androidSdkPath\cmdline-tools\latest\bin"
)
$updatedPath = ($currentPath + ';' + ($newPaths -join ';')).TrimEnd(';')
[System.Environment]::SetEnvironmentVariable('PATH', $updatedPath, 'User')

Write-Host "✅ Environment variables set!"
```

**Закройте и откройте PowerShell заново**, чтобы переменные применились.

---

## 4️⃣ Открытие проекта в Android Studio

1. Откройте **Android Studio**
2. Нажмите **Open** → выберите папку:
   ```
   f:\MyGitProjects\intraset-browser\mobile\android
   ```
3. Дождитесь синхронизации Gradle (может занять 5-10 минут)
4. Если появится предложение обновить Gradle или плагины — **согласитесь**

---

## 5️⃣ Сборка APK через Android Studio

### Вариант A: Debug APK (для тестирования)

1. Меню **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. Дождитесь сборки (внизу прогресс-бар)
3. APK будет в:
   ```
   f:\MyGitProjects\intraset-browser\mobile\android\app\build\outputs\apk\debug\app-debug.apk
   ```

### Вариант B: Release APK (для публикации)

1. **Создание ключа (keystore):**
   - Меню **Build** → **Generate Signed Bundle / APK**
   - Выберите **APK** → **Next**
   - Нажмите **Create new...**
   - Заполните:
     - Key store path: `f:\MyGitProjects\intraset-browser\mobile\android\release.keystore`
     - Password: (придумайте пароль)
     - Alias: `intra-browser`
     - Validity: `25` лет
   - Нажмите **OK**

2. **Настройка build.gradle:**
   
   Откройте файл `f:\MyGitProjects\intraset-browser\mobile\android\app\build.gradle` и добавьте перед `android {}`:

   ```gradle
   def keystorePropertiesFile = rootProject.file("keystore.properties")
   def keystoreProperties = new Properties()
   keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
   ```

   В секции `android {}` добавьте:

   ```gradle
   signingConfigs {
       release {
           keyAlias keystoreProperties['keyAlias']
           keyPassword keystoreProperties['keyPassword']
           storeFile file(keystoreProperties['storeFile'])
           storePassword keystoreProperties['storePassword']
       }
   }

   buildTypes {
       release {
           signingConfig signingConfigs.release
           minifyEnabled false
           proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
       }
   }
   ```

3. **Сборка:**
   - Правая панель **Gradle** → `app` → `Tasks` → `build` → `assembleRelease`
   - Или через терминал (см. ниже)

---

## 6️⃣ Сборка через командную строку

После установки Android Studio и настройки переменных:

### Debug APK
```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot"
cd f:\MyGitProjects\intraset-browser\mobile\android
.\gradlew.bat assembleDebug
```

### Release APK
```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot"
cd f:\MyGitProjects\intraset-browser\mobile\android
.\gradlew.bat assembleRelease
```

---

## 7️⃣ Запуск на эмуляторе

1. **Создание эмулятора:**
   - Android Studio → **Tools** → **Device Manager**
   - Нажмите **Create Device**
   - Выберите устройство (например, Pixel 6)
   - Выберите образ системы (API 36)
   - Нажмите **Finish**

2. **Запуск приложения:**
   ```powershell
   cd f:\MyGitProjects\intraset-browser\mobile
   npm run android
   ```

---

## 8️⃣ Запуск на реальном устройстве

1. Включите **Отладку по USB** на телефоне:
   - **Настройки** → **О телефоне** → 7 раз нажмите **Номер сборки**
   - Вернитесь → **Для разработчиков** → ✅ **Отладка по USB**

2. Подключите телефон по USB
3. Разрешите отладку на экране телефона
4. Проверьте подключение:
   ```powershell
   adb devices
   ```
5. Запустите:
   ```powershell
   cd f:\MyGitProjects\intraset-browser\mobile
   npm run android
   ```

---

## 📁 Расположение APK

После сборки APK будет в:

| Тип | Путь |
|-----|------|
| **Debug** | `mobile\android\app\build\outputs\apk\debug\app-debug.apk` |
| **Release** | `mobile\android\app\build\outputs\apk\release\app-release.apk` |

---

## 🐛 Решение проблем

### Ошибка: SDK location not found
```powershell
# Создайте файл local.properties
echo "sdk.dir=$env:LOCALAPPDATA\Android\Sdk" > f:\MyGitProjects\intraset-browser\mobile\android\local.properties
```

### Ошибка: NDK not found
Установите NDK через SDK Manager:
- **SDK Tools** → ✅ **NDK (Side by side)** → версия **27.1.12297006**

### Ошибка: Java version mismatch
Убедитесь, что используется JDK 17:
```powershell
& "C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot\bin\java.exe" -version
```

### Gradle sync failed
1. **File** → **Invalidate Caches** → **Invalidate and Restart**
2. Удалите папки `.gradle`, `build`, `.idea`
3. Откройте проект заново

---

## ✅ Чек-лист перед сборкой

- [ ] Android Studio установлена
- [ ] SDK Platform 36 установлен
- [ ] Build Tools 36.0.0 установлены
- [ ] NDK 27.1.12297006 установлен
- [ ] `ANDROID_HOME` настроен
- [ ] `JAVA_HOME` настроен
- [ ] Проект открывается в Android Studio без ошибок
