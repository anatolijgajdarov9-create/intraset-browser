import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

/**
 * Фиолетовая плашка "Приватный режим" над адресной строкой.
 * Видна только когда активная вкладка приватная.
 */
export default function PrivateModeBanner({ visible }) {
  const theme = useTheme();

  if (!visible) return null;

  return (
    <View style={[styles.banner, { backgroundColor: theme.private }]}>
      <Ionicons name="eye-off-outline" size={14} color="#fff" style={{ marginRight: 6 }} />
      <Text style={styles.text}>Приватный режим</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
    paddingHorizontal: 12,
  },
  text: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
