// Estimates nutrition and a simple A-E health grade for a recipe from its ingredients.
//
// TheMealDB doesn't come with nutrition facts, so we work them out ourselves:
// each ingredient is matched against a built-in table of common foods (values per
// 100 g, rounded from the USDA FoodData Central database), its amount is turned into
// grams ("2 tbsp", "1 lb", "400g can"...), and everything is added up. No account,
// key or internet connection is needed, and nothing is sent anywhere.
//
// The grade uses the Nutri-Score method found on food labels in Europe: points
// against for calories, sugar, saturated fat and salt, points for fiber, protein
// and vegetables/fruit/beans/nuts. We then knock it down a step each for processed
// meat, lots of added sugar, or a very big portion. It is an estimate, not medical advice.
import { Recipe } from '../types';

export type Grade = 'A' | 'B' | 'C' | 'D' | 'E';

export type NutritionFacts = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  satFat: number;
  sugar: number;
  fiber: number;
  /** Milligrams. */
  sodium: number;
};

export type Highlight = { good: boolean; text: string };

export type NutritionEstimate = {
  /** Per serving, rounded. */
  perServing: NutritionFacts;
  servings: number;
  grade: Grade;
  highlights: Highlight[];
  /** How many ingredients we recognized, out of how many. */
  matched: number;
  total: number;
  /** True when the numbers came from the recipe's own website. */
  fromSite: boolean;
};

export const GRADE_INFO: Record<Grade, { label: string; color: string; text: string }> = {
  A: { label: 'Great choice', color: '#1e8f4e', text: '#fff' },
  B: { label: 'Good choice', color: '#7ac143', text: '#fff' },
  C: { label: 'Okay', color: '#f4c20d', text: '#3a2f00' },
  D: { label: 'Now and then', color: '#ef8a22', text: '#fff' },
  E: { label: 'Treat meal', color: '#e0412c', text: '#fff' },
};

// ---- the food table ----

type Flag = 'veg' | 'seedOil' | 'addedSugar' | 'processedMeat' | 'liquid' | 'absorbs' | 'water' | 'spice';

type Food = {
  /** kcal, protein, carbs, fat, saturated fat, sugar, fiber (g) and sodium (mg), per 100 g. */
  n: [number, number, number, number, number, number, number, number];
  /** Grams in one "1 x" of it (one onion, one egg, one can...). */
  each?: number;
  /** Grams in one cup. Tablespoons and teaspoons are worked out from this. */
  cup?: number;
  flags?: Flag[];
};

