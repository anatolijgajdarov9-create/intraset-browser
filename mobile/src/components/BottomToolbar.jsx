import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../hooks/useTheme';
import { SIZES } from '../utils/theme';

/**
 * Нижняя панель навигации браузера.
 * Back · Forward · Home · Bookmark · Find · Tabs (с бейджем)
 */
export default function BottomToolbar({
  canGoBack,
  canGoForward,
  isPrivate,
  isBookmarked,
  tabCount,
  onGoBack,
  onGoForward,
  onHome,
  onToggleBookmark,
  onOpenTabs,
  onOpenFind,
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, insets), [theme, insets]);

  const iconColor = isPrivate ? theme.private : theme.text;
  const disabledColor = isPrivate ? theme.privateBorder : theme.textTertiary;

  // Вспомогательная функция: оборачивает обработчик хаптиком
  const withHaptic = (fn, style = 'light') => () => {
    if (style === 'medium') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (style === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    fn && fn();
  };

  const buttons = [
    {
      key: 'back',
      icon: 'chevron-back',
      onPress: withHaptic(onGoBack),
      disabled: !canGoBack,
    },
    {
      key: 'forward',
      icon: 'chevron-forward',
      onPress: withHaptic(onGoForward),
      disabled: !canGoForward,
    },
    {
      key: 'home',
      icon: 'home-outline',
      onPress: withHaptic(onHome),
      disabled: false,
    },
    {
      key: 'bookmark',
      icon: isBookmarked ? 'star' : 'star-outline',
      color: isBookmarked ? '#f59e0b' : null,
      onPress: withHaptic(onToggleBookmark, isBookmarked ? 'light' : 'success'),
      disabled: false,
    },
    {
      key: 'search',
      icon: 'search-outline',
      onPress: withHaptic(onOpenFind),
      disabled: false,
    },
    {
      key: 'tabs',
      onPress: withHaptic(onOpenTabs, 'medium'),
      disabled: false,
      custom: true,
    },
  ];

  return (
    <View style={styles.container}>
      {buttons.map((btn) => {
        if (btn.custom) {
          // Кнопка вкладок с бейджем
          return (
            <TouchableOpacity
              key={btn.key}
              style={styles.button}
              onPress={btn.onPress}
              activeOpacity={0.6}
            >
              <View style={styles.tabsIconWrapper}>
                <Ionicons
                  name="square-outline"
                  size={22}
                  color={isPrivate ? theme.private : theme.text}
                />
                {tabCount > 0 && (
                  <View style={[styles.badge, isPrivate && styles.badgePrivate]}>
                    <Text style={styles.badgeText} numberOfLines={1}>
                      {tabCount > 99 ? '99' : tabCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={btn.key}
            style={[styles.button, btn.disabled && styles.buttonDisabled]}
            onPress={btn.onPress}
            disabled={btn.disabled}
            activeOpacity={0.6}
          >
            <Ionicons
              name={btn.icon}
              size={22}
              color={btn.color ?? (btn.disabled ? disabledColor : iconColor)}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const makeStyles = (theme, insets) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.tabBarBg,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    height: SIZES.bottomBarHeight + insets.bottom,
    paddingBottom: insets.bottom,
    paddingHorizontal: SIZES.paddingSm,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: SIZES.bottomBarHeight,
  },
  buttonDisabled: {
    opacity: 0.3,
  },
  tabsIconWrapper: {
    position: 'relative',
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: SIZES.radiusFull,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgePrivate: {
    backgroundColor: theme.private,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 12,
  },
});
