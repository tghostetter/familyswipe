import { Day, DAYS, MEAL_SLOTS, MealSlot, Recipe, WeekPlan } from '../types';

export const SLOT_NAMES: Record<MealSlot, string> = { breakfast: 'Breakfast', lunch: 'School lunch', dinner: 'Dinner' };
export const SLOT_ICONS: Record<MealSlot, string> = { breakfast: '🥞', lunch: '🍎', dinner: '🍝' };

export const DAY_NAMES: Record<Day, string> = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday',
};

export const emptyPlan = (): WeekPlan =>
  Object.fromEntries(DAYS.map((d) => [d, { breakfast: null, lunch: null, dinner: null }])) as WeekPlan;

/**
 * Reads a saved plan. Plans saved before breakfast and lunch existed had one dinner per day
 * ({ Mon: 'recipe id' }), so those become this week's dinners.
 */
export function normalizePlan(saved: unknown): WeekPlan {
  const plan = emptyPlan();
  if (!saved || typeof saved !== 'object') return plan;
  for (const day of DAYS) {
    const value = (saved as Record<string, unknown>)[day];
    if (typeof value === 'string') plan[day].dinner = value;
    else if (value && typeof value === 'object') {
      for (const slot of MEAL_SLOTS) {
        const id = (value as Record<string, unknown>)[slot];
        if (typeof id === 'string') plan[day][slot] = id;
      }
    }
  }
  return plan;
}

/** Which meal a recipe is for. Recipes without a meal type are dinners. */
const slotOf = (recipe: Recipe): MealSlot => recipe.mealType ?? 'dinner';

/** Every planned recipe id in the given meals, once per time it's planned (Mon to Sun). */
export function plannedIds(plan: WeekPlan, slots: readonly MealSlot[] = MEAL_SLOTS): string[] {
  return DAYS.flatMap((day) => slots.map((slot) => plan[day][slot]).filter((id): id is string => !!id));
}

/** Matches that suit this meal and aren't planned for it yet this week. */
export function spareMatches(plan: WeekPlan, slot: MealSlot, matches: Recipe[]): Recipe[] {
  const planned = new Set(plannedIds(plan, [slot]));
  return matches.filter((r) => slotOf(r) === slot && !planned.has(r.id));
}

/** Fills every empty spot in the chosen meals with matches, in the order the family matched them. */
export function autofill(plan: WeekPlan, slots: readonly MealSlot[], matches: Recipe[]): WeekPlan {
  const next = clonePlan(plan);
  for (const slot of slots) {
    const spare = spareMatches(plan, slot, matches);
    for (const day of DAYS) {
      if (!next[day][slot] && spare.length) next[day][slot] = spare.shift()!.id;
    }
  }
  return next;
}

/** Moves a meal to another day. Whatever was planned there moves to the first day, so nothing is lost. */
export function moveMeal(plan: WeekPlan, slot: MealSlot, from: Day, to: Day): WeekPlan {
  const next = clonePlan(plan);
  next[to][slot] = plan[from][slot];
  next[from][slot] = plan[to][slot];
  return next;
}

export function setMeal(plan: WeekPlan, day: Day, slot: MealSlot, recipeId: string | null): WeekPlan {
  const next = clonePlan(plan);
  next[day][slot] = recipeId;
  return next;
}

/** Every day and meal whose recipe differs between two plans. */
export function changedSpots(prev: WeekPlan, next: WeekPlan): { day: Day; slot: MealSlot }[] {
  return DAYS.flatMap((day) => MEAL_SLOTS.filter((slot) => prev[day][slot] !== next[day][slot]).map((slot) => ({ day, slot })));
}

const clonePlan = (plan: WeekPlan): WeekPlan =>
  Object.fromEntries(DAYS.map((d) => [d, { ...plan[d] }])) as WeekPlan;