// Keys are matched against the ingredient name; the longest matching key wins,
// so "red pepper flakes" beats "red pepper", which beats "pepper".
const FOODS: Record<string, Food> = {
  // Meat
  'chicken breast|chicken fillet': { n: [120, 22.5, 0, 2.6, 0.6, 0, 0, 45], each: 170 },
  'chicken thigh|chicken leg|drumstick|chicken wing': { n: [177, 19.7, 0, 10.9, 3, 0, 0, 85], each: 110 },
  // A whole bird, without the bones.
  chicken: { n: [215, 18.6, 0, 15, 4.3, 0, 0, 70], each: 1000 },
  'turkey mince|turkey': { n: [150, 19, 0, 8, 2.3, 0, 0, 70], each: 150 },
  duck: { n: [337, 19, 0, 28, 9.7, 0, 0, 63], each: 250 },
  'minced beef|beef mince|ground beef|mince': { n: [250, 17.4, 0, 20, 7.6, 0, 0, 66], cup: 225 },
  'lean minced beef|lean beef': { n: [176, 20, 0, 10, 4, 0, 0, 66], cup: 225 },
  'beef|steak|veal|oxtail': { n: [190, 20, 0, 12, 4.8, 0, 0, 60], each: 250 },
  'kidney|liver': { n: [110, 17, 1, 3.5, 1.1, 0, 0, 180], each: 100 },
  'minced pork|pork mince|ground pork': { n: [263, 17, 0, 21, 7.9, 0, 0, 56], cup: 225 },
  'pork belly': { n: [518, 9.3, 0, 53, 19, 0, 0, 32], each: 500 },
  'pork|gammon': { n: [242, 18, 0, 18, 6.5, 0, 0, 60], each: 200 },
  'lamb|lamb mince|minced lamb|mutton|goat': { n: [282, 17, 0, 23, 10, 0, 0, 65], each: 150 },
  bacon: { n: [417, 13, 1.4, 40, 13, 0, 0, 1700], each: 25, flags: ['processedMeat'] },
  'pancetta|lardons': { n: [450, 14, 0, 44, 15, 0, 0, 1700], flags: ['processedMeat'] },
  'ham|prosciutto|parma ham|salami|pepperoni': { n: [210, 22, 1, 13, 4.5, 0.5, 0, 1600], each: 15, flags: ['processedMeat'] },
  chorizo: { n: [455, 24, 2, 38, 14, 0, 0, 1200], each: 200, flags: ['processedMeat'] },
  'sausage|frankfurter|hot dog|doner meat': { n: [300, 13, 3, 26, 9, 1, 0, 800], each: 70, flags: ['processedMeat'] },
  'black pudding': { n: [300, 10, 20, 20, 8, 1, 0, 1000], each: 50, flags: ['processedMeat'] },

  // Fish and seafood
  salmon: { n: [208, 20, 0, 13, 3.1, 0, 0, 59], each: 150 },
  'white fish|cod|haddock|monkfish|hake|pollock|tilapia|sea bass|sole|plaice|halibut|snapper|trout|fish fillet': {
    n: [90, 19, 0, 1, 0.2, 0, 0, 60],
    each: 150,
  },
  'smoked haddock|smoked fish|smoked salmon': { n: [116, 23, 0, 2.5, 0.5, 0, 0, 1000], each: 150 },
  'salt cod': { n: [150, 30, 0, 1, 0.2, 0, 0, 1500], each: 150 },
  tuna: { n: [116, 26, 0, 1, 0.3, 0, 0, 250], each: 150 },
  'mackerel|sardine|pilchard|anchov|herring': { n: [205, 20, 0, 13, 3.3, 0, 0, 400], each: 120 },
  'prawn|shrimp|lobster|crab': { n: [85, 20, 0, 0.5, 0.1, 0, 0, 120], each: 15, cup: 150 },
  'mussel|clam|oyster|scallop|squid|calamari|octopus': { n: [86, 14, 3.5, 1.8, 0.4, 0, 0, 290], each: 15, cup: 150 },

  // Eggs and dairy
  'egg|eggs': { n: [143, 12.6, 0.7, 9.5, 3.1, 0.4, 0, 142], each: 50 },
  'egg yolk': { n: [322, 16, 3.6, 26.5, 9.5, 0.6, 0, 48], each: 17 },
  'egg white': { n: [52, 11, 0.7, 0.2, 0, 0.7, 0, 166], each: 33 },
  'milk|whole milk': { n: [61, 3.2, 4.8, 3.3, 1.9, 5, 0, 43], cup: 245, flags: ['liquid'] },
  'semi-skimmed milk|skimmed milk|skim milk|low fat milk': { n: [47, 3.4, 4.8, 1.7, 1.1, 4.8, 0, 44], cup: 245, flags: ['liquid'] },
  'soya milk|soy milk|almond milk|oat milk': { n: [45, 2.5, 4, 1.8, 0.2, 3, 0.4, 50], cup: 245, flags: ['liquid'] },
  'condensed milk': { n: [321, 8, 54, 8.7, 5.5, 54, 0, 127], cup: 306, flags: ['addedSugar'] },
  'evaporated milk': { n: [134, 6.8, 10, 7.6, 4.6, 10, 0, 106], cup: 252, flags: ['liquid'] },
  'butter|salted butter|chilled butter|unsalted butter|ghee': { n: [717, 0.9, 0.1, 81, 51, 0.1, 0, 500], each: 113, cup: 227 },
  'vegan butter|margarine': { n: [717, 0.2, 0.7, 80, 20, 0, 0, 700], cup: 227, flags: ['seedOil'] },
  'cream|double cream|heavy cream|whipping cream|clotted cream': { n: [340, 2.8, 2.7, 36, 23, 2.9, 0, 38], cup: 238, flags: ['liquid'] },
  'single cream|light cream|half and half': { n: [195, 2.7, 4, 19, 12, 4, 0, 40], cup: 240, flags: ['liquid'] },
  'sour cream|creme fraiche|crème fraîche|fromage frais': { n: [198, 2.4, 4.6, 19, 11, 3.4, 0, 31], cup: 230 },
  'greek yogurt|greek yoghurt': { n: [97, 9, 3.6, 5, 2.4, 3.6, 0, 35], cup: 245 },
  'yogurt|yoghurt|full fat yogurt|curd': { n: [61, 3.5, 4.7, 3.3, 2.1, 4.7, 0, 46], cup: 245 },
  'cheese|cheddar|monterey jack|colby|gouda|gruyère|gruyere|stilton|emmental|edam|jarlsberg|red leicester|cheese curds|halloumi':
    { n: [403, 25, 1.3, 33, 21, 0.5, 0, 650], each: 200, cup: 113 },
  'parmesan|parmigiano|pecorino|grana padano': { n: [431, 38, 4, 29, 19, 0.9, 0, 1600], cup: 100 },
  mozzarella: { n: [280, 22, 2.2, 20, 13, 1, 0, 630], each: 125, cup: 113 },
  feta: { n: [264, 14, 4, 21, 15, 4, 0, 1100], each: 200, cup: 150 },
  "goats cheese|goat's cheese|goat cheese|brie|camembert": { n: [350, 21, 0.5, 29, 19, 0.5, 0, 600], each: 150 },
  ricotta: { n: [174, 11, 3, 13, 8.3, 0.3, 0, 84], cup: 245 },
  mascarpone: { n: [429, 4.6, 4.8, 44, 30, 4, 0, 40], cup: 230 },
  'cream cheese': { n: [342, 6, 4, 34, 19, 3.2, 0, 320], cup: 230 },
  paneer: { n: [321, 21, 3.6, 25, 16, 2, 0, 30], each: 200 },
  tofu: { n: [76, 8, 1.9, 4.8, 0.7, 0.6, 0.3, 7], each: 400, flags: ['veg'] },

  // Grains, bread and pasta (dry weights; "absorbs" means it roughly
  // triples in weight once cooked, which matters for the serving count)
  'flour|plain flour|white flour|all purpose flour|self-raising flour|self raising flour|bread flour': {
    n: [364, 10, 76, 1, 0.2, 0.3, 2.7, 2],
    cup: 125,
  },
  'whole wheat|wholemeal flour|whole wheat flour': { n: [340, 13, 72, 2.5, 0.4, 0.4, 10.7, 2], cup: 120 },
  'cornstarch|corn flour|cornflour|potato starch|arrowroot': { n: [381, 0.3, 91, 0.1, 0, 0, 0.9, 9], cup: 128 },
  'rice|basmati|jasmine rice|arborio|risotto rice|sushi rice|long grain': {
    n: [360, 7, 79, 0.6, 0.2, 0.1, 1.3, 1],
    cup: 185,
    flags: ['absorbs'],
  },
  'brown rice|wild rice|mixed grain|quinoa|bulgur|barley|freekeh': {
    n: [370, 9, 74, 3, 0.6, 0.8, 5, 5],
    cup: 185,
    flags: ['absorbs'],
  },
  'pasta|spaghetti|penne|macaroni|farfalle|bowtie|tagliatelle|fettuccine|rigatoni|linguine|pappardelle|paccheri|lasagne|lasagna|fideo|vermicelli|orzo|fusilli|conchiglie|gnocchi':
    { n: [371, 13, 75, 1.5, 0.3, 2.7, 3.2, 6], cup: 100, each: 20, flags: ['absorbs'] },
  'noodles|rice noodles|udon|egg noodles|rice stick|ramen|soba': { n: [364, 7, 80, 1, 0.2, 0.5, 2, 150], each: 75, flags: ['absorbs'] },
  'couscous|khus khus': { n: [376, 12.8, 77, 0.6, 0.1, 0, 5, 10], cup: 175, flags: ['absorbs'] },
  'oats|rolled oats|oatmeal': { n: [389, 16.9, 66, 6.9, 1.2, 0, 10.6, 2], cup: 90, flags: ['absorbs'] },
  'bread|baguette|crusty bread|ciabatta|bread roll|bun|pitta|pita|wholegrain bread|sourdough': {
    n: [265, 9, 49, 3.2, 0.7, 5, 2.7, 490],
    each: 35,
  },
  'naan|naan bread': { n: [290, 9, 50, 6, 1.5, 3, 2, 460], each: 90 },
  'flour tortilla|tortilla|wrap': { n: [312, 8, 52, 8, 3, 2, 3.5, 620], each: 45 },
  'corn tortilla': { n: [218, 5.7, 45, 2.9, 0.4, 0.9, 6.3, 45], each: 26 },
  'taco shell|tostada|tortilla chips|nachos': { n: [470, 6, 62, 22, 4, 1, 5, 400], each: 13 },
  'breadcrumbs|panko': { n: [395, 13, 72, 5.3, 1.2, 6, 4.5, 730], cup: 110 },
  'puff pastry|shortcrust pastry|filo|pastry|pie crust': { n: [540, 7, 46, 36, 18, 1, 1.5, 300], each: 320 },
  'egg rolls|spring roll wrappers|wonton': { n: [290, 10, 58, 1.5, 0.3, 1, 2, 560], each: 15 },
  'fries|chips|crisps': { n: [312, 3.4, 41, 15, 2.3, 0.3, 3.8, 210], cup: 120, flags: ['seedOil'] },

  // Beans and lentils (canned weights unless they're dry lentils)
  'lentils|red lentils|green lentils|brown lentils|french lentils|toor dal|dal|split peas|green red lentils': {
    n: [352, 24.6, 63, 1.1, 0.2, 2, 10.7, 6],
    cup: 190,
    flags: ['veg', 'absorbs'],
  },
  'chickpeas|garbanzo': { n: [139, 7, 23, 2.6, 0.3, 4, 7, 240], each: 240, cup: 165, flags: ['veg'] },
  'beans|kidney beans|cannellini|borlotti|haricot|butter beans|pinto|black beans|black-eyed|edamame|broad beans|flageolet': {
    n: [110, 7.5, 20, 0.5, 0.1, 0.3, 6, 250],
    each: 240,
    cup: 175,
    flags: ['veg'],
  },
  'refried beans': { n: [91, 5.4, 15, 1.2, 0.4, 0.4, 5, 450], each: 450, cup: 240, flags: ['veg'] },
  'baked beans': { n: [94, 4.8, 17, 0.4, 0.1, 6, 4, 400], each: 415, cup: 250, flags: ['veg'] },

  // Vegetables
  'potato|potatoes|floury potatoes|charlotte potatoes|small potatoes|new potatoes|maris piper|king edward|yukon': {
    n: [77, 2, 17, 0.1, 0, 0.8, 2.2, 6],
    each: 170,
    cup: 150,
  },
  'sweet potato': { n: [86, 1.6, 20, 0.1, 0, 4.2, 3, 55], each: 130, cup: 135, flags: ['veg'] },
  'onion|onions|red onion|chopped onion|white onion|yellow onion|brown onion': {
    n: [40, 1.1, 9.3, 0.1, 0, 4.2, 1.7, 4],
    each: 150,
    cup: 160,
    flags: ['veg'],
  },
  'shallot|shallots|challots|spring onion|scallion|green onion': { n: [40, 1.5, 9, 0.1, 0, 4, 2, 10], each: 25, cup: 100, flags: ['veg'] },
  leek: { n: [61, 1.5, 14, 0.3, 0, 3.9, 1.8, 20], each: 200, cup: 90, flags: ['veg'] },
  'garlic|garlic clove|minced garlic': { n: [149, 6.4, 33, 0.5, 0.1, 1, 2.1, 17], each: 5, cup: 136, flags: ['veg'] },
  'ginger|ginger paste|ginger garlic paste|galangal|lemongrass': { n: [80, 1.8, 18, 0.8, 0.2, 1.7, 2, 13], each: 15, cup: 96, flags: ['veg'] },
  'tomato|tomatoes|plum tomatoes|cherry tomatoes|grape tomatoes|vine tomatoes|baby plum tomatoes': {
    n: [18, 0.9, 3.9, 0.2, 0, 2.6, 1.2, 5],
    each: 120,
    cup: 180,
    flags: ['veg'],
  },
  'cherry tomato|grape tomato|baby plum': { n: [18, 0.9, 3.9, 0.2, 0, 2.6, 1.2, 5], each: 15, cup: 150, flags: ['veg'] },
  'canned tomatoes|chopped tomatoes|tinned tomatoes|tinned tomatos|diced tomatoes|crushed tomatoes|passata|tomato sauce|marinara':
    { n: [28, 1.3, 5, 0.2, 0, 3.5, 1.5, 200], each: 400, cup: 245, flags: ['veg'] },
  'tomato puree|tomato paste|sun-dried tomatoes|sun dried tomatoes': { n: [82, 4.3, 19, 0.5, 0.1, 12, 4, 60], each: 15, cup: 260, flags: ['veg'] },
  'carrot|carrots': { n: [41, 0.9, 9.6, 0.2, 0, 4.7, 2.8, 69], each: 60, cup: 128, flags: ['veg'] },
  celery: { n: [16, 0.7, 3, 0.2, 0, 1.3, 1.6, 80], each: 40, cup: 100, flags: ['veg'] },
  'red pepper|green pepper|yellow pepper|orange pepper|bell pepper|capsicum|sweet pepper|peppers': {
    n: [31, 1, 6, 0.3, 0, 4.2, 2.1, 4],
    each: 150,
    cup: 150,
    flags: ['veg'],
  },
  'chilli|chili|chillies|jalapeno|jalapeño|green chilli|red chilli|scotch bonnet|serrano|bird': {
    n: [40, 1.9, 8.8, 0.4, 0, 5, 1.5, 9],
    each: 15,
    cup: 100,
    flags: ['veg'],
  },
  'mushroom|mushrooms|chestnut mushroom|shiitake|wild mushrooms|portobello|button mushrooms': {
    n: [22, 3.1, 3.3, 0.3, 0, 2, 1, 5],
    each: 18,
    cup: 70,
    flags: ['veg'],
  },
  'spinach|kale|lettuce|rocket|arugula|chard|watercress|little gem|pak choi|bok choy|chinese broccoli|vine leaves|greens|collard':
    { n: [23, 2.9, 3.6, 0.4, 0, 0.4, 2.2, 79], each: 250, cup: 30, flags: ['veg'] },
  'cabbage|red cabbage|savoy': { n: [25, 1.3, 5.8, 0.1, 0, 3.2, 2.5, 18], each: 900, cup: 90, flags: ['veg'] },
  'broccoli|cauliflower|brussels sprouts|green beans|runner beans|asparagus|sugar snap|mangetout|snow peas|okra|beansprouts|bean sprouts|artichoke|jerusalem artichokes':
    { n: [32, 2.6, 6, 0.3, 0.1, 1.8, 2.6, 20], each: 300, cup: 90, flags: ['veg'] },
  'zucchini|courgette|courgettes|aubergine|eggplant|egg plants|cucumber|fennel|fennel bulb|radish': {
    n: [19, 1, 4, 0.2, 0, 2.5, 1.3, 6],
    each: 250,
    cup: 120,
    flags: ['veg'],
  },
  'squash|butternut|pumpkin': { n: [45, 1, 12, 0.1, 0, 2.2, 2, 4], each: 1000, cup: 140, flags: ['veg'] },
  'celeriac|turnip|turnips|swede|parsnip|beetroot|beet|rutabaga': { n: [42, 1.4, 9, 0.3, 0, 4, 2.8, 50], each: 300, cup: 140, flags: ['veg'] },
  'peas|frozen peas|petit pois': { n: [81, 5.4, 14, 0.4, 0.1, 5.7, 5.1, 5], cup: 145, flags: ['veg'] },
  'sweetcorn|corn|creamed corn|corn on the cob': { n: [86, 3.3, 19, 1.4, 0.3, 6, 2, 15], each: 150, cup: 165, flags: ['veg'] },
  'stir-fry vegetables|mixed vegetables|roasted vegetables|frozen vegetables': { n: [35, 2, 6, 0.3, 0, 3, 2.5, 30], each: 300, cup: 120, flags: ['veg'] },
  avocado: { n: [160, 2, 8.5, 14.7, 2.1, 0.7, 6.7, 7], each: 150, cup: 150, flags: ['veg'] },
  'olives|green olives|black olives|pitted black olives|kalamata': { n: [115, 0.8, 6, 11, 1.4, 0, 3.2, 735], each: 4, cup: 135, flags: ['veg'] },
  capers: { n: [23, 2.4, 4.9, 0.9, 0.2, 0.4, 3.2, 2350], cup: 135, flags: ['veg'] },

  // Fruit, nuts and seeds
  'lemon|lime|lemons|limes': { n: [29, 1.1, 9, 0.3, 0, 2.5, 2.8, 2], each: 60, flags: ['veg'] },
  'lemon juice|lime juice|orange juice': { n: [22, 0.4, 6.9, 0.2, 0, 2.5, 0.3, 1], cup: 245, flags: ['veg', 'liquid'] },
  'zest|lemon zest|orange zest|lime zest': { n: [47, 1.5, 16, 0.3, 0, 4.2, 10.6, 6], each: 2, cup: 96, flags: ['veg'] },
  'apple|apples|bramley|braeburn|pear|pears|orange|peach|peaches|plum|nectarine|mango|pineapple|banana|apricot': {
    n: [60, 0.6, 15, 0.2, 0, 11, 2.2, 1],
    each: 160,
    cup: 150,
    flags: ['veg'],
  },
  'berries|strawberries|raspberries|blueberries|blackberries|redcurrants|cherry|cherries|grapes|pomegranate|cranberries': {
    n: [50, 0.8, 12, 0.3, 0, 7, 3, 1],
    each: 10,
    cup: 145,
    flags: ['veg'],
  },
  'raisins|sultanas|currants|dried apricots|dates|medjool dates|prunes|dried fruit|dried cranberries|figs|mixed peel': {
    n: [300, 3, 75, 0.5, 0, 60, 6, 10],
    each: 15,
    cup: 160,
    flags: ['veg'],
  },
  'almonds|ground almonds|flaked almonds|cashew|cashews|cashew nuts|peanuts|walnuts|pine nuts|pecan|pecans|hazelnuts|hazlenuts|pistachio|macadamia|chestnuts|nuts':
    { n: [600, 20, 20, 52, 6, 4, 8, 5], cup: 140, flags: ['veg'] },
  'peanut butter|almond butter': { n: [588, 25, 20, 50, 10, 9, 6, 430], cup: 258, flags: ['veg'] },
  'sesame seed|sesame seeds|sunflower seeds|pumpkin seeds|chia|flax|flax eggs|linseed': { n: [570, 20, 22, 48, 6, 1, 12, 10], cup: 145, flags: ['veg'] },
  'tahini': { n: [595, 17, 21, 54, 7.5, 0.5, 9, 115], cup: 240, flags: ['veg'] },
  'desiccated coconut|coconut flakes|shredded coconut': { n: [660, 7, 24, 65, 57, 7, 16, 37], cup: 85 },
  'coconut milk': { n: [197, 2, 2.8, 21, 18.9, 2.8, 0, 13], each: 400, cup: 240, flags: ['liquid'] },
  'coconut cream': { n: [330, 3.6, 6.6, 34.7, 30.8, 3.3, 2.2, 4], each: 400, cup: 240 },

  // Oils and fats. Olive oil counts towards the "good" side in the Nutri-Score;
  // the others are seed oils, which a lot of families (and the Olive app) avoid.
  'olive oil|extra virgin olive oil|light olive oil|truffle oil|avocado oil': { n: [884, 0, 0, 100, 14, 0, 0, 2], cup: 216, flags: ['veg'] },
  'oil|vegetable oil|sunflower oil|canola oil|rapeseed oil|corn oil|peanut oil|groundnut oil|sesame oil|sesame seed oil|soybean oil|cooking oil|frying oil|grapeseed oil':
    { n: [884, 0, 0, 100, 10, 0, 0, 0], cup: 218, flags: ['seedOil'] },
  'coconut oil': { n: [862, 0, 0, 100, 87, 0, 0, 0], cup: 218 },
  'lard|suet|goose fat|duck fat|dripping|beef fat|tallow': { n: [900, 0, 0, 100, 40, 0, 0, 0], cup: 205 },
  'mayonnaise|mayo|salad cream|aioli|garlic sauce': { n: [680, 1, 0.6, 75, 11.7, 0.6, 0, 635], cup: 220, flags: ['seedOil'] },
  'vinaigrette|salad dressing|vinaigrette dressing': { n: [450, 0.2, 9, 45, 7, 8, 0, 800], cup: 240, flags: ['seedOil'] },

  // Sugars and sweet things
  'sugar|caster sugar|granulated sugar|brown sugar|light brown soft sugar|dark brown sugar|dark brown soft sugar|dark soft brown sugar|demerara|muscovado|icing sugar|powdered sugar|coco sugar|jaggery|palm sugar':
    { n: [387, 0, 100, 0, 0, 100, 0, 1], cup: 200, flags: ['addedSugar'] },
  'honey|maple syrup|golden syrup|treacle|black treacle|molasses|agave|corn syrup|syrup': {
    n: [304, 0.3, 80, 0, 0, 78, 0.2, 10],
    cup: 340,
    flags: ['addedSugar'],
  },
  'jam|raspberry jam|apricot jam|marmalade|jelly|red wine jelly|redcurrant jelly|chutney|mango chutney': {
    n: [260, 0.4, 66, 0.1, 0, 50, 1, 30],
    cup: 320,
    flags: ['addedSugar'],
  },
  'chocolate|dark chocolate|milk chocolate|plain chocolate|white chocolate|chocolate chips|dark chocolate chips|white chocolate chips': {
    n: [546, 4.9, 61, 31, 19, 48, 7, 24],
    cup: 170,
    flags: ['addedSugar'],
  },
  'cocoa|cacao|cocoa powder': { n: [228, 20, 58, 14, 8, 1.8, 37, 21], cup: 86 },
  'marshmallows|miniature marshmallows|caramel|caramel sauce|toffee|custard|ice cream|meringue|marzipan|digestive biscuits|biscuits|cookies|christmas pudding':
    { n: [400, 3, 70, 12, 7, 50, 1, 150], cup: 150, each: 30, flags: ['addedSugar'] },

  // Sauces, stocks and condiments
  'stock|broth|chicken stock|beef stock|vegetable stock|fish stock|hot beef stock|bone broth|dashi': {
    n: [7, 0.6, 0.6, 0.2, 0.1, 0.3, 0, 340],
    cup: 240,
    flags: ['liquid'],
  },
  'stock cube|bouillon|stock pot|oxo|gravy granules': { n: [250, 10, 20, 15, 7, 5, 0, 20000], each: 10, cup: 150 },
  'gravy|beef gravy': { n: [50, 1.5, 5, 2.5, 1, 0.5, 0, 600], cup: 240, flags: ['liquid'] },
  'soy sauce|dark soy sauce|light soy sauce|tamari|kecap manis': { n: [53, 8, 4.9, 0.6, 0.1, 0.4, 0.8, 5500], cup: 255, flags: ['liquid'] },
  'fish sauce|thai fish sauce|nam pla': { n: [35, 5, 3.6, 0, 0, 3.6, 0, 7850], cup: 290, flags: ['liquid'] },
  'oyster sauce': { n: [51, 1.4, 11, 0.3, 0, 0, 0.3, 2700], cup: 290 },
  'hoisin|teriyaki|sweet chilli sauce|sweet chili sauce|plum sauce': { n: [220, 3, 45, 3, 0.5, 30, 2, 1600], cup: 290, flags: ['addedSugar'] },
  'worcestershire|worcestershire sauce': { n: [78, 0, 19, 0, 0, 10, 0, 980], cup: 275, flags: ['liquid'] },
  'ketchup|tomato ketchup|barbeque sauce|barbecue sauce|bbq sauce|brown sauce': {
    n: [130, 1, 31, 0.2, 0, 26, 0.5, 950],
    cup: 270,
    flags: ['addedSugar'],
  },
  'hotsauce|hot sauce|tabasco|tabasco sauce|sriracha|harissa|chilli sauce|chili sauce': { n: [40, 1, 6, 1, 0.1, 3, 1, 2500], cup: 260 },
  'salsa|green salsa|enchilada sauce|pico de gallo': { n: [36, 1.5, 7, 0.5, 0, 4, 1.8, 600], cup: 260, flags: ['veg'] },
  'mustard|dijon|dijon mustard|english mustard|wholegrain mustard|yellow mustard|horseradish': { n: [66, 4, 5.8, 4, 0.2, 0.9, 3.3, 1100], cup: 250 },
  'vinegar|white vinegar|wine vinegar|red wine vinegar|white wine vinegar|rice vinegar|apple cider vinegar|cider vinegar|malt vinegar': {
    n: [20, 0, 1, 0, 0, 0.4, 0, 2],
    cup: 240,
    flags: ['liquid'],
  },
  'balsamic|balsamic vinegar': { n: [88, 0.5, 17, 0, 0, 15, 0, 23], cup: 255, flags: ['liquid'] },
  'curry paste|thai red curry paste|thai green curry paste|massaman curry paste|madras paste|tikka paste|korma paste|miso|gochujang|tamarind|tamarind paste|tamarind ball|pesto':
    { n: [150, 3, 15, 8, 1.5, 5, 3, 2500], each: 50, cup: 250 },
  'wine|red wine|white wine|dry white wine|sherry|port|marsala|sake|mirin|brandy|rum|stout|beer|ale|cider|cognac|vodka': {
    n: [85, 0.1, 4, 0, 0, 1, 0, 5],
    cup: 240,
    flags: ['liquid'],
  },
  'water|cold water|ice|boiling water|hot water|warm water': { n: [0, 0, 0, 0, 0, 0, 0, 0], cup: 240, flags: ['water'] },

  // Salt, herbs and spices
  'salt|sea salt|kosher salt|table salt|celery salt|onion salt|garlic salt|rock salt|flaky salt': { n: [0, 0, 0, 0, 0, 0, 0, 38700], cup: 290, flags: ['spice'] },
  'seasoning|fajita seasoning|cajun|taco seasoning|italian seasoning|jerk seasoning|stock powder': {
    n: [300, 8, 55, 6, 1, 10, 15, 5000],
    each: 30,
    cup: 100,
    flags: ['spice'],
  },
  'baking powder|bicarbonate|bicarbonate of soda|baking soda': { n: [53, 0, 28, 0, 0, 0, 0, 10600], cup: 230, flags: ['spice'] },
  'pepper|black pepper|white pepper|peppercorns|cumin|cumin seeds|ground cumin|paprika|smoked paprika|smoky paprika|turmeric|turmeric powder|cinnamon|cinnamon stick|cloves|cardamom|nutmeg|mace|allspice|garam masala|curry powder|chilli powder|chili powder|red chilli powder|cayenne|cayenne pepper|red pepper flakes|red chilli flakes|chilli flakes|chili flakes|saffron|fenugreek|star anise|fennel seeds|mustard seeds|mustard powder|coriander seeds|ground coriander|five spice|ground ginger|garlic powder|onion powder|biryani masala|ras el hanout|za\'atar|sumac|harissa spice|asafoetida|caraway|nigella|vanilla|vanilla extract|yeast|gelatine|food colouring|red food colouring|bouquet garni|bay leaf|bay leaves|dried oregano|dried thyme|dried basil|dried herbs|mixed herbs':
    { n: [280, 11, 55, 7, 1.5, 3, 30, 60], each: 3, cup: 100, flags: ['spice'] },
  'basil|basil leaves|fresh basil|parsley|chopped parsley|freshly chopped parsley|flat leaf parsley|coriander|cilantro|coriander leaves|mint|dill|thyme|fresh thyme|rosemary|sage|oregano|chives|tarragon|tarragon leaves|marjoram|curry leaves|lemon balm|herbs':
    { n: [40, 3, 7, 0.6, 0.1, 1, 4, 30], each: 2, cup: 20, flags: ['veg'] },
};

