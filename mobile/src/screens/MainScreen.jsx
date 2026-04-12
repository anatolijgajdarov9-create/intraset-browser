import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  Platform,
  Linking,
  Share,
  ScrollView,
  BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';

import { useTabStore } from '../store/tabStore';
import { useSettingsStore } from '../store/settingsStore';
import { inputToUrl, getDomain, isTrackableUrl } from '../utils/url';
import {
  trackVisit,
  addHistoryEntry,
  addBookmark,
  removeBookmarkByUrl,
  isBookmarked as checkBookmark,
  addDownload,
  updateDownload,
} from '../utils/storage';
import { isIntranetUrl } from '../config/intranet';
import { useTheme } from '../hooks/useTheme';
import { SIZES } from '../utils/theme';

import NetInfo from '@react-native-community/netinfo';
import * as Haptics from 'expo-haptics';

import AddressBar from '../components/AddressBar';
import TabChips from '../components/TabChips';
import BrowserMenu from '../components/BrowserMenu';
import BottomToolbar from '../components/BottomToolbar';
import ProgressBar from '../components/ProgressBar';
import HomeContent from '../components/HomeContent';
import FindBar from '../components/FindBar';
import PrivateModeBanner from '../components/PrivateModeBanner';
import OfflineBanner from '../components/OfflineBanner';
import LinkContextMenu from '../components/LinkContextMenu';

// ─── Утилиты для скачивания файлов ──────────────────────────────────────────

const DOWNLOAD_EXTENSIONS = new Set([
  'pdf','doc','docx','xls','xlsx','ppt','pptx',
  'zip','rar','7z','tar','gz','tgz',
  'apk','exe','dmg','deb','rpm',
  'mp3','mp4','avi','mkv','mov','wav','flac',
  'csv',
]);

function isLikelyDownloadUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split('.').pop()?.toLowerCase();
    return !!ext && DOWNLOAD_EXTENSIONS.has(ext);
  } catch {
    return false;
  }
}

async function downloadFileAndSave(url) {
  if (!url) return;
  const filename = decodeURIComponent(url.split('/').pop()?.split('?')[0] || 'download');
  const downloadsDir = FileSystem.documentDirectory + 'downloads/';
  const dirInfo = await FileSystem.getInfoAsync(downloadsDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(downloadsDir, { intermediates: true });
  }
  // Сразу добавляем запись "загружается" — чтобы она отобразилась немедленно
  const entryList = await addDownload({ filename, url, uri: null, size: null, status: 'downloading' });
  const entryId = entryList?.[0]?.id;
  try {
    const { uri } = await FileSystem.downloadAsync(url, downloadsDir + filename);
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (entryId) {
      await updateDownload(entryId, { uri, size: fileInfo.size || null, status: 'completed' });
    }
    return filename;
  } catch (e) {
    if (entryId) await updateDownload(entryId, { status: 'failed' });
    throw e;
  }
}

// ─── Заглушка для заблокированной страницы ──────────────────────────────────

function BlockedView({ url, onHome, theme }) {
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.blockedContainer}>
      <Text style={styles.blockedIcon}>🚫</Text>
      <Text style={styles.blockedTitle}>Доступ заблокирован</Text>
      <Text style={styles.blockedUrl} numberOfLines={2}>{url}</Text>
      <Text style={styles.blockedText}>
        Этот сайт не является интранет-ресурсом. Режим «Только интранет» активен.
      </Text>
      <TouchableOpacity style={[styles.blockedButton, { backgroundColor: theme.primary }]} onPress={onHome}>
        <Text style={styles.blockedButtonText}>На главную</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Основной экран браузера ─────────────────────────────────────────────────

