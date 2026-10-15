// Ready-made idea packs. Each entry: [english, lithuanian, english ingredients, lithuanian ingredients]
export const PACKS = {
  meal: [
    { id: 'takeaway', en: 'Takeaway and fast food', lt: 'Išsinešti ir greitas maistas', items: [
      ["McDonald's", "McDonald's"], ['Hesburger', 'Hesburger'], ['Čili Pizza', 'Čili Pizza'], ['KFC', 'KFC'],
      ['Kebab', 'Kebabas'], ['Sushi takeaway', 'Sušiai į namus'], ['Thai takeaway', 'Tailandietiškas maistas'],
      ['Pizza delivery', 'Pica į namus'], ['Try something new on Wolt', 'Kažkas naujo iš Wolt'], ['Burger place in town', 'Burgerinė mieste'],
    ] },
    { id: 'recipes', en: 'Quick recipes', lt: 'Greiti receptai', items: [
      ['Pasta carbonara', 'Karbonara', ['Spaghetti', 'Eggs', 'Parmesan', 'Bacon'], ['Spagečiai', 'Kiaušiniai', 'Parmezanas', 'Šoninė']],
      ['Chicken curry', 'Vištienos karis', ['Chicken breast', 'Curry paste', 'Coconut milk', 'Rice', 'Onion'], ['Vištienos krūtinėlė', 'Kario pasta', 'Kokosų pienas', 'Ryžiai', 'Svogūnai']],
      ['Tacos', 'Takai', ['Tortillas', 'Minced beef', 'Taco seasoning', 'Tomatoes', 'Lettuce', 'Cheese', 'Sour cream'], ['Tortilijos', 'Jautienos faršas', 'Takų prieskoniai', 'Pomidorai', 'Salotos', 'Sūris', 'Grietinė']],
      ['Shakshuka', 'Šakšuka', ['Eggs', 'Canned tomatoes', 'Onion', 'Peppers', 'Bread'], ['Kiaušiniai', 'Konservuoti pomidorai', 'Svogūnai', 'Paprikos', 'Duona']],
      ['Stir-fry noodles', 'Keptos makaronų juostelės', ['Noodles', 'Chicken breast', 'Soy sauce', 'Stir-fry vegetables', 'Garlic'], ['Makaronų juostelės', 'Vištienos krūtinėlė', 'Sojų padažas', 'Daržovių mišinys', 'Česnakai']],
      ['Salmon with potatoes', 'Lašiša su bulvėmis', ['Salmon', 'Potatoes', 'Lemon', 'Dill', 'Butter'], ['Lašiša', 'Bulvės', 'Citrina', 'Krapai', 'Sviestas']],
      ['Homemade pizza', 'Naminė pica', ['Pizza dough', 'Tomato sauce', 'Mozzarella', 'Ham', 'Mushrooms'], ['Picos tešla', 'Pomidorų padažas', 'Mocarela', 'Kumpis', 'Pievagrybiai']],
      ['Caesar salad', 'Cezario salotos', ['Lettuce', 'Chicken breast', 'Parmesan', 'Croutons', 'Caesar dressing'], ['Salotos', 'Vištienos krūtinėlė', 'Parmezanas', 'Skrebučiai', 'Cezario padažas']],
      ['Burgers at home', 'Naminiai burgeriai', ['Burger buns', 'Minced beef', 'Cheese', 'Tomatoes', 'Lettuce', 'Onion'], ['Burgerių bandelės', 'Jautienos faršas', 'Sūris', 'Pomidorai', 'Salotos', 'Svogūnai']],
      ['Chili con carne', 'Čili su mėsa', ['Minced beef', 'Kidney beans', 'Canned tomatoes', 'Onion', 'Chili', 'Rice'], ['Jautienos faršas', 'Raudonosios pupelės', 'Konservuoti pomidorai', 'Svogūnai', 'Čili', 'Ryžiai']],
      ['Pancakes', 'Blynai', ['Flour', 'Milk', 'Eggs', 'Sugar', 'Jam'], ['Miltai', 'Pienas', 'Kiaušiniai', 'Cukrus', 'Uogienė']],
      ['Mushroom risotto', 'Rizotas su grybais', ['Arborio rice', 'Mushrooms', 'Onion', 'Parmesan', 'Stock'], ['Rizoto ryžiai', 'Pievagrybiai', 'Svogūnai', 'Parmezanas', 'Sultinys']],
    ] },
    { id: 'lithuanian', en: 'Lithuanian classics', lt: 'Lietuviška klasika', items: [
      ['Cepelinai', 'Cepelinai', ['Potatoes', 'Minced pork', 'Onion', 'Sour cream'], ['Bulvės', 'Kiaulienos faršas', 'Svogūnai', 'Grietinė']],
      ['Šaltibarščiai', 'Šaltibarščiai', ['Beetroot', 'Kefir', 'Cucumbers', 'Eggs', 'Dill', 'Potatoes'], ['Burokėliai', 'Kefyras', 'Agurkai', 'Kiaušiniai', 'Krapai', 'Bulvės']],
      ['Kugelis', 'Kugelis', ['Potatoes', 'Bacon', 'Onion', 'Eggs', 'Sour cream'], ['Bulvės', 'Šoninė', 'Svogūnai', 'Kiaušiniai', 'Grietinė']],
      ['Balandėliai', 'Balandėliai', ['Cabbage', 'Minced meat', 'Rice', 'Onion', 'Tomato sauce'], ['Kopūstas', 'Faršas', 'Ryžiai', 'Svogūnai', 'Pomidorų padažas']],
      ['Koldūnai', 'Koldūnai', ['Frozen koldūnai', 'Sour cream'], ['Šaldyti koldūnai', 'Grietinė']],
      ['Kibinai', 'Kibinai', ['Kibinai'], ['Kibinai']],
      ['Varškėčiai', 'Varškėčiai', ['Curd', 'Eggs', 'Flour', 'Sugar', 'Sour cream'], ['Varškė', 'Kiaušiniai', 'Miltai', 'Cukrus', 'Grietinė']],
      ['Potato pancakes', 'Bulviniai blynai', ['Potatoes', 'Eggs', 'Flour', 'Onion', 'Sour cream'], ['Bulvės', 'Kiaušiniai', 'Miltai', 'Svogūnai', 'Grietinė']],
    ] },
  ],
  date: [
    { id: 'home', en: 'Cosy at home', lt: 'Jaukiai namie', items: [
      ['Movie night with popcorn', 'Filmų vakaras su spragėsiais'], ['Cook something new together', 'Kartu išvirti kažką naujo'], ['Board game night', 'Stalo žaidimų vakaras'],
      ['Spa evening at home', 'SPA vakaras namie'], ['Build a blanket fort', 'Pastatyti pledų tvirtovę'], ['Wine and a puzzle', 'Vynas ir dėlionė'],
    ] },
    { id: 'vilnius', en: 'Out in Vilnius', lt: 'Vilniuje', items: [
      ['Walk in Vingis park', 'Pasivaikščiojimas Vingio parke'], ['Sunset at Gediminas tower', 'Saulėlydis prie Gedimino bokšto'], ['Užupis café hop', 'Užupio kavinės'],
      ['Cinema night', 'Kinas'], ['Museum afternoon', 'Popietė muziejuje'], ['Bowling', 'Boulingas'], ['Escape room', 'Pabėgimo kambarys'], ['Concert', 'Koncertas'], ['Try a new restaurant', 'Naujas restoranas'],
    ] },
    { id: 'trips', en: 'Day trips', lt: 'Vienos dienos išvykos', items: [
      ['Trakai castle', 'Trakų pilis'], ['Kernavė mounds', 'Kernavės piliakalniai'], ['Druskininkai spa day', 'SPA diena Druskininkuose'],
      ['Anykščiai treetop walk', 'Anykščių lajų takas'], ['Kaunas old town', 'Kauno senamiestis'], ['Curonian Spit weekend', 'Savaitgalis Neringoje'],
    ] },
  ],
};
