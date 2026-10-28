import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { siteName } from '../api/importRecipe';
import { photoFit } from '../logic/matching';
import { colors, radius } from '../theme';
import { Recipe, Vote } from '../types';

const SCREEN_W = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_W * 0.28;
// A quick flick counts as a swipe even if the card hasn't moved far yet.
const FLICK_VELOCITY = 800;
const FLY_DISTANCE = SCREEN_W * 1.5;

type Props = {
  recipes: Recipe[];
  kidMode: boolean;
  onVote: (recipe: Recipe, vote: Vote) => void;
  onOpen: (recipe: Recipe) => void;
};

export function SwipeDeck({ recipes, kidMode, onVote, onOpen }: Props) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  // True while a card is flying away, so a second swipe or tap can't double-vote.
  const busy = useSharedValue(false);
  const top = recipes[0];
  const next = recipes[1];

  // Animation callbacks run on the UI thread, so read the latest values through a ref.
  const latest = useRef({ top, onVote });
  latest.current = { top, onVote };

  useEffect(() => {
    x.value = 0;
    y.value = 0;
    busy.value = false;
  }, [top?.id, x, y, busy]);

  const commitVote = (vote: Vote) => {
    const recipe = latest.current.top;
    if (recipe) latest.current.onVote(recipe, vote);
  };
  const tick = () => {
    Haptics.selectionAsync().catch(() => {});
  };
  const thump = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const flyOut = (vote: Vote, fromY = 40) => {
    'worklet';
    busy.value = true;
    scheduleOnRN(thump);
    y.value = withTiming(fromY, { duration: 240 });
    x.value = withTiming((vote === 'yum' ? 1 : -1) * FLY_DISTANCE, { duration: 240 }, (finished) => {
      if (finished) scheduleOnRN(commitVote, vote);
    });
  };

  const pan = usePanGesture({
    // Only grab sideways drags, so tapping the card still opens the recipe.
    activeOffsetX: [-10, 10],
    onUpdate: (e) => {
      if (busy.value) return;
      const wasPast = Math.abs(x.value) > SWIPE_THRESHOLD;
      x.value = e.translationX;
      y.value = e.translationY;
      // A little buzz the moment the card crosses the "let go to vote" line.
      if (wasPast !== Math.abs(x.value) > SWIPE_THRESHOLD) scheduleOnRN(tick);
    },
    onDeactivate: (e) => {
      if (busy.value) return;
      const goRight = e.translationX > SWIPE_THRESHOLD || (e.velocityX > FLICK_VELOCITY && e.translationX > 0);
      const goLeft = e.translationX < -SWIPE_THRESHOLD || (e.velocityX < -FLICK_VELOCITY && e.translationX < 0);
      if (goRight) flyOut('yum', e.translationY + 40);
      else if (goLeft) flyOut('nope', e.translationY + 40);
      else {
        x.value = withSpring(0);
        y.value = withSpring(0);
      }
    },
  });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${interpolate(x.value, [-SCREEN_W, 0, SCREEN_W], [-14, 0, 14])}deg` },
    ],
  }));
  const yumStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));
  const nopeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));
  // The next card grows into place as the top one is dragged away.
  const behindStyle = useAnimatedStyle(() => {
    const t = interpolate(Math.abs(x.value), [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: 0.8 + 0.2 * t,
      transform: [{ scale: 0.95 + 0.05 * t }, { translateY: 14 * (1 - t) }],
    };
  });

  const press = (vote: Vote) => {
    if (busy.value) return;
    flyOut(vote);
  };

  if (!top) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.stack}>
        {next && (
          <Animated.View style={[styles.card, behindStyle]}>
            <Image source={next.image} style={styles.photo} contentFit={photoFit(next)} />
          </Animated.View>
        )}
        <GestureDetector gesture={pan}>
            <Animated.View style={[styles.card, cardStyle]}>
            <Pressable style={{ flex: 1 }} onPress={() => onOpen(top)}>
              <Image source={top.image} style={styles.photo} contentFit={photoFit(top)} transition={150} />
              <View style={styles.caption}>
                <Text style={[styles.name, kidMode && styles.nameKid]} numberOfLines={2}>
                  {top.name}
                </Text>
                {!kidMode && (
                  <Text style={styles.meta}>
                    {[top.sourceUrl ? `🔗 ${siteName(top.sourceUrl)}` : '', top.cuisine, top.category, `${top.ingredients.length} ingredients`].filter(Boolean).join(' · ')}
                    {'  ·  Tap for recipe'}
                  </Text>
                )}
              </View>
            </Pressable>
            <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampYum, yumStyle]}>
              <Text style={[styles.stampText, { color: colors.basil }]}>YUM</Text>
            </Animated.View>
            <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampNope, nopeStyle]}>
            <Text style={[styles.stampText, { color: colors.nope }]}>NOPE</Text>
          </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>

      <View style={styles.buttons}>
        <Pressable
          accessibilityLabel="Nope"
          onPress={() => press('nope')}
          style={({ pressed }) => [styles.btn, kidMode && styles.btnKid, styles.btnNope, pressed && styles.pressed]}
        >
          <Text style={[styles.btnIcon, kidMode && styles.btnIconKid]}>{kidMode ? '😝' : '✕'}</Text>
          {kidMode && <Text style={styles.btnLabel}>Yuck</Text>}
        </Pressable>
        <Pressable
          accessibilityLabel="Yum"
          onPress={() => press('yum')}
          style={({ pressed }) => [styles.btn, kidMode && styles.btnKid, styles.btnYum, pressed && styles.pressed]}
        >
          <Text style={[styles.btnIcon, kidMode && styles.btnIconKid, { color: '#fff' }]}>{kidMode ? '😋' : '♥'}</Text>
          {kidMode && <Text style={[styles.btnLabel, { color: '#fff' }]}>Yum!</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: 18 },
  stack: { flex: 1 },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  photo: { flex: 1, backgroundColor: colors.basilSoft },
  caption: { padding: 18, gap: 4 },
  name: { fontSize: 24, fontWeight: '800', color: colors.text },
  nameKid: { fontSize: 30, textAlign: 'center' },
  meta: { fontSize: 14, color: colors.muted },
  stamp: { position: 'absolute', top: 28, borderWidth: 4, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.85)' },
  stampYum: { left: 24, borderColor: colors.basil, transform: [{ rotate: '-14deg' }] },
  stampNope: { right: 24, borderColor: colors.nope, transform: [{ rotate: '14deg' }] },
  stampText: { fontSize: 34, fontWeight: '900', letterSpacing: 2 },
  buttons: { flexDirection: 'row', justifyContent: 'center', gap: 40, paddingBottom: 6 },
  btn: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  btnKid: { width: 120, height: 96, borderRadius: 28 },
  btnNope: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.line },
  btnYum: { backgroundColor: colors.match },
  btnIcon: { fontSize: 30, color: colors.nope, fontWeight: '700' },
  btnIconKid: { fontSize: 40 },
  btnLabel: { fontSize: 16, fontWeight: '800', color: colors.muted },
  pressed: { transform: [{ scale: 0.94 }] },
});
