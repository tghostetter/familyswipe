// Turns a link to a recipe web page into a Recipe for the deck.
//
// Almost every recipe site (Allrecipes, BBC Good Food, NYT Cooking, food blogs...)
// hides a tidy copy of the recipe inside the page for Google, in a format called
// schema.org "Recipe" (a <script type="application/ld+json"> block). We read that,
// so we get the title, photo, ingredients and steps without guessing.
import { Ingredient, Recipe } from '../types';

export class ImportError extends Error {}

const MAX_PAGE_CHARS = 3_000_000;

/** Downloads the page at `url` and pulls the recipe out of it. */
export async function importRecipeFromUrl(rawUrl: string): Promise<Recipe> {
  const url = cleanUrl(rawUrl);
  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        // Some recipe sites turn away requests that don't look like a phone browser.
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) throw new ImportError(`That website said no (error ${res.status}). Try a different link.`);
    html = (await res.text()).slice(0, MAX_PAGE_CHARS);
  } catch (e) {
    if (e instanceof ImportError) throw e;
    throw new ImportError("Couldn't open that link. Check your internet connection and the link, then try again.");
  }
  const recipe = parseRecipeHtml(html, url);
  if (!recipe) {
    throw new ImportError(
      "We couldn't find a recipe on that page. Try the link to the recipe itself (not a list or search page).",
    );
  }
  return recipe;
}

/** Accepts what people paste from a share sheet, like "Try this! https://site.com/recipe". */
export function cleanUrl(raw: string): string {
  const found = raw.match(/https?:\/\/[^\s"'<>]+/i)?.[0] ?? raw.trim();
  // Always ask for the secure (https) version; iPhones block plain http pages.
  const withScheme = `https://${found.replace(/^https?:\/\//i, '')}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new ImportError("That doesn't look like a web link. Copy the address of the recipe page and paste it here.");
  }
  if (!parsed.hostname.includes('.')) {
    throw new ImportError("That doesn't look like a web link. Copy the address of the recipe page and paste it here.");
  }
  return parsed.toString();
}

/** Finds the schema.org Recipe in a page. Returns null when there isn't one. */
export function parseRecipeHtml(html: string, url: string): Recipe | null {
  const node = findRecipeNode(html);
  if (!node) return null;

  const name = text(node.name) || text(node.headline) || metaContent(html, 'og:title');
  if (!name) return null;

  const ingredients = asArray(node.recipeIngredient ?? node.ingredients)
    .map(text)
    .filter(Boolean)
    .map(splitIngredient);
  const instructions = steps(node.recipeInstructions).join('\n');
  if (ingredients.length === 0 && !instructions) return null;

  return {
    id: recipeIdFor(url),
    name,
    image: absolute(imageUrl(node.image) || metaContent(html, 'og:image'), url),
    category: firstText(node.recipeCategory),
    cuisine: firstText(node.recipeCuisine),
    ingredients,
    instructions,
    sourceUrl: url,
    servings: servingsFrom(node.recipeYield),
    siteNutrition: nutritionFrom(node.nutrition),
  };
}

/** The same link always gets the same id, so pasting it twice doesn't add it twice. */
export function recipeIdFor(url: string): string {
  const u = new URL(url);
  const key = `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
  // A short fingerprint (FNV-1a) keeps the id small.
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `link-${hash.toString(36)}`;
}

/** "From allrecipes.com" */
export function siteName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// ---- reading the page ----

type Json = Record<string, unknown>;

function findRecipeNode(html: string): Json | null {
  const scripts = html.matchAll(/<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, body] of scripts) {
    let data: unknown;
    try {
      data = JSON.parse(body.trim());
    } catch {
      try {
        // Some sites leave raw line breaks inside strings, which strict JSON doesn't allow.
        data = JSON.parse(body.trim().replace(/[\r\n\t]+/g, ' '));
      } catch {
        continue;
      }
    }
    const found = searchForRecipe(data, 0);
    if (found) return found;
  }
  return null;
}

function searchForRecipe(value: unknown, depth: number): Json | null {
  if (depth > 6 || !value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const v of value) {
      const found = searchForRecipe(v, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const obj = value as Json;
  const type = obj['@type'];
  if (asArray(type).some((t) => typeof t === 'string' && t.toLowerCase() === 'recipe')) return obj;
  for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item']) {
    const found = searchForRecipe(obj[key], depth + 1);
    if (found) return found;
  }
  return null;
}

function metaContent(html: string, property: string): string {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const prop = tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1];
    if (prop?.toLowerCase() === property) {
      return decodeEntities(tag.match(/content\s*=\s*["']([^"']*)["']/i)?.[1] ?? '').trim();
    }
  }
  return '';
}

