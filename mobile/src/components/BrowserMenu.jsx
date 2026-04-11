import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { SIZES } from '../utils/theme';

const BASE_MENU_ITEMS = [
  { key: 'reload',    icon: 'refresh',           label: 'Обновить' },
  { key: 'desktop',   icon: 'desktop-outline',    label: 'Десктоп версия' },
  { key: 'nightMode', icon: 'moon-outline',       label: 'Ночной режим' },
  { key: 'reading',   icon: 'book-outline',       label: 'Режим чтения' },
  { key: 'zoom',      type: 'zoom' },                                     // inline zoom row
  { key: 'share',     icon: 'share-outline',      label: 'Поделиться' },
  { key: 'find',      icon: 'search',             label: 'Найти на странице' },
  { key: 'settings',  icon: 'settings-outline',   label: 'Настройки' },
];

export default function BrowserMenu({
  visible,
  onClose,
  onAction,
  url,
  isDesktopMode,
  isNightMode,
  isReadingMode,
  currentZoom = 100,
  onZoomIn,
  onZoomOut,
  canGoBack,
  canGoForward,
  headerHeight = 120,
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => makeStyles(theme, insets, headerHeight),
    [theme, insets, headerHeight],
  );

  const handleAction = (key) => {
    onAction(key);
    onClose();
  };

  const items = BASE_MENU_ITEMS.map(item => {
    if (item.key === 'desktop') {
      return { ...item, label: isDesktopMode ? 'Мобильная версия' : 'Десктоп версия' };
    }
    if (item.key === 'nightMode') {
      return {
        ...item,
        label: isNightMode ? 'Выкл. ночной режим' : 'Ночной режим',
        icon: isNightMode ? 'sunny-outline' : 'moon-outline',
        active: isNightMode,
      };
    }
    if (item.key === 'reading') {
      return { ...item, active: isReadingMode };
    }
    return item;
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.container}>
          <View style={styles.menu}>
            {items.map((item) => {
              // ── Зум-строка (inline, не закрывает меню) ──
              if (item.type === 'zoom') {
                return (
                  <View key="zoom" style={styles.zoomRow}>
                    <Ionicons
                      name="text-outline"
                      size={20}
                      color={theme.textSecondary}
                      style={styles.menuIcon}
                    />
                    <Text style={styles.zoomLabel}>Масштаб</Text>
                    <View style={styles.zoomControls}>
                      <TouchableOpacity
                        style={styles.zoomBtn}
                        onPress={onZoomOut}
                        disabled={currentZoom <= 50}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="remove"
                          size={18}
                          color={currentZoom <= 50 ? theme.textTertiary : theme.text}
                        />
                      </TouchableOpacity>
                      <Text style={styles.zoomValue}>{currentZoom}%</Text>
                      <TouchableOpacity
                        style={styles.zoomBtn}
                        onPress={onZoomIn}
                        disabled={currentZoom >= 200}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="add"
                          size={18}
                          color={currentZoom >= 200 ? theme.textTertiary : theme.text}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }

              // ── Обычный пункт меню ──
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.menuItem, item.active && styles.menuItemActive]}
                  onPress={() => handleAction(item.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={item.active ? theme.primary : theme.text}
                    style={styles.menuIcon}
                  />
                  <Text style={[styles.menuLabel, item.active && styles.menuLabelActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.arrow} />
        </View>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (theme, insets, headerHeight) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: headerHeight + 8,
    paddingRight: 16,
  },
  container: {
    position: 'relative',
  },
  menu: {
    backgroundColor: theme.background,
    borderRadius: SIZES.radiusLg,
    borderWidth: 1,
    borderColor: theme.border,
    width: 230,
    paddingVertical: SIZES.paddingXs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.paddingMd,
    paddingHorizontal: SIZES.paddingMd,
  },
  menuItemActive: {
    backgroundColor: theme.primaryLight,
  },
  menuIcon: {
    marginRight: SIZES.paddingMd,
    width: 24,
  },
  menuLabel: {
    fontSize: SIZES.textMd,
    color: theme.text,
  },
  menuLabelActive: {
    color: theme.primary,
    fontWeight: '600',
  },
  // ── Зум ──
  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.paddingSm,
    paddingHorizontal: SIZES.paddingMd,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.borderLight,
    marginVertical: 2,
  },
  zoomLabel: {
    flex: 1,
    fontSize: SIZES.textMd,
    color: theme.text,
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.paddingXs,
  },
  zoomBtn: {
    width: 30,
    height: 30,
    borderRadius: SIZES.radiusMd,
    backgroundColor: theme.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomValue: {
    fontSize: SIZES.textSm,
    fontWeight: '600',
    color: theme.text,
    minWidth: 42,
    textAlign: 'center',
  },
  // ── Стрелка ──
  arrow: {
    position: 'absolute',
    top: -8,
    right: 14,
    width: 16,
    height: 16,
    backgroundColor: theme.background,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: theme.border,
    transform: [{ rotate: '45deg' }],
  },
});
