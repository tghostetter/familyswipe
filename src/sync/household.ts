import { changedSpots, emptyPlan } from '../logic/plan';
import { Action, initialState } from '../state/store';
import { readPrefs } from '../logic/preferences';
import { AppState, Day, DAYS, ExtraGrocery, MEAL_SLOTS, MatchRule, MealSlot, Member, Recipe, Vote } from '../types';
import { ensureSignedIn, supabase } from './supabase';

export type Household = { id: string; name: string; inviteCode: string };

type HouseholdRow = { id: string; name: string; invite_code: string; match_rule: MatchRule; plan_slots: MealSlot[] | null };
type MemberRow = { id: string; name: string; avatar: string; is_kid: boolean; no_foods: string[]; prefs: unknown };
type VoteRow = { member_id: string; recipe_id: string; vote: Vote };

function db() {
  if (!supabase) throw new Error('Family sync is not set up');
  return supabase;
}

function check<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

const toHousehold = (h: HouseholdRow): Household => ({ id: h.id, name: h.name, inviteCode: h.invite_code });

const memberRow = (householdId: string, m: Member) => ({
  household_id: householdId,
  id: m.id,
  name: m.name,
  avatar: m.avatar,
  is_kid: m.isKid,
  no_foods: m.noFoods,
  prefs: m.prefs,
});

type PlanMealRow = { day: Day; slot: MealSlot; recipe_id: string | null };

const planMealRow = (householdId: string, day: Day, slot: MealSlot, recipeId: string | null) => ({
  household_id: householdId,
  day,
  slot,
  recipe_id: recipeId,
});

/** Shows a code like "XP5 59S" so it is easier to read out loud. */
export const formatCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

export async function createHousehold(name: string, current: AppState): Promise<Household> {
  await ensureSignedIn();
  const household = toHousehold(check(await db().rpc('create_household', { p_name: name }).single<HouseholdRow>()));
  // Whatever this phone already had (family, swipes, plan) becomes the shared family's starting point.
  await uploadAll(household.id, current);
  return household;
}

export async function joinHousehold(code: string): Promise<Household> {
  await ensureSignedIn();
  const { data, error } = await db().rpc('join_household', { p_code: code }).single<HouseholdRow>();
  if (error) {
    throw new Error(
      error.message.includes('No family') ? "We couldn't find a family with that code. Check it and try again." : error.message,
    );
  }
  return toHousehold(data);
}

export async function leaveHousehold(householdId: string): Promise<void> {
  const userId = await ensureSignedIn();
  check(await db().from('household_devices').delete().eq('household_id', householdId).eq('user_id', userId));
}

/** Everything the app shows for this family, read fresh from the server. */
export async function fetchFamily(householdId: string): Promise<{ household: Household; state: AppState }> {
  const s = db();
  const [h, members, recipes, votes, planMeals, groceries, extras] = await Promise.all([
    s.from('households').select('id, name, invite_code, match_rule, plan_slots').eq('id', householdId).single<HouseholdRow>(),
    s.from('members').select('id, name, avatar, is_kid, no_foods, prefs').eq('household_id', householdId).order('created_at'),
    s.from('recipes').select('id, data').eq('household_id', householdId).order('position').order('created_at'),
    s.from('votes').select('member_id, recipe_id, vote').eq('household_id', householdId),
    s.from('plan_meals').select('day, slot, recipe_id').eq('household_id', householdId),
    s.from('grocery_checks').select('key').eq('household_id', householdId).eq('checked', true),
    s.from('grocery_extras').select('id, name').eq('household_id', householdId).order('created_at'),
  ]);
  const household = check(h);

  const state: AppState = {
    ...initialState,
    matchRule: household.match_rule,
    planSlots: household.plan_slots?.length ? MEAL_SLOTS.filter((m) => household.plan_slots!.includes(m)) : initialState.planSlots,
    members: (check(members) as MemberRow[]).map((m) => ({
      id: m.id,
      name: m.name,
      avatar: m.avatar,
      isKid: m.is_kid,
      noFoods: m.no_foods,
      prefs: readPrefs(m.prefs),
    })),
    recipes: {},
    deckOrder: [],
    votes: {},
    plan: emptyPlan(),
    checkedGroceries: (check(groceries) as { key: string }[]).map((g) => g.key),
    extraGroceries: check(extras) as ExtraGrocery[],
  };
  for (const r of check(recipes) as { id: string; data: Recipe }[]) {
    state.recipes[r.id] = r.data;
    state.deckOrder.push(r.id);
  }
  for (const v of check(votes) as VoteRow[]) {
    (state.votes[v.member_id] ??= {})[v.recipe_id] = v.vote;
  }
  for (const p of check(planMeals) as PlanMealRow[]) {
    if (state.plan[p.day]) state.plan[p.day][p.slot] = p.recipe_id;
  }
  return { household: toHousehold(household), state };
}