export default function MainScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const {
    tabs,
    activeTabId,
    updateTabUrl,
    updateTabTitle,
    updateTabFavicon,
    updateTabLoading,
    updateTabNavState,
    getActiveTab,
    createTab,
    switchTab,
    tabHomeOverlay,
    setTabHomeOverlay,
    tabZoom,
    setTabZoom,
  } = useTabStore();
  const { settings, toggleNightMode, toggleDarkMode } = useSettingsStore();

  const [isBookmarked, setIsBookmarked] = useState(false);
  const [blockedUrl, setBlockedUrl] = useState(null);
  const [findBarVisible, setFindBarVisible] = useState(false);
  const [findMatchCount, setFindMatchCount] = useState(0);
  const [findCurrentMatch, setFindCurrentMatch] = useState(0);
  const [loadProgress, setLoadProgress] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);
  const [isDesktopMode, setIsDesktopMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuUrl, setContextMenuUrl] = useState('');
  const [contextMenuElementType, setContextMenuElementType] = useState('link');
  // Режим чтения: { [tabId]: boolean } — не персистируется
  const [readingModes, setReadingModes] = useState({});

  const webViewRef = useRef(null);
  const activeTabIdRef = useRef(activeTabId);
  const activeTabRef = useRef(null);
  const findBarVisibleRef = useRef(false);
  // Предыдущий поисковый термин — для определения смены запроса vs навигации пред/след
  const findTermRef = useRef('');

  const activeTab = getActiveTab();

  // Синхронизируем ref'ы
  useEffect(() => {
    activeTabIdRef.current = activeTabId;
    activeTabRef.current = activeTab;
  }, [activeTabId, activeTab]);

  // Проверяем, добавлена ли страница в закладки
  useEffect(() => {
    const check = async () => {
      if (activeTab?.url && activeTab.url !== 'intra://home') {
        const result = await checkBookmark(activeTab.url);
        setIsBookmarked(result);
      } else {
        setIsBookmarked(false);
      }
    };
    check();
  }, [activeTab?.url]);

  // Синхронизируем ref для findBarVisible (защита от stale closure в handleNavigationStateChange)
  useEffect(() => { findBarVisibleRef.current = findBarVisible; }, [findBarVisible]);

  // Слежение за состоянием сети
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(state.isConnected === false);
    });
    return unsubscribe;
  }, []);

  // Аппаратная кнопка «Назад» (Android)
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const onBackPress = () => {
      const store = useTabStore.getState();

      // 1. Активен домашний оверлей → снять его (как будто пользователь «вернулся» со страницы)
      if (store.tabHomeOverlay[activeTabIdRef.current]) {
        store.setTabHomeOverlay(activeTabIdRef.current, false);
        return true;
      }

      // 2. WebView может вернуться назад
      if (activeTabRef.current?.canGoBack) {
        webViewRef.current?.goBack();
        return true;
      }

      // 3. Мы на домашней странице (или нет активной вкладки) → диалог выхода
      const tab = activeTabRef.current;
      const isOnHome = !tab || tab.url === 'intra://home' || tab.isHome;
      if (isOnHome) {
        Alert.alert(
          'Выйти из браузера?',
          'Вы действительно хотите закрыть браузер?',
          [
            { text: 'Отмена', style: 'cancel' },
            { text: 'Выйти', style: 'destructive', onPress: () => BackHandler.exitApp() },
          ]
        );
        return true;
      }

      // 4. Мы на веб-странице, но вернуться назад нельзя → показать домашнюю страницу
      //    (НИКОГДА не позволяем системе закрыть приложение без подтверждения)
      store.setTabHomeOverlay(activeTabIdRef.current, true);
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, []); // refs всегда актуальны — deps пустые

  // При закрытии FindBar сбрасываем подсветку
  useEffect(() => {
    if (!findBarVisible) {
      webViewRef.current?.injectJavaScript(`
        (function() {
          var el = document.getElementById('__intra_find_style__');
          if (el) el.remove();
          document.querySelectorAll('.__intra_hl__').forEach(function(n) {
            var t = document.createTextNode(n.textContent);
            n.parentNode.replaceChild(t, n);
          });
        })(); true;
      `);
    }
  }, [findBarVisible]);

  // ─── Перехват навигации внутри WebView ───────────────────────────────────

  const handleShouldStartLoadWithRequest = useCallback((request) => {
    const { url, navigationType } = request;

    if (!url || url.startsWith('intra://') || url.startsWith('about:')) {
      return true;
    }

    // Определяем тип навигации: click (пользователь кликнул ссылку) или other
    const isUserClick = navigationType === 'click' || navigationType === 'formSubmitted';

    // Открываем системные URI-схемы через Linking
    const systemSchemes = ['tel:', 'mailto:', 'intent:', 'market:', 'geo:', 'sms:', 'whatsapp:', 'tg:', 'telegram:', 'vk:', 'skype:', 'slack:'];
    if (systemSchemes.some(s => url.startsWith(s))) {
      Linking.openURL(url).catch(() => {});
      return false;
    }

    // Проверка на интранет-режим
    if (settings.intranetOnly && !isIntranetUrl(url)) {
      setBlockedUrl(url);
      updateTabUrl(activeTabIdRef.current, 'intra://home');
      return false;
    }

    // Внешние ссылки (не HTTP/HTTPS) — открываем в системном браузере
    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:', 'file:', 'data:'].includes(parsedUrl.protocol)) {
        Linking.openURL(url).catch(() => {});
        return false;
      }
    } catch {
      return false;
    }

    // Android: перехватываем файлы по расширению до того, как их заберёт DownloadManager
    // onFileDownload работает только на iOS, поэтому нужна эта ветка
    if (Platform.OS === 'android' && isLikelyDownloadUrl(url)) {
      Alert.alert('Скачивание', `Начинаю скачивание...`);
      downloadFileAndSave(url)
        .then(filename => Alert.alert('Готово', `Файл «${filename}» сохранён в загрузки`))
        .catch(e => Alert.alert('Ошибка', `Не удалось скачать файл: ${e.message}`));
      return false;
    }

    return true;
  }, [settings.intranetOnly]);

  // ─── Навигация ────────────────────────────────────────────────────────────

  const handleNavigate = useCallback((rawInput) => {
    const url = inputToUrl(rawInput, settings.searchEngine);
    if (!url) return;

    if (settings.intranetOnly && !isIntranetUrl(url)) {
      setBlockedUrl(url);
      return;
    }
    setBlockedUrl(null);
    // Снимаем домашний оверлей при любой навигации
    setTabHomeOverlay(activeTabIdRef.current, false);
    updateTabUrl(activeTabIdRef.current, url);
  }, [settings.intranetOnly, settings.searchEngine, setTabHomeOverlay, updateTabUrl]);

  const handleHome = useCallback(() => {
    setBlockedUrl(null);
    setFindBarVisible(false);
    const tabId = activeTabIdRef.current;
    const currentTab = activeTabRef.current;
    // Если вкладка уже на домашней странице — ничего не делаем
    if (!currentTab || currentTab.url === 'intra://home') return;
    // Показываем домашний оверлей, НЕ меняя URL вкладки
    setTabHomeOverlay(tabId, true);
    // Сбрасываем заголовок и favicon, чтобы чип показывал домашнюю страницу
    updateTabTitle(tabId, 'Новая вкладка');
    updateTabFavicon(tabId, null);
  }, [setTabHomeOverlay, updateTabTitle, updateTabFavicon]);

  // При выборе вкладки через TabChips — всегда снимаем домашний оверлей для той вкладки
  const handleSelectTab = useCallback((tabId) => {
    const overlay = useTabStore.getState().tabHomeOverlay;
    if (overlay[tabId]) {
      setTabHomeOverlay(tabId, false);
    }
    switchTab(tabId);
  }, [switchTab, setTabHomeOverlay]);

  const handleNewTab = useCallback((isPrivate = false) => {
    const tab = createTab('intra://home', 'Новая вкладка', isPrivate);
    setBlockedUrl(null);
    setFindBarVisible(false);
  }, [createTab]);

  const handleGoBack = useCallback(() => {
    // Если активен домашний оверлей — кнопка «Назад» снимает его
    const { tabHomeOverlay: overlay, setTabHomeOverlay: setOverlay } = useTabStore.getState();
    if (overlay[activeTabIdRef.current]) {
      setOverlay(activeTabIdRef.current, false);
      return;
    }
    webViewRef.current?.goBack();
  }, []);

  const handleGoForward = useCallback(() => {
    webViewRef.current?.goForward();
  }, []);

  const handleReload = useCallback(() => {
    webViewRef.current?.reload();
  }, []);

  const handleStop = useCallback(() => {
    webViewRef.current?.stopLoading();
  }, []);

  // ─── Управление меню ───────────────────────────────────────────────────────

  const handleMenuAction = useCallback((action) => {
    const tab = activeTabRef.current;
    switch (action) {
      case 'reload':
        handleReload();
        break;
      case 'desktop':
        setIsDesktopMode(prev => !prev);
        setTimeout(() => {
          const url = activeTabRef.current?.url;
          if (url && url !== 'intra://home') {
            updateTabUrl(activeTabIdRef.current, url);
          }
        }, 100);
        break;
      case 'share':
        if (tab?.url && tab.url !== 'intra://home') {
          Share.share({
            message: tab.url,
            title: tab.title || tab.url,
          });
        }
        break;
      case 'save':
        Alert.alert('Сохранить', 'Функция сохранения страницы в разработке');
        break;
      case 'find':
        setFindBarVisible(true);
        break;
      case 'nightMode': {
        const newMode = !settings.nightMode;
        toggleNightMode();
        // Синхронизируем тему интерфейса с ночным режимом
        if (newMode !== settings.darkMode) {
          toggleDarkMode();
        }
        webViewRef.current?.injectJavaScript(newMode ? nightModeOnScript : nightModeOffScript);
        break;
      }
      case 'reading': {
        const tabId = activeTabIdRef.current;
        const newVal = !readingModes[tabId];
        setReadingModes(prev => ({ ...prev, [tabId]: newVal }));
        const readerScript = `(function(){
          var el = document.getElementById('__intra_reader__');
          if (el) { el.remove(); }
          ${newVal ? `
          var s = document.createElement('style');
          s.id = '__intra_reader__';
          s.textContent = [
            'html,body{background:#fffff8!important;color:#1a1a1a!important}',
            'body{max-width:680px!important;margin:0 auto!important;padding:20px!important;font-family:Georgia,serif!important;font-size:18px!important;line-height:1.8!important}',
            'nav,header,footer,aside,[class*="nav"],[class*="menu"],[class*="sidebar"],[class*="ad"],[class*="banner"],[id*="nav"],[id*="header"],[id*="footer"],[id*="sidebar"]{display:none!important}',
            'img,video{max-width:100%!important;height:auto!important}',
            'a{color:#2563eb!important}'
          ].join('\\n');
          document.head.appendChild(s);
          ` : ''}
        })(); true;`;
        webViewRef.current?.injectJavaScript(readerScript);
        break;
      }
      case 'settings':
        navigation.navigate('Settings');
        break;
    }
  }, [handleReload, settings.nightMode, settings.darkMode, toggleNightMode, toggleDarkMode, readingModes]);

  // ─── Масштаб текста ──────────────────────────────────────────────────────────

  const handleZoomIn = useCallback(() => {
    const tabId = activeTabIdRef.current;
    const current = useTabStore.getState().tabZoom[tabId] || 100;
    const next = Math.min(200, current + 10);
    setTabZoom(tabId, next);
    webViewRef.current?.injectJavaScript(
      `(function(){document.body.style.zoom='${next}%';document.documentElement.style.zoom='${next}%';})(); true;`
    );
  }, [setTabZoom]);

  const handleZoomOut = useCallback(() => {
    const tabId = activeTabIdRef.current;
    const current = useTabStore.getState().tabZoom[tabId] || 100;
    const next = Math.max(50, current - 10);
    setTabZoom(tabId, next);
    webViewRef.current?.injectJavaScript(
      `(function(){document.body.style.zoom='${next}%';document.documentElement.style.zoom='${next}%';})(); true;`
    );
  }, [setTabZoom]);

  const { closeTab } = useTabStore();

  const handleCloseTab = useCallback((tabId) => {
    closeTab(tabId);
  }, [closeTab]);

  // target="_blank" и window.open() — открываем в новой вкладке, а не в системном браузере
  const handleOpenWindow = useCallback((syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    const targetUrl = nativeEvent?.targetUrl;
    if (targetUrl && targetUrl !== 'about:blank') {
      createTab(targetUrl, 'Новая вкладка', activeTabRef.current?.isPrivate || false);
    }
  }, [createTab]);

  const handleLoadProgress = useCallback(({ nativeEvent }) => {
    setLoadProgress(nativeEvent.progress);
  }, []);

  // ─── Состояние WebView ───────────────────────────────────────────────────

  const handleNavigationStateChange = useCallback((navState) => {
    const { url, title, canGoBack, canGoForward, loading } = navState;
    const tabId = activeTabIdRef.current;

    // Автозакрытие FindBar при переходе на другую страницу
    const prevUrl = activeTabRef.current?.url;
    if (findBarVisibleRef.current && url && prevUrl && url !== prevUrl) {
      setFindBarVisible(false);
    }

    updateTabUrl(tabId, url);
    updateTabTitle(tabId, title || getDomain(url));
    updateTabLoading(tabId, loading);
    updateTabNavState(tabId, { canGoBack, canGoForward });

    const isPrivate = activeTabRef.current?.isPrivate;
    if (!loading && isTrackableUrl(url) && !isPrivate) {
      trackVisit(url, title, null);
      addHistoryEntry({ url, title, favicon: null });
    }
  }, [updateTabUrl, updateTabTitle, updateTabLoading, updateTabNavState]);

  const handleLoadStart = useCallback(() => {
    updateTabLoading(activeTabIdRef.current, true);
  }, []);

  // ─── Pull to refresh ───────────────────────────────────────────────────────

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    webViewRef.current?.reload();
  }, []);

  const handleLoadEnd = useCallback(() => {
    setRefreshing(false);
    updateTabLoading(activeTabIdRef.current, false);
  }, []);

  const handleError = useCallback(() => {
    updateTabLoading(activeTabIdRef.current, false);
  }, []);

  // ─── Закладки ────────────────────────────────────────────────────────────

  const handleToggleBookmark = useCallback(async () => {
    const tab = activeTabRef.current;
    if (!tab?.url || tab.url === 'intra://home') return;

    if (isBookmarked) {
      await removeBookmarkByUrl(tab.url);
      setIsBookmarked(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      await addBookmark({
        url: tab.url,
        title: tab.title || getDomain(tab.url),
        favicon: tab.favicon || null,
      });
      setIsBookmarked(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [isBookmarked]);

  // ─── Скачивание файлов ───────────────────────────────────────────────────

  // onFileDownload срабатывает на iOS; на Android используем перехват в onShouldStartLoadWithRequest
  const handleFileDownload = useCallback(async ({ nativeEvent }) => {
    const url = nativeEvent?.url;
    if (!url) return;
    Alert.alert('Скачивание', `Начинаю скачивание...`);
    try {
      const filename = await downloadFileAndSave(url);
      Alert.alert('Готово', `Файл «${filename}» сохранён в загрузки`);
    } catch (e) {
      Alert.alert('Ошибка', `Не удалось скачать файл: ${e.message}`);
    }
  }, []);

  // ─── Favicon из WebView ──────────────────────────────────────────────────

  const extractFaviconScript = `
    (function() {
      var favicon = document.querySelector('link[rel="icon"]') ||
                    document.querySelector('link[rel="shortcut icon"]') ||
                    document.querySelector('link[rel="apple-touch-icon"]');
      var faviconUrl = favicon ? (favicon.href || favicon.getAttribute('href')) : null;
      if (!faviconUrl) faviconUrl = window.location.origin + '/favicon.ico';
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'favicon', favicon: faviconUrl }));
      true;
    })();
  `;

  // Определение долгого нажатия на ссылку или изображение → контекстное меню
  const linkLongPressScript = `(function(){
    var _lpt;
    document.addEventListener('touchstart', function(e){
      var a   = e.target.closest('a[href]');
      var img = e.target.closest('img[src]');
      if (!a && !img) return;
      _lpt = setTimeout(function(){
        var payload;
        if (img && img.src) {
          // Изображение (может быть одновременно обёрнуто в <a>)
          payload = {
            type: '__linkContext',
            elementType: 'image',
            url: img.src,
          };
        } else {
          // Ссылка
          payload = {
            type: '__linkContext',
            elementType: 'link',
            url: a.href,
            text: (a.innerText || a.textContent || '').trim().substring(0, 80),
          };
        }
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }, 500);
    }, {passive:true});
    document.addEventListener('touchend',  function(){ clearTimeout(_lpt); }, {passive:true});
    document.addEventListener('touchmove', function(){ clearTimeout(_lpt); }, {passive:true});
  })(); true;`;

  // ─── Принудительная светлая тема на сайтах ──────────────────────────────────
  //
  // Запускается ДО загрузки контента (injectedJavaScriptBeforeContentLoaded).
  // Двойная защита:
  //   1. <meta name="color-scheme" content="light"> — говорит движку CSS,
  //      что страница только светлая (@media prefers-color-scheme: dark не срабатывает)
  //   2. Переопределение window.matchMedia — для JS-кода, читающего тему
  //
  // Всегда применяется, чтобы страницы оставались светлыми для CSS-фильтра
  // ночного режима (иначе тёмная страница + инверсия = белый экран).
  const forceLightBeforeScript = `
    (function(){
      try {
        // 1. meta color-scheme: light — самый надёжный способ отключить dark-тему на уровне CSS
        var m = document.createElement('meta');
        m.name = 'color-scheme';
        m.content = 'light';
        document.head.appendChild(m);
      } catch(e) {}
      try {
        // 2. Переопределяем window.matchMedia для JS-библиотек (React, Vue, MUI и т.д.)
        var _mm = window.matchMedia.bind(window);
        window.matchMedia = function(q) {
          if (q && q.indexOf('prefers-color-scheme') !== -1) {
            return {
              matches: q.indexOf('dark') === -1,
              media: q,
              onchange: null,
              addListener: function() {},
              removeListener: function() {},
              addEventListener: function() {},
              removeEventListener: function() {},
              dispatchEvent: function() { return false; },
            };
          }
          return _mm(q);
        };
      } catch(e) {}
    })(); true;
  `;

  // CSS-инъекция ночного режима
  const nightModeOnScript = `(function(){
    var el = document.getElementById('__intra_night__');
    if (!el) { el = document.createElement('style'); el.id = '__intra_night__'; document.head.appendChild(el); }
    el.textContent = 'html{filter:invert(1) hue-rotate(180deg)!important;}img,video,canvas,svg,iframe{filter:invert(1) hue-rotate(180deg)!important;}';
  })(); true;`;

  const nightModeOffScript = `(function(){
    var el = document.getElementById('__intra_night__');
    if (el) el.remove();
  })(); true;`;

  // Перехват window.alert / confirm / prompt — преобразуем в нативные диалоги
  const dialogInterceptScript = `(function(){
    window.alert = function(msg) {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'__dialog',kind:'alert',msg:String(msg||'')}));
    };
    window.confirm = function(msg) {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'__dialog',kind:'confirm',msg:String(msg||'')}));
      return true;
    };
    window.prompt = function(msg, def) {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'__dialog',kind:'prompt',msg:String(msg||'')}));
      return null;
    };
  })(); true;`;

  // ─── Find in Page ────────────────────────────────────────────────────────

  const handleFind = useCallback((term, direction) => {
    if (!term) {
      findTermRef.current = '';
      webViewRef.current?.injectJavaScript(`
        (function() {
          var el = document.getElementById('__intra_find_style__');
          if (el) el.remove();
          document.querySelectorAll('.__intra_hl__').forEach(function(n) {
            var t = document.createTextNode(n.textContent);
            n.parentNode.replaceChild(t, n);
          });
          window.__intraFindIdx = 0;
        })(); true;
      `);
      setFindMatchCount(0);
      setFindCurrentMatch(0);
      return;
    }

    if (Platform.OS === 'ios') {
      webViewRef.current?.injectJavaScript(`
        window.find(${JSON.stringify(term)}, false, ${direction === 'backward'}, true, false, true, false); true;
      `);
      return;
    }

    // Android: новый запрос или навигация по результатам?
    const isNewTerm = findTermRef.current !== term;
    findTermRef.current = term;

    if (isNewTerm) {
      // Полный проход: подсветить все вхождения, прокрутить к первому
      webViewRef.current?.injectJavaScript(`
        (function() {
          // Стиль подсветки
          var prevStyle = document.getElementById('__intra_find_style__');
          if (!prevStyle) {
            var s = document.createElement('style');
            s.id = '__intra_find_style__';
            s.textContent = [
              '.__intra_hl__         { background:#fbbf24; color:#000; border-radius:2px; }',
              '.__intra_hl_active__  { background:#f97316!important; outline:2px solid #ea580c; }'
            ].join('');
            document.head.appendChild(s);
          }
          // Убираем старую подсветку
          document.querySelectorAll('.__intra_hl__').forEach(function(n) {
            var t = document.createTextNode(n.textContent);
            n.parentNode.replaceChild(t, n);
          });

          // Находим вхождения через indexOf (без regexp-бага с lastIndex)
          var term     = ${JSON.stringify(term)};
          var termLow  = term.toLowerCase();
          // Фильтр: пропускаем текст внутри <script>, <style>, <noscript>
          var skipTags = {SCRIPT:1, STYLE:1, NOSCRIPT:1, TEXTAREA:1};
          var walker   = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
              acceptNode: function(n) {
                var p = n.parentElement;
                while (p) {
                  if (skipTags[p.tagName]) return NodeFilter.FILTER_REJECT;
                  p = p.parentElement;
                }
                return NodeFilter.FILTER_ACCEPT;
              }
            }
          );
          var textNodes = [];
          var node;
          while ((node = walker.nextNode())) {
            if (node.nodeValue.toLowerCase().indexOf(termLow) !== -1) {
              textNodes.push(node);
            }
          }

          var hlCount = 0;
          textNodes.forEach(function(node) {
            var text = node.nodeValue;
            var lText = text.toLowerCase();
            var frag = document.createDocumentFragment();
            var pos = 0, idx;
            while ((idx = lText.indexOf(termLow, pos)) !== -1) {
              if (idx > pos) frag.appendChild(document.createTextNode(text.substring(pos, idx)));
              var span = document.createElement('span');
              span.className = '__intra_hl__';
              span.textContent = text.substring(idx, idx + term.length);
              frag.appendChild(span);
              hlCount++;
              pos = idx + term.length;
            }
            if (pos < text.length) frag.appendChild(document.createTextNode(text.substring(pos)));
            node.parentNode.replaceChild(frag, node);
          });

          // Отметить первый как активный
          window.__intraFindIdx = 0;
          var items = document.querySelectorAll('.__intra_hl__');
          items.forEach(function(el, i) {
            el.classList.toggle('__intra_hl_active__', i === 0);
          });
          if (items[0]) items[0].scrollIntoView({ behavior: 'smooth', block: 'center' });

          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'findResult', count: hlCount
          }));
        })(); true;
      `);
    } else {
      // Навигация по уже найденным результатам (prev / next)
      const delta = direction === 'backward' ? -1 : 1;
      webViewRef.current?.injectJavaScript(`
        (function() {
          var items = document.querySelectorAll('.__intra_hl__');
          if (!items.length) return;
          var total = items.length;
          window.__intraFindIdx = ((window.__intraFindIdx || 0) + ${delta} + total) % total;
          items.forEach(function(el, i) {
            el.classList.toggle('__intra_hl_active__', i === window.__intraFindIdx);
          });
          items[window.__intraFindIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'findNav', current: window.__intraFindIdx + 1
          }));
        })(); true;
      `);
    }
  }, []);

  // Обработка результатов поиска из WebView
  const handleWebViewMessageExtended = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'favicon' && data.favicon && activeTabIdRef.current) {
        updateTabFavicon(activeTabIdRef.current, data.favicon);
      } else if (data.type === 'findResult') {
        setFindMatchCount(data.count);
        setFindCurrentMatch(data.count > 0 ? 1 : 0);
      } else if (data.type === 'findNav') {
        // Обновляем текущий номер результата при навигации пред/след
        setFindCurrentMatch(data.current);
      } else if (data.type === '__dialog') {
        Alert.alert(
          data.kind === 'alert' ? 'Сообщение' : 'Подтверждение',
          data.msg || ''
        );
      } else if (data.type === '__download' && data.url) {
        // Перехвачен клик по <a download> — скачиваем сами, чтобы попало в список загрузок
        const dlUrl = data.url;
        downloadFileAndSave(dlUrl)
          .then(filename => Alert.alert('Готово', `«${filename}» сохранён в загрузки`))
          .catch(e => Alert.alert('Ошибка загрузки', e.message));
      } else if (data.type === '__linkContext' && data.url) {
        setContextMenuUrl(data.url);
        setContextMenuElementType(data.elementType || 'link');
        setContextMenuVisible(true);
      }
    } catch {
      // Игнорируем ошибки парсинга
    }
  }, [updateTabFavicon]);

  // Открыть ссылку из контекстного меню в новой вкладке
  const handleOpenLinkInNewTab = useCallback((url) => {
    createTab(url, url, activeTabRef.current?.isPrivate || false);
  }, [createTab]);

  // Скачать файл / изображение из контекстного меню
  const handleContextMenuDownload = useCallback((url) => {
    if (!url) return;
    Alert.alert('Скачивание', 'Начинаю скачивание...');
    downloadFileAndSave(url)
      .then(filename => Alert.alert('Готово', `Файл «${filename}» сохранён в загрузки`))
      .catch(e => Alert.alert('Ошибка', `Не удалось скачать: ${e.message}`));
  }, []);

  // ─── Рендер ──────────────────────────────────────────────────────────────

  const isTabShowingHomeOverlay = !!(tabHomeOverlay[activeTabId]);
  const showHome = !activeTab || activeTab.url === 'intra://home' || activeTab.isHome || isTabShowingHomeOverlay;
  const currentZoom = tabZoom[activeTabId] || 100;
  const isReadingMode = !!readingModes[activeTabId];

  // Скрипт масштаба — применяется при каждой загрузке страницы
  const zoomInitScript = currentZoom !== 100
    ? `(function(){document.body.style.zoom='${currentZoom}%';document.documentElement.style.zoom='${currentZoom}%';})(); true;`
    : '';

  // Скрипт режима чтения — применяется при каждой загрузке страницы
  const readerInitScript = isReadingMode ? `(function(){
    var s = document.createElement('style');
    s.id = '__intra_reader__';
    s.textContent = [
      'html,body{background:#fffff8!important;color:#1a1a1a!important}',
      'body{max-width:680px!important;margin:0 auto!important;padding:20px!important;font-family:Georgia,serif!important;font-size:18px!important;line-height:1.8!important}',
      'nav,header,footer,aside,[class*="nav"],[class*="menu"],[class*="sidebar"],[class*="ad"],[class*="banner"],[id*="nav"],[id*="header"],[id*="footer"],[id*="sidebar"]{display:none!important}',
      'img,video{max-width:100%!important;height:auto!important}',
      'a{color:#2563eb!important}'
    ].join('\\n');
    document.head.appendChild(s);
  })(); true;` : '';
  const showBlocked = !!blockedUrl && !showHome;
  const showWebView = !showHome && !showBlocked;

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safeArea, activeTab?.isPrivate && styles.safeAreaPrivate]}
    >
      {/* Баннер приватного режима */}
      <PrivateModeBanner visible={!!activeTab?.isPrivate} />

      {/* Табы-чипсы */}
      <TabChips
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={handleSelectTab}
        onNewTab={() => handleNewTab(false)}
        onNewPrivateTab={() => handleNewTab(true)}
        onCloseTab={handleCloseTab}
        onOpenTabs={() => navigation.navigate('Tabs')}
      />

      {/* Адресная строка */}
      <AddressBar
        url={activeTab?.url || 'intra://home'}
        loading={activeTab?.loading || false}
        isPrivate={activeTab?.isPrivate || false}
        isBookmarked={isBookmarked}
        onNavigate={handleNavigate}
        onReload={handleReload}
        onStop={handleStop}
        onToggleBookmark={handleToggleBookmark}
        onOpenMenu={() => setMenuVisible(true)}
      />

      {/* Прогресс-бар загрузки */}
      <ProgressBar
        loading={activeTab?.loading || false}
        progress={loadProgress}
        isPrivate={activeTab?.isPrivate || false}
      />

      {/* Меню браузера */}
      <BrowserMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onAction={handleMenuAction}
        url={activeTab?.url}
        isDesktopMode={isDesktopMode}
        isNightMode={settings.nightMode}
        isReadingMode={isReadingMode}
        currentZoom={currentZoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        canGoBack={activeTab?.canGoBack || false}
        canGoForward={activeTab?.canGoForward || false}
        headerHeight={insets.top + (activeTab?.isPrivate ? 28 : 0) + SIZES.tabBarHeight + 56}
      />

      {/* Область контента */}
      <View style={styles.content}>
        {showHome && (
          <HomeContent
            onNavigate={handleNavigate}
            onOpenBookmarks={() => navigation.navigate('Bookmarks')}
            onOpenHistory={() => navigation.navigate('History')}
            onOpenDownloads={() => navigation.navigate('Downloads')}
            onOpenSettings={() => navigation.navigate('Settings')}
          />
        )}

        {showBlocked && (
          <BlockedView
            url={blockedUrl}
            onHome={handleHome}
            theme={theme}
          />
        )}

        {showWebView && activeTab?.url && (
          <WebView
            ref={webViewRef}
            source={{ uri: activeTab.url }}
            onNavigationStateChange={handleNavigationStateChange}
            onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
            onOpenWindow={handleOpenWindow}
            onLoadStart={handleLoadStart}
            onLoadEnd={handleLoadEnd}
            onLoadProgress={handleLoadProgress}
            onError={handleError}
            onFileDownload={handleFileDownload}
            onMessage={handleWebViewMessageExtended}
            // Запускается ДО парсинга страницы: переопределяем matchMedia
            // чтобы сайты думали что ОС в светлом режиме.
            injectedJavaScriptBeforeContentLoaded={forceLightBeforeScript}
            injectedJavaScript={
              // 1. Принудительно обновляем color-scheme после загрузки страницы:
              //    некоторые сайты переписывают мета-тег через JS — восстанавливаем.
              `(function(){
                var m = document.querySelector('meta[name="color-scheme"]');
                if (m) m.content = 'light';
              })(); true;` + '\n' +
              // 2. Перехват кликов на <a download> — чтобы загрузки попадали в наш список
              `(function(){
                document.addEventListener('click', function(e){
                  var a = e.target.closest('a[download], a[href$=".pdf"], a[href$=".zip"], a[href$=".apk"], a[href$=".doc"], a[href$=".docx"], a[href$=".xls"], a[href$=".xlsx"], a[href$=".mp3"], a[href$=".mp4"]');
                  if (!a || !a.href) return;
                  // Только если явно помечено как download ИЛИ это известный тип файла
                  if (a.hasAttribute('download') || /\.(pdf|zip|apk|doc|docx|xls|xlsx|mp3|mp4|avi|mkv|mov|wav|flac|rar|7z|csv|ppt|pptx|dmg|exe|deb)$/i.test(a.pathname || '')) {
                    e.preventDefault();
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: '__download',
                      url: a.href,
                      filename: a.download || '',
                    }));
                  }
                }, true);
              })(); true;` + '\n' +
              extractFaviconScript + '\n' +
              dialogInterceptScript + '\n' +
              linkLongPressScript +
              (settings.nightMode ? '\n' + nightModeOnScript : '') +
              (zoomInitScript ? '\n' + zoomInitScript : '') +
              (readerInitScript ? '\n' + readerInitScript : '')
            }
            pullToRefreshEnabled={true}
            renderError={(domain, code, desc) => (
              <View style={styles.errorContainer}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorTitle}>Страница недоступна</Text>
                <Text style={styles.errorDesc}>{desc || 'Проверьте подключение к сети'}</Text>
                <TouchableOpacity
                  style={[styles.blockedButton, { backgroundColor: theme.primary }]}
                  onPress={handleReload}
                >
                  <Text style={styles.blockedButtonText}>Повторить</Text>
                </TouchableOpacity>
              </View>
            )}
            style={styles.webView}
            originWhitelist={['*']}
            setSupportMultipleWindows={false}
            setSupportZoom={true}
            startInLoadingState={false}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowFileAccess={true}
            allowUniversalAccessFromFileURLs={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            sharedCookiesEnabled={!activeTab?.isPrivate}
            thirdPartyCookiesEnabled={!activeTab?.isPrivate}
            cacheEnabled={!activeTab?.isPrivate}
            incognito={activeTab?.isPrivate || false}
            scalesPageToFit={true}
            bounces={true}
            backgroundColor={theme.background}
            userAgent={isDesktopMode ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' : undefined}
          />
        )}
      </View>

      {/* Панель поиска по странице */}
      {findBarVisible && (
        <FindBar
          visible={findBarVisible}
          onClose={() => setFindBarVisible(false)}
          onSearch={handleFind}
          matchCount={findMatchCount}
          currentMatch={findCurrentMatch}
        />
      )}

      {/* Нижняя панель навигации */}
      <BottomToolbar
        canGoBack={activeTab?.canGoBack || false}
        canGoForward={activeTab?.canGoForward || false}
        isPrivate={activeTab?.isPrivate || false}
        isBookmarked={isBookmarked}
        tabCount={tabs.length}
        onGoBack={handleGoBack}
        onGoForward={handleGoForward}
        onHome={handleHome}
        onToggleBookmark={handleToggleBookmark}
        onOpenTabs={() => navigation.navigate('Tabs')}
        onOpenFind={() => setFindBarVisible(v => !v)}
      />

      <OfflineBanner visible={isOffline} />

      {/* Контекстное меню длинного нажатия на ссылку / изображение */}
      <LinkContextMenu
        visible={contextMenuVisible}
        url={contextMenuUrl}
        elementType={contextMenuElementType}
        onClose={() => setContextMenuVisible(false)}
        onNavigateHere={handleNavigate}
        onOpenInNewTab={handleOpenLinkInNewTab}
        onDownload={handleContextMenuDownload}
      />
    </SafeAreaView>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.tabBarBg,
  },
  safeAreaPrivate: {
    backgroundColor: theme.privateLight,
  },
  content: {
    flex: 1,
    backgroundColor: theme.background,
  },
  webView: {
    flex: 1,
  },
  // ── Error page ──
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.paddingXl,
    backgroundColor: theme.background,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: SIZES.paddingLg,
  },
  errorTitle: {
    fontSize: SIZES.textXl,
    fontWeight: '700',
    color: theme.text,
    marginBottom: SIZES.paddingSm,
  },
  errorDesc: {
    fontSize: SIZES.textSm,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: SIZES.paddingXl,
  },
  // ── Blocked page ──
  blockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.paddingXl,
    backgroundColor: theme.background,
  },
  blockedIcon: {
    fontSize: 56,
    marginBottom: SIZES.paddingLg,
  },
  blockedTitle: {
    fontSize: SIZES.text2Xl,
    fontWeight: '700',
    color: theme.text,
    marginBottom: SIZES.paddingSm,
  },
  blockedUrl: {
    fontSize: SIZES.textSm,
    color: theme.error,
    marginBottom: SIZES.paddingMd,
    textAlign: 'center',
  },
  blockedText: {
    fontSize: SIZES.textMd,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: SIZES.paddingXl,
    lineHeight: 22,
  },
  blockedButton: {
    paddingVertical: SIZES.paddingMd,
    paddingHorizontal: SIZES.paddingXl,
    borderRadius: SIZES.radiusLg,
  },
  blockedButtonText: {
    color: '#ffffff',
    fontSize: SIZES.textMd,
    fontWeight: '600',
  },
});