type Entry = { key: string; food: Food };

// Every alias, longest first, so the most specific name wins.
const ENTRIES: Entry[] = Object.entries(FOODS)
  .flatMap(([keys, food]) => keys.split('|').map((key) => ({ key, food })))
  .sort((a, b) => b.key.length - a.key.length);

const SINGULAR_END = /(es|s)$/;

function findFood(name: string): Food | null {
  const n = ` ${name.toLowerCase().replace(/[^a-zà-ÿ' -]/g, ' ').replace(/\s+/g, ' ').trim()} `;
  for (const { key, food } of ENTRIES) {
    if (n.includes(` ${key} `) || n.includes(` ${key}s `) || n.includes(` ${key.replace(SINGULAR_END, '')} `)) return food;
  }
  // Words like "chillies" or "prawns" that only match the start of a key.
  for (const { key, food } of ENTRIES) {
    if (key.length >= 5 && n.includes(` ${key}`)) return food;
  }
  return null;
}

// ---- amounts ----

const FRACTIONS: Record<string, number> = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅛': 0.125 };

/** "1 1/2", "½", "1.5", "2-3" (we take the middle) → a number, or null. */
function parseQuantity(text: string): number | null {
  const s = text.replace(/[½⅓⅔¼¾⅛]/g, (f) => ` ${FRACTIONS[f]} `).trim();
  let m = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)/); // 1 1/2
  if (m && Number(m[3])) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = s.match(/^(\d+)\s*\/\s*(\d+)/); // 1/2
  if (m && Number(m[2])) return Number(m[1]) / Number(m[2]);
  m = s.match(/^(\d+)\s+(0\.\d+)/); // 1½
  if (m) return Number(m[1]) + Number(m[2]);
  m = s.match(/^(\d*\.?\d+)(?:\s*(?:-|–|to)\s*(\d*\.?\d+))?/); // 2, 1.5, 2-3
  if (!m) return null;
  const q = m[2] ? (Number(m[1]) + Number(m[2])) / 2 : Number(m[1]);
  return q > 0 ? q : null;
}

