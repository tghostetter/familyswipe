// Recipes and photos come from TheMealDB (https://www.themealdb.com/api.php).
// The "1" key is their free development key. Before the App Store launch,
// switch to a paid production key (or another service such as Spoonacular).
// Everything that talks to the recipe service lives in this file, so swapping
// services later only means changing this file.
import { LUNCHBOX_RECIPES } from '../data/lunchbox';
import { Ingredient, MealSlot, Recipe } from '../types';

const BASE = 'https://www.themealdb.com/api/json/v1/1';

type MealDbMeal = Record<string, string | null>;

function toRecipe(meal: MealDbMeal): Recipe {
  const ingredients: Ingredient[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}`]?.trim();
    if (name) ingredients.push({ name, measure: meal[`strMeasure${i}`]?.trim() ?? '' });
  }
  return {
    id: meal.idMeal ?? '',
    name: meal.strMeal ?? 'Untitled',
    image: meal.strMealThumb ?? '',
    category: meal.strCategory ?? '',
    cuisine: meal.strArea ?? '',
    ingredients,
    instructions: meal.strInstructions ?? '',
  };
}

// Dinner-ish categories only, so the deck isn't full of desserts and breakfasts.
const SKIP_CATEGORIES = new Set(['Dessert', 'Breakfast', 'Starter', 'Side']);

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let catalog: Promise<Recipe[]> | null = null;

/** Every dinner the service has, with photos. Loaded once per app launch. */
function allDinners(): Promise<Recipe[]> {
  catalog ??= Promise.allSettled(
    LETTERS.map(async (letter) => {
      const res = await fetch(`${BASE}/search.php?f=${letter}`);
      if (!res.ok) throw new Error(`Recipe service returned ${res.status}`);
      const json: { meals: MealDbMeal[] | null } = await res.json();
      return (json.meals ?? []).map(toRecipe);
    }),
  ).then((results) => {
    const ok = results.filter((r) => r.status === 'fulfilled').flatMap((r) => r.value);
    if (ok.length === 0) {
      catalog = null; // try again next time
      throw new Error("Couldn't reach the recipe service");
    }
    return ok.filter((r) => r.id && r.image && !SKIP_CATEGORIES.has(r.category));
  });
  return catalog;
}

export type DeckOptions = {
  /** Recipes already in the deck, so "load more" brings new ones. */
  exclude?: Set<string>;
  /** False for recipes the family can't eat. */
  allowed?: (r: Recipe) => boolean;
  /** Higher means the family is more likely to love it. */
  score?: (r: Recipe) => number;
};

/**
 * Loads a batch of dinner recipes with photos. The best fits for the family come
 * first, with a few surprises mixed in so the deck doesn't get boring.
 */
async function fetchDinnerDeck(target = 40, { exclude, allowed, score }: DeckOptions = {}): Promise<Recipe[]> {
  const fresh = shuffle(await allDinners()).filter((r) => !exclude?.has(r.id) && (allowed?.(r) ?? true));
  if (!score) return fresh.slice(0, target);
  const ranked = fresh.map((r) => ({ r, s: score(r) }));
  const favorites = ranked.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.r);
  const others = ranked.filter((x) => x.s === 0).map((x) => x.r);
  // About one card in five is something new to try.
  const surprises = Math.min(others.length, Math.max(target - favorites.length, Math.round(target / 5)));
  return shuffle([...favorites.slice(0, target - surprises), ...others.slice(0, surprises)]);
}

async function getMeals(path: string): Promise<MealDbMeal[]> {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`Recipe service returned ${res.status}`);
  const json: { meals: MealDbMeal[] | null } = await res.json();
  return json.meals ?? [];
}

// Breakfast-y searches, on top of TheMealDB's own Breakfast category.
const BREAKFAST_SEARCHES = ['pancake', 'french toast', 'waffle', 'omelette', 'porridge', 'muffin', 'crepe', 'frittata', 'shakshuka'];

let breakfasts: Promise<Recipe[]> | null = null;

/**
 * Every breakfast we can find, loaded once per app launch. Ids get a "breakfast-"
 * prefix so a dish that is also in the dinner deck gets its own swipes and matches.
 */
function allBreakfasts(): Promise<Recipe[]> {
  breakfasts ??= (async () => {
    const ids = (await getMeals('filter.php?c=Breakfast')).map((m) => m.idMeal).filter((id): id is string => !!id);
    const [category, searches] = await Promise.all([
      Promise.all(ids.map((id) => getMeals(`lookup.php?i=${id}`).catch(() => []))),
      Promise.all(BREAKFAST_SEARCHES.map((q) => getMeals(`search.php?s=${encodeURIComponent(q)}`).catch(() => []))),
    ]);
    const found = new Map<string, Recipe>();
    for (const recipe of [...category.flat(), ...searches.flat()].map(toRecipe)) {
      if (recipe.id && recipe.image) {
        found.set(recipe.id, { ...recipe, id: `breakfast-${recipe.id}`, mealType: 'breakfast' });
      }
    }
    return [...found.values()];
  })().catch((e) => {
    breakfasts = null; // try again next time
    throw e;
  });
  return breakfasts;
}

/**
 * Loads a batch of recipes with photos for one meal. Food preferences (loved
 * cuisines and kinds of dinner) only rank dinners; "never eats" applies to all.
 */
export async function fetchDeck(mealType: MealSlot, options: DeckOptions = {}): Promise<Recipe[]> {
  const { exclude, allowed } = options;
  const keep = (r: Recipe) => !exclude?.has(r.id) && (allowed?.(r) ?? true);
  switch (mealType) {
    case 'breakfast':
      return shuffle((await allBreakfasts()).filter(keep));
    case 'lunch':
      return shuffle(LUNCHBOX_RECIPES.filter(keep));
    case 'dinner':
      return (await fetchDinnerDeck(40, options)).map((r) => ({ ...r, mealType: 'dinner' }));
  }
}
