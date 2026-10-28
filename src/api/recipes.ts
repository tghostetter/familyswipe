// Recipes and photos come from TheMealDB (https://www.themealdb.com/api.php).
// The "1" key is their free development key. Before the App Store launch,
// switch to a paid production key (or another service such as Spoonacular).
// Everything that talks to the recipe service lives in this file, so swapping
// services later only means changing this file.
import { Ingredient, Recipe } from '../types';

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
export async function fetchDinnerDeck(target = 40, { exclude, allowed, score }: DeckOptions = {}): Promise<Recipe[]> {
  const fresh = shuffle(await allDinners()).filter((r) => !exclude?.has(r.id) && (allowed?.(r) ?? true));
  if (!score) return fresh.slice(0, target);
  const ranked = fresh.map((r) => ({ r, s: score(r) }));
  const favorites = ranked.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.r);
  const others = ranked.filter((x) => x.s === 0).map((x) => x.r);
  // About one card in five is something new to try.
  const surprises = Math.min(others.length, Math.max(target - favorites.length, Math.round(target / 5)));
  return shuffle([...favorites.slice(0, target - surprises), ...others.slice(0, surprises)]);
}
