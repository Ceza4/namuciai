// Store sections in walking order, with keyword guesses (English and Lithuanian stems).
// Shared by the app and the Siri endpoint.
export const AISLES = [
  { id: 'produce', en: 'Fruit & veg', lt: 'Vaisiai ir daržovės', words: ['banana', 'apple', 'tomato', 'potato', 'onion', 'cucumber', 'lemon', 'lime', 'salad', 'lettuce', 'carrot', 'garlic', 'pepper', 'avocado', 'berries', 'grape', 'orange', 'herb', 'dill', 'mushroom', 'banan', 'obuol', 'pomidor', 'bulv', 'svogūn', 'agurk', 'citrin', 'salot', 'mork', 'česnak', 'paprik', 'avokad', 'uog', 'vynuog', 'apelsin', 'krap', 'grybai', 'pievagryb'] },
  { id: 'bakery', en: 'Bakery', lt: 'Duona', words: ['bread', 'bun', 'baguette', 'croissant', 'tortilla', 'pita', 'duon', 'baton', 'bandel', 'ragel', 'lavaš'] },
  { id: 'dairy', en: 'Dairy & eggs', lt: 'Pieno produktai', words: ['milk', 'cheese', 'butter', 'yogurt', 'yoghurt', 'cream', 'egg', 'kefir', 'curd', 'mozzarella', 'parmesan', 'pien', 'sūr', 'sviest', 'jogurt', 'grietin', 'kiauši', 'varšk', 'kefyr', 'pasukos'] },
  { id: 'meat', en: 'Meat & fish', lt: 'Mėsa ir žuvis', words: ['chicken', 'beef', 'pork', 'fish', 'salmon', 'mince', 'ham', 'steak', 'sausage', 'bacon', 'tuna', 'shrimp', 'turkey', 'višt', 'jautien', 'kiaul', 'žuv', 'lašiš', 'dešr', 'kump', 'farš', 'šonin', 'krevet', 'kalakut', 'tunas', 'kepsn'] },
  { id: 'frozen', en: 'Frozen', lt: 'Šaldyti', words: ['frozen', 'ice cream', 'ledai', 'šaldyt', 'koldūn'] },
  { id: 'pantry', en: 'Pantry', lt: 'Bakalėja', words: ['rice', 'pasta', 'spaghetti', 'noodle', 'flour', 'sugar', 'salt', 'oil', 'coffee', 'tea', 'cereal', 'oat', 'beans', 'sauce', 'ketchup', 'mayo', 'honey', 'jam', 'spice', 'chocolate', 'snack', 'chips', 'ryž', 'makaron', 'milt', 'cukr', 'drusk', 'aliej', 'kav', 'arbat', 'dribsn', 'pupel', 'padaž', 'kečup', 'majonez', 'medus', 'uogien', 'prieskon', 'šokolad', 'traškuč'] },
  { id: 'drinks', en: 'Drinks', lt: 'Gėrimai', words: ['water', 'orange juice', 'juice', 'beer', 'wine', 'cola', 'soda', 'lemonade', 'kombucha', 'vanden', 'sult', 'alus', 'alaus', 'vyn', 'gaivus', 'limonad', 'gira'] },
  { id: 'household', en: 'Household', lt: 'Buitis', words: ['soap', 'toilet', 'paper towel', 'detergent', 'sponge', 'trash bag', 'bin bag', 'shampoo', 'toothpaste', 'tissue', 'foil', 'battery', 'bulb', 'muil', 'tualet', 'plovikl', 'kempin', 'šiukšl', 'šampūn', 'dantų', 'servetėl', 'folij', 'baterij', 'lemput', 'skalbim'] },
  { id: 'other', en: 'Other', lt: 'Kita', words: [] },
];
export const AISLE_ORDER = AISLES.map((a) => a.id);
export function guessAisle(title) {
  const t = String(title || '').toLowerCase();
  let best = 'other', len = 0;
  for (const a of AISLES) for (const w of a.words) if (w.length > len && t.includes(w)) { best = a.id; len = w.length; }
  return best;
}
