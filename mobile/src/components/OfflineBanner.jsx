import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function OfflineBanner({ visible }) {
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
      <Ionicons name="wifi-outline" size={14} color="#fff" style={styles.icon} />
      <Text style={styles.text}>Нет подключения к интернету</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#374151',
    height: 36,
    zIndex: 999,
  },
  icon: {
    marginRight: 6,
  },
  text: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
});
