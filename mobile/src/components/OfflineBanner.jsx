import React, { useEffect, useRef, useMemo } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

export default function OfflineBanner({ visible }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const slideAnim = useRef(new Animated.Value(-36)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : -36,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY: slideAnim }] }]}>
      <Ionicons name="wifi-outline" size={14} color={theme.textInverse} style={styles.icon} />
      <Text style={styles.text}>Нет подключения к интернету</Text>
    </Animated.View>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.error,
    height: 36,
    zIndex: 999,
  },
  icon: {
    marginRight: 6,
  },
  text: {
    fontSize: 12,
    color: theme.textInverse,
    fontWeight: '600',
  },
});