type Unit = { re: RegExp; grams: (f: Food) => number };

// Order matters: longer and more specific names first.
const UNITS: Unit[] = [
  { re: /^(kg|kilo|kilograms?)\b/, grams: () => 1000 },
  { re: /^(mg)\b/, grams: () => 0.001 },
  { re: /^(g|gr|grams?|gms?)\b/, grams: () => 1 },
  { re: /^(ml|millilit(re|er)s?)\b/, grams: () => 1 },
  { re: /^(cl)\b/, grams: () => 10 },
  { re: /^(dl)\b/, grams: () => 100 },
  { re: /^(l|lit(re|er)s?|ltr)\b/, grams: () => 1000 },
  { re: /^(lbs?|pounds?)\b/, grams: () => 453.6 },
  { re: /^(oz|ounces?)\b/, grams: () => 28.35 },
  { re: /^(pints?|pt)\b/, grams: () => 500 },
  { re: /^(quarts?|qt)\b/, grams: () => 946 },
  { re: /^(cups?|c)\b/, grams: (f) => f.cup ?? 200 },
  { re: /^(tablespoons?|tbsps?|tbls?p?s?|tbs|tbl|tb)\b/, grams: (f) => (f.cup ?? 200) / 16 },
  { re: /^(teaspoons?|tsps?|tspn|tea spoons?)\b/, grams: (f) => (f.cup ?? 200) / 48 },
  { re: /^(pinch(es)?)\b/, grams: () => 0.4 },
  { re: /^(dash(es)?|splash(es)?|drizzle|sprinkl\w*)\b/, grams: () => 3 },
  { re: /^(handfuls?)\b/, grams: () => 30 },
  { re: /^(bunch(es)?)\b/, grams: () => 30 },
  { re: /^(sprigs?|leaves?)\b/, grams: () => 1 },
  { re: /^(knobs?)\b/, grams: () => 15 },
  { re: /^(sticks?)\b/, grams: (f) => (f.cup === 227 ? 113 : (f.each ?? 40)) },
  { re: /^(cloves?)\b/, grams: () => 5 },
  { re: /^(heads?)\b/, grams: (f) => (f.each === 5 ? 40 : (f.each ?? 300)) },
  { re: /^(cans?|tins?)\b/, grams: () => 400 },
  { re: /^(jars?)\b/, grams: () => 350 },
  { re: /^(packets?|packs?|packages?|bags?|blocks?)\b/, grams: (f) => f.each ?? 250 },
  { re: /^(slices?|rashers?|strips?)\b/, grams: (f) => (f.flags?.includes('processedMeat') ? 25 : 30) },
  { re: /^(fillets?|breasts?|thighs?|legs?|chops?|steaks?)\b/, grams: (f) => f.each ?? 150 },
];

