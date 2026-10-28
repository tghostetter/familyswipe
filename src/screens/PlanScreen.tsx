import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RecipeDetail } from '../components/RecipeDetail';
import { matchedRecipeIds } from '../logic/matching';
import { useStore } from '../state/store';
import { colors, radius } from '../theme';
import { DAYS, Recipe } from '../types';

const DAY_NAMES: Record<string, string> = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday',
};

export function PlanScreen() {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState<Recipe | null>(null);
  const matches = matchedRecipeIds(state);
  const planned = new Set(Object.values(state.plan).filter(Boolean));
  const spareMatches = matches.filter((id) => !planned.has(id)).length;

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.h1}>This week's dinners</Text>
      <Pressable
        style={[styles.fill, spareMatches === 0 && { opacity: 0.5 }]}
        disabled={spareMatches === 0}
        onPress={() => dispatch({ type: 'autofillPlan' })}
      >
        <Text style={styles.fillText}>
          {spareMatches === 0 ? 'No unplanned matches yet' : `Fill empty nights from ${spareMatches} matches`}
        </Text>
      </Pressable>

      {DAYS.map((day) => {
        const r = state.plan[day] ? state.recipes[state.plan[day]!] : null;
        return (
          <View key={day} style={styles.day}>
            <Text style={styles.dayName}>{DAY_NAMES[day]}</Text>
            {r ? (
              <View style={styles.meal}>
                <Pressable style={styles.mealMain} onPress={() => setOpen(r)}>
                  <Image source={r.image} style={styles.thumb} contentFit="cover" />
                  <Text style={styles.mealName} numberOfLines={2}>
                    {r.name}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`Remove ${r.name} from ${DAY_NAMES[day]}`}
                  onPress={() => dispatch({ type: 'setPlanDay', day, recipeId: null })}
                  style={styles.remove}
                >
                  <Text style={styles.removeText}>✕</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.emptyDay}>Nothing planned. Add a match from the Matches tab.</Text>
            )}
          </View>
        );
      })}
      <RecipeDetail recipe={open} onClose={() => setOpen(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 10 },
  h1: { fontSize: 28, fontWeight: '800', color: colors.text },
  fill: { backgroundColor: colors.basil, borderRadius: 999, paddingVertical: 12, alignItems: 'center', marginBottom: 6 },
  fillText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  day: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 12, gap: 8 },
  dayName: { fontSize: 13, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: colors.basil },
  meal: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mealMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: radius.sm },
  mealName: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  remove: { padding: 8 },
  removeText: { fontSize: 18, color: colors.muted },
  emptyDay: { fontSize: 15, color: colors.muted },
});
