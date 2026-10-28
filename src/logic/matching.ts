import { AppState, MatchRule, Member, Recipe } from '../types';

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
  if (likers.size === 0) return false;

  switch (matchRule) {
    case 'everyone':
      return members.every((m) => likers.has(m.id));
    case 'majority':
      // A family of one or two still needs everyone.
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

/** Recipes this member hasn't voted on yet. */
export function deckFor(state: AppState, memberId: string): Recipe[] {
  const mine = state.votes[memberId] ?? {};
  return state.deckOrder
    .map((id) => state.recipes[id])
    .filter((r): r is Recipe => !!r && !mine[r.id] && !isBlocked(state.members, r));
}
