import { ExtraGrocery, Recipe } from '../types';

/**
 * Turns the week's recipes into one shopping list.
 *
 * - The same ingredient from different recipes becomes one line ("Onion: 3, for Curry and Tacos").
 * - Amounts in the same unit are added up (1 cup + 2 cups = 3 cups). Different units are listed side by side.
 * - Lines are grouped by store aisle, in the order you'd walk a typical grocery store.
 */

export const AISLES = [
  'Produce',
  'Meat & seafood',
  'Dairy & eggs',
  'Bakery',
  'Pantry',
  'Spices & seasonings',
  'Sauces, oils & condiments',
  'Frozen',
  'Drinks',
  'Everything else',
] as const;
export type Aisle = (typeof AISLES)[number];

/** One amount of an item, added up from every recipe that uses it in that unit. */
export type Amount = { quantity: number; unit: string };

export type GroceryItem = {
  /** Stays the same across devices and weeks, so a checked item stays checked everywhere. */
  key: string;
  name: string;
  aisle: Aisle;
  /** Amounts we could add up, one per unit. */
  amounts: Amount[];
  /** Amounts we couldn't read as numbers, like "to taste" or "a handful". */
  notes: string[];
  /** The planned recipes that need this, by name. */
  recipes: string[];
  /** True when someone added this to the list by hand. */
  extraId?: string;
};

export type GroceryAisle = { aisle: Aisle; items: GroceryItem[] };