const SIZE: [RegExp, number][] = [
  [/\b(small)\b/, 0.7],
  [/\b(large|big)\b/, 1.4],
  [/\b(x-?large|extra large|jumbo)\b/, 1.7],
];

/** Grams of an ingredient, or null if the measure is just "to taste" or "to serve". */
export function gramsFor(measure: string, food: Food): number | null {
  const m = measure.toLowerCase().trim();
  // "175g/6oz" or "1 can (400g)": an explicit weight wins.
  const weight = m.match(/(\d+(?:\.\d+)?)\s*(kg|g|gr|grams?|ml|l|lb|lbs|oz)\b/);
  const q = parseQuantity(m);
  const rest = m.replace(/^[\d\s./½⅓⅔¼¾⅛–-]+/, '').replace(/^(heaped|level|rounded|generous|scant|large|small|medium|x)\s+/g, '').trim();

  const unit = UNITS.find((u) => u.re.test(rest));
  if (unit && (q !== null || !weight)) {
    // "2 x 400g cans" → 800g
    if (weight && /^(cans?|tins?|packets?|packs?|jars?)\b/.test(rest)) return (q ?? 1) * gramsFor(weight[0], food)!;
    return (q ?? 1) * unit.grams(food);
  }
  if (weight) {
    const w = UNITS.find((u) => u.re.test(weight[2]))!;
    return Number(weight[1]) * w.grams(food);
  }
  const size = SIZE.find(([re]) => re.test(m))?.[1] ?? 1;
  // "5 chicken" means five pieces, not five whole birds.
  if (q !== null) return q * (q > 1 && (food.each ?? 0) >= 800 ? 200 : (food.each ?? 100)) * size;
  if (/to (taste|serve)|garnish|for (serving|frying|greasing|dusting)|optional|top|as needed|some/.test(m)) {
    return food.flags?.includes('spice') ? 1 : food.each && food.each <= 15 ? food.each : 0;
  }
  // No amount at all: assume one of it, or a teaspoon of seasonings.
  if (food.flags?.includes('spice')) return 2;
  return (food.each ?? 30) * size;
}

