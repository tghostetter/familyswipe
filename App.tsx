import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { matchedRecipeIds } from './src/logic/matching';
import { FamilyScreen } from './src/screens/FamilyScreen';
import { GroceryScreen } from './src/screens/GroceryScreen';
import { MatchesScreen } from './src/screens/MatchesScreen';
import { PlanScreen } from './src/screens/PlanScreen';
import { SwipeScreen } from './src/screens/SwipeScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { StoreProvider, useStore } from './src/state/store';
import { syncEnabled } from './src/sync/supabase';
import { colors } from './src/theme';

type Tab = 'swipe' | 'matches' | 'plan' | 'grocery' | 'family';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'swipe', label: 'Swipe', icon: '🍽️' },
  { key: 'matches', label: 'Matches', icon: '💞' },
  { key: 'plan', label: 'Plan', icon: '📅' },
  { key: 'grocery', label: 'Groceries', icon: '🛒' },
  { key: 'family', label: 'Family', icon: '👨‍👩‍👧' },
];

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StoreProvider>
          <StatusBar style="dark" />
          <Main />
        </StoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Main() {
  const { state, ready, household, syncError } = useStore();
  const [tab, setTab] = useState<Tab>('swipe');
  const noFamily = state.members.length === 0;

  useEffect(() => {
    if (ready && noFamily) setTab('family');
  }, [ready, noFamily]);

  if (!ready) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.basil} />
      </View>
    );
  }

  if (syncEnabled && !household) {
    return (
      <SafeAreaView style={styles.root}>
        <WelcomeScreen />
      </SafeAreaView>
    );
  }

  const matchCount = matchedRecipeIds(state).length;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      {syncError && <Text style={styles.syncError}>{syncError}</Text>}
      <View style={{ flex: 1 }}>
        {tab === 'swipe' && <SwipeScreen />}
        {tab === 'matches' && <MatchesScreen />}
        {tab === 'plan' && <PlanScreen />}
        {tab === 'grocery' && <GroceryScreen />}
        {tab === 'family' && <FamilyScreen onDone={() => setTab('swipe')} />}
      </View>
      {!noFamily && (
        <SafeAreaView edges={['bottom']} style={styles.tabBar}>
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <Pressable key={t.key} onPress={() => setTab(t.key)} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                <Text style={[styles.tabIcon, !on && { opacity: 0.55 }]}>{t.icon}</Text>
                <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{t.label}</Text>
                {t.key === 'matches' && matchCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{matchCount}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </SafeAreaView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  tabBar: { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  tab: { flex: 1, alignItems: 'center', paddingTop: 8, paddingBottom: 6, gap: 2 },
  tabIcon: { fontSize: 22 },
  tabLabel: { fontSize: 11, fontWeight: '700', color: colors.muted },
  tabLabelOn: { color: colors.basil },
  badge: { position: 'absolute', top: 4, right: '22%', backgroundColor: colors.match, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  syncError: { backgroundColor: colors.matchSoft, color: colors.text, fontSize: 13, paddingHorizontal: 16, paddingVertical: 8, textAlign: 'center' },
});
