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

const LETTERS = 'abcdefghijklmnoprstvw'.split('');

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Loads a fresh, shuffled batch of dinner recipes with photos. */
export async function fetchDinnerDeck(target = 40): Promise<Recipe[]> {
  const found = new Map<string, Recipe>();
  for (const letter of shuffle(LETTERS)) {
    if (found.size >= target) break;
    const res = await fetch(`${BASE}/search.php?f=${letter}`);
    if (!res.ok) throw new Error(`Recipe service returned ${res.status}`);
    const json: { meals: MealDbMeal[] | null } = await res.json();
    for (const meal of json.meals ?? []) {
      const recipe = toRecipe(meal);
      if (recipe.id && recipe.image && !SKIP_CATEGORIES.has(recipe.category)) {
        found.set(recipe.id, recipe);
      }
    }
  }
  return shuffle([...found.values()]).slice(0, target);
}