// ---- adding it up ----

const ZERO: NutritionFacts = { calories: 0, protein: 0, carbs: 0, fat: 0, satFat: 0, sugar: 0, fiber: 0, sodium: 0 };
const KEYS = Object.keys(ZERO) as (keyof NutritionFacts)[];

/** Each serving of a home-cooked dinner weighs about this much. */
const SERVING_GRAMS = 400;

const cache = new WeakMap<Recipe, NutritionEstimate>();

/** Nutrition per serving and a health grade, estimated from the ingredients. */
export function estimateNutrition(recipe: Recipe): NutritionEstimate {
  const hit = cache.get(recipe);
  if (hit) return hit;

  const total = { ...ZERO };
  let dishGrams = 0;
  let goodGrams = 0;
  let matched = 0;
  const seedOils: string[] = [];
  const processed: string[] = [];
  let addedSugar = 0;

  for (const ing of recipe.ingredients) {
    const food = findFood(ing.name);
    if (!food) continue;
    matched++;
    const grams = gramsFor(ing.measure, food);
    if (!grams) continue;
    const flags = food.flags ?? [];
    food.n.forEach((v, i) => (total[KEYS[i]] += (v * grams) / 100));
    if (!flags.includes('water')) {
      const cooked = flags.includes('absorbs') ? grams * 2.5 : grams;
      dishGrams += cooked;
      if (flags.includes('veg')) goodGrams += cooked;
    }
    if (flags.includes('seedOil')) seedOils.push(ing.name.toLowerCase());
    if (flags.includes('processedMeat')) processed.push(ing.name.toLowerCase());
    if (flags.includes('addedSugar')) addedSugar += (food.n[5] * grams) / 100;
  }

  const servings = recipe.servings ?? Math.min(8, Math.max(2, Math.round(dishGrams / SERVING_GRAMS)));
  const perServing = { ...ZERO };
  for (const k of KEYS) perServing[k] = Math.round(total[k] / servings);

  // The site's own nutrition label, when an imported recipe has one, beats our estimate.
  const site = recipe.siteNutrition;
  if (site) for (const k of KEYS) if (site[k] != null) perServing[k] = Math.round(site[k]!);

  const sugarPer = addedSugar / servings;
  // The Nutri-Score, one step lower for each thing it doesn't count but families care about.
  const steps = Number(processed.length > 0) + Number(sugarPer >= 10) + Number(perServing.calories >= 750);
  const grade = GRADES[Math.min(4, GRADES.indexOf(nutriScore(total, dishGrams, goodGrams)) + steps)];
  const highlights: Highlight[] = [];
  const goodShare = dishGrams ? goodGrams / dishGrams : 0;
  if (goodShare >= 0.4) highlights.push({ good: true, text: 'Packed with vegetables, beans or fruit' });
  if (perServing.protein >= 25) highlights.push({ good: true, text: `High in protein (${perServing.protein} g per serving)` });
  if (perServing.fiber >= 6) highlights.push({ good: true, text: `Good source of fiber (${perServing.fiber} g per serving)` });
  if (seedOils.length) highlights.push({ good: false, text: `Uses seed oil (${unique(seedOils)}). Olive oil or butter works instead.` });
  if (processed.length) highlights.push({ good: false, text: `Contains processed meat (${unique(processed)})` });
  if (sugarPer >= 6) highlights.push({ good: false, text: `Added sugar (about ${Math.round(sugarPer)} g per serving)` });
  if (perServing.sodium >= 1200) highlights.push({ good: false, text: `Salty (about ${perServing.sodium} mg sodium per serving)` });
  if (perServing.satFat >= 12) highlights.push({ good: false, text: `High in saturated fat (${perServing.satFat} g per serving)` });

  const result: NutritionEstimate = {
    perServing,
    servings,
    grade,
    highlights,
    matched,
    total: recipe.ingredients.length,
    fromSite: !!site,
  };
  cache.set(recipe, result);
  return result;
}