/** Builds the list from the planned recipes (a recipe planned twice counts twice) plus hand-added items. */
export function buildGroceryList(recipes: Recipe[], extras: ExtraGrocery[] = []): GroceryItem[] {
  const items = new Map<string, GroceryItem>();
  const add = (rawName: string) => {
    const name = cleanName(rawName);
    const key = itemKey(name);
    if (!key) return null;
    let item = items.get(key);
    if (!item) {
      item = { key, name: capitalize(name), aisle: aisleFor(name), amounts: [], notes: [], recipes: [] };
      items.set(key, item);
    }
    return item;
  };

  for (const recipe of recipes) {
    for (const ing of recipe.ingredients) {
      const item = add(ing.name);
      if (!item) continue;
      if (!item.recipes.includes(recipe.name)) item.recipes.push(recipe.name);
      const amount = parseMeasure(ing.measure);
      if (amount) {
        const same = item.amounts.find((a) => a.unit === amount.unit);
        if (same) same.quantity += amount.quantity;
        else item.amounts.push(amount);
      } else {
        const note = ing.measure.trim();
        if (note && !item.notes.some((n) => n.toLowerCase() === note.toLowerCase())) item.notes.push(note);
      }
    }
  }
  for (const extra of extras) {
    const item = add(extra.name);
    if (item) item.extraId ??= extra.id;
  }
  return [...items.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Splits the list into aisles, in store order, leaving out empty aisles. */
export function groupByAisle(items: GroceryItem[]): GroceryAisle[] {
  return AISLES.map((aisle) => ({ aisle, items: items.filter((i) => i.aisle === aisle) })).filter((g) => g.items.length);
}

/** How much to buy, in words, e.g. "3 cups + 2 tbsp". Empty when no recipe says. */
export function amountText(item: GroceryItem): string {
  return [...item.amounts.map(formatAmount), ...item.notes].join(' + ');
}

/** The list as plain text, for sharing in a message. Checked items are left out. */
export function groceryListText(items: GroceryItem[], checked: Set<string>): string {
  const lines: string[] = [];
  for (const { aisle, items: inAisle } of groupByAisle(items.filter((i) => !checked.has(i.key)))) {
    lines.push(aisle.toUpperCase());
    for (const item of inAisle) {
      const amount = amountText(item);
      lines.push(`☐ ${item.name}${amount ? ` (${amount})` : ''}`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

/**
 * The list in the shape grocery delivery services ask for: an item name, plus a quantity and
 * unit when there's exactly one. This is what we'll hand to Instacart when we add delivery.
 */
export type ShoppingLineItem = { name: string; quantity?: number; unit?: string; displayText: string };

export function toShoppingLineItems(items: GroceryItem[], checked: Set<string>): ShoppingLineItem[] {
  return items
    .filter((i) => !checked.has(i.key))
    .map((i) => {
      const amount = amountText(i);
      const only = i.amounts.length === 1 && i.notes.length === 0 ? i.amounts[0] : null;
      return {
        name: i.name,
        ...(only && { quantity: round(only.quantity), unit: only.unit || 'each' }),
        displayText: amount ? `${i.name}, ${amount}` : i.name,
      };
    });
}

// ---------- Names ----------

function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Red Onions" and "red onion" are the same thing to buy. */
export function itemKey(name: string): string {
  const words = name
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(' ')
    .filter(Boolean);
  if (!words.length) return '';
  words[words.length - 1] = singular(words[words.length - 1]);
  return words.join(' ');
}

function singular(word: string): string {
  if (word.length <= 3 || /(ss|us|is)$/.test(word)) return word;
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y'; // berries
  if (/(oes|ches|shes|xes)$/.test(word)) return word.slice(0, -2); // tomatoes, peaches
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

// ---------- Aisles ----------

// Checked in this order, so "chicken stock" is found as a pantry item before "chicken" makes it meat,
// and "pepperoni" is meat before "pepper" makes it a spice.
// Each word only matches at the start of a word, so "tea" doesn't match "steak".
const AISLE_WORDS: [Aisle, string[]][] = [
  ['Frozen', ['frozen', 'ice cream']],
  ['Pantry', ['stock', 'broth', 'bouillon', 'canned', 'tinned', 'chopped tomatoes', 'tomato puree', 'tomato paste', 'coconut milk', 'coconut cream', 'condensed milk', 'evaporated milk', 'butter beans', 'egg noodle']],
  ['Sauces, oils & condiments', ['oil', 'vinegar', 'sauce', 'ketchup', 'mustard', 'mayonnaise', 'mayo', 'honey', 'syrup', 'jam', 'salsa', 'pesto', 'dressing', 'relish', 'peanut butter', 'tahini', 'miso', 'harissa', 'sriracha']],
  ['Meat & seafood', ['chicken', 'beef', 'pork', 'lamb', 'mince', 'bacon', 'sausage', 'ham', 'turkey', 'steak', 'chorizo', 'prosciutto', 'salami', 'pepperoni', 'veal', 'duck', 'goat', 'fish', 'salmon', 'tuna', 'cod', 'haddock', 'prawn', 'shrimp', 'crab', 'mussel', 'clam', 'squid', 'anchov', 'sardine', 'mackerel', 'scallop', 'lobster']],
  ['Dairy & eggs', ['milk', 'cheese', 'cheddar', 'parmesan', 'mozzarella', 'feta', 'ricotta', 'butter', 'cream', 'double cream', 'yogurt', 'yoghurt', 'egg', 'creme fraiche', 'crème fraîche', 'ghee', 'paneer']],
  ['Spices & seasonings', ['salt', 'pepper', 'black pepper', 'cumin', 'paprika', 'oregano', 'thyme', 'cinnamon', 'nutmeg', 'turmeric', 'chili powder', 'chilli powder', 'curry powder', 'garam masala', 'bay lea', 'cloves', 'cardamom', 'coriander seed', 'seasoning', 'spice', 'allspice', 'saffron', 'vanilla', 'peppercorn']],
  ['Pantry', ['flour', 'sugar', 'rice', 'pasta', 'spaghetti', 'penne', 'fusilli', 'noodle', 'macaroni', 'lasagne', 'oats', 'cereal', 'beans', 'lentil', 'chickpea', 'baking', 'yeast', 'cornstarch', 'cornflour', 'breadcrumb', 'cracker', 'chocolate', 'cocoa', 'nuts', 'almond', 'walnut', 'pecan', 'peanut', 'cashew', 'raisin', 'quinoa', 'couscous', 'gelatin', 'chips', 'granola']],
  ['Bakery', ['bread', 'bun', 'roll', 'baguette', 'tortilla', 'pitta', 'pita', 'naan', 'bagel', 'croissant', 'muffin', 'wrap', 'brioche', 'ciabatta']],
  ['Drinks', ['wine', 'beer', 'juice', 'cider', 'brandy', 'rum', 'vodka', 'whisky', 'sherry', 'coffee', 'tea', 'soda']],
  ['Produce', ['onion', 'garlic', 'ginger', 'tomato', 'potato', 'carrot', 'celery', 'lettuce', 'spinach', 'kale', 'cabbage', 'broccoli', 'cauliflower', 'chilli', 'chili', 'jalapeno', 'cucumber', 'zucchini', 'courgette', 'aubergine', 'mushroom', 'lemon', 'lime', 'orange', 'apple', 'banana', 'berr', 'blueberr', 'strawberr', 'raspberr', 'grape', 'mango', 'pineapple', 'avocado', 'pear', 'peach', 'plum', 'cherr', 'melon', 'basil', 'parsley', 'cilantro', 'coriander', 'mint', 'dill', 'rosemary', 'chives', 'scallion', 'leek', 'shallot', 'squash', 'pumpkin', 'corn', 'peas', 'asparagus', 'beetroot', 'radish', 'turnip', 'parsnip', 'fennel', 'herb', 'salad', 'sprout', 'watercress', 'rocket', 'arugula']],
];

// Fresh things whose names would otherwise land in another aisle (eggplant isn't an egg).
const ALWAYS_PRODUCE = /\b(eggplants?|green beans?|sweet potato(es)?|spring onions?|garlic|(lemon|lime) juice|(bell|red|green|yellow|orange) peppers?|fresh (basil|parsley|coriander|mint|thyme|rosemary|dill|herbs?|ginger|chillis?|chilies))\b/;
// Dried and ground things are spices, even when the plant is also sold fresh.
const ALWAYS_SPICE = /\b(ground|dried|powder)\b/;

const WORD_PATTERNS = AISLE_WORDS.map(
  ([aisle, words]) => [aisle, new RegExp(`\\b(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`)] as const,
);

export function aisleFor(name: string): Aisle {
  const n = name.toLowerCase();
  if (ALWAYS_SPICE.test(n) && !/\b(beef|pork|lamb|turkey|chicken|almonds?)\b/.test(n)) return 'Spices & seasonings';
  if (ALWAYS_PRODUCE.test(n)) return 'Produce';
  for (const [aisle, pattern] of WORD_PATTERNS) {
    if (pattern.test(n)) return aisle;
  }
  return 'Everything else';
}

// ---------- Amounts ----------

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };

// Different spellings of the same unit, so "2 tbs" and "1 tablespoon" add up.
const UNITS: Record<string, string> = {
  tsp: 'tsp', tsps: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  tbsp: 'tbsp', tbs: 'tbsp', tbls: 'tbsp', tblsp: 'tbsp', tbsps: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  cup: 'cup', cups: 'cup',
  g: 'g', gram: 'g', grams: 'g', gr: 'g',
  kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  ml: 'ml', millilitre: 'ml', milliliter: 'ml', millilitres: 'ml', milliliters: 'ml',
  l: 'l', litre: 'l', liter: 'l', litres: 'l', liters: 'l',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  clove: 'clove', cloves: 'clove',
  can: 'can', cans: 'can', tin: 'can', tins: 'can',
  slice: 'slice', slices: 'slice',
  pinch: 'pinch', pinches: 'pinch',
  bunch: 'bunch', bunches: 'bunch',
  large: 'large', medium: 'medium', small: 'small',
};
// Units we can turn into a bigger or smaller one, so 500g + 1kg = 1.5 kg.
const CONVERT: Record<string, [string, number]> = { kg: ['g', 1000], l: ['ml', 1000] };

/** Reads a measure like "1 1/2 cups", "200g" or "2 large". Returns null for "to taste" and friends. */
export function parseMeasure(measure: string): Amount | null {
  const m = measure
    .trim()
    .toLowerCase()
    .match(/^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+|\d*\s*[½¼¾⅓⅔⅛])\s*([a-z]+)?\.?(?:\s|$)/);
  if (!m) return null;
  const quantity = parseNumber(m[1]);
  if (!quantity) return null;
  const word = m[2] ?? '';
  let unit = UNITS[word] ?? (word ? null : '');
  if (unit === null) return { quantity, unit: '' }; // "2 onions": the number is what matters
  let q = quantity;
  if (CONVERT[unit]) [unit, q] = [CONVERT[unit][0], q * CONVERT[unit][1]];
  return { quantity: q, unit };
}

function parseNumber(text: string): number {
  let total = 0;
  for (const part of text.trim().split(/\s+/)) {
    const uni = part.match(/^(\d*)([½¼¾⅓⅔⅛])$/);
    if (uni) total += (Number(uni[1]) || 0) + FRACTIONS[uni[2]];
    else if (part.includes('/')) {
      const [a, b] = part.split('/').map(Number);
      if (b) total += a / b;
    } else total += Number(part) || 0;
  }
  return total;
}

const round = (n: number) => Math.round(n * 100) / 100;

const PLURAL_UNITS = new Set(['cup', 'clove', 'can', 'slice', 'pinch', 'bunch']);

function formatAmount({ quantity, unit }: Amount): string {
  let q = quantity;
  let u = unit;
  // Show big amounts in kg or litres.
  if (u === 'g' && q >= 1000) [q, u] = [q / 1000, 'kg'];
  if (u === 'ml' && q >= 1000) [q, u] = [q / 1000, 'l'];
  const label = u && q > 1 && PLURAL_UNITS.has(u) ? (u === 'pinch' || u === 'bunch' ? `${u}es` : `${u}s`) : u;
  const number = formatNumber(q);
  if (!label) return number;
  return /^(g|kg|ml|l)$/.test(label) ? `${number}${label}` : `${number} ${label}`;
}

function formatNumber(n: number): string {
  const whole = Math.floor(n + 1e-9);
  const rest = n - whole;
  const nice = Object.entries(FRACTIONS).find(([, v]) => Math.abs(v - rest) < 0.02);
  if (nice && rest > 0.02) return whole ? `${whole}${nice[0]}` : nice[0];
  return String(round(n));
}
