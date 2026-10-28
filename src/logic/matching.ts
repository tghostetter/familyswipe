import { AppState, MatchRule, Member, Recipe } from '../types';
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

export function matchedRecipeIds(state: AppState): string[] {
  return state.deckOrder.filter(
    (id) => state.recipes[id] && !isBlocked(state.members, state.recipes[id]) && isMatch(state, id),
  );
}

/** Recipes this member hasn't voted on yet, the ones the family loves most first. */
export function deckFor(state: AppState, memberId: string): Recipe[] {
  const mine = state.votes[memberId] ?? {};
  return state.deckOrder
    .map((id) => state.recipes[id])
    .filter((r): r is Recipe => !!r && !mine[r.id] && !isBlocked(state.members, r))
    .map((r) => ({ r, score: familyScore(state.members, r) }))
    // Recipes someone pasted a link for stay on top, then the family's favorites.
    .sort((a, b) => Number(!!b.r.sourceUrl) - Number(!!a.r.sourceUrl) || b.score - a.score)
    .map(({ r }) => r);
}
