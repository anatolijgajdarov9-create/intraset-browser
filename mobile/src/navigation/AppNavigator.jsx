import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSettingsStore } from '../store/settingsStore';
import { lightTheme, darkTheme } from '../utils/theme';

import MainScreen from '../screens/MainScreen';
import TabsScreen from '../screens/TabsScreen';
import BookmarksScreen from '../screens/BookmarksScreen';
import HistoryScreen from '../screens/HistoryScreen';
import DownloadsScreen from '../screens/DownloadsScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const isDark = useSettingsStore(state => state.settings.darkMode);
  const bgColor = isDark ? darkTheme.background : lightTheme.background;

  // Передаём цвет фона во все экраны, чтобы исключить чёрный мигающий фон
  // при закрытии модальных экранов на Android.
  // transparentModal: underlying MainScreen остаётся смонтированным и видимым
  // во время анимации → нет чёрного мигания при возврате на Android.
  const modalOptions = {
    presentation: 'transparentModal',
    gestureEnabled: true,
    animation: 'slide_from_bottom',
    contentStyle: { backgroundColor: bgColor },
  };

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Main"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: bgColor },
        }}
      >
        {/* Основной экран браузера — всегда смонтирован */}
        <Stack.Screen name="Main" component={MainScreen} />

        {/* Модальные экраны */}
        <Stack.Screen name="Tabs"      component={TabsScreen}       options={modalOptions} />
        <Stack.Screen name="Bookmarks" component={BookmarksScreen}  options={modalOptions} />
        <Stack.Screen name="History"   component={HistoryScreen}    options={modalOptions} />
        <Stack.Screen name="Downloads" component={DownloadsScreen}  options={modalOptions} />
        <Stack.Screen name="Settings"  component={SettingsScreen}   options={modalOptions} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
