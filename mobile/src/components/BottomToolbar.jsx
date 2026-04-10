import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { SIZES } from '../utils/theme';

/**
 * Нижняя панель навигации браузера.
 * Back · Forward · Home · Bookmark · Tabs (с бейджем)
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

  const buttons = [
    {
      key: 'back',
      icon: 'chevron-back',
      onPress: onGoBack,
      disabled: !canGoBack,
    },
    {
      key: 'forward',
      icon: 'chevron-forward',
      onPress: onGoForward,
      disabled: !canGoForward,
    },
    {
      key: 'home',
      icon: 'home-outline',
      onPress: onHome,
      disabled: false,
    },
    {
      key: 'bookmark',
      icon: isBookmarked ? 'star' : 'star-outline',
      color: isBookmarked ? '#f59e0b' : null,
      onPress: onToggleBookmark,
      disabled: false,
    },
    {
      key: 'tabs',
      onPress: onOpenTabs,
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
