import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getVisits, getBookmarks } from '../utils/storage';
import { getDomain } from '../utils/url';
import { useTheme } from '../hooks/useTheme';
import { SIZES } from '../utils/theme';

// Поисковые системы для быстрого доступа
const QUICK_ENGINES = [
  { key: 'yandex',     label: 'Яндекс',     url: 'https://yandex.ru',         color: '#FF0000', letter: 'Я' },
  { key: 'google',     label: 'Google',      url: 'https://www.google.com',    color: '#4285F4', letter: 'G' },
  { key: 'duckduckgo', label: 'DuckDuckGo',  url: 'https://duckduckgo.com',    color: '#DE5833', letter: '🦆' },
  { key: 'bing',       label: 'Bing',        url: 'https://www.bing.com',      color: '#00809D', letter: 'B' },
];

/**
 * Контент главной страницы браузера.
 */
export default function HomeContent({ onNavigate, onOpenBookmarks, onOpenHistory, onOpenDownloads, onOpenSettings }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [topSites, setTopSites] = useState([]);
  const [recentBookmarks, setRecentBookmarks] = useState([]);

  // Анимация появления логотипа
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale  = useRef(new Animated.Value(0.75)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Последовательная анимация: лого → контент
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [visits, bookmarks] = await Promise.all([
        getVisits(),
        getBookmarks(),
      ]);

      // Топ сайты: сортируем по количеству визитов (кросс-сессионно!)
      const topSitesList = Object.values(visits)
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)
        .map(v => ({
          url: v.url,
          title: v.title || getDomain(v.url),
          favicon: v.favicon || null,
        }));

      setTopSites(topSitesList);
      setRecentBookmarks(bookmarks.slice(0, 6));
    } catch (e) {
      console.error('[HomeContent] Error loading data:', e);
    }
  };

  const quickActions = [
    { icon: 'bookmark-outline', label: 'Закладки', onPress: onOpenBookmarks },
    { icon: 'time-outline',     label: 'История',  onPress: onOpenHistory },
    { icon: 'download-outline', label: 'Загрузки', onPress: onOpenDownloads },
    { icon: 'settings-outline', label: 'Настройки',onPress: onOpenSettings },
  ];

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Заголовок */}
      <View style={styles.header}>
        <Animated.View
          style={[
            styles.logoContainer,
            { opacity: logoOpacity, transform: [{ scale: logoScale }] },
          ]}
        >
          <Ionicons name="globe" size={28} color={theme.primary} />
        </Animated.View>
        <Animated.View style={{ opacity: logoOpacity, alignItems: 'center' }}>
          <Text style={styles.title}>Intra Browser</Text>
          <Text style={styles.subtitle}>Используйте адресную строку выше для поиска</Text>
        </Animated.View>
      </View>

      <Animated.View style={{ opacity: contentOpacity }}>
        {/* Быстрый доступ к поисковым системам */}
        <View style={styles.enginesSection}>
          {QUICK_ENGINES.map((engine) => (
            <TouchableOpacity
              key={engine.key}
              style={styles.engineButton}
              onPress={() => onNavigate(engine.url)}
              activeOpacity={0.7}
            >
              <View style={[styles.engineIconBg, { backgroundColor: engine.color + '18' }]}>
                <Text style={[styles.engineLetter, { color: engine.color }]}>
                  {engine.letter}
                </Text>
              </View>
              <Text style={styles.engineLabel} numberOfLines={1}>
                {engine.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Быстрые действия */}
        <View style={styles.quickActions}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.actionButton}
              onPress={action.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.actionIconBg}>
                <Ionicons name={action.icon} size={22} color={theme.primary} />
              </View>
              <Text style={styles.actionText}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Часто посещаемые сайты */}
        {topSites.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { marginBottom: SIZES.paddingMd }]}>Часто посещаемые</Text>
            <View style={styles.grid}>
              {topSites.map((site, index) => (
                <TopSiteItem
                  key={index}
                  site={site}
                  onNavigate={onNavigate}
                  styles={styles}
                  theme={theme}
                />
              ))}
            </View>
          </View>
        )}

        {/* Последние закладки */}
        {recentBookmarks.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Закладки</Text>
              <TouchableOpacity onPress={onOpenBookmarks} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.sectionMore}>Все</Text>
              </TouchableOpacity>
            </View>
            {recentBookmarks.map((bookmark) => (
              <BookmarkItem
                key={bookmark.id}
                bookmark={bookmark}
                onNavigate={onNavigate}
                styles={styles}
                theme={theme}
              />
            ))}
          </View>
        )}
      </Animated.View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ─── Sub-components (поддерживают local state для favicon fallback) ──────────

