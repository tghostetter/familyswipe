import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { buildGroceryList } from '../logic/grocery';
import { useStore } from '../state/store';
import { colors, radius } from '../theme';
import { Recipe } from '../types';

export function GroceryScreen() {
  const { state, dispatch } = useStore();
  const planned = Object.values(state.plan)
    .filter((id): id is string => !!id)
    .map((id) => state.recipes[id])
    .filter((r): r is Recipe => !!r);
  const items = buildGroceryList(planned);
  const checked = new Set(state.checkedGroceries);
  const left = items.filter((i) => !checked.has(i.key)).length;

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.key}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={{ gap: 4, marginBottom: 8 }}>
          <Text style={styles.h1}>Grocery list</Text>
          <Text style={styles.sub}>
            {items.length === 0
              ? 'Plan some dinners and the ingredients show up here.'
              : `${left} of ${items.length} items left for ${planned.length} dinners`}
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const done = checked.has(item.key);
        return (
          <Pressable style={styles.row} onPress={() => dispatch({ type: 'toggleGrocery', key: item.key })}>
            <View style={[styles.box, done && styles.boxDone]}>{done && <Text style={styles.tick}>✓</Text>}</View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, done && styles.nameDone]}>{item.name}</Text>
              <Text style={styles.amounts}>{item.amounts.join(' · ')}</Text>
            </View>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.sm, padding: 12 },
  box: { width: 26, height: 26, borderRadius: 7, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  boxDone: { backgroundColor: colors.basil, borderColor: colors.basil },
  tick: { color: '#fff', fontWeight: '900' },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  nameDone: { textDecorationLine: 'line-through', color: colors.muted },
  amounts: { fontSize: 13, color: colors.muted },
});
