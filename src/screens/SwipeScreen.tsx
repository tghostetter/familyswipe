import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchDinnerDeck } from '../api/recipes';
import { MatchModal } from '../components/MatchModal';
import { RecipeDetail } from '../components/RecipeDetail';
import { SwipeDeck } from '../components/SwipeDeck';
import { deckFor, isMatch, likersOf } from '../logic/matching';
import { useStore } from '../state/store';
import { colors, radius } from '../theme';
import { Recipe, Vote } from '../types';

export function SwipeScreen() {
  const { state, dispatch } = useStore();
  const [swiperId, setSwiperId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matched, setMatched] = useState<Recipe | null>(null);
  const [open, setOpen] = useState<Recipe | null>(null);

  const swiper = state.members.find((m) => m.id === swiperId) ?? null;
  const deck = useMemo(() => (swiper ? deckFor(state, swiper.id) : []), [state, swiper]);

  const loadMore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      dispatch({ type: 'addRecipes', recipes: await fetchDinnerDeck() });
    } catch {
      setError("Couldn't load recipes. Check your internet connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    if (state.deckOrder.length === 0 && !loading && !error) loadMore();
  }, [state.deckOrder.length, loading, error, loadMore]);

  const handleVote = (recipe: Recipe, vote: Vote) => {
    if (!swiper) return;
    const wasMatch = isMatch(state, recipe.id);
    const nextVotes = { ...state.votes, [swiper.id]: { ...state.votes[swiper.id], [recipe.id]: vote } };
    dispatch({ type: 'vote', memberId: swiper.id, recipeId: recipe.id, vote });
    if (!wasMatch && isMatch({ ...state, votes: nextVotes }, recipe.id)) setMatched(recipe);
  };

  if (!swiper) {
    return (
      <ScrollView contentContainerStyle={styles.pickWrap}>
        <Text style={styles.h1}>Who's swiping?</Text>
        <Text style={styles.sub}>Pass the phone around. Each person swipes on their own.</Text>
        <View style={styles.grid}>
          {state.members.map((m) => {
            const left = deckFor(state, m.id).length;
            return (
              <Pressable
                key={m.id}
                onPress={() => setSwiperId(m.id)}
                style={({ pressed }) => [styles.person, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.personAvatar}>{m.avatar}</Text>
                <Text style={styles.personName}>{m.name}</Text>
                <Text style={styles.personLeft}>{left === 0 ? 'All done ✓' : `${left} to swipe`}</Text>
              </Pressable>
            );
          })}
        </View>
        {loading && <ActivityIndicator color={colors.basil} />}
        {error && <ErrorBox message={error} onRetry={loadMore} />}
      </ScrollView>
    );
  }

  return (
    <View style={styles.swipeWrap}>
      <View style={styles.header}>
        <Text style={styles.headerName}>
          {swiper.avatar} {swiper.name}
          {swiper.isKid ? '  ·  Kid mode' : ''}
        </Text>
        <Pressable onPress={() => setSwiperId(null)} style={styles.passBtn}>
          <Text style={styles.passText}>Pass the phone</Text>
        </Pressable>
      </View>

      {deck.length > 0 ? (
        <SwipeDeck recipes={deck} kidMode={swiper.isKid} onVote={handleVote} onOpen={setOpen} />
      ) : (
        <View style={styles.done}>
          <Text style={styles.doneEmoji}>🎉</Text>
          <Text style={styles.h1}>You swiped them all, {swiper.name}!</Text>
          <Text style={styles.sub}>Pass the phone to the next person, or load more dinners.</Text>
          {error && <ErrorBox message={error} onRetry={loadMore} />}
          <Pressable style={styles.primary} onPress={() => setSwiperId(null)}>
            <Text style={styles.primaryText}>Pass the phone</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={loadMore} disabled={loading}>
            <Text style={styles.secondaryText}>{loading ? 'Loading…' : 'Load more dinners'}</Text>
          </Pressable>
        </View>
      )}

      <MatchModal recipe={matched} likers={matched ? likersOf(state, matched.id) : []} onClose={() => setMatched(null)} />
      <RecipeDetail recipe={open} onClose={() => setOpen(null)} />
    </View>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.error}>
      <Text style={styles.errorText}>{message}</Text>
      <Pressable onPress={onRetry}>
        <Text style={styles.errorRetry}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pickWrap: { padding: 20, gap: 14 },
  h1: { fontSize: 28, fontWeight: '800', color: colors.text, textAlign: 'center' },
  sub: { fontSize: 16, color: colors.muted, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 8 },
  person: { width: 150, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingVertical: 18, alignItems: 'center', gap: 4 },
  personAvatar: { fontSize: 46 },
  personName: { fontSize: 18, fontWeight: '800', color: colors.text },
  personLeft: { fontSize: 13, color: colors.muted },
  swipeWrap: { flex: 1, padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headerName: { fontSize: 18, fontWeight: '800', color: colors.text, flexShrink: 1 },
  passBtn: { backgroundColor: colors.basilSoft, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  passText: { color: colors.basil, fontWeight: '800' },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 12 },
  doneEmoji: { fontSize: 64 },
  primary: { backgroundColor: colors.basil, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 999, marginTop: 8 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  secondary: { paddingVertical: 10 },
  secondaryText: { color: colors.basil, fontWeight: '800', fontSize: 16 },
  error: { backgroundColor: colors.matchSoft, padding: 14, borderRadius: radius.sm, gap: 6, alignSelf: 'stretch' },
  errorText: { color: colors.text },
  errorRetry: { color: colors.match, fontWeight: '800' },
});
