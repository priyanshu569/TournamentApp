import React, { useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Platform } from 'react-native';
import PagerView from 'react-native-pager-view';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen from './index';
import EventsScreen from './events';
import HistoryScreen from './history';
import ChatScreen from '../chat';
import ProfileScreen from './profile';

const TABS = [
  { key: 'index', label: 'Home', icon: 'home' as const },
  { key: 'events', label: 'Events', icon: 'trophy' as const },
  { key: 'history', label: 'History', icon: 'time' as const },
  { key: 'chat', label: 'Chats', icon: 'chatbubbles' as const },
  { key: 'profile', label: 'Profile', icon: 'person' as const },
];

export default function TabLayout() {
  const pagerRef = useRef<PagerView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const insets = useSafeAreaInsets();

  const handleTabPress = useCallback((index: number) => {
    pagerRef.current?.setPage(index);
    setActiveIndex(index);
  }, []);

  const handlePageSelected = useCallback((e: any) => {
    setActiveIndex(e.nativeEvent.position);
  }, []);

  return (
    <View style={styles.flex}>
      <PagerView
        ref={pagerRef}
        style={styles.flex}
        initialPage={0}
        onPageSelected={handlePageSelected}
        offscreenPageLimit={4}
      >
        <View key="index" style={styles.page}>
          <HomeScreen />
        </View>
        <View key="events" style={styles.page}>
          <EventsScreen />
        </View>
        <View key="history" style={styles.page}>
          <HistoryScreen />
        </View>
        <View key="chat" style={styles.page}>
          <ChatScreen />
        </View>
        <View key="profile" style={styles.page}>
          <ProfileScreen />
        </View>
      </PagerView>

      {/* Custom Bottom Tab Bar */}
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {TABS.map((tab, index) => {
          const isActive = activeIndex === index;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              onPress={() => handleTabPress(index)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={tab.icon}
                size={24}
                color={isActive ? '#7C3AED' : '#555'}
              />
              <Text style={[styles.tabLabel, { color: isActive ? '#7C3AED' : '#555' }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#0a0a0a' },
  page: { flex: 1, backgroundColor: '#0a0a0a' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0d0d0d',
    borderTopColor: '#1a1a1a',
    borderTopWidth: 1,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
});
