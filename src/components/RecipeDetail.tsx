import { Image } from 'expo-image';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { siteName } from '../api/importRecipe';
import { estimateNutrition } from '../logic/nutrition';
import { colors, radius } from '../theme';
import { Recipe } from '../types';
import { NutritionPanel } from './Nutrition';

type Props = { recipe: Recipe | null; onClose: () => void };

export function RecipeDetail({ recipe, onClose }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!recipe} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {recipe && (
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
            <Image source={recipe.image} style={styles.photo} contentFit="cover" />
            <View style={styles.body}>
              <Text style={styles.name}>{recipe.name}</Text>
              <Text style={styles.meta}>{[recipe.cuisine, recipe.category].filter(Boolean).join(' · ')}</Text>
              {recipe.sourceUrl && (
                <Pressable onPress={() => Linking.openURL(recipe.sourceUrl!).catch(() => {})} accessibilityRole="link">
                  <Text style={styles.source}>🔗 From {siteName(recipe.sourceUrl)} · Open the full recipe</Text>
                </Pressable>
              )}

              <Text style={styles.h}>Nutrition</Text>
              <NutritionPanel n={estimateNutrition(recipe)} />

              <Text style={styles.h}>Ingredients</Text>
              {recipe.ingredients.map((ing, i) => (
                <View key={i} style={styles.ingRow}>
                  <Text style={styles.ingName}>{ing.name}</Text>
                  <Text style={styles.ingMeasure}>{ing.measure}</Text>
                </View>
              ))}

              <Text style={styles.h}>Steps</Text>
              {recipe.instructions
                .split(/\r?\n+/)
                .map((s) => s.trim())
                .filter(Boolean)
                .map((step, i) => (
                  <Text key={i} style={styles.step}>
                    {step}
                  </Text>
                ))}
            </View>
          </ScrollView>
          <Pressable style={[styles.close, { top: 16 }]} onPress={onClose} accessibilityLabel="Close recipe">
            <Text style={styles.closeText}>Done</Text>
          </Pressable>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 1.25, backgroundColor: colors.basilSoft },
  body: { padding: 20, gap: 8 },
  name: { fontSize: 28, fontWeight: '800', color: colors.text },
  meta: { fontSize: 15, color: colors.muted },
  source: { fontSize: 15, fontWeight: '700', color: colors.basil },
  h: { fontSize: 13, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: colors.basil, marginTop: 18 },
  ingRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  ingName: { fontSize: 16, color: colors.text, flexShrink: 1 },
  ingMeasure: { fontSize: 16, color: colors.muted },
  step: { fontSize: 16, lineHeight: 24, color: colors.text },
  close: { position: 'absolute', right: 16, backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.sm },
  closeText: { fontWeight: '800', color: colors.basil, fontSize: 16 },
});
