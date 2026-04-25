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
  BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';
import { useTabStore } from '../store/tabStore';
import { useSettingsStore } from '../store/settingsStore';
import { inputToUrl, getDomain, isTrackableUrl } from '../utils/url';
import {
  trackVisit,
  addHistoryEntry,
  addBookmark,
  removeBookmarkByUrl,
  isBookmarked as checkBookmark,
} from '../utils/storage';
import { useWebViewScripts, nightModeOnScript, nightModeOffScript, READER_STYLE_LINES } from '../hooks/useWebViewScripts';
import { useDownloadInterceptor, isLikelyDownloadUrl } from '../hooks/useDownloadInterceptor';
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
  const { handleFileDownload, handleContextMenuDownload, saveWebPage } = useDownloadInterceptor();

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

  const activeTab = getActiveTab();
  const currentZoom = tabZoom[activeTabId] || 100;
  const isReadingMode = !!readingModes[activeTabId];
  const { forceLightBeforeScript, injectedJavaScript } = useWebViewScripts({
    currentZoom,
    isReadingMode,
    isNightMode: settings.nightMode,
  });

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

  useEffect(() => {
    if (!findBarVisible) {
      webViewRef.current?.injectJavaScript(
        `try { window.getSelection()?.removeAllRanges(); } catch(e) {} true;`
      );
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
      handleContextMenuDownload(url);
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
    const isBlank = !isPrivate && settings.newTabMode === 'blank';
    createTab('intra://home', 'Новая вкладка', isPrivate, isBlank);
    setBlockedUrl(null);
    setFindBarVisible(false);
  }, [createTab, settings.newTabMode]);

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
      case 'save': {
        const saveTab = activeTabRef.current;
        if (!saveTab?.url || saveTab.url === 'intra://home') break;
        saveWebPage(saveTab.url);
        break;
      }
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
          s.textContent = ${JSON.stringify(READER_STYLE_LINES.join('\n'))};
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
  }, [handleReload, settings.nightMode, settings.darkMode, toggleNightMode, toggleDarkMode, readingModes, saveWebPage]);

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

  // ─── Find in Page ────────────────────────────────────────────────────────

  const handleFind = useCallback((term, direction) => {
    if (!term) {
      setFindMatchCount(0);
      setFindCurrentMatch(0);
      webViewRef.current?.injectJavaScript(
        `try { window.getSelection()?.removeAllRanges(); } catch(e) {} true;`
      );
      return;
    }
    webViewRef.current?.injectJavaScript(`
      var found = window.find(${JSON.stringify(term)}, false, ${direction === 'backward'}, true, false, true, false);
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'findFound',found:found}));
      true;
    `);
  }, []);

  // Обработка результатов поиска из WebView
  const handleWebViewMessageExtended = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'favicon' && data.favicon && activeTabIdRef.current) {
        updateTabFavicon(activeTabIdRef.current, data.favicon);
      } else if (data.type === 'findFound') {
        setFindMatchCount(data.found ? 1 : 0);
        setFindCurrentMatch(data.found ? 1 : 0);
      } else if (data.type === '__dialog') {
        Alert.alert(
          data.kind === 'alert' ? 'Сообщение' : 'Подтверждение',
          data.msg || ''
        );
      } else if (data.type === '__download' && data.url) {
        handleContextMenuDownload(data.url);
      } else if (data.type === '__linkContext' && data.url) {
        setContextMenuUrl(data.url);
        setContextMenuElementType(data.elementType || 'link');
        setContextMenuVisible(true);
      }
    } catch {
      // Игнорируем ошибки парсинга
    }
  }, [updateTabFavicon, handleContextMenuDownload]);

  // Открыть ссылку из контекстного меню в новой вкладке
  const handleOpenLinkInNewTab = useCallback((url) => {
    createTab(url, url, activeTabRef.current?.isPrivate || false);
  }, [createTab]);

  // ─── Рендер ──────────────────────────────────────────────────────────────

  const isTabShowingHomeOverlay = !!(tabHomeOverlay[activeTabId]);
  const showHome = !activeTab || activeTab.url === 'intra://home' || activeTab.isHome || isTabShowingHomeOverlay;
  const showBlank = showHome && !!activeTab?.isBlank;
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
        {showHome && !showBlank && (
          <HomeContent
            onNavigate={handleNavigate}
            onOpenBookmarks={() => navigation.navigate('Bookmarks')}
            onOpenHistory={() => navigation.navigate('History')}
            onOpenDownloads={() => navigation.navigate('Downloads')}
            onOpenSettings={() => navigation.navigate('Settings')}
          />
        )}

        {showBlank && (
          <View style={styles.blankTab} />
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
            injectedJavaScript={injectedJavaScript}
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
  blankTab: {
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
