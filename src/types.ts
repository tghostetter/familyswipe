export type Ingredient = { name: string; measure: string };

export type Recipe = {
  id: string;
  name: string;
  image: string;
  category: string;
  cuisine: string;
  ingredients: Ingredient[];
  instructions: string;
  /** The web page a family member imported this recipe from, if they pasted a link. */
  sourceUrl?: string;
  /** How many people the recipe feeds, when the recipe says so. */
  servings?: number;
  /** Nutrition per serving from the recipe's own website, when it lists it. */
  siteNutrition?: Partial<Record<'calories' | 'protein' | 'carbs' | 'fat' | 'satFat' | 'sugar' | 'fiber' | 'sodium', number>>;
  /** Which meal this recipe is for. Recipes without one count as dinners. */
  mealType?: MealSlot;
};

export type Member = {
  id: string;
  name: string;
  avatar: string;
  isKid: boolean;
  /** Foods this person never eats (or is allergic to). Matching recipes are hidden for the whole family. */
  noFoods: string[];
  prefs: FoodPrefs;
};

export type FoodPrefs = {
  /** Cuisines this person loves, e.g. "Italian". Used to pick and order the dinners in the deck. */
  cuisines: string[];
  /** Kinds of dinner this person loves, e.g. "Chicken" or "Pasta". */
  kinds: string[];
  /** Meats this person never eats, e.g. "pork". Matching recipes are hidden for the whole family. */
  skips: string[];
};

export type MatchRule = 'everyone' | 'majority' | 'parentsPlusKid';

export type Vote = 'yum' | 'nope';

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type Day = (typeof DAYS)[number];

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner'] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

/** One recipe id (or nothing) for each meal of each day. */
export type WeekPlan = Record<Day, Record<MealSlot, string | null>>;

/** Something added to the shopping list by hand, like milk or paper towels. */
export type ExtraGrocery = { id: string; name: string };

export type AppState = {
  members: Member[];
  matchRule: MatchRule;
  /** votes[memberId][recipeId] */
  votes: Record<string, Record<string, Vote>>;
  /** Recipes loaded into this week's deck, keyed by id. */
  recipes: Record<string, Recipe>;
  deckOrder: string[];
  plan: WeekPlan;
  /** Which meals the family plans each day. Dinner only, unless they turn on breakfast or lunch. */
  planSlots: MealSlot[];
  /** Grocery items the family has checked off, by item key. */
  checkedGroceries: string[];
  /** Items added to the shopping list by hand. */
  extraGroceries: ExtraGrocery[];
};
