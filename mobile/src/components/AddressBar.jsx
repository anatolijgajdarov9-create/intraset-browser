import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Text,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { SIZES } from '../utils/theme';

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
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  // Отображаемое значение: при фокусе — полный URL, иначе — домен/путь
  const displayUrl = url === 'intra://home' ? '' : url;

  useEffect(() => {
    if (!isFocused) {
      setInputValue(displayUrl);
    }
  }, [url, isFocused]);

  const handleSubmit = () => {
    Keyboard.dismiss();
    const trimmed = inputValue.trim();
    if (trimmed) onNavigate(trimmed);
  };

  const handleFocus = () => {
    setIsFocused(true);
    setInputValue(displayUrl);
    // Выделить весь текст при фокусе
    setTimeout(() => inputRef.current?.selectAll?.(), 50);
  };

  const handleBlur = () => {
    setIsFocused(false);
    setInputValue(displayUrl);
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
      </View>
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
});
