import React, { useRef, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import PagerView from 'react-native-pager-view';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen from './index';
import EventsScreen from './events';
import HistoryScreen from './history';
import ChatScreen from '../chat';
import ProfileScreen from './profile';
import { TabNavigationContext } from '@/lib/tabNavigation';
import { useAppTheme } from '@/lib/ThemeContext';
import { ThemeColors } from '@/constants/theme';

const TABS = [
  { key: 'index', label: 'Home', icon: 'home' as const },
  { key: 'events', label: 'Events', icon: 'trophy' as const },
  { key: 'history', label: 'History', icon: 'time' as const },
  { key: 'chat', label: 'Chats', icon: 'chatbubbles' as const },
  { key: 'profile', label: 'Profile', icon: 'person' as const },
];

export default function TabLayout() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
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

  const goToTab = useCallback((key: string) => {
    const index = TABS.findIndex((t) => t.key === key);
    if (index !== -1) {
      pagerRef.current?.setPage(index);
      setActiveIndex(index);
    }
  }, []);

  return (
    <View style={styles.flex}>
      <TabNavigationContext.Provider value={{ goToTab, activeTab: TABS[activeIndex].key }}>
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
      </TabNavigationContext.Provider>

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
              <View style={[styles.tabIconWrap, isActive && styles.tabIconWrapActive]}>
                <Ionicons
                  name={tab.icon}
                  size={21}
                  color={isActive ? '#fff' : colors.textMuted}
                />
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    page: { flex: 1, backgroundColor: colors.background },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderTopColor: colors.surfaceAlt,
      borderTopWidth: 1,
      paddingTop: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
      elevation: 12,
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 4,
    },
    tabIconWrap: {
      width: 40,
      height: 30,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    tabIconWrapActive: {
      backgroundColor: colors.accent,
    },
    tabLabel: {
      fontSize: 11,
      fontWeight: '600',
      marginTop: 3,
      color: colors.textMuted,
    },
    tabLabelActive: {
      color: colors.accent,
    },
  });
}
