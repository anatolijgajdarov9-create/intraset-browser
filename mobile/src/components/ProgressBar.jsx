import React, { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { SIZES } from '../utils/theme';

/**
 * Прогресс-бар загрузки страницы.
 * - Реальный прогресс от onLoadProgress (0→1) — плавно анимируется.
 * - Фейковая анимация до 85% если реальный прогресс недоступен.
 * - Мерцающий «гло» на переднем крае для визуального полиша.
 */
export default function ProgressBar({ loading, progress, isPrivate }) {
  const theme = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  const fillAnim = useRef(null);
  const glowLoop = useRef(null);
  const hasRealProgress = typeof progress === 'number';

  useEffect(() => {
    if (loading) {
      anim.setValue(0);
      setVisible(true);

      if (!hasRealProgress) {
        // Фейковая анимация если нет реального прогресса
        fillAnim.current = Animated.timing(anim, {
          toValue: 0.85,
          duration: 8000,
          useNativeDriver: false,
        });
        fillAnim.current.start();
      }

      // Пульсирующий гло на переднем крае
      glowLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 480, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0, duration: 480, useNativeDriver: true }),
        ])
      );
      glowLoop.current.start();
    } else {
      if (fillAnim.current) fillAnim.current.stop();
      if (glowLoop.current) { glowLoop.current.stop(); glowLoop.current = null; }
      glowAnim.setValue(0);

      Animated.timing(anim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start(() => {
        setTimeout(() => {
          setVisible(false);
          anim.setValue(0);
        }, 250);
      });
    }
  }, [loading]);

  // Обновляем анимацию при получении реального прогресса
  useEffect(() => {
    if (hasRealProgress && loading && visible) {
      if (fillAnim.current) fillAnim.current.stop();
      Animated.timing(anim, {
        toValue: progress,
        duration: 100,
        useNativeDriver: false,
      }).start();
    }
  }, [progress]);

  if (!visible) return null;

  const barColor = isPrivate ? theme.progressBarPrivate : theme.progressBar;

  return (
    <View style={{ height: SIZES.progressBarHeight, backgroundColor: 'transparent', overflow: 'hidden' }}>
      {/* Основная полоса прогресса */}
      <Animated.View
        style={{
          height: SIZES.progressBarHeight,
          backgroundColor: barColor,
          width: anim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0%', '100%'],
          }),
        }}
      >
        {/* Светлый гло-оверлей на переднем крае */}
        <Animated.View
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: 32,
            backgroundColor: 'rgba(255,255,255,0.55)',
            opacity: glowAnim,
            borderRadius: SIZES.progressBarHeight / 2,
          }}
        />
      </Animated.View>
    </View>
  );
}
