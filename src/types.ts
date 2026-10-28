export type Ingredient = { name: string; measure: string };

export type Recipe = {
  id: string;
  name: string;
  image: string;
  category: string;
  cuisine: string;
  ingredients: Ingredient[];
  instructions: string;
};

export type Member = {
  id: string;
  name: string;
  avatar: string;
  isKid: boolean;
  /** Foods this person never eats (or is allergic to). Matching recipes are hidden for the whole family. */
  noFoods: string[];
};

export type MatchRule = 'everyone' | 'majority' | 'parentsPlusKid';

export type Vote = 'yum' | 'nope';

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type Day = (typeof DAYS)[number];

export type AppState = {
  members: Member[];
  matchRule: MatchRule;
  /** votes[memberId][recipeId] */
  votes: Record<string, Record<string, Vote>>;
  /** Recipes loaded into this week's deck, keyed by id. */
  recipes: Record<string, Recipe>;
  deckOrder: string[];
  plan: Record<Day, string | null>;
  /** Grocery items the family has checked off, by item key. */
  checkedGroceries: string[];
};
