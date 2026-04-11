import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { useTabStore } from '../store/tabStore';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { SIZES } from '../utils/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_COL_PADDING = SIZES.paddingMd;
const CARD_GAP = SIZES.paddingSm;
const CARD_WIDTH = (SCREEN_W - CARD_COL_PADDING * 2 - CARD_GAP) / 2;
const PREVIEW_H = Math.round(CARD_WIDTH * 0.58);

// Детерминированный оттенок по домену
function domainHue(url) {
  try {
    const host = new URL(url).hostname;
    let h = 0;
    for (let i = 0; i < host.length; i++) h = (h * 31 + host.charCodeAt(i)) & 0x7fffffff;
    return h % 360;
  } catch { return 220; }
}

function TabCard({ tab, isActive, onSelect, onClose, theme }) {
  const [faviconError, setFaviconError] = useState(false);
  const isHome = !tab.url || tab.url === 'intra://home';
  const hue = isHome ? 210 : domainHue(tab.url);
  const previewBg = `hsl(${hue}, 40%, 90%)`;
  const letterBg = `hsl(${hue}, 60%, 58%)`;
  const domainLabel = (() => {
    try { return new URL(tab.url).hostname.replace('www.', ''); } catch { return ''; }
  })();

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isActive && { borderColor: theme.primary, borderWidth: 2 },
        tab.isPrivate && { borderColor: theme.private, borderWidth: 1.5 },
        !isActive && !tab.isPrivate && { borderColor: theme.border, borderWidth: 1 },
      ]}
      onPress={onSelect}
      activeOpacity={0.82}
    >
      {/* Превью-зона */}
      <View style={[styles.preview, { backgroundColor: tab.isPrivate ? theme.privateLight : previewBg }]}>
        {tab.isPrivate ? (
          <Ionicons name="eye-off-outline" size={32} color={theme.private} style={{ opacity: 0.6 }} />
        ) : tab.loading ? (
          <Ionicons name="hourglass-outline" size={28} color={`hsl(${hue},50%,50%)`} />
        ) : tab.favicon && !faviconError ? (
          <Image
            source={{ uri: tab.favicon }}
            style={styles.faviconLarge}
            onError={() => setFaviconError(true)}
          />
        ) : (
          <View style={[styles.letterCircle, { backgroundColor: letterBg }]}>
            <Text style={styles.letterText}>
              {isHome ? '⌂' : tab.title?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
        )}
        {!isHome && domainLabel ? (
          <Text style={[styles.domainLabel, { color: `hsl(${hue},40%,38%)` }]} numberOfLines={1}>
            {domainLabel}
          </Text>
        ) : null}
        {isActive && (
          <View style={[styles.activeDot, { backgroundColor: theme.primary }]} />
        )}
      </View>

      {/* Строка заголовка */}
      <View style={[styles.titleBar, { backgroundColor: theme.backgroundSecondary }]}>
        <Text
          style={[
            styles.cardTitle,
            isActive && { color: theme.primary, fontWeight: '600' },
            tab.isPrivate && { color: theme.private },
            !isActive && !tab.isPrivate && { color: theme.text },
          ]}
          numberOfLines={1}
        >
          {tab.title || 'Новая вкладка'}
        </Text>
        <TouchableOpacity
          style={styles.cardClose}
          onPress={onClose}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Ionicons name="close" size={14} color={theme.textTertiary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    borderRadius: SIZES.radiusLg,
    overflow: 'hidden',
    marginBottom: CARD_GAP,
  },
  preview: {
    height: PREVIEW_H,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  faviconLarge: {
    width: 40,
    height: 40,
    borderRadius: SIZES.radiusMd,
  },
  letterCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  letterText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
  },
  domainLabel: {
    position: 'absolute',
    bottom: 6,
    left: 8,
    right: 8,
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.8,
  },
  activeDot: {
    position: 'absolute',
    top: 6,
    left: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.paddingXs,
    paddingLeft: SIZES.paddingSm,
    height: 34,
  },
  cardTitle: {
    flex: 1,
    fontSize: SIZES.textSm,
    marginRight: 4,
  },
  cardClose: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
});