function steps(value: unknown): string[] {
  if (typeof value === 'string') {
    // One big block: split it on line breaks or HTML paragraphs.
    return text(value.replace(/<\/(p|li)>|<br\s*\/?>/gi, '\n'))
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return asArray(value).flatMap((item): string[] => {
    if (typeof item === 'string') return steps(item);
    if (!item || typeof item !== 'object') return [];
    const obj = item as Json;
    // A HowToSection ("For the sauce") holds its own list of steps.
    if (obj.itemListElement) {
      const title = text(obj.name);
      const inner = steps(obj.itemListElement);
      return title && inner.length ? [`${title}:`, ...inner] : inner;
    }
    const step = text(obj.text) || text(obj.name) || text(obj.description);
    return step ? [step] : [];
  });
}

// Units we split off the front of an ingredient line, so "2 cups flour" becomes "flour" + "2 cups".
const UNITS =
  'cups?|c\\.|tablespoons?|tbsps?\\.?|tbs\\.?|teaspoons?|tsps?\\.?|ounces?|oz\\.?|fl\\.? oz\\.?|pounds?|lbs?\\.?|grams?|g|kilograms?|kg|milliliters?|millilitres?|ml|liters?|litres?|l|pints?|quarts?|gallons?|cloves?|cans?|jars?|packages?|pkgs?\\.?|sticks?|slices?|pinch(?:es)?|dash(?:es)?|handfuls?|bunch(?:es)?|sprigs?|heads?|stalks?|pieces?|large|medium|small';
// Fractions first, so "1 1/2" isn't read as "1 1" followed by "/2".
const QTY = '(?:\\d+\\s*\\/\\s*\\d+|\\d+(?:[.,]\\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])';
const INGREDIENT_RE = new RegExp(
  `^((?:${QTY}\\s*)+(?:(?:-|to|–)\\s*(?:${QTY}\\s*)+)?(?:\\([^)]*\\)\\s*)?(?:(?:${UNITS})(?![a-z]))?)\\s*(?:of\\s+)?(.+)$`,
  'i',
);

export function splitIngredient(line: string): Ingredient {
  const m = line.match(INGREDIENT_RE);
  if (!m || !m[2]) return { name: line, measure: '' };
  return { name: m[2].trim(), measure: m[1].trim() };
}

/** "4", "Serves 4", "4-6 servings", ["4", "4 servings"] → 4. */
function servingsFrom(value: unknown): number | undefined {
  for (const v of asArray(value)) {
    const n = Number(text(v).match(/\d+/)?.[0]);
    if (n >= 1 && n <= 50) return n;
  }
  return undefined;
}

const NUTRITION_FIELDS = {
  calories: 'calories',
  protein: 'proteinContent',
  carbs: 'carbohydrateContent',
  fat: 'fatContent',
  satFat: 'saturatedFatContent',
  sugar: 'sugarContent',
  fiber: 'fiberContent',
  sodium: 'sodiumContent',
} as const;

/** The schema.org NutritionInformation block ("350 kcal", "12 g"...), per serving. */
function nutritionFrom(value: unknown): Recipe['siteNutrition'] {
  const node = asArray(value)[0];
  if (!node || typeof node !== 'object') return undefined;
  const out: NonNullable<Recipe['siteNutrition']> = {};
  for (const [ours, theirs] of Object.entries(NUTRITION_FIELDS) as [keyof typeof NUTRITION_FIELDS, string][]) {
    const raw = text((node as Json)[theirs]);
    const n = Number(raw.replace(',', '.').match(/\d+(?:\.\d+)?/)?.[0]);
    if (!raw || !Number.isFinite(n)) continue;
    // Sodium is usually in milligrams, but some sites give grams.
    out[ours] = ours === 'sodium' && /\d\s*g\b/i.test(raw) && !/mg/i.test(raw) ? n * 1000 : n;
  }
  // Only trust it if it at least has calories.
  return out.calories ? out : undefined;
}

// ---- small helpers ----

function asArray(value: unknown): unknown[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string {
  if (typeof value === 'number') return String(value);
  if (typeof value !== 'string') return '';
  return decodeEntities(value.replace(/<[^>]*>/g, ' '))
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

function firstText(value: unknown): string {
  for (const v of asArray(value)) {
    const t = text(v);
    if (t) return t.split(',')[0].trim();
  }
  return '';
}

function imageUrl(value: unknown): string {
  for (const v of asArray(value)) {
    if (typeof v === 'string' && v) return v;
    if (v && typeof v === 'object') {
      const u = (v as Json).url ?? (v as Json).contentUrl;
      if (typeof u === 'string' && u) return u;
    }
  }
  return '';
}

function absolute(maybeRelative: string, base: string): string {
  if (!maybeRelative) return '';
  try {
    const u = new URL(decodeEntities(maybeRelative), base);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : '';
  } catch {
    return '';
  }
}

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  deg: '°',
  ndash: '–',
  mdash: '—',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  hellip: '…',
  eacute: 'é',
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole;
    }
    return NAMED[code.toLowerCase()] ?? whole;
  });
}
