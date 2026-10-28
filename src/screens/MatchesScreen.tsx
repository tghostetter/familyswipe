import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { RecipeDetail } from '../components/RecipeDetail';
import { likersOf, matchedRecipeIds, MATCH_RULES } from '../logic/matching';
import { useStore } from '../state/store';
import { colors, radius } from '../theme';
import { DAYS, Recipe } from '../types';

export function MatchesScreen() {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState<Recipe | null>(null);
  const ids = matchedRecipeIds(state);
  const planned = new Set(Object.values(state.plan));
  const rule = MATCH_RULES.find((r) => r.value === state.matchRule);

  const addToPlan = (id: string) => {
    const day = DAYS.find((d) => !state.plan[d]);
    if (day) dispatch({ type: 'setPlanDay', day, recipeId: id });
  };
  const weekFull = DAYS.every((d) => state.plan[d]);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={ids}
        keyExtractor={(id) => id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 4, marginBottom: 8 }}>
            <Text style={styles.h1}>Matches</Text>
            <Text style={styles.sub}>{rule?.help} You can change this on the Family tab.</Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No matches yet. Once the family has swiped, dinners you agree on show up here.</Text>
        }
        renderItem={({ item: id }) => {
          const r = state.recipes[id];
          const isPlanned = planned.has(id);
          return (
            <Pressable style={styles.row} onPress={() => setOpen(r)}>
              <Image source={r.image} style={styles.thumb} contentFit="cover" />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.name} numberOfLines={2}>
                  {r.name}
                </Text>
                <Text style={styles.likers}>{likersOf(state, id).map((m) => m.avatar).join(' ')}</Text>
              </View>
              <Pressable
                disabled={isPlanned || weekFull}
                onPress={() => addToPlan(id)}
                style={[styles.add, (isPlanned || weekFull) && styles.addDisabled]}
              >
                <Text style={[styles.addText, (isPlanned || weekFull) && { color: colors.muted }]}>
                  {isPlanned ? 'Planned' : weekFull ? 'Week full' : 'Add'}
                </Text>
              </Pressable>
            </Pressable>
          );
        }}
      />
      <RecipeDetail recipe={open} onClose={() => setOpen(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10 },
  h1: { fontSize: 28, fontWeight: '800', color: colors.text },
  sub: { fontSize: 15, color: colors.muted },
  empty: { fontSize: 16, color: colors.muted, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.md, padding: 10, borderWidth: 1, borderColor: colors.line },
  thumb: { width: 64, height: 64, borderRadius: radius.sm },
  name: { fontSize: 16, fontWeight: '800', color: colors.text },
  likers: { fontSize: 18 },
  add: { backgroundColor: colors.match, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  addDisabled: { backgroundColor: colors.line },
  addText: { color: '#fff', fontWeight: '800' },
});
