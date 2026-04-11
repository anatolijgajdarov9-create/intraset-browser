import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Keyboard,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../store/settingsStore';
import { inputToUrl } from '../utils/url';
import { getVisits, getBookmarks } from '../utils/storage';
import { useTheme } from '../hooks/useTheme';
import { SIZES } from '../utils/theme';

/**
 * Контент главной страницы браузера.
 * Используется внутри MainScreen вместо отдельного HomeScreen.
 */
export default function HomeContent({ onNavigate, onOpenBookmarks, onOpenHistory, onOpenDownloads, onOpenSettings }) {
  const theme = useTheme();
  const { settings } = useSettingsStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [frequentSites, setFrequentSites] = useState([]);
  const [recentBookmarks, setRecentBookmarks] = useState([]);

  const styles = useMemo(() => makeStyles(theme), [theme]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const visits = await getVisits();
      const bookmarks = await getBookmarks();
      const sorted = Object.values(visits)
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
      setFrequentSites(sorted);
      setRecentBookmarks(bookmarks.slice(0, 6));
    } catch (e) {
      console.error('[HomeContent] Error loading data:', e);
    }
  };

  const handleSearch = () => {
    Keyboard.dismiss();
    if (!searchQuery.trim()) return;
    const url = inputToUrl(searchQuery, settings.searchEngine);
    if (url) onNavigate(url);
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
        <View style={styles.logoContainer}>
          <Ionicons name="globe" size={28} color={theme.primary} />
        </View>
        <Text style={styles.title}>Intra Browser</Text>
        <Text style={styles.subtitle}>Введите адрес или поисковый запрос</Text>
      </View>

      {/* Поисковая строка */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={18} color={theme.textTertiary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            placeholder="Поиск или введите URL..."
            placeholderTextColor={theme.addressBarText}
            returnKeyType="go"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={16} color={theme.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Ionicons name="arrow-forward" size={20} color={theme.textInverse} />
        </TouchableOpacity>
      </View>

      {/* Быстрые действия */}
      <View style={styles.quickActions}>
        {quickActions.map((action) => (
          <TouchableOpacity
            key={action.label}
            style={styles.actionButton}
            onPress={action.onPress}
          >
            <View style={styles.actionIconBg}>
              <Ionicons name={action.icon} size={22} color={theme.primary} />
            </View>
            <Text style={styles.actionText}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Частые сайты */}
      {frequentSites.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Частые сайты</Text>
          <View style={styles.grid}>
            {frequentSites.map((site, index) => (
              <TouchableOpacity
                key={index}
                style={styles.gridItem}
                onPress={() => onNavigate(site.url)}
              >
                {site.favicon ? (
                  <Image source={{ uri: site.favicon }} style={styles.favicon} />
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
            ))}
          </View>
        </View>
      )}

      {/* Последние закладки */}
      {recentBookmarks.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Закладки</Text>
            <TouchableOpacity onPress={onOpenBookmarks}>
              <Text style={styles.sectionMore}>Все</Text>
            </TouchableOpacity>
          </View>
          {recentBookmarks.map((bookmark) => (
            <TouchableOpacity
              key={bookmark.id}
              style={styles.bookmarkItem}
              onPress={() => onNavigate(bookmark.url)}
            >
              {bookmark.favicon ? (
                <Image source={{ uri: bookmark.favicon }} style={styles.bookmarkFavicon} />
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
          ))}
        </View>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    alignItems: 'center',
    paddingTop: SIZES.paddingXl * 2,
    paddingBottom: SIZES.paddingXl,
    paddingHorizontal: SIZES.paddingLg,
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.paddingMd,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.07)',
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
  },
  searchContainer: {
    flexDirection: 'row',
    marginHorizontal: SIZES.paddingLg,
    marginBottom: SIZES.paddingLg,
    gap: SIZES.paddingSm,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.addressBarBg,
    borderRadius: SIZES.radiusLg,
    borderWidth: 1,
    borderColor: theme.addressBarBorder,
    paddingHorizontal: SIZES.paddingMd,
  },
  searchIcon: {
    marginRight: SIZES.paddingXs,
  },
  searchInput: {
    flex: 1,
    fontSize: SIZES.textMd,
    color: theme.text,
    paddingVertical: SIZES.paddingMd,
  },
  clearButton: {
    padding: SIZES.paddingXs,
  },
  searchButton: {
    backgroundColor: theme.primary,
    borderRadius: SIZES.radiusLg,
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: SIZES.paddingLg,
    paddingBottom: SIZES.paddingLg,
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
  bookmarkFaviconPlaceholder: {
    marginRight: SIZES.paddingMd,
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
