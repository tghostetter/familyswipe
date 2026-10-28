import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RecipeDetail } from '../components/RecipeDetail';
import { matchedRecipeIds } from '../logic/matching';
import { DAY_NAMES, plannedIds, SLOT_ICONS, SLOT_NAMES, spareMatches } from '../logic/plan';
import { useStore } from '../state/store';
import { colors, radius } from '../theme';
import { Day, DAYS, MEAL_SLOTS, MealSlot, Recipe } from '../types';

type Spot = { day: Day; slot: MealSlot };

// iPhones won't open a new sheet while the last one is still sliding away.
const afterClose = (fn: () => void) => setTimeout(fn, 350);

export function PlanScreen() {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState<Recipe | null>(null);
  // The planned meal whose options are showing, or the empty spot someone is filling.
  const [editing, setEditing] = useState<Spot | null>(null);
  const [picking, setPicking] = useState<Spot | null>(null);

  const matches = matchedRecipeIds(state).map((id) => state.recipes[id]);
  const slots = state.planSlots;
  const spare = slots.reduce((n, slot) => n + spareMatches(state.plan, slot, matches).length, 0);
  const emptySpots = DAYS.reduce((n, day) => n + slots.filter((slot) => !state.plan[day][slot]).length, 0);
  const canFill = spare > 0 && emptySpots > 0;
  const anything = plannedIds(state.plan, slots).length > 0;

  const toggleSlot = (slot: MealSlot) => {
    const on = slots.includes(slot);
    if (on && slots.length === 1) return; // Always plan at least one meal a day.
    dispatch({ type: 'setPlanSlots', slots: on ? slots.filter((s) => s !== slot) : [...slots, slot] });
  };

  const clearWeek = () =>
    Alert.alert('Clear this week?', 'This empties every day of the plan. Your matches stay.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => dispatch({ type: 'clearPlan' }) },
    ]);

  const editingRecipe = editing ? state.recipes[state.plan[editing.day][editing.slot] ?? ''] : undefined;

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.h1}>This week's meals</Text>

      <Text style={styles.label}>Meals to plan</Text>
      <View style={styles.chips}>
        {MEAL_SLOTS.map((slot) => {
          const on = slots.includes(slot);
          return (
            <Pressable
              key={slot}
              onPress={() => toggleSlot(slot)}
              style={[styles.chip, on && styles.chipOn]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {SLOT_ICONS[slot]} {SLOT_NAMES[slot]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={[styles.fill, !canFill && { opacity: 0.5 }]}
        disabled={!canFill}
        onPress={() => dispatch({ type: 'autofillPlan' })}
      >
        <Text style={styles.fillText}>
          {emptySpots === 0
            ? 'The week is planned 🎉'
            : spare === 0
              ? 'No unplanned matches yet'
              : `Fill empty spots from ${spare} ${spare === 1 ? 'match' : 'matches'}`}
        </Text>
      </Pressable>

      {DAYS.map((day) => (
        <View key={day} style={styles.day}>
          <Text style={styles.dayName}>{DAY_NAMES[day]}</Text>
          {slots.map((slot) => {
            const id = state.plan[day][slot];
            const r = id ? state.recipes[id] : null;
            return (
              <Pressable
                key={slot}
                style={styles.meal}
                onPress={() => (r ? setEditing({ day, slot }) : setPicking({ day, slot }))}
                accessibilityLabel={r ? `${SLOT_NAMES[slot]} on ${DAY_NAMES[day]}: ${r.name}. Tap to change.` : `Add ${SLOT_NAMES[slot]} on ${DAY_NAMES[day]}`}
              >
                {r ? (
                  <Image source={r.image} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]}>
                    <Text style={{ fontSize: 22 }}>{SLOT_ICONS[slot]}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  {slots.length > 1 && <Text style={styles.slotName}>{SLOT_NAMES[slot]}</Text>}
                  {r ? (
                    <Text style={styles.mealName} numberOfLines={2}>
                      {r.name}
                    </Text>
                  ) : (
                    <Text style={styles.emptyMeal}>+ Pick a match</Text>
                  )}
                </View>
                {r && <Text style={styles.chevron}>›</Text>}
              </Pressable>
            );
          })}
        </View>
      ))}

      {anything && (
        <Pressable onPress={clearWeek} style={styles.clear}>
          <Text style={styles.clearText}>Clear this week's plan</Text>
        </Pressable>
      )}

      <MealOptions
        spot={editing}
        recipe={editingRecipe ?? null}
        onClose={() => setEditing(null)}
        onView={() => {
          const r = editingRecipe ?? null;
          setEditing(null);
          afterClose(() => setOpen(r));
        }}
        onSwap={() => {
          const spot = editing;
          setEditing(null);
          afterClose(() => setPicking(spot));
        }}
        onMove={(to) => {
          if (editing) dispatch({ type: 'movePlanMeal', slot: editing.slot, from: editing.day, to });
          setEditing(null);
        }}
        onRemove={() => {
          if (editing) dispatch({ type: 'setPlanMeal', ...editing, recipeId: null });
          setEditing(null);
        }}
        plannedOn={(day) => (editing ? state.recipes[state.plan[day][editing.slot] ?? '']?.name : undefined)}
      />
      <MatchPicker
        spot={picking}
        matches={picking ? matches.filter((r) => (r.mealType ?? 'dinner') === picking.slot) : []}
        plannedIds={picking ? new Set(plannedIds(state.plan, [picking.slot])) : new Set()}
        onPick={(recipeId) => {
          if (picking) dispatch({ type: 'setPlanMeal', ...picking, recipeId });
          setPicking(null);
        }}
        onClose={() => setPicking(null)}
      />
      <RecipeDetail recipe={open} onClose={() => setOpen(null)} />
    </ScrollView>
  );
}

/** What you can do with a planned meal: look at it, swap it, move it to another day, or take it off. */
function MealOptions(props: {
  spot: Spot | null;
  recipe: Recipe | null;
  onClose: () => void;
  onView: () => void;
  onSwap: () => void;
  onMove: (to: Day) => void;
  onRemove: () => void;
  plannedOn: (day: Day) => string | undefined;
}) {
  const { spot, recipe } = props;
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!spot && !!recipe} transparent animationType="fade" onRequestClose={props.onClose}>
      <Pressable style={styles.backdrop} onPress={props.onClose}>
        {spot && recipe && (
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
            <Text style={styles.sheetSmall}>
              {SLOT_NAMES[spot.slot]} · {DAY_NAMES[spot.day]}
            </Text>
            <Text style={styles.sheetTitle}>{recipe.name}</Text>

            <Pressable style={styles.action} onPress={props.onView}>
              <Text style={styles.actionText}>📖  See the recipe</Text>
            </Pressable>
            <Pressable style={styles.action} onPress={props.onSwap}>
              <Text style={styles.actionText}>🔁  Swap for a different match</Text>
            </Pressable>

            <Text style={styles.sheetSmall}>Move to another day</Text>
            <View style={styles.chips}>
              {DAYS.filter((d) => d !== spot.day).map((day) => {
                const there = props.plannedOn(day);
                return (
                  <Pressable
                    key={day}
                    style={styles.dayChip}
                    onPress={() => props.onMove(day)}
                    accessibilityLabel={there ? `Swap with ${there} on ${DAY_NAMES[day]}` : `Move to ${DAY_NAMES[day]}`}
                  >
                    <Text style={styles.dayChipText}>{day}</Text>
                    <Text style={styles.dayChipSub}>{there ? 'swap' : 'free'}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable style={styles.action} onPress={props.onRemove}>
              <Text style={[styles.actionText, { color: colors.match }]}>✕  Take it off the plan</Text>
            </Pressable>
          </Pressable>
        )}
      </Pressable>
    </Modal>
  );
}

/** A list of the family's matches for one meal, to put on a day. */
function MatchPicker(props: {
  spot: Spot | null;
  matches: Recipe[];
  plannedIds: Set<string>;
  onPick: (recipeId: string) => void;
  onClose: () => void;
}) {
  const { spot, matches } = props;
  const insets = useSafeAreaInsets();
  // Matches not on the plan yet come first.
  const sorted = [...matches].sort((a, b) => Number(props.plannedIds.has(a.id)) - Number(props.plannedIds.has(b.id)));
  return (
    <Modal visible={!!spot} animationType="slide" presentationStyle="pageSheet" onRequestClose={props.onClose}>
      {spot && (
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={styles.pickerHead}>
            <Text style={styles.sheetTitle}>
              {SLOT_NAMES[spot.slot]} on {DAY_NAMES[spot.day]}
            </Text>
            <Pressable onPress={props.onClose} hitSlop={12}>
              <Text style={styles.done}>Done</Text>
            </Pressable>
          </View>
          <FlatList
            data={sorted}
            keyExtractor={(r) => r.id}
            contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 24 }}
            ListEmptyComponent={
              <Text style={styles.emptyMeal}>
                No {SLOT_NAMES[spot.slot].toLowerCase()} matches yet. Keep swiping, and the ones the family agrees on show up
                here.
              </Text>
            }
            renderItem={({ item: r }) => (
              <Pressable style={styles.pickRow} onPress={() => props.onPick(r.id)}>
                <Image source={r.image} style={styles.thumb} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.mealName} numberOfLines={2}>
                    {r.name}
                  </Text>
                  {props.plannedIds.has(r.id) && <Text style={styles.slotName}>Already planned this week</Text>}
                </View>
              </Pressable>
            )}
          />
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 10 },
  h1: { fontSize: 28, fontWeight: '800', color: colors.text },
  label: { fontSize: 13, fontWeight: '700', color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.basilSoft, borderColor: colors.basil },
  chipText: { fontSize: 14, fontWeight: '700', color: colors.muted },
  chipTextOn: { color: colors.basil },
  fill: { backgroundColor: colors.basil, borderRadius: 999, paddingVertical: 12, alignItems: 'center', marginVertical: 6 },
  fillText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  day: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 12, gap: 10 },
  dayName: { fontSize: 13, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: colors.basil },
  meal: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: radius.sm },
  thumbEmpty: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  slotName: { fontSize: 12, fontWeight: '700', color: colors.muted },
  mealName: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptyMeal: { fontSize: 15, color: colors.muted },
  chevron: { fontSize: 26, color: colors.muted, paddingHorizontal: 4 },
  clear: { alignItems: 'center', paddingVertical: 14 },
  clearText: { color: colors.muted, fontWeight: '700', fontSize: 15 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: 20, gap: 10 },
  sheetSmall: { fontSize: 13, fontWeight: '700', color: colors.muted, marginTop: 4 },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: colors.text, flexShrink: 1 },
  action: { backgroundColor: colors.bg, borderRadius: radius.sm, padding: 14 },
  actionText: { fontSize: 16, fontWeight: '700', color: colors.text },
  dayChip: { alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6, minWidth: 48 },
  dayChipText: { fontSize: 15, fontWeight: '800', color: colors.text },
  dayChipSub: { fontSize: 11, color: colors.muted },
  pickerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  done: { fontSize: 17, fontWeight: '700', color: colors.basil },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.md, padding: 10, borderWidth: 1, borderColor: colors.line },
});
