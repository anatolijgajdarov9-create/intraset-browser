import React, { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { SIZES } from '../utils/theme';

/**
 * Прогресс-бар загрузки страницы.
 * Если передан реальный progress (0-1) от onLoadProgress — использует его.
 * Иначе показывает фейковую анимацию до 85%.
 */
export default function ProgressBar({ loading, progress, isPrivate }) {
  const theme = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  const fillAnim = useRef(null);
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
    } else {
      if (fillAnim.current) fillAnim.current.stop();

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

  const color = isPrivate ? theme.progressBarPrivate : theme.progressBar;

  return (
    <View style={{ height: SIZES.progressBarHeight, backgroundColor: 'transparent', overflow: 'hidden' }}>
      <Animated.View
        style={{
          height: SIZES.progressBarHeight,
          backgroundColor: color,
          width: anim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0%', '100%'],
          }),
        }}
      />
    </View>
  );
}
