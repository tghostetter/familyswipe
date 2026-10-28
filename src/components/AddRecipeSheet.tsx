import { Image } from 'expo-image';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ImportError, importRecipeFromUrl, siteName } from '../api/importRecipe';
import { useStore } from '../state/store';
import { colors, radius } from '../theme';
import { Recipe } from '../types';

type Props = { visible: boolean; onClose: () => void; onAdded: (recipe: Recipe) => void };

/** Paste a link to any recipe page and add it to the family's deck. */
export function AddRecipeSheet({ visible, onClose, onAdded }: Props) {
  const { state, dispatch, household } = useStore();
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<Recipe | null>(null);

  const reset = () => {
    setLink('');
    setLoading(false);
    setError(null);
    setFound(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const lookUp = async () => {
    if (!link.trim() || loading) return;
    setLoading(true);
    setError(null);
    setFound(null);
    try {
      setFound(await importRecipeFromUrl(link));
    } catch (e) {
      setError(e instanceof ImportError ? e.message : 'Something went wrong reading that page. Try a different link.');
    } finally {
      setLoading(false);
    }
  };

  const add = () => {
    if (!found) return;
    dispatch({ type: 'importRecipe', recipe: found });
    onAdded(found);
    close();
  };

  const alreadyIn = !!found && !!state.recipes[found.id];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.top}>
          <Text style={styles.title}>Add a recipe from a link</Text>
          <Pressable onPress={close} accessibilityLabel="Close" hitSlop={10}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.sub}>
            Found a dinner you like on a website? Copy its link, paste it here, and it goes to the top of{' '}
            {household ? "everyone's" : 'the'} swipe deck.
          </Text>
          <TextInput
            value={link}
            onChangeText={(t) => {
              setLink(t);
              setError(null);
            }}
            placeholder="https://www.example.com/best-lasagna"
            placeholderTextColor={colors.nope}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={lookUp}
            style={styles.input}
            accessibilityLabel="Recipe link"
          />
          {!found && (
            <Pressable
              style={[styles.primary, (!link.trim() || loading) && { opacity: 0.5 }]}
              onPress={lookUp}
              disabled={!link.trim() || loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Get recipe</Text>}
            </Pressable>
          )}
          {error && <Text style={styles.error}>{error}</Text>}

          {found && (
            <View style={styles.preview}>
              {found.image ? (
                <Image source={found.image} style={styles.photo} contentFit="cover" />
              ) : (
                <View style={[styles.photo, styles.noPhoto]}>
                  <Text style={{ fontSize: 48 }}>🍽️</Text>
                </View>
              )}
              <View style={styles.previewBody}>
                <Text style={styles.name}>{found.name}</Text>
                <Text style={styles.meta}>
                  {[found.sourceUrl && siteName(found.sourceUrl), `${found.ingredients.length} ingredients`]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                {alreadyIn && <Text style={styles.meta}>This one is already in your deck.</Text>}
              </View>
              <Pressable style={[styles.primary, styles.inset, alreadyIn && { opacity: 0.5 }]} onPress={add} disabled={alreadyIn}>
                <Text style={styles.primaryText}>Add to our deck</Text>
              </Pressable>
              <Pressable style={styles.secondary} onPress={reset}>
                <Text style={styles.secondaryText}>Try a different link</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, flexShrink: 1 },
  cancel: { fontSize: 16, fontWeight: '800', color: colors.basil },
  body: { padding: 20, paddingTop: 8, gap: 14 },
  sub: { fontSize: 16, color: colors.muted },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  primary: { backgroundColor: colors.basil, paddingVertical: 14, borderRadius: 999, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  secondary: { paddingVertical: 6, alignItems: 'center' },
  secondaryText: { color: colors.basil, fontWeight: '800', fontSize: 16 },
  error: { backgroundColor: colors.matchSoft, color: colors.text, padding: 14, borderRadius: radius.sm, overflow: 'hidden' },
  preview: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', paddingBottom: 14, gap: 10 },
  photo: { width: '100%', aspectRatio: 1.4, backgroundColor: colors.basilSoft },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  inset: { marginHorizontal: 16 },
  previewBody: { paddingHorizontal: 16, gap: 4 },
  name: { fontSize: 22, fontWeight: '800', color: colors.text },
  meta: { fontSize: 14, color: colors.muted },
});
