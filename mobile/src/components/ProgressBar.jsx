import React, { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { SIZES } from '../utils/theme';

/**
 * Тонкая полоска прогресса загрузки страницы (как в Chrome Mobile).
 * Анимирует от 0 до ~85% пока loading=true, потом завершается до 100%.
 */
export default function ProgressBar({ loading, isPrivate }) {
  const theme = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  const containerWidth = useRef(0);
  const fillAnim = useRef(null);

  useEffect(() => {
    if (loading) {
      // Показываем и начинаем анимацию
      progress.setValue(0);
      setVisible(true);

      fillAnim.current = Animated.timing(progress, {
        toValue: 0.85,
        duration: 8000,
        useNativeDriver: false,
      });
      fillAnim.current.start();
    } else {
      // Страница загружена — быстро дотягиваем до конца
      if (fillAnim.current) fillAnim.current.stop();

      Animated.timing(progress, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start(() => {
        // Небольшая задержка, потом скрываем
        setTimeout(() => {
          setVisible(false);
          progress.setValue(0);
        }, 250);
      });
    }
  }, [loading]);

  if (!visible) return null;

  const color = isPrivate ? theme.progressBarPrivate : theme.progressBar;

  return (
    <View
      style={{ height: SIZES.progressBarHeight, backgroundColor: 'transparent', overflow: 'hidden' }}
      onLayout={(e) => { containerWidth.current = e.nativeEvent.layout.width; }}
    >
      <Animated.View
        style={{
          height: SIZES.progressBarHeight,
          backgroundColor: color,
          width: progress.interpolate({
            inputRange: [0, 1],
            outputRange: ['0%', '100%'],
          }),
        }}
      />
    </View>
  );
}
