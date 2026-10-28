import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { RecipeDetail } from '../components/RecipeDetail';
import { likersOf, MATCH_RULES, matchedRecipeIds, MEAL_TYPES, mealTypeOf, MIN_LIKERS, photoFit } from '../logic/matching';
import { useStore } from '../state/store';
import { colors, radius } from '../theme';
import { plannedIds } from '../logic/plan';
import { DAYS, Recipe } from '../types';

export function MatchesScreen() {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState<Recipe | null>(null);
  // Matches are kept separate for each meal, so a yum on pancakes never fills a dinner slot.
  const sections = MEAL_TYPES.map((t) => ({ ...t, data: matchedRecipeIds(state, t.value) })).filter((s) => s.data.length > 0);
  const planned = new Set(plannedIds(state.plan));
  const rule = MATCH_RULES.find((r) => r.value === state.matchRule);

  // Puts the recipe on the first free day for its meal (dinner, unless it's a breakfast or lunch).
  const addToPlan = (r: Recipe) => {
    const slot = mealTypeOf(r);
    const day = DAYS.find((d) => !state.plan[d][slot]);
    if (!day) return;
    if (!state.planSlots.includes(slot)) dispatch({ type: 'setPlanSlots', slots: [...state.planSlots, slot] });
    dispatch({ type: 'setPlanMeal', day, slot, recipeId: r.id });
  };
  const weekFull = (r: Recipe) => DAYS.every((d) => state.plan[d][mealTypeOf(r)]);

  return (
    <View style={{ flex: 1 }}>
      <SectionList
        sections={sections}
        keyExtractor={(id) => id}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text style={styles.section}>
            {section.emoji} {section.label}
          </Text>
        )}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 4, marginBottom: 8 }}>
            <Text style={styles.h1}>Matches</Text>
            <Text style={styles.sub}>{rule?.help} You can change this on the Family tab.</Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {state.members.length < MIN_LIKERS
              ? 'A match needs at least two people saying yum. Add another family member on the Family tab, or have them join from their own phone.'
              : 'No matches yet. Once the family has swiped, breakfasts, school lunches and dinners you agree on show up here.'}
          </Text>
        }
        renderItem={({ item: id }) => {
          const r = state.recipes[id];
          const isPlanned = planned.has(id);
          const full = !isPlanned && weekFull(r);
          return (
            <Pressable style={styles.row} onPress={() => setOpen(r)}>
              <Image source={r.image} style={styles.thumb} contentFit={photoFit(r)} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.name} numberOfLines={2}>
                  {r.name}
                </Text>
                <Text style={styles.likers}>{likersOf(state, id).map((m) => m.avatar).join(' ')}</Text>
              </View>
              <Pressable
                disabled={isPlanned || full}
                onPress={() => addToPlan(r)}
                style={[styles.add, (isPlanned || full) && styles.addDisabled]}
              >
                <Text style={[styles.addText, (isPlanned || full) && { color: colors.muted }]}>
                  {isPlanned ? 'Planned' : full ? 'Week full' : 'Add'}
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
  section: { fontSize: 13, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: colors.basil, marginTop: 8 },
  empty: { fontSize: 16, color: colors.muted, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.md, padding: 10, borderWidth: 1, borderColor: colors.line },
  thumb: { width: 64, height: 64, borderRadius: radius.sm },
  name: { fontSize: 16, fontWeight: '800', color: colors.text },
  likers: { fontSize: 18 },
  add: { backgroundColor: colors.match, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  addDisabled: { backgroundColor: colors.line },
  addText: { color: '#fff', fontWeight: '800' },
});