const GRADES: Grade[] = ['A', 'B', 'C', 'D', 'E'];

function unique(items: string[]): string {
  return [...new Set(items)].slice(0, 3).join(', ');
}

/** Points from 0 up to thresholds.length: one point for each threshold passed. */
function points(value: number, thresholds: number[]): number {
  return thresholds.filter((t) => value > t).length;
}

/** The Nutri-Score grade for the whole dish, worked out per 100 g. */
function nutriScore(total: NutritionFacts, grams: number, goodGrams: number): Grade {
  if (grams <= 0) return 'C';
  const per = (v: number) => (v * 100) / grams;
  const kj = per(total.calories) * 4.184;
  const bad =
    points(kj, [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350]) +
    points(per(total.sugar), [4.5, 9, 13.5, 18, 22.5, 27, 31, 36, 40, 45]) +
    points(per(total.satFat), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) +
    points(per(total.sodium), [90, 180, 270, 360, 450, 540, 630, 720, 810, 900]);
  const share = (goodGrams / grams) * 100;
  const veg = share > 80 ? 5 : share > 60 ? 2 : share > 40 ? 1 : 0;
  const fiber = points(per(total.fiber), [0.9, 1.9, 2.8, 3.7, 4.7]);
  const protein = points(per(total.protein), [1.6, 3.2, 4.8, 6.4, 8.0]);
  const score = bad >= 11 && veg < 5 ? bad - veg - fiber : bad - veg - fiber - protein;
  if (score <= -1) return 'A';
  if (score <= 2) return 'B';
  if (score <= 10) return 'C';
  if (score <= 18) return 'D';
  return 'E';
}