function TopSiteItem({ site, onNavigate, styles, theme }) {
  const [faviconError, setFaviconError] = useState(false);
  return (
    <TouchableOpacity
      style={styles.gridItem}
      onPress={() => onNavigate(site.url)}
      activeOpacity={0.7}
    >
      {site.favicon && !faviconError ? (
        <Image
          source={{ uri: site.favicon }}
          style={styles.favicon}
          onError={() => setFaviconError(true)}
        />
      ) : (
        <View style={styles.faviconPlaceholder}>
          <Text style={styles.faviconText}>
            {site.title?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
      )}
      <Text style={styles.gridItemTitle} numberOfLines={1}>
        {site.title || site.url}
      </Text>
    </TouchableOpacity>
  );
}

function BookmarkItem({ bookmark, onNavigate, styles, theme }) {
  const [faviconError, setFaviconError] = useState(false);
  return (
    <TouchableOpacity
      style={styles.bookmarkItem}
      onPress={() => onNavigate(bookmark.url)}
      activeOpacity={0.7}
    >
      {bookmark.favicon && !faviconError ? (
        <Image
          source={{ uri: bookmark.favicon }}
          style={styles.bookmarkFavicon}
          onError={() => setFaviconError(true)}
        />
      ) : (
        <View style={[styles.faviconPlaceholder, styles.bookmarkFaviconPlaceholder]}>
          <Text style={styles.faviconText}>
            {bookmark.title?.charAt(0).toUpperCase() || '★'}
          </Text>
        </View>
      )}
      <View style={styles.bookmarkInfo}>
        <Text style={styles.bookmarkTitle} numberOfLines={1}>
          {bookmark.title}
        </Text>
        <Text style={styles.bookmarkUrl} numberOfLines={1}>
          {bookmark.url}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
    </TouchableOpacity>
  );
}

// ─── Стили ──────────────────────────────────────────────────────────────────

const makeStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    alignItems: 'center',
    paddingTop: SIZES.paddingXl * 2,
    paddingBottom: SIZES.paddingLg,
    paddingHorizontal: SIZES.paddingLg,
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: theme.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.paddingMd,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 0.5,
    borderColor: theme.border,
  },
  title: {
    fontSize: SIZES.text2Xl,
    fontWeight: '700',
    color: theme.text,
    marginBottom: SIZES.paddingXs,
  },
  subtitle: {
    fontSize: SIZES.textSm,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  // ── Поисковые системы ──
  enginesSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: SIZES.paddingLg,
    paddingVertical: SIZES.paddingMd,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  engineButton: {
    alignItems: 'center',
    gap: SIZES.paddingXs,
    minWidth: 60,
  },
  engineIconBg: {
    width: 52,
    height: 52,
    borderRadius: SIZES.radiusLg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  engineLetter: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  engineLabel: {
    fontSize: SIZES.textXs,
    color: theme.textSecondary,
    textAlign: 'center',
    maxWidth: 64,
  },
  // ── Быстрые действия ──
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: SIZES.paddingLg,
    paddingVertical: SIZES.paddingMd,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  actionButton: {
    alignItems: 'center',
    gap: SIZES.paddingXs,
  },
  actionIconBg: {
    width: 52,
    height: 52,
    borderRadius: SIZES.radiusLg,
    backgroundColor: theme.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    fontSize: SIZES.textXs,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  // ── Секции ──
  section: {
    paddingHorizontal: SIZES.paddingLg,
    paddingTop: SIZES.paddingLg,
    paddingBottom: SIZES.paddingSm,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.paddingMd,
  },
  sectionTitle: {
    fontSize: SIZES.textMd,
    fontWeight: '600',
    color: theme.text,
  },
  sectionMore: {
    fontSize: SIZES.textSm,
    color: theme.primary,
    fontWeight: '500',
  },
  // ── Топ сайты (сетка) ──
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.paddingMd,
    marginBottom: SIZES.paddingSm,
  },
  gridItem: {
    width: '21%',
    alignItems: 'center',
    gap: SIZES.paddingXs,
  },
  favicon: {
    width: 40,
    height: 40,
    borderRadius: SIZES.radiusMd,
  },
  faviconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: SIZES.radiusMd,
    backgroundColor: theme.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faviconText: {
    fontSize: SIZES.textLg,
    fontWeight: '700',
    color: theme.primary,
  },
  gridItemTitle: {
    fontSize: SIZES.textXs,
    color: theme.text,
    textAlign: 'center',
  },
  // ── Закладки ──
  bookmarkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.paddingMd,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  bookmarkFavicon: {
    width: 32,
    height: 32,
    borderRadius: SIZES.radiusMd,
    marginRight: SIZES.paddingMd,
  },
  bookmarkFaviconPlaceholder: {
    marginRight: SIZES.paddingMd,
    width: 32,
    height: 32,
  },
  bookmarkInfo: {
    flex: 1,
  },
  bookmarkTitle: {
    fontSize: SIZES.textMd,
    color: theme.text,
    fontWeight: '500',
    marginBottom: 2,
  },
  bookmarkUrl: {
    fontSize: SIZES.textSm,
    color: theme.textSecondary,
  },
});