async function uploadAll(householdId: string, state: AppState) {
  const s = db();
  check(
    await s.from('households').update({ match_rule: state.matchRule, plan_slots: state.planSlots }).eq('id', householdId),
  );
  if (state.members.length) {
    check(await s.from('members').upsert(state.members.map((m) => memberRow(householdId, m))));
  }
  await upsertRecipes(householdId, state.deckOrder.map((id) => state.recipes[id]).filter(Boolean), state.deckOrder);
  const memberIds = new Set(state.members.map((m) => m.id));
  const votes = Object.entries(state.votes)
    .filter(([memberId]) => memberIds.has(memberId))
    .flatMap(([memberId, mine]) =>
      Object.entries(mine).map(([recipeId, vote]) => ({ household_id: householdId, member_id: memberId, recipe_id: recipeId, vote })),
    );
  if (votes.length) check(await s.from('votes').upsert(votes));
  const meals = DAYS.flatMap((day) =>
    MEAL_SLOTS.filter((slot) => state.plan[day][slot]).map((slot) => planMealRow(householdId, day, slot, state.plan[day][slot])),
  );
  if (meals.length) check(await s.from('plan_meals').upsert(meals));
  if (state.extraGroceries.length) {
    check(await s.from('grocery_extras').upsert(state.extraGroceries.map((i) => ({ household_id: householdId, ...i }))));
  }
  if (state.checkedGroceries.length) {
    check(
      await s.from('grocery_checks').upsert(state.checkedGroceries.map((key) => ({ household_id: householdId, key, checked: true }))),
    );
  }
}

async function upsertRecipes(householdId: string, recipes: Recipe[], deckOrder: string[]) {
  if (!recipes.length) return;
  check(
    await db()
      .from('recipes')
      .upsert(
        recipes.map((r) => ({ household_id: householdId, id: r.id, data: r, position: deckOrder.indexOf(r.id) })),
        { ignoreDuplicates: true },
      ),
  );
}

/** Saves one change made on this device. `prev` and `next` are the app state before and after it. */
export async function pushChange(householdId: string, action: Action, prev: AppState, next: AppState): Promise<void> {
  const s = db();
  const hid = householdId;
  switch (action.type) {
    case 'addMember':
    case 'updateMember':
      check(await s.from('members').upsert(memberRow(hid, action.member)));
      return;
    case 'removeMember':
      check(await s.from('members').delete().eq('household_id', hid).eq('id', action.id));
      return;
    case 'setRule':
      check(await s.from('households').update({ match_rule: action.rule }).eq('id', hid));
      return;
    case 'vote':
      check(
        await s.from('votes').upsert({
          household_id: hid,
          member_id: action.memberId,
          recipe_id: action.recipeId,
          vote: action.vote,
          updated_at: new Date().toISOString(),
        }),
      );
      return;
    case 'undoVote':
      check(
        await s.from('votes').delete().eq('household_id', hid).eq('member_id', action.memberId).eq('recipe_id', action.recipeId),
      );
      return;
    case 'addRecipes':
      await upsertRecipes(hid, action.recipes, next.deckOrder);
      return;
    case 'importRecipe':
      // Newest imports get the lowest position, so they sort to the top of the deck on every device.
      check(
        await s.from('recipes').upsert({
          household_id: hid,
          id: action.recipe.id,
          data: action.recipe,
          position: -Math.floor(Date.now() / 1000),
        }),
      );
      return;
    case 'setPlanMeal':
    case 'movePlanMeal':
    case 'autofillPlan':
    case 'clearPlan': {
      const changed = changedSpots(prev.plan, next.plan);
      if (changed.length) {
        check(
          await s
            .from('plan_meals')
            .upsert(changed.map(({ day, slot }) => planMealRow(hid, day, slot, next.plan[day][slot]))),
        );
      }
      return;
    }
    case 'setPlanSlots':
      check(await s.from('households').update({ plan_slots: next.planSlots }).eq('id', hid));
      return;
    case 'addExtraGrocery':
      check(await s.from('grocery_extras').upsert({ household_id: hid, ...action.item }));
      return;
    case 'removeExtraGrocery':
      check(await s.from('grocery_extras').delete().eq('household_id', hid).eq('id', action.id));
      return;
    case 'toggleGrocery':
      check(
        await s
          .from('grocery_checks')
          .upsert({ household_id: hid, key: action.key, checked: next.checkedGroceries.includes(action.key) }),
      );
      return;
    case 'newWeek':
      check(await s.rpc('new_week', { p_household: hid }));
      return;
    case 'hydrate':
      return;
  }
}

/**
 * Listens for changes other devices make. Votes arrive one at a time through `onVote`;
 * anything else calls `onChange`, and the app reloads the family.
 */
export function subscribeToFamily(
  householdId: string,
  handlers: { onChange: () => void; onVote: (memberId: string, recipeId: string, vote: Vote) => void },
): () => void {
  const s = db();
  const onVote = (payload: { new: Partial<VoteRow> }) => {
    const v = payload.new;
    if (v.member_id && v.recipe_id && v.vote) handlers.onVote(v.member_id, v.recipe_id, v.vote);
  };
  const channel = s
    .channel(`family:${householdId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'households', filter: `id=eq.${householdId}` }, handlers.onChange)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes', filter: `household_id=eq.${householdId}` }, onVote)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'votes', filter: `household_id=eq.${householdId}` }, onVote)
    .subscribe((status) => {
      // Catch up on anything missed while we were disconnected.
      if (status === 'SUBSCRIBED') handlers.onChange();
    });
  return () => {
    s.removeChannel(channel);
  };
}
