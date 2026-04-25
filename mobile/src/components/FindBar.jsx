import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Text,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { SIZES } from '../utils/theme';

/**
 * Панель поиска по странице (Find in Page).
 * Появляется сверху над BottomToolbar при активации.
 */
export default function FindBar({ visible, onClose, onSearch, matchCount, currentMatch }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [term, setTerm] = useState('');
  const slideAnim = useRef(new Animated.Value(52)).current;
  const inputRef = useRef(null);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : 52,
      duration: 200,
      useNativeDriver: true,
    }).start();

    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 220);
    } else {
      setTerm('');
    }
  }, [visible]);

  const handleChange = (text) => {
    setTerm(text);
    onSearch(text, 'forward');
  };

  const handlePrev = () => {
    if (term) onSearch(term, 'backward');
  };

  const handleNext = () => {
    if (term) onSearch(term, 'forward');
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      {/* Поле ввода */}
      <View style={styles.inputWrapper}>
        <Ionicons name="search" size={16} color={theme.textTertiary} style={{ marginRight: 6 }} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={term}
          onChangeText={handleChange}
          placeholder="Поиск на странице..."
          placeholderTextColor={theme.addressBarText}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {term.length > 0 && (
          <TouchableOpacity onPress={() => { setTerm(''); onSearch('', 'forward'); }}>
            <Ionicons name="close-circle" size={16} color={theme.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Счётчик совпадений */}
      {term.length > 0 && (
        <Text style={[styles.counter, matchCount === 0 && styles.counterNoResults]}>
          {matchCount > 0 ? `${currentMatch}/${matchCount}` : 'Не найдено'}
        </Text>
      )}

      {/* Кнопки навигации */}
      <TouchableOpacity style={styles.iconBtn} onPress={handlePrev} disabled={!term}>
        <Ionicons name="chevron-up" size={20} color={term ? theme.text : theme.textTertiary} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.iconBtn} onPress={handleNext} disabled={!term}>
        <Ionicons name="chevron-down" size={20} color={term ? theme.text : theme.textTertiary} />
      </TouchableOpacity>

      {/* Закрыть */}
      <TouchableOpacity style={styles.iconBtn} onPress={onClose}>
        <Ionicons name="close" size={20} color={theme.text} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.findBarBg,
    borderTopWidth: 1,
    borderTopColor: theme.findBarBorder,
    paddingHorizontal: SIZES.paddingMd,
    paddingVertical: SIZES.paddingSm,
    gap: SIZES.paddingXs,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.background,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: SIZES.paddingSm,
    height: 36,
  },
  input: {
    flex: 1,
    fontSize: SIZES.textMd,
    color: theme.text,
    paddingVertical: 0,
  },
  counter: {
    fontSize: SIZES.textSm,
    color: theme.textSecondary,
    minWidth: 68,
    textAlign: 'center',
  },
  counterNoResults: {
    color: theme.error,
    fontWeight: '600',
  },
  iconBtn: {
    width: 32,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
