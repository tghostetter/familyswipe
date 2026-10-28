import { Recipe } from '../types';

export type GroceryItem = {
  key: string;
  name: string;
  /** Each amount, with the recipe it's for, e.g. "2 cups (Chicken Curry)". */
  amounts: string[];
};

/** Combines the ingredients of every planned recipe into one list, A to Z. */
export function buildGroceryList(recipes: Recipe[]): GroceryItem[] {
  const items = new Map<string, GroceryItem>();
  for (const recipe of recipes) {
    for (const ing of recipe.ingredients) {
      const key = ing.name.trim().toLowerCase();
      if (!key) continue;
      const item = items.get(key) ?? { key, name: ing.name.trim(), amounts: [] };
      item.amounts.push(ing.measure ? `${ing.measure} (${recipe.name})` : recipe.name);
      items.set(key, item);
    }
  }
  return [...items.values()].sort((a, b) => a.name.localeCompare(b.name));
}
