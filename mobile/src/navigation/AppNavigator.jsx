import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import MainScreen from '../screens/MainScreen';
import TabsScreen from '../screens/TabsScreen';
import BookmarksScreen from '../screens/BookmarksScreen';
import HistoryScreen from '../screens/HistoryScreen';
import DownloadsScreen from '../screens/DownloadsScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Main"
        screenOptions={{ headerShown: false }}
      >
        {/* Основной экран браузера — всегда смонтирован */}
        <Stack.Screen name="Main" component={MainScreen} />

        {/* Модальные экраны */}
        <Stack.Screen
          name="Tabs"
          component={TabsScreen}
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
        <Stack.Screen
          name="Bookmarks"
          component={BookmarksScreen}
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
        <Stack.Screen
          name="History"
          component={HistoryScreen}
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
        <Stack.Screen
          name="Downloads"
          component={DownloadsScreen}
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ presentation: 'modal', gestureEnabled: true }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
