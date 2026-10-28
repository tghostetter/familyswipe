import { StyleSheet, Text, View } from 'react-native';
import { GRADE_INFO, Grade, NutritionEstimate } from '../logic/nutrition';
import { colors, radius } from '../theme';

/** The colored A-E letter, like the label on a food package. */
export function GradeBadge({ grade, size = 26 }: { grade: Grade; size?: number }) {
  const info = GRADE_INFO[grade];
  return (
    <View
      accessibilityLabel={`Health grade ${grade}, ${info.label}`}
      style={[styles.badge, { backgroundColor: info.color, width: size, height: size, borderRadius: size * 0.3 }]}
    >
      <Text style={[styles.badgeText, { color: info.text, fontSize: size * 0.6 }]}>{grade}</Text>
    </View>
  );
}

/** One line for the swipe card: grade, calories and protein. */
export function NutritionLine({ n }: { n: NutritionEstimate }) {
  return (
    <View style={styles.line}>
      <GradeBadge grade={n.grade} size={22} />
      <Text style={styles.lineText}>
        {n.perServing.calories} cal · {n.perServing.protein} g protein
      </Text>
    </View>
  );
}

/** The nutrition section of the recipe page. */
export function NutritionPanel({ n }: { n: NutritionEstimate }) {
  const info = GRADE_INFO[n.grade];
  const tiles: [string, string][] = [
    ['Calories', `${n.perServing.calories}`],
    ['Protein', `${n.perServing.protein} g`],
    ['Carbs', `${n.perServing.carbs} g`],
    ['Fat', `${n.perServing.fat} g`],
  ];
  return (
    <View style={styles.panel}>
      <View style={styles.gradeRow}>
        <GradeBadge grade={n.grade} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={styles.gradeLabel}>{info.label}</Text>
          <Text style={styles.small}>Health grade from A (best) to E. Based on the Nutri-Score from food labels, a step lower for processed meat, lots of added sugar or a very big portion.</Text>
        </View>
      </View>

      <View style={styles.tiles}>
        {tiles.map(([label, value]) => (
          <View key={label} style={styles.tile}>
            <Text style={styles.tileValue}>{value}</Text>
            <Text style={styles.tileLabel}>{label}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.small}>
        Per serving · makes about {n.servings} · {n.perServing.fiber} g fiber · {n.perServing.sugar} g sugar ·{' '}
        {n.perServing.sodium} mg sodium
      </Text>

      {n.highlights.map((h, i) => (
        <Text key={i} style={styles.highlight}>
          {h.good ? '✅' : '⚠️'} {h.text}
        </Text>
      ))}

      <Text style={styles.note}>
        {n.fromSite
          ? 'Numbers from the recipe’s website. The grade is our estimate from the ingredients.'
          : `Estimated from ${n.matched} of ${n.total} ingredients. Real numbers depend on brands and portion sizes.`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontWeight: '900' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineText: { fontSize: 14, fontWeight: '700', color: colors.text },
  panel: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 16, gap: 10, marginTop: 6 },
  gradeRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  gradeLabel: { fontSize: 20, fontWeight: '800', color: colors.text },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, backgroundColor: colors.basilSoft, borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center' },
  tileValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  tileLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
  small: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  highlight: { fontSize: 15, color: colors.text, lineHeight: 21 },
  note: { fontSize: 12, color: colors.muted, fontStyle: 'italic' },
});
