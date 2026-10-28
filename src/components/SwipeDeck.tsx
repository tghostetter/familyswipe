import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';
import { Recipe, Vote } from '../types';

const SCREEN_W = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_W * 0.28;

type Props = {
  recipes: Recipe[];
  kidMode: boolean;
  onVote: (recipe: Recipe, vote: Vote) => void;
  onOpen: (recipe: Recipe) => void;
};

export function SwipeDeck({ recipes, kidMode, onVote, onOpen }: Props) {
  const position = useRef(new Animated.ValueXY()).current;
  const top = recipes[0];
  const next = recipes[1];

  // PanResponder is created once, so read the latest values through refs.
  const latest = useRef({ top, onVote });
  latest.current = { top, onVote };

  useEffect(() => {
    position.setValue({ x: 0, y: 0 });
  }, [top?.id, position]);

  const flyOut = (vote: Vote) => {
    const recipe = latest.current.top;
    if (!recipe) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.timing(position, {
      toValue: { x: (vote === 'yum' ? 1 : -1) * SCREEN_W * 1.5, y: 40 },
      duration: 220,
      useNativeDriver: true,
    }).start(() => latest.current.onVote(recipe, vote));
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8,
      onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_e, g) => {
        if (g.dx > SWIPE_THRESHOLD) flyOut('yum');
        else if (g.dx < -SWIPE_THRESHOLD) flyOut('nope');
        else Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
      },
    }),
  ).current;

  if (!top) return null;

  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_W, 0, SCREEN_W],
    outputRange: ['-14deg', '0deg', '14deg'],
  });
  const yumOpacity = position.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });
  const nopeOpacity = position.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <View style={styles.wrap}>
      <View style={styles.stack}>
        {next && (
          <View style={[styles.card, styles.behind]}>
            <Image source={next.image} style={styles.photo} contentFit="cover" />
          </View>
        )}
        <Animated.View
          {...pan.panHandlers}
          style={[styles.card, { transform: [...position.getTranslateTransform(), { rotate }] }]}
        >
          <Pressable style={{ flex: 1 }} onPress={() => onOpen(top)}>
            <Image source={top.image} style={styles.photo} contentFit="cover" transition={150} />
            <View style={styles.caption}>
              <Text style={[styles.name, kidMode && styles.nameKid]} numberOfLines={2}>
                {top.name}
              </Text>
              {!kidMode && (
                <Text style={styles.meta}>
                  {[top.cuisine, top.category, `${top.ingredients.length} ingredients`].filter(Boolean).join(' · ')}
                  {'  ·  Tap for recipe'}
                </Text>
              )}
            </View>
          </Pressable>
          <Animated.View style={[styles.stamp, styles.stampYum, { opacity: yumOpacity }]}>
            <Text style={[styles.stampText, { color: colors.basil }]}>YUM</Text>
          </Animated.View>
          <Animated.View style={[styles.stamp, styles.stampNope, { opacity: nopeOpacity }]}>
            <Text style={[styles.stampText, { color: colors.nope }]}>NOPE</Text>
          </Animated.View>
        </Animated.View>
      </View>

      <View style={styles.buttons}>
        <Pressable
          accessibilityLabel="Nope"
          onPress={() => flyOut('nope')}
          style={({ pressed }) => [styles.btn, kidMode && styles.btnKid, styles.btnNope, pressed && styles.pressed]}
        >
          <Text style={[styles.btnIcon, kidMode && styles.btnIconKid]}>{kidMode ? '😝' : '✕'}</Text>
          {kidMode && <Text style={styles.btnLabel}>Yuck</Text>}
        </Pressable>
        <Pressable
          accessibilityLabel="Yum"
          onPress={() => flyOut('yum')}
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
  behind: { transform: [{ scale: 0.95 }, { translateY: 14 }], opacity: 0.8 },
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
