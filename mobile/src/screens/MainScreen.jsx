import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';

import { useTabStore } from '../store/tabStore';
import { useSettingsStore } from '../store/settingsStore';
import { inputToUrl, getDomain, isTrackableUrl } from '../utils/url';
import {
  trackVisit,
  addHistoryEntry,
  addBookmark,
  removeBookmark,
  isBookmarked as checkBookmark,
  getDownloads,
  setDownloadsList,
} from '../utils/storage';
import { isIntranetUrl } from '../config/intranet';
import { useTheme } from '../hooks/useTheme';
import { SIZES } from '../utils/theme';

import AddressBar from '../components/AddressBar';
import BottomToolbar from '../components/BottomToolbar';
import ProgressBar from '../components/ProgressBar';
import HomeContent from '../components/HomeContent';
import FindBar from '../components/FindBar';
import PrivateModeBanner from '../components/PrivateModeBanner';

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
  } = useTabStore();
  const { settings } = useSettingsStore();

  const [isBookmarked, setIsBookmarked] = useState(false);
  const [blockedUrl, setBlockedUrl] = useState(null);
  const [findBarVisible, setFindBarVisible] = useState(false);
  const [findMatchCount, setFindMatchCount] = useState(0);
  const [findCurrentMatch, setFindCurrentMatch] = useState(0);
  const [loadProgress, setLoadProgress] = useState(0);

  const webViewRef = useRef(null);
  const activeTabIdRef = useRef(activeTabId);
  const activeTabRef = useRef(null);

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

  // ─── Навигация ────────────────────────────────────────────────────────────

  const handleNavigate = useCallback((rawInput) => {
    const url = inputToUrl(rawInput, settings.searchEngine);
    if (!url) return;

    if (settings.intranetOnly && !isIntranetUrl(url)) {
      setBlockedUrl(url);
      return;
    }
    setBlockedUrl(null);
    updateTabUrl(activeTabIdRef.current, url);
  }, [settings.intranetOnly, settings.searchEngine]);

  const handleHome = useCallback(() => {
    setBlockedUrl(null);
    setFindBarVisible(false);
    updateTabUrl(activeTabIdRef.current, 'intra://home');
  }, []);

  const handleNewTab = useCallback((isPrivate = false) => {
    const tab = createTab('intra://home', 'Новая вкладка', isPrivate);
    setBlockedUrl(null);
    setFindBarVisible(false);
  }, [createTab]);

  const handleGoBack = useCallback(() => {
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

  // ─── Состояние WebView ───────────────────────────────────────────────────

  const handleNavigationStateChange = useCallback((navState) => {
    const { url, title, canGoBack, canGoForward, loading } = navState;
    const tabId = activeTabIdRef.current;

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

  const handleLoadEnd = useCallback(() => {
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
      await removeBookmark(tab.url);
      setIsBookmarked(false);
    } else {
      await addBookmark({
        url: tab.url,
        title: tab.title || getDomain(tab.url),
        favicon: tab.favicon || null,
      });
      setIsBookmarked(true);
    }
  }, [isBookmarked]);

  // ─── Скачивание файлов ───────────────────────────────────────────────────

  const handleFileDownload = useCallback(async ({ nativeEvent }) => {
    const { url } = nativeEvent;
    if (!url) return;

    try {
      const filename = url.split('/').pop()?.split('?')[0] || 'download';
      const downloadsDir = FileSystem.documentDirectory + 'downloads/';
      const dirInfo = await FileSystem.getInfoAsync(downloadsDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(downloadsDir, { intermediates: true });
      }
      const fileUri = downloadsDir + filename;

      Alert.alert('Скачивание', `Начинаю скачивание: ${filename}`);

      const { uri } = await FileSystem.downloadAsync(url, fileUri);
      const fileInfo = await FileSystem.getInfoAsync(uri);

      const downloads = await getDownloads();
      downloads.unshift({
        id: Date.now().toString(),
        filename,
        url,
        uri,
        size: fileInfo.size || null,
        date: Date.now(),
        status: 'completed',
      });
      await setDownloadsList(downloads);

      Alert.alert('Готово', `Файл «${filename}» сохранён в загрузки`);
    } catch (e) {
      Alert.alert('Ошибка', `Не удалось скачать файл: ${e.message}`);
    }
  }, []);

  // ─── Favicon из WebView ──────────────────────────────────────────────────

  const handleWebViewMessage = useCallback(async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'favicon' && data.favicon && activeTabIdRef.current) {
        updateTabFavicon(activeTabIdRef.current, data.favicon);
      }
    } catch {
      // Игнорируем ошибки парсинга
    }
  }, [updateTabFavicon]);

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

  // ─── Find in Page ────────────────────────────────────────────────────────

  const handleFind = useCallback((term, direction) => {
    if (!term) {
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
      setFindMatchCount(0);
      setFindCurrentMatch(0);
      return;
    }

    if (Platform.OS === 'ios') {
      // iOS поддерживает window.find()
      const forward = direction !== 'backward';
      webViewRef.current?.injectJavaScript(`
        window.find(${JSON.stringify(term)}, false, ${!forward}, true, false, true, false); true;
      `);
    } else {
      // Android: собственная подсветка через DOM
      webViewRef.current?.injectJavaScript(`
        (function() {
          // Убираем предыдущую подсветку
          var prevStyle = document.getElementById('__intra_find_style__');
          if (!prevStyle) {
            var s = document.createElement('style');
            s.id = '__intra_find_style__';
            s.textContent = '.__intra_hl__ { background: #fbbf24; color: #000; border-radius: 2px; }';
            document.head.appendChild(s);
          }
          document.querySelectorAll('.__intra_hl__').forEach(function(n) {
            var t = document.createTextNode(n.textContent);
            n.parentNode.replaceChild(t, n);
          });

          // Находим вхождения
          var term = ${JSON.stringify(term)};
          var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
          var nodes = [];
          var node;
          while (node = walker.nextNode()) {
            if (node.nodeValue.toLowerCase().indexOf(term.toLowerCase()) !== -1) {
              nodes.push(node);
            }
          }

          nodes.forEach(function(node) {
            var text = node.nodeValue;
            var re = new RegExp('(' + term.replace(/[.*+?^{}$()|[\\\]\\\\]/g, '\\\\$&') + ')', 'gi');
            var frag = document.createDocumentFragment();
            var parts = text.split(re);
            parts.forEach(function(part) {
              if (re.test(part)) {
                var span = document.createElement('span');
                span.className = '__intra_hl__';
                span.textContent = part;
                frag.appendChild(span);
              } else {
                frag.appendChild(document.createTextNode(part));
              }
            });
            node.parentNode.replaceChild(frag, node);
          });

          // Прокрутить к первому вхождению
          var first = document.querySelector('.__intra_hl__');
          if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });

          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'findResult',
            count: nodes.length
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
      }
    } catch {
      // Игнорируем ошибки парсинга
    }
  }, [updateTabFavicon]);

  // ─── Рендер ──────────────────────────────────────────────────────────────

  const showHome = !activeTab || activeTab.url === 'intra://home' || activeTab.isHome;
  const showBlocked = !!blockedUrl && !showHome;
  const showWebView = !showHome && !showBlocked;

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safeArea, activeTab?.isPrivate && styles.safeAreaPrivate]}
    >
      {/* Баннер приватного режима */}
      <PrivateModeBanner visible={!!activeTab?.isPrivate} />

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
      />

      {/* Прогресс-бар загрузки */}
      <ProgressBar
        loading={activeTab?.loading || false}
        isPrivate={activeTab?.isPrivate || false}
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
            onLoadStart={handleLoadStart}
            onLoadEnd={handleLoadEnd}
            onError={handleError}
            onFileDownload={handleFileDownload}
            onMessage={handleWebViewMessageExtended}
            injectedJavaScript={extractFaviconScript}
            style={styles.webView}
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