export default function TabsScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const screenStyles = useMemo(() => makeScreenStyles(theme, insets), [theme, insets]);
  const { tabs, activeTabId, switchTab, closeTab, createTab, restoreTab, recentlyClosed, setTabHomeOverlay } = useTabStore();

  const regularTabs = tabs.filter(t => !t.isPrivate);
  const privateTabs = tabs.filter(t => t.isPrivate);

  const handleCloseTab = (tabId) => {
    closeTab(tabId);
  };

  const handleCloseAllPrivate = () => {
    Alert.alert(
      'Закрыть приватные вкладки?',
      `Будет закрыто ${privateTabs.length} приватных вкладок. Данные не сохранятся.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Закрыть все', style: 'destructive',
          onPress: () => {
            privateTabs.forEach(tab => useTabStore.getState().closeTab(tab.id));
          },
        },
      ]
    );
  };

  const handleCloseAll = () => {
    Alert.alert(
      'Закрыть все вкладки?',
      `Будет закрыто ${tabs.length} ${tabs.length === 1 ? 'вкладка' : 'вкладок'}.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Закрыть все', style: 'destructive',
          onPress: () => {
            const ids = tabs.map(t => t.id);
            ids.forEach((id, i) => {
              if (i < ids.length - 1) useTabStore.getState().closeTab(id);
            });
            useTabStore.getState().closeTab(ids[ids.length - 1]);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleSelectTab = (tabId) => {
    const overlay = useTabStore.getState().tabHomeOverlay;
    if (overlay[tabId]) setTabHomeOverlay(tabId, false);
    switchTab(tabId);
    navigation.goBack();
  };

  const handleNewTab = () => {
    createTab('intra://home', 'Новая вкладка');
    navigation.goBack();
  };

  const handleNewPrivateTab = () => {
    createTab('intra://home', 'Приватная вкладка', true);
    navigation.goBack();
  };

  const handleRestoreTab = (entry) => {
    restoreTab(entry);
    navigation.goBack();
  };

  // Рендер сетки в 2 колонки
  const renderGrid = (tabList) => {
    const rows = [];
    for (let i = 0; i < tabList.length; i += 2) {
      const left = tabList[i];
      const right = tabList[i + 1];
      rows.push(
        <View key={left.id} style={screenStyles.row}>
          <TabCard
            tab={left}
            isActive={left.id === activeTabId}
            onSelect={() => handleSelectTab(left.id)}
            onClose={() => handleCloseTab(left.id)}
            theme={theme}
          />
          {right ? (
            <TabCard
              tab={right}
              isActive={right.id === activeTabId}
              onSelect={() => handleSelectTab(right.id)}
              onClose={() => handleCloseTab(right.id)}
              theme={theme}
            />
          ) : (
            <View style={{ width: CARD_WIDTH }} />
          )}
        </View>
      );
    }
    return rows;
  };

  return (
    <View style={screenStyles.container}>
      {/* Заголовок */}
      <View style={screenStyles.header}>
        <Text style={screenStyles.headerTitle}>Вкладки ({tabs.length})</Text>
        <View style={screenStyles.headerActions}>
          {regularTabs.length > 1 && (
            <TouchableOpacity style={screenStyles.closeAllButton} onPress={handleCloseAll}>
              <Text style={screenStyles.closeAllText}>Закрыть все</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={screenStyles.doneButton} onPress={() => navigation.goBack()}>
            <Text style={screenStyles.doneButtonText}>Готово</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={screenStyles.list}>
        {/* Обычные вкладки — сетка */}
        {regularTabs.length > 0 && (
          <>
            <Text style={screenStyles.sectionLabel}>ВКЛАДКИ ({regularTabs.length})</Text>
            {renderGrid(regularTabs)}
          </>
        )}

        {/* Приватные вкладки */}
        {privateTabs.length > 0 && (
          <View style={screenStyles.privateSection}>
            <View style={screenStyles.privateSectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="eye-off-outline" size={14} color={theme.private} style={{ marginRight: 6 }} />
                <Text style={[screenStyles.sectionLabel, { color: theme.private, marginBottom: 0 }]}>
                  ПРИВАТНЫЕ ({privateTabs.length})
                </Text>
              </View>
              <TouchableOpacity onPress={handleCloseAllPrivate} style={screenStyles.closePrivateButton}>
                <Text style={screenStyles.closePrivateText}>Закрыть все</Text>
              </TouchableOpacity>
            </View>
            {renderGrid(privateTabs)}
          </View>
        )}

        {/* Недавно закрытые */}
        {recentlyClosed.length > 0 && (
          <View style={screenStyles.recentSection}>
            <Text style={screenStyles.sectionLabel}>НЕДАВНО ЗАКРЫТЫЕ</Text>
            {recentlyClosed.map((entry) => (
              <TouchableOpacity
                key={entry.closedAt}
                style={screenStyles.recentItem}
                onPress={() => handleRestoreTab(entry)}
                activeOpacity={0.7}
              >
                {entry.favicon ? (
                  <Image source={{ uri: entry.favicon }} style={screenStyles.recentFavicon} />
                ) : (
                  <View style={screenStyles.recentIconPlaceholder}>
                    <Text style={screenStyles.recentIconText}>
                      {entry.title?.charAt(0).toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
                <View style={screenStyles.recentInfo}>
                  <Text style={screenStyles.recentTitle} numberOfLines={1}>
                    {entry.title || entry.url}
                  </Text>
                  <Text style={screenStyles.recentUrl} numberOfLines={1}>{entry.url}</Text>
                </View>
                <Ionicons name="refresh-outline" size={18} color={theme.primary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Кнопки действий */}
      <View style={screenStyles.actions}>
        <TouchableOpacity
          style={[screenStyles.actionButton, screenStyles.primaryButton]}
          onPress={handleNewTab}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={20} color={theme.textInverse} style={{ marginRight: 6 }} />
          <Text style={screenStyles.actionButtonText}>Новая вкладка</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[screenStyles.actionButton, screenStyles.privateButton]}
          onPress={handleNewPrivateTab}
          activeOpacity={0.8}
        >
          <Ionicons name="eye-off-outline" size={20} color={theme.private} style={{ marginRight: 6 }} />
          <Text style={[screenStyles.actionButtonText, { color: theme.private }]}>Приватная вкладка</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeScreenStyles = (theme, insets) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: insets.top + SIZES.paddingMd,
    paddingHorizontal: SIZES.paddingLg,
    paddingBottom: SIZES.paddingMd,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    backgroundColor: theme.background,
  },
  headerTitle: { fontSize: SIZES.textXl, fontWeight: '700', color: theme.text },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: SIZES.paddingXs },
  closeAllButton: { padding: SIZES.paddingSm },
  closeAllText: { fontSize: SIZES.textSm, color: theme.error, fontWeight: '600' },
  doneButton: { padding: SIZES.paddingSm },
  doneButtonText: { fontSize: SIZES.textMd, color: theme.primary, fontWeight: '600' },
  list: { padding: CARD_COL_PADDING, paddingBottom: SIZES.paddingLg },
  sectionLabel: {
    fontSize: SIZES.textXs,
    fontWeight: '700',
    color: theme.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SIZES.paddingSm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  // ── Приватные ──
  privateSection: {
    marginTop: SIZES.paddingLg,
    borderTopWidth: 1,
    borderTopColor: theme.privateBorder,
    paddingTop: SIZES.paddingMd,
  },
  privateSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.paddingSm,
  },
  closePrivateButton: { padding: SIZES.paddingXs },
  closePrivateText: { fontSize: SIZES.textSm, color: theme.private, fontWeight: '600' },
  // ── Недавно закрытые ──
  recentSection: {
    marginTop: SIZES.paddingLg,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: SIZES.paddingMd,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.paddingMd,
    marginBottom: SIZES.paddingXs,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: SIZES.radiusMd,
  },
  recentFavicon: { width: 24, height: 24, borderRadius: SIZES.radiusSm, marginRight: SIZES.paddingMd },
  recentIconPlaceholder: {
    width: 24, height: 24,
    borderRadius: SIZES.radiusSm,
    backgroundColor: theme.backgroundTertiary,
    justifyContent: 'center', alignItems: 'center',
    marginRight: SIZES.paddingMd,
  },
  recentIconText: { fontSize: SIZES.textXs, fontWeight: '700', color: theme.textSecondary },
  recentInfo: { flex: 1, marginRight: SIZES.paddingSm },
  recentTitle: { fontSize: SIZES.textSm, color: theme.text, fontWeight: '500', marginBottom: 1 },
  recentUrl: { fontSize: SIZES.textXs, color: theme.textSecondary },
  // ── Действия ──
  actions: {
    padding: SIZES.paddingLg,
    paddingBottom: insets.bottom + SIZES.paddingLg,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    gap: SIZES.paddingSm,
  },
  actionButton: {
    flexDirection: 'row',
    paddingVertical: SIZES.paddingMd,
    borderRadius: SIZES.radiusLg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: { backgroundColor: theme.primary },
  privateButton: {
    backgroundColor: theme.privateLight,
    borderWidth: 1,
    borderColor: theme.privateBorder,
  },
  actionButtonText: { fontSize: SIZES.textMd, fontWeight: '600', color: theme.textInverse },
});
