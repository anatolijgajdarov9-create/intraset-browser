import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../hooks/useTheme';
import { SIZES } from '../utils/theme';

export default function TabChips({
  tabs,
  activeTabId,
  onSelectTab,
  onNewTab,
  onNewPrivateTab,
  onCloseTab,
  onOpenTabs,
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, insets), [theme, insets]);
  const scrollRef = useRef(null);
  const chipPositions = useRef({});
  const faviconErrors = useRef(new Set());
  const [, forceUpdate] = useState(0);

  // Анимация пульса для загружающейся активной вкладки
  const loadingPulse = useRef(new Animated.Value(1)).current;
  const loadingAnim = useRef(null);

  useEffect(() => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    const isLoading = !!(activeTab?.loading);
    if (isLoading) {
      loadingAnim.current = Animated.loop(
        Animated.sequence([
          Animated.timing(loadingPulse, { toValue: 0.35, duration: 550, useNativeDriver: true }),
          Animated.timing(loadingPulse, { toValue: 1,    duration: 550, useNativeDriver: true }),
        ])
      );
      loadingAnim.current.start();
    } else {
      if (loadingAnim.current) {
        loadingAnim.current.stop();
        loadingAnim.current = null;
      }
      Animated.timing(loadingPulse, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
    return () => {
      if (loadingAnim.current) {
        loadingAnim.current.stop();
        loadingAnim.current = null;
      }
    };
  }, [tabs, activeTabId]);

  // Scroll to active tab when it changes
  useEffect(() => {
    const x = chipPositions.current[activeTabId];
    if (x !== undefined && scrollRef.current) {
      scrollRef.current.scrollTo({ x: Math.max(0, x - 12), animated: true });
    }
  }, [activeTabId]);

  const handleTabPress = (tabId) => {
    onSelectTab(tabId);
  };

  const handleCloseTab = (tabId, e) => {
    e.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCloseTab(tabId);
  };

  return (
    <View style={styles.container}>
      {onOpenTabs && (
        <TouchableOpacity style={styles.gridButton} onPress={onOpenTabs} activeOpacity={0.7}>
          <Ionicons name="browsers-outline" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      )}
      <View style={styles.divider} />
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        style={styles.scrollView}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const hasFaviconError = faviconErrors.current.has(tab.id);
          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.chip,
                isActive && styles.chipActive,
                tab.isPrivate && styles.chipPrivate,
              ]}
              onPress={() => handleTabPress(tab.id)}
              onLayout={(e) => {
                chipPositions.current[tab.id] = e.nativeEvent.layout.x;
              }}
              activeOpacity={0.7}
            >
              {tab.isPrivate ? (
                <Ionicons
                  name="eye-off-outline"
                  size={14}
                  color={isActive ? theme.private : theme.textTertiary}
                  style={styles.chipIcon}
                />
              ) : tab.favicon && !hasFaviconError ? (
                <Animated.Image
                  source={{ uri: tab.favicon }}
                  style={[
                    styles.chipFavicon,
                    isActive && tab.loading && { opacity: loadingPulse },
                  ]}
                  onError={() => {
                    faviconErrors.current.add(tab.id);
                    forceUpdate(n => n + 1);
                  }}
                />
              ) : (
                <Animated.View
                  style={[
                    styles.chipFaviconPlaceholder,
                    isActive && styles.chipFaviconPlaceholderActive,
                    isActive && tab.loading && { opacity: loadingPulse },
                  ]}
                >
                  <Text style={[styles.chipFaviconText, isActive && styles.chipFaviconTextActive]}>
                    {tab.loading && isActive ? '…' : (tab.title?.charAt(0).toUpperCase() || '?')}
                  </Text>
                </Animated.View>
              )}

              <Text
                style={[
                  styles.chipTitle,
                  isActive && styles.chipTitleActive,
                  tab.isPrivate && styles.chipTitlePrivate,
                ]}
                numberOfLines={1}
              >
                {tab.title || 'Новая вкладка'}
              </Text>

              {tabs.length > 1 && (
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={(e) => handleCloseTab(tab.id, e)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="close"
                    size={12}
                    color={isActive ? theme.textSecondary : theme.textTertiary}
                  />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={styles.newTabButton}
          onPress={onNewTab}
          activeOpacity={0.7}
        >
          <Ionicons
            name="add"
            size={20}
            color={theme.textTertiary}
          />
        </TouchableOpacity>

        {onNewPrivateTab && (
          <TouchableOpacity
            style={styles.privateTabButton}
            onPress={onNewPrivateTab}
            activeOpacity={0.7}
          >
            <Ionicons
              name="eye-off-outline"
              size={16}
              color={theme.private}
            />
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (theme, insets) => StyleSheet.create({
  container: {
    height: SIZES.tabBarHeight,
    backgroundColor: theme.tabBarBg,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridButton: {
    width: 38,
    height: SIZES.tabBarHeight,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: SIZES.paddingXs,
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: theme.border,
    marginRight: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: SIZES.paddingXs,
    paddingVertical: SIZES.paddingXs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: SIZES.radiusLg,
    paddingVertical: SIZES.paddingXs,
    paddingLeft: SIZES.paddingSm,
    paddingRight: SIZES.paddingXs,
    marginRight: SIZES.paddingXs,
    maxWidth: 160,
    minWidth: 80,
    height: 32,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: theme.tabActive,
    borderColor: theme.primary,
  },
  chipPrivate: {
    backgroundColor: theme.privateLight,
    borderColor: theme.privateBorder,
  },
  chipIcon: {
    marginRight: SIZES.paddingXs,
  },
  chipFavicon: {
    width: 16,
    height: 16,
    borderRadius: SIZES.radiusSm,
    marginRight: SIZES.paddingXs,
  },
  chipFaviconPlaceholder: {
    width: 16,
    height: 16,
    borderRadius: SIZES.radiusSm,
    backgroundColor: theme.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.paddingXs,
  },
  chipFaviconPlaceholderActive: {
    backgroundColor: theme.primaryLight,
  },
  chipFaviconText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.textTertiary,
  },
  chipFaviconTextActive: {
    color: theme.primary,
  },
  chipTitle: {
    flex: 1,
    fontSize: SIZES.textXs,
    color: theme.textSecondary,
    marginRight: SIZES.paddingXs,
  },
  chipTitleActive: {
    color: theme.text,
    fontWeight: '500',
  },
  chipTitlePrivate: {
    color: theme.private,
  },
  closeButton: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newTabButton: {
    width: 32,
    height: 32,
    borderRadius: SIZES.radiusLg,
    backgroundColor: theme.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  privateTabButton: {
    width: 32,
    height: 32,
    borderRadius: SIZES.radiusLg,
    backgroundColor: theme.privateLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.privateBorder,
    marginLeft: SIZES.paddingXs,
  },
});
