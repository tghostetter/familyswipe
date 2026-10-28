// Food preferences: what each person loves and what they never eat.
// The recipe service tags every dinner with a kind (Chicken, Pasta...) and a
// cuisine (Italian, Mexican...), so preferences use those same names.
import { FoodPrefs, Member, Recipe } from '../types';

export const emptyPrefs = (): FoodPrefs => ({ cuisines: [], kinds: [], skips: [] });

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** Reads saved preferences, filling in anything missing (people saved before preferences existed have none). */
export function readPrefs(saved: unknown): FoodPrefs {
  const p = (saved ?? {}) as Partial<Record<keyof FoodPrefs, unknown>>;
  return { cuisines: strings(p.cuisines), kinds: strings(p.kinds), skips: strings(p.skips) };
}

export const withPrefs = (m: Member): Member => ({ ...m, prefs: readPrefs(m.prefs) });

export const CUISINES: { value: string; icon: string }[] = [
  { value: 'American', icon: '🍔' },
  { value: 'British', icon: '🥧' },
  { value: 'Chinese', icon: '🥡' },
  { value: 'French', icon: '🥖' },
  { value: 'Greek', icon: '🫒' },
  { value: 'Indian', icon: '🍛' },
  { value: 'Irish', icon: '🍀' },
  { value: 'Italian', icon: '🍝' },
  { value: 'Jamaican', icon: '🌶️' },
  { value: 'Japanese', icon: '🍣' },
  { value: 'Mexican', icon: '🌮' },
  { value: 'Moroccan', icon: '🧆' },
  { value: 'Spanish', icon: '🥘' },
  { value: 'Thai', icon: '🍜' },
  { value: 'Turkish', icon: '🥙' },
  { value: 'Vietnamese', icon: '🍲' },
];

/** Kinds of dinner, matched against the recipe's category. */
export const KINDS: { value: string; icon: string; categories: string[] }[] = [
  { value: 'Chicken', icon: '🍗', categories: ['Chicken'] },
  { value: 'Beef', icon: '🥩', categories: ['Beef'] },
  { value: 'Pork', icon: '🥓', categories: ['Pork'] },
  { value: 'Lamb', icon: '🍖', categories: ['Lamb', 'Goat'] },
  { value: 'Seafood', icon: '🐟', categories: ['Seafood'] },
  { value: 'Pasta', icon: '🍝', categories: ['Pasta'] },
  { value: 'Veggie', icon: '🥦', categories: ['Vegetarian', 'Vegan'] },
];

/**
 * Meats a person can say they never eat. A recipe is skipped if its category
 * matches, or if any ingredient mentions one of the words (so "chicken stock"
 * counts as chicken).
 */
export const MEATS: { value: string; label: string; categories: string[]; words: string[] }[] = [
  { value: 'beef', label: 'Beef', categories: ['Beef'], words: ['beef', 'steak', 'brisket', 'veal', 'oxtail'] },
  {
    value: 'pork',
    label: 'Pork',
    categories: ['Pork'],
    words: ['pork', 'bacon', 'ham', 'sausage', 'chorizo', 'pancetta', 'prosciutto', 'salami', 'lardons', 'gammon', 'pepperoni'],
  },
  { value: 'chicken', label: 'Chicken & turkey', categories: ['Chicken'], words: ['chicken', 'turkey', 'duck'] },
  { value: 'lamb', label: 'Lamb & goat', categories: ['Lamb', 'Goat'], words: ['lamb', 'mutton', 'goat'] },
  {
    value: 'seafood',
    label: 'Fish & seafood',
    categories: ['Seafood'],
    words: [
      'fish', 'salmon', 'tuna', 'cod', 'haddock', 'prawn', 'shrimp', 'crab', 'lobster', 'mussel', 'clam', 'squid',
      'anchovy', 'anchovies', 'sardine', 'mackerel', 'tilapia', 'trout', 'scallop', 'oyster', 'monkfish', 'sea bass',
    ],
  },
];

const ALL_MEATS = MEATS.map((m) => m.value);
export const isVegetarian = (prefs: FoodPrefs) => ALL_MEATS.every((m) => prefs.skips.includes(m));
export const vegetarianSkips = () => [...ALL_MEATS];

// Whole words only, with an optional plural, so "ham" doesn't catch "champagne".
const meatPatterns = new Map(
  MEATS.map((m) => [m.value, new RegExp(`\\b(${m.words.join('|')})(s|es)?\\b`, 'i')]),
);

/** True when the recipe has a meat this person never eats. */
export function hasSkippedMeat(prefs: FoodPrefs, recipe: Recipe): boolean {
  if (prefs.skips.length === 0) return false;
  const text = [recipe.name, ...recipe.ingredients.map((i) => i.name)].join(' ');
  return MEATS.some(
    (m) => prefs.skips.includes(m.value) && (m.categories.includes(recipe.category) || meatPatterns.get(m.value)!.test(text)),
  );
}

/**
 * How well a recipe fits what the family loves. Each person who loves the
 * cuisine or the kind of dinner adds a point, so the dinners most people will
 * like come first.
 */
export function familyScore(members: Member[], recipe: Recipe): number {
  const kinds = KINDS.filter((k) => k.categories.includes(recipe.category)).map((k) => k.value);
  let score = 0;
  for (const m of members) {
    if (m.prefs.cuisines.includes(recipe.cuisine)) score += 1;
    if (m.prefs.kinds.some((k) => kinds.includes(k))) score += 1;
  }
  return score;
}

export const hasAnyLikes = (members: Member[]) => members.some((m) => m.prefs.cuisines.length || m.prefs.kinds.length);

/** A short line like "Loves Italian, Pasta · Never pork" for the family list. */
export function prefsSummary(m: Member): string {
  const loves = [...m.prefs.cuisines, ...m.prefs.kinds];
  const never = isVegetarian(m.prefs)
    ? ['meat or fish']
    : MEATS.filter((x) => m.prefs.skips.includes(x.value)).map((x) => x.label.toLowerCase());
  never.push(...m.noFoods);
  return [loves.length ? `Loves ${loves.join(', ')}` : '', never.length ? `Never ${never.join(', ')}` : '']
    .filter(Boolean)
    .join('  ·  ');
}
