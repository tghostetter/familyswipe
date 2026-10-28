import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MEAL_TYPES } from '../logic/matching';
import { colors } from '../theme';
import { MealSlot } from '../types';

type Props = { value: MealSlot; onChange: (mealType: MealSlot) => void };

/** A row of Breakfast / School lunch / Dinner buttons. */
export function MealTypePicker({ value, onChange }: Props) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {MEAL_TYPES.map((t) => {
        const selected = t.value === value;
        return (
          <Pressable
            key={t.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(t.value)}
            style={[styles.chip, selected && styles.chipOn]}
          >
            <Text style={[styles.label, selected && styles.labelOn]} numberOfLines={1}>
              {t.emoji} {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, backgroundColor: colors.surface, borderRadius: 999, padding: 4, borderWidth: 1, borderColor: colors.line },
  chip: { flex: 1, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, borderRadius: 999 },
  chipOn: { backgroundColor: colors.basil },
  label: { fontSize: 13, fontWeight: '800', color: colors.muted },
  labelOn: { color: '#fff' },
});
