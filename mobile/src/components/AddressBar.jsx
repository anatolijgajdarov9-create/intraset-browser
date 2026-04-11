import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Text,
  Keyboard,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { SIZES } from '../utils/theme';
import { getHistory, getBookmarks } from '../utils/storage';

/**
 * Адресная строка браузера.
 * Отображает домен в обычном состоянии, полный URL при фокусе.
 */
export default function AddressBar({
  url,
  loading,
  isPrivate,
  isBookmarked,
  onNavigate,
  onReload,
  onStop,
  onToggleBookmark,
  onOpenMenu,
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [clipboardUrl, setClipboardUrl] = useState(null);
  const inputRef = useRef(null);

  // Отображаемое значение: при фокусе — полный URL, иначе — домен/путь
  const displayUrl = url === 'intra://home' ? '' : url;

  useEffect(() => {
    if (!isFocused) {
      setInputValue(displayUrl);
    }
  }, [url, isFocused]);

  const debounceTimer = useRef(null);

  useEffect(() => {
    if (isFocused && inputValue.length > 2) {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        loadSuggestions(inputValue);
      }, 300);
    } else {
      setSuggestions([]);
    }

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [inputValue, isFocused]);

  const loadSuggestions = async (query) => {
    try {
      const history = await getHistory();
      const bookmarks = await getBookmarks();
      const lowerQuery = query.toLowerCase();

      const matchedHistory = history
        .filter(h => h.url?.toLowerCase().includes(lowerQuery) || h.title?.toLowerCase().includes(lowerQuery))
        .slice(0, 3);

      const matchedBookmarks = bookmarks
        .filter(b => b.url?.toLowerCase().includes(lowerQuery) || b.title?.toLowerCase().includes(lowerQuery))
        .slice(0, 3);

      const combined = [];
      const seenUrls = new Set();

      [...matchedHistory, ...matchedBookmarks].forEach(item => {
        if (!seenUrls.has(item.url)) {
          seenUrls.add(item.url);
          combined.push({
            type: bookmarks.some(b => b.url === item.url) ? 'bookmark' : 'history',
            ...item,
          });
        }
      });

      setSuggestions(combined.slice(0, 6));
    } catch (e) {
      console.error('[AddressBar] Error loading suggestions:', e);
    }
  };

  const handleSubmit = () => {
    Keyboard.dismiss();
    const trimmed = inputValue.trim();
    if (trimmed) onNavigate(trimmed);
  };

  const handleFocus = () => {
    setIsFocused(true);
    setInputValue(displayUrl);
    // Проверяем буфер обмена на наличие URL
    Clipboard.getStringAsync().then(text => {
      if (!text) return;
      try {
        const parsed = new URL(text.trim());
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          setClipboardUrl(text.trim());
        }
      } catch {
        // не URL — игнорируем
      }
    }).catch(() => {});
  };

  const handleBlur = () => {
    setIsFocused(false);
    setInputValue(displayUrl);
    setClipboardUrl(null);
  };

  // Иконка безопасности слева
  const isHttps = url?.startsWith('https://');
  const isHome = url === 'intra://home' || !url;

  const SecurityIcon = () => {
    if (isHome) return <Ionicons name="home-outline" size={16} color={theme.textTertiary} />;
    if (isPrivate) return <Ionicons name="eye-off-outline" size={16} color={theme.private} />;
    if (isHttps) return <Ionicons name="lock-closed" size={16} color={theme.success} />;
    return <Ionicons name="globe-outline" size={16} color={theme.textTertiary} />;
  };

  // Что показывать в поле когда не в фокусе
  const getDisplayText = () => {
    if (!url || url === 'intra://home') return '';
    if (isFocused) return inputValue;
    try {
      const u = new URL(url);
      return u.hostname + (u.pathname !== '/' ? u.pathname : '');
    } catch {
      return url;
    }
  };

  const accentColor = isPrivate ? theme.private : theme.primary;

  return (
    <View style={[styles.container, isPrivate && styles.containerPrivate]}>
      {/* Поле ввода URL */}
      <View style={[
        styles.inputRow,
        isFocused && { borderColor: accentColor, borderWidth: 2 },
      ]}>
        {/* Иконка безопасности */}
        <View style={styles.securityIcon}>
          <SecurityIcon />
        </View>

        <TextInput
          ref={inputRef}
          style={[styles.input, isPrivate && styles.inputPrivate]}
          value={isFocused ? inputValue : getDisplayText()}
          onChangeText={setInputValue}
          onSubmitEditing={handleSubmit}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Введите адрес или поисковый запрос..."
          placeholderTextColor={theme.addressBarText}
          returnKeyType="go"
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          selectTextOnFocus
        />

        {/* Кнопка очистки (только при фокусе с текстом) */}
        {isFocused && inputValue.length > 0 && (
          <TouchableOpacity
            onPress={() => { setInputValue(''); setSuggestions([]); }}
            style={styles.iconButton}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Ionicons name="close-circle" size={16} color={theme.textTertiary} />
          </TouchableOpacity>
        )}

        {/* Кнопка закладки */}
        {!isFocused && url && url !== 'intra://home' && (
          <TouchableOpacity onPress={onToggleBookmark} style={styles.iconButton} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
            <Ionicons
              name={isBookmarked ? 'star' : 'star-outline'}
              size={18}
              color={isBookmarked ? '#f59e0b' : theme.textTertiary}
            />
          </TouchableOpacity>
        )}

        {/* Кнопка обновления / остановки */}
        <TouchableOpacity
          onPress={loading ? onStop : onReload}
          style={styles.iconButton}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
        >
          <Ionicons
            name={loading ? 'close' : 'refresh'}
            size={18}
            color={theme.textSecondary}
          />
        </TouchableOpacity>

        {/* Кнопка меню */}
        <TouchableOpacity
          onPress={onOpenMenu}
          style={styles.iconButton}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Ionicons
            name="ellipsis-vertical"
            size={18}
            color={theme.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Clipboard URL chip */}
      {isFocused && clipboardUrl && clipboardUrl !== url && inputValue.length === 0 && (
        <TouchableOpacity
          style={styles.clipboardChip}
          onPress={() => {
            setInputValue(clipboardUrl);
            onNavigate(clipboardUrl);
            setIsFocused(false);
            setClipboardUrl(null);
            setSuggestions([]);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="clipboard-outline" size={14} color={theme.primary} style={{ marginRight: 6 }} />
          <Text style={styles.clipboardChipText} numberOfLines={1}>
            Вставить: {clipboardUrl}
          </Text>
        </TouchableOpacity>
      )}

      {isFocused && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          {suggestions.map((item, index) => (
            <TouchableOpacity
              key={`${item.url}-${index}`}
              style={styles.suggestionItem}
              onPress={() => {
                setInputValue(item.url);
                onNavigate(item.url);
                setIsFocused(false);
                setSuggestions([]);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.suggestionIcon}>
                <Ionicons
                  name={item.type === 'bookmark' ? 'star' : 'time-outline'}
                  size={16}
                  color={item.type === 'bookmark' ? '#f59e0b' : theme.textTertiary}
                />
              </View>
              <View style={styles.suggestionContent}>
                <Text style={styles.suggestionTitle} numberOfLines={1}>
                  {item.title || item.url}
                </Text>
                <Text style={styles.suggestionUrl} numberOfLines={1}>
                  {item.url}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  container: {
    paddingHorizontal: SIZES.paddingMd,
    paddingVertical: SIZES.paddingSm,
    backgroundColor: theme.tabBarBg,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  containerPrivate: {
    backgroundColor: theme.privateLight,
    borderBottomColor: theme.privateBorder,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.addressBarBg,
    borderRadius: SIZES.radiusLg,
    borderWidth: 1,
    borderColor: theme.addressBarBorder,
    height: 40,
    paddingHorizontal: SIZES.paddingSm,
  },
  securityIcon: {
    marginRight: SIZES.paddingXs,
    width: 20,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: SIZES.textMd,
    color: theme.text,
    paddingVertical: 0,
  },
  inputPrivate: {
    color: theme.private,
  },
  iconButton: {
    padding: SIZES.paddingXs,
    marginLeft: SIZES.paddingXs,
  },
  clipboardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SIZES.paddingXs,
    paddingVertical: SIZES.paddingXs,
    paddingHorizontal: SIZES.paddingMd,
    backgroundColor: theme.primaryLight,
    borderRadius: SIZES.radiusFull,
    borderWidth: 1,
    borderColor: theme.primary,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  clipboardChipText: {
    fontSize: SIZES.textXs,
    color: theme.primary,
    fontWeight: '500',
    flexShrink: 1,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    backgroundColor: theme.background,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: theme.border,
    maxHeight: 200,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.paddingMd,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  suggestionIcon: {
    marginRight: SIZES.paddingSm,
    width: 20,
    alignItems: 'center',
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: SIZES.textSm,
    color: theme.text,
    fontWeight: '500',
  },
  suggestionUrl: {
    fontSize: SIZES.textXs,
    color: theme.textSecondary,
  },
});
