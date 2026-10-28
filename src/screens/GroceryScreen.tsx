import { useState } from 'react';
import { Pressable, SectionList, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { amountText, buildGroceryList, groceryListText, groupByAisle } from '../logic/grocery';
import { plannedIds } from '../logic/plan';
import { newId, useStore } from '../state/store';
import { colors, radius } from '../theme';
import { Recipe } from '../types';

export function GroceryScreen() {
  const { state, dispatch } = useStore();
  const [draft, setDraft] = useState('');
  const planned = plannedIds(state.plan, state.planSlots)
    .map((id) => state.recipes[id])
    .filter((r): r is Recipe => !!r);
  const items = buildGroceryList(planned, state.extraGroceries);
  const checked = new Set(state.checkedGroceries);
  const left = items.filter((i) => !checked.has(i.key)).length;
  // Checked items sink to the bottom of their aisle, so what's left to grab stays on top.
  const sections = groupByAisle(items).map(({ aisle, items: inAisle }) => ({
    title: aisle,
    data: [...inAisle].sort((a, b) => Number(checked.has(a.key)) - Number(checked.has(b.key))),
  }));

  const addItem = () => {
    const name = draft.trim();
    if (!name) return;
    dispatch({ type: 'addExtraGrocery', item: { id: newId(), name } });
    setDraft('');
  };

  const share = () => Share.share({ message: `Shopping list 🛒\n\n${groceryListText(items, checked)}` }).catch(() => {});

  return (
    <SectionList
      sections={sections}
      keyExtractor={(i) => i.key}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 4 }}>
          <View style={{ gap: 4 }}>
            <Text style={styles.h1}>Shopping list</Text>
            <Text style={styles.sub}>
              {items.length === 0
                ? 'Plan some meals and their ingredients show up here, sorted by aisle.'
                : `${left} of ${items.length} items left, for ${planned.length} planned ${planned.length === 1 ? 'meal' : 'meals'}`}
            </Text>
          </View>
          <View style={styles.addRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={addItem}
              placeholder="Add something else (milk, paper towels…)"
              placeholderTextColor={colors.muted}
              returnKeyType="done"
              style={styles.input}
            />
            <Pressable onPress={addItem} style={[styles.addBtn, !draft.trim() && { opacity: 0.5 }]} disabled={!draft.trim()}>
              <Text style={styles.addBtnText}>Add</Text>
            </Pressable>
          </View>
          {left > 0 && (
            <Pressable onPress={share} style={styles.share}>
              <Text style={styles.shareText}>Send the list in a text or email</Text>
            </Pressable>
          )}
        </View>
      }
      renderSectionHeader={({ section }) => <Text style={styles.aisle}>{section.title}</Text>}
      renderItem={({ item }) => {
        const done = checked.has(item.key);
        const amount = amountText(item);
        const forWhat = item.recipes.length ? `for ${item.recipes.join(', ')}` : 'added by hand';
        return (
          <Pressable
            style={styles.row}
            onPress={() => dispatch({ type: 'toggleGrocery', key: item.key })}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done }}
          >
            <View style={[styles.box, done && styles.boxDone]}>{done && <Text style={styles.tick}>✓</Text>}</View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, done && styles.nameDone]}>
                {item.name}
                {amount ? <Text style={styles.amount}>  {amount}</Text> : null}
              </Text>
              <Text style={styles.forWhat} numberOfLines={2}>
                {forWhat}
              </Text>
            </View>
            {item.extraId && (
              <Pressable
                hitSlop={10}
                onPress={() => dispatch({ type: 'removeExtraGrocery', id: item.extraId! })}
                accessibilityLabel={`Remove ${item.name} from the list`}
              >
                <Text style={styles.remove}>✕</Text>
              </Pressable>
            )}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 6 },
  h1: { fontSize: 28, fontWeight: '800', color: colors.text },
  sub: { fontSize: 15, color: colors.muted },
  addRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colors.text },
  addBtn: { backgroundColor: colors.basil, borderRadius: radius.sm, paddingHorizontal: 16, justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  share: { borderWidth: 1, borderColor: colors.basil, borderRadius: 999, paddingVertical: 10, alignItems: 'center' },
  shareText: { color: colors.basil, fontWeight: '800', fontSize: 15 },
  aisle: { fontSize: 13, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: colors.basil, marginTop: 14, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.sm, padding: 12 },
  box: { width: 26, height: 26, borderRadius: 7, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  boxDone: { backgroundColor: colors.basil, borderColor: colors.basil },
  tick: { color: '#fff', fontWeight: '900' },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  nameDone: { textDecorationLine: 'line-through', color: colors.muted },
  amount: { fontSize: 15, fontWeight: '600', color: colors.basil },
  forWhat: { fontSize: 13, color: colors.muted },
  remove: { fontSize: 16, color: colors.muted, paddingHorizontal: 4 },
});
