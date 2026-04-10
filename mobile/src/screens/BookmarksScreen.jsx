import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  Image,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getBookmarks, removeBookmark, addBookmark } from '../utils/storage';
import { useTabStore } from '../store/tabStore';
import { useTheme } from '../hooks/useTheme';
import { SIZES } from '../utils/theme';

export default function BookmarksScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, insets), [theme, insets]);
  const { createTab, switchTab } = useTabStore();

  const [bookmarks, setBookmarks] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');

  useEffect(() => { loadBookmarks(); }, []);

  const loadBookmarks = async () => {
    const data = await getBookmarks();
    setBookmarks(data);
  };

  const handleOpen = (url) => {
    createTab(url, 'Вкладка');
    navigation.goBack();
  };

  const handleDelete = async (id) => {
    Alert.alert(
      'Удалить закладку?',
      'Это действие нельзя отменить.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить', style: 'destructive',
          onPress: async () => {
            await removeBookmark(id);
            await loadBookmarks();
          },
        },
      ]
    );
  };

  const handleEdit = (bookmark) => {
    setEditingId(bookmark.id);
    setEditTitle(bookmark.title);
    setEditUrl(bookmark.url);
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim() || !editUrl.trim()) return;
    await removeBookmark(editingId);
    await addBookmark({ title: editTitle.trim(), url: editUrl.trim(), favicon: null });
    setEditingId(null);
    setEditTitle('');
    setEditUrl('');
    await loadBookmarks();
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditUrl('');
  };

  const renderBookmark = ({ item }) => {
    if (editingId === item.id) {
      return (
        <View style={styles.editItem}>
          <TextInput
            style={styles.editInput}
            value={editTitle}
            onChangeText={setEditTitle}
            placeholder="Заголовок"
            placeholderTextColor={theme.textTertiary}
          />
          <TextInput
            style={styles.editInput}
            value={editUrl}
            onChangeText={setEditUrl}
            placeholder="URL"
            placeholderTextColor={theme.textTertiary}
            keyboardType="url"
            autoCapitalize="none"
          />
          <View style={styles.editButtons}>
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveEdit}>
              <Text style={styles.saveButtonText}>Сохранить</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelEdit}>
              <Text style={styles.cancelButtonText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={styles.bookmarkItem}
        onPress={() => handleOpen(item.url)}
        onLongPress={() => handleEdit(item)}
        activeOpacity={0.7}
      >
        <View style={styles.bookmarkIcon}>
          {item.favicon ? (
            <Image source={{ uri: item.favicon }} style={styles.favicon} />
          ) : (
            <View style={styles.faviconPlaceholder}>
              <Text style={styles.faviconText}>
                {item.title?.charAt(0).toUpperCase() || '★'}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.bookmarkInfo}>
          <Text style={styles.bookmarkTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.bookmarkUrl} numberOfLines={1}>{item.url}</Text>
        </View>
        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
          <Ionicons name="trash-outline" size={18} color={theme.textTertiary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Закладки ({bookmarks.length})</Text>
        <TouchableOpacity style={styles.doneButton} onPress={() => navigation.goBack()}>
          <Text style={styles.doneButtonText}>Готово</Text>
        </TouchableOpacity>
      </View>

      {bookmarks.length > 0 ? (
        <FlatList
          data={bookmarks}
          keyExtractor={(item) => item.id}
          renderItem={renderBookmark}
          contentContainerStyle={styles.list}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="star-outline" size={64} color={theme.textTertiary} />
          <Text style={styles.emptyTitle}>Нет закладок</Text>
          <Text style={styles.emptyText}>
            Нажмите на звёздочку в адресной строке, чтобы добавить закладку
          </Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = (theme, insets) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: insets.top + SIZES.paddingMd,
    paddingHorizontal: SIZES.paddingLg,
    paddingBottom: SIZES.paddingMd,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: {
    fontSize: SIZES.textXl,
    fontWeight: '700',
    color: theme.text,
  },
  doneButton: { padding: SIZES.paddingSm },
  doneButtonText: {
    fontSize: SIZES.textMd,
    color: theme.primary,
    fontWeight: '600',
  },
  list: { padding: SIZES.paddingMd },
  bookmarkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.paddingMd,
    marginBottom: SIZES.paddingSm,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: SIZES.radiusLg,
  },
  bookmarkIcon: { marginRight: SIZES.paddingMd },
  favicon: {
    width: 36,
    height: 36,
    borderRadius: SIZES.radiusMd,
  },
  faviconPlaceholder: {
    width: 36,
    height: 36,
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
  bookmarkInfo: {
    flex: 1,
    marginRight: SIZES.paddingSm,
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
  deleteButton: { padding: SIZES.paddingSm },
  editItem: {
    padding: SIZES.paddingMd,
    marginBottom: SIZES.paddingSm,
    backgroundColor: theme.backgroundTertiary,
    borderRadius: SIZES.radiusLg,
    borderWidth: 2,
    borderColor: theme.primary,
  },
  editInput: {
    backgroundColor: theme.background,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.paddingMd,
    fontSize: SIZES.textMd,
    color: theme.text,
    marginBottom: SIZES.paddingSm,
    borderWidth: 1,
    borderColor: theme.border,
  },
  editButtons: {
    flexDirection: 'row',
    gap: SIZES.paddingSm,
  },
  saveButton: {
    flex: 1,
    backgroundColor: theme.primary,
    paddingVertical: SIZES.paddingMd,
    borderRadius: SIZES.radiusMd,
    alignItems: 'center',
  },
  saveButtonText: {
    color: theme.textInverse,
    fontSize: SIZES.textMd,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
    paddingVertical: SIZES.paddingMd,
    borderRadius: SIZES.radiusMd,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  cancelButtonText: {
    color: theme.textSecondary,
    fontSize: SIZES.textMd,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.paddingXl * 2,
    gap: SIZES.paddingMd,
  },
  emptyTitle: {
    fontSize: SIZES.textXl,
    fontWeight: '700',
    color: theme.text,
  },
  emptyText: {
    fontSize: SIZES.textMd,
    color: theme.textSecondary,
    textAlign: 'center',
  },
});
