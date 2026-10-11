/*
  GRAVEYARD ESCAPE — READY-MADE CHARACTERS
  ========================================
  Tap one in "My Character" to dress up as them, then change anything you like.
  The first eight are our family and friends (rename them below!), the rest are spooky extras.

  The numbers pick from the lists in js/art.js (counting from 0):
    skin        0 light, 1 tan, 2 brown, 3 dark, 4 very fair
    hair        0 brown, 1 black, 2 blonde, 3 ginger, 4 pink, 5 purple, 6 dark blonde,
                7 dark brown, 8 grey, 9 platinum, 10 auburn, 11 mousy brown
    hairStyle   0 long, 1 pigtails, 2 short, 3 ponytail, 4 bun, 5 curly, 6 bob, 7 messy, 8 neat, 9 thin on top
    body        0 dress, 1 jumper & trousers, 2 suit, 3 waistcoat
    outfit      0 purple, 1 orange, 2 green, 3 pink, 4 blue, 5 red, 6 navy, 7 white, 8 black,
                9 beige, 10 charcoal, 11 olive
    pattern     0 plain, 1 flowers, 2 check, 3 lace, 4 knitted
    bottom      0 jeans, 1 black, 2 grey, 3 navy, 4 beige
    tie         0 none, 1 copper, 2 burgundy, 3 navy, 4 gold
    eyes        0 brown, 1 blue, 2 green, 3 grey
    glasses     0 none, 1 round, 2 oval, 3 square, 4 red arms, 5 chunky, 6 sunglasses
    beard       0 none, 1 stubble, 2 goatee, 3 big beard      (beardColor uses the hair colours)
    hat         0 none, 1 flat cap, 2 flower crown
    necklace    0 none, 1 gold, 2 silver
    costume     0 witch, 1 cat, 2 princess, 3 vampire, 4 fairy, 5 no costume
*/
const PRESETS = [
  { name: 'Captain Beard', hero: { skin: 4, hair: 10, hairStyle: 2, body: 3, outfit: 10, pattern: 2, bottom: 2, tie: 1, eyes: 1, glasses: 3, beard: 3, beardColor: 10, hat: 1, necklace: 0, costume: 5 } },
  { name: 'Flower Crown', hero: { skin: 4, hair: 6, hairStyle: 0, body: 0, outfit: 7, pattern: 3, bottom: 0, tie: 0, eyes: 1, glasses: 1, beard: 0, hat: 2, necklace: 1, costume: 5 } },
  { name: 'Spellcaster', hero: { skin: 4, hair: 6, hairStyle: 3, body: 1, outfit: 6, pattern: 1, bottom: 0, tie: 0, eyes: 1, glasses: 2, beard: 0, hat: 0, necklace: 0, costume: 5 } },
  { name: 'Curls', hero: { skin: 4, hair: 7, hairStyle: 5, body: 0, outfit: 11, pattern: 3, bottom: 0, tie: 0, eyes: 1, glasses: 0, beard: 0, hat: 0, necklace: 1, costume: 5 } },
  { name: 'Professor', hero: { skin: 4, hair: 11, hairStyle: 7, body: 2, outfit: 9, pattern: 2, bottom: 2, tie: 4, eyes: 0, glasses: 4, beard: 0, hat: 0, necklace: 0, costume: 5 } },
  { name: 'Shades', hero: { skin: 4, hair: 9, hairStyle: 6, body: 1, outfit: 8, pattern: 4, bottom: 1, tie: 0, eyes: 3, glasses: 6, beard: 0, hat: 0, necklace: 2, costume: 5 } },
  { name: 'Big Grin', hero: { skin: 4, hair: 11, hairStyle: 9, body: 2, outfit: 10, pattern: 0, bottom: 2, tie: 2, eyes: 0, glasses: 5, beard: 1, beardColor: 8, hat: 0, necklace: 0, costume: 5 } },
  { name: 'Sharp Suit', hero: { skin: 4, hair: 0, hairStyle: 8, body: 2, outfit: 6, pattern: 0, bottom: 3, tie: 2, eyes: 1, glasses: 3, beard: 0, hat: 0, necklace: 0, costume: 5 } },
  { name: 'Little Witch', hero: { skin: 0, hair: 0, hairStyle: 0, body: 0, outfit: 0, pattern: 0, eyes: 0, glasses: 0, beard: 0, hat: 0, necklace: 0, costume: 0 } },
  { name: 'Night Cat', hero: { skin: 1, hair: 1, hairStyle: 2, body: 1, outfit: 8, pattern: 0, bottom: 1, eyes: 2, glasses: 0, beard: 0, hat: 0, necklace: 0, costume: 1 } },
  { name: 'Count Fang', hero: { skin: 4, hair: 1, hairStyle: 8, body: 2, outfit: 8, pattern: 0, bottom: 1, tie: 2, eyes: 3, glasses: 0, beard: 0, hat: 0, necklace: 0, costume: 3 } },
  { name: 'Pumpkin Fairy', hero: { skin: 2, hair: 3, hairStyle: 1, body: 0, outfit: 1, pattern: 1, eyes: 2, glasses: 0, beard: 0, hat: 0, necklace: 0, costume: 4 } },
];

// Colours a ghost player can pick in multiplayer
const GHOST_COLORS = ['#eef3ff', '#c9ffd2', '#e4d6ff', '#ffe9c9', '#cfe6ff', '#ffd8de', '#ffb3b3'];
