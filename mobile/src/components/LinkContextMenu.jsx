import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { SIZES } from '../utils/theme';

export default function LinkContextMenu({
  visible,
  url,
  linkText,
  onClose,
  onOpenInNewTab,
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, insets), [theme, insets]);

  const displayUrl = url
    ? url.length > 70 ? url.substring(0, 70) + '…' : url
    : '';

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(url || '');
    onClose();
  };

  const handleShare = async () => {
    try {
      await Share.share({ url: url || '', message: url || '' });
    } catch (_) {}
    onClose();
  };

  const handleOpenNewTab = () => {
    onOpenInNewTab(url);
    onClose();
  };

  const actions = [
    {
      key: 'new-tab',
      icon: 'add-circle-outline',
      label: 'Открыть в новой вкладке',
      onPress: handleOpenNewTab,
    },
    {
      key: 'copy',
      icon: 'copy-outline',
      label: 'Копировать ссылку',
      onPress: handleCopyLink,
    },
    {
      key: 'share',
      icon: 'share-outline',
      label: 'Поделиться',
      onPress: handleShare,
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet}>
          {/* URL preview */}
          <View style={styles.urlPreview}>
            <Ionicons
              name="link-outline"
              size={14}
              color={theme.textTertiary}
              style={styles.urlIcon}
            />
            <Text style={styles.urlText} numberOfLines={2} selectable>
              {displayUrl}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Actions */}
          {actions.map((action, idx) => (
            <TouchableOpacity
              key={action.key}
              style={[
                styles.action,
                idx < actions.length - 1 && styles.actionBorder,
              ]}
              onPress={action.onPress}
              activeOpacity={0.7}
            >
              <Ionicons
                name={action.icon}
                size={20}
                color={theme.text}
                style={styles.actionIcon}
              />
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}

          {/* Cancel */}
          <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Отмена</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (theme, insets) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.background,
    borderTopLeftRadius: SIZES.radiusXl,
    borderTopRightRadius: SIZES.radiusXl,
    paddingBottom: insets.bottom + SIZES.paddingMd,
    borderTopWidth: 1,
    borderColor: theme.border,
  },
  urlPreview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SIZES.paddingLg,
    paddingBottom: SIZES.paddingMd,
  },
  urlIcon: {
    marginRight: SIZES.paddingXs,
    marginTop: 2,
  },
  urlText: {
    flex: 1,
    fontSize: SIZES.textSm,
    color: theme.textSecondary,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: theme.border,
    marginHorizontal: SIZES.paddingLg,
    marginBottom: SIZES.paddingXs,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.paddingMd,
    paddingHorizontal: SIZES.paddingLg,
  },
  actionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  actionIcon: {
    marginRight: SIZES.paddingMd,
    width: 24,
  },
  actionLabel: {
    fontSize: SIZES.textMd,
    color: theme.text,
    fontWeight: '500',
  },
  cancelButton: {
    marginHorizontal: SIZES.paddingLg,
    marginTop: SIZES.paddingMd,
    paddingVertical: SIZES.paddingMd,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: SIZES.radiusLg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  cancelText: {
    fontSize: SIZES.textMd,
    color: theme.textSecondary,
    fontWeight: '600',
  },
});
