import { AppState, MatchRule, MealSlot, Member, Recipe } from '../types';
import { familyScore, hasSkippedMeat } from './preferences';

/** Fewest people who must say yum before anything counts as a match. */
export const MIN_LIKERS = 2;

export const MATCH_RULES: { value: MatchRule; label: string; help: string }[] = [
  { value: 'everyone', label: 'Everyone', help: 'A match needs a "yum" from every family member.' },
  { value: 'majority', label: 'Majority', help: 'A match needs a "yum" from more than half the family.' },
  {
    value: 'parentsPlusKid',
    label: 'Parents + a kid',
    help: 'A match needs every grown-up plus at least one kid.',
  },
];

/** How each meal shows up in the app, in the order they appear on screen. */
export const MEAL_TYPES: { value: MealSlot; label: string; emoji: string; plural: string }[] = [
  { value: 'breakfast', label: 'Breakfast', emoji: '🍳', plural: 'breakfasts' },
  { value: 'lunch', label: 'School lunch', emoji: '🎒', plural: 'lunchbox ideas' },
  { value: 'dinner', label: 'Dinner', emoji: '🍝', plural: 'dinners' },
];

export const mealTypeInfo = (mealType: MealSlot) => MEAL_TYPES.find((t) => t.value === mealType)!;

/** Recipes saved before breakfasts and lunches existed are dinners. */
export const mealTypeOf = (recipe: Recipe): MealSlot => recipe.mealType ?? 'dinner';

/** Lunchbox photos are cut-out pictures of the food, so show them whole instead of cropping. */
export const photoFit = (recipe: Recipe) => (recipe.mealType === 'lunch' ? 'contain' : 'cover');

export function likersOf(state: Pick<AppState, 'members' | 'votes'>, recipeId: string): Member[] {
  return state.members.filter((m) => state.votes[m.id]?.[recipeId] === 'yum');
}

export function isMatch(
  state: Pick<AppState, 'members' | 'votes' | 'matchRule'>,
  recipeId: string,
): boolean {
  const { members, matchRule } = state;
  if (members.length === 0) return false;
  const likers = new Set(likersOf(state, recipeId).map((m) => m.id));
  // A match always takes at least two people saying yum, whatever the rule.
  if (likers.size < MIN_LIKERS) return false;

  switch (matchRule) {
    case 'everyone':
      return members.every((m) => likers.has(m.id));
    case 'majority':
      // A family of two still needs both.
      return members.length <= 2
        ? members.every((m) => likers.has(m.id))
        : likers.size > members.length / 2;
    case 'parentsPlusKid': {
      const parents = members.filter((m) => !m.isKid);
      const kids = members.filter((m) => m.isKid);
      const parentsOk = parents.every((m) => likers.has(m.id));
      const kidOk = kids.length === 0 || kids.some((m) => likers.has(m.id));
      return parentsOk && kidOk;
    }
  }
}

/** True when the recipe uses something any family member never eats. */
export function isBlocked(members: Member[], recipe: Recipe): boolean {
  if (members.some((m) => hasSkippedMeat(m.prefs, recipe))) return true;
  const noFoods = members.flatMap((m) => m.noFoods.map((f) => f.trim().toLowerCase())).filter(Boolean);
  if (noFoods.length === 0) return false;
  const haystack = [recipe.name, ...recipe.ingredients.map((i) => i.name)].join(' ').toLowerCase();
  return noFoods.some((food) => haystack.includes(food));
}

/** Matched recipes, optionally only those for one meal. */
export function matchedRecipeIds(state: AppState, mealType?: MealSlot): string[] {
  return state.deckOrder.filter((id) => {
    const r = state.recipes[id];
    return r && (!mealType || mealTypeOf(r) === mealType) && !isBlocked(state.members, r) && isMatch(state, id);
  });
}

/** True once this meal's recipes have been loaded into the deck. */
export const hasDeck = (state: AppState, mealType: MealSlot) =>
  state.deckOrder.some((id) => state.recipes[id] && mealTypeOf(state.recipes[id]) === mealType);

/** Recipes for this meal that this member hasn't voted on yet, the ones the family loves most first. */
export function deckFor(state: AppState, memberId: string, mealType: MealSlot): Recipe[] {
  const mine = state.votes[memberId] ?? {};
  return state.deckOrder
    .map((id) => state.recipes[id])
    .filter((r): r is Recipe => !!r && mealTypeOf(r) === mealType && !mine[r.id] && !isBlocked(state.members, r))
    .map((r) => ({ r, score: familyScore(state.members, r) }))
    // Recipes someone pasted a link for stay on top, then the family's favorites.
    .sort((a, b) => Number(!!b.r.sourceUrl) - Number(!!a.r.sourceUrl) || b.score - a.score)
    .map(({ r }) => r);
}
