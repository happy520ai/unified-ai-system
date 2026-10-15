// Grounding guard for TasteRouter's human copy (regulars, opening night, belonging lines).
// Rule: every concrete noun the copy names (drink, dish, brand, artist, film, book, venue, place) must come from
// the run's Qloo results. The LLM is asked to obey; this module checks, so made-up details ("cold brew",
// "Starbucks", "a glass of wine") are rejected, retried, and finally replaced by deterministic Qloo-only copy.

// Food and drink words an LLM likes to sprinkle in. Allowed only when the same word appears in the Qloo kit.
export const FOOD_DRINK = [
  'cold brew', 'coffee', 'espresso', 'latte', 'lattes', 'cappuccino', 'flat white', 'americano', 'macchiato', 'mocha', 'cortado', 'matcha', 'chai', 'tea', 'teas', 'kombucha', 'smoothie', 'juice', 'lemonade', 'soda', 'cola', 'seltzer',
  'wine', 'wines', 'natural wine', 'orange wine', 'rosé', 'rose wine', 'prosecco', 'champagne', 'beer', 'beers', 'ipa', 'lager', 'stout', 'craft brew', 'brew', 'pint', 'cider', 'cocktail', 'cocktails', 'negroni', 'martini', 'margarita', 'mezcal', 'tequila', 'whisky', 'whiskey', 'bourbon', 'gin', 'vodka', 'rum', 'sake', 'soju', 'highball', 'spritz', 'aperol',
  'croissant', 'croissants', 'bagel', 'bagels', 'donut', 'doughnut', 'muffin', 'scone', 'pastry', 'pastries', 'toast', 'avocado toast', 'pancakes', 'waffles', 'granola', 'oat milk',
  'pizza', 'burger', 'burgers', 'fries', 'tacos', 'taco', 'burrito', 'sushi', 'ramen', 'pho', 'dumplings', 'noodles', 'curry', 'kimchi', 'tofu', 'salad', 'sandwich', 'sandwiches', 'oysters', 'oyster', 'cheese', 'charcuterie', 'olives', 'tapas', 'pasta', 'risotto', 'steak', 'chicken', 'wings', 'popcorn', 'cake', 'cookie', 'cookies', 'brownie', 'ice cream', 'gelato', 'sorbet', 'chocolate', 'candy', 'nachos', 'hummus', 'falafel', 'kebab', 'bao', 'buns', 'tater tots', 'baked eggs', 'eggs', 'brunch',
];
// Brands that slip into lifestyle copy. Allowed only when Qloo returned them for this run.
export const BRANDS = [
  'starbucks', 'blue bottle', 'nespresso', 'la colombe', 'stumptown', 'dunkin', 'pret', 'costa', 'nike', 'adidas', 'apple', 'iphone', 'airpods', 'macbook', 'spotify', 'netflix', 'instagram', 'tiktok', 'uber', 'lyft', 'amazon', 'kindle',
  'uniqlo', 'zara', 'h&m', 'cos', 'muji', 'aesop', 'le labo', 'diptyque', 'glossier', 'patagonia', 'the north face', 'north face', 'arc\'teryx', 'fjällräven', 'carhartt', 'levi\'s', 'dr. martens', 'converse', 'vans', 'new balance', 'birkenstock', 'everlane', 'urban outfitters', 'outside voices', 'lululemon', 'aritzia', 'ikea', 'polaroid', 'leica', 'sonos', 'vespa', 'tesla',
];

const STOP_CAPS = new Set(['i', "i'm", "i've", "i'd", "i'll", 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'tasterouter', 'qloo', 'taste', 'ok', 'dj', 'japanese', 'french', 'italian', 'korean', 'chinese', 'mexican', 'american', 'british', 'english', 'spanish', 'thai', 'indian', 'vietnamese', 'greek', 'german', 'scandinavian', 'nordic', 'european', 'asian', 'latin', 'african', 'caribbean', 'mediterranean']);
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’`]/g, "'");
const words = s => norm(s).split(/[^a-z0-9'&]+/).map(w => w.replace(/'s$/, '').replace(/^'+|'+$/g, '')).filter(Boolean);
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every name/term from this run's Qloo results (plus the founder's own concept and city) that copy may mention. */
export function allowedKit(ev = {}, kits = []) {
  const phrases = [];
  const add = x => { if (x == null) return; if (Array.isArray(x)) x.forEach(add); else if (typeof x === 'object') add(x.name); else phrases.push(String(x)); };
  add(ev.city); add(ev.concept); add(ev.category?.name); add(ev.vibe_tags);
  add((ev.seeds || []).map(s => s.name));
  for (const v of Object.values(ev.taste_dna || {})) add(v);
  for (const v of Object.values(ev.programming || {})) add(v);
  for (const v of Object.values(ev.programming_full || {})) add(v);
  for (const n of ev.neighborhoods || []) { add(n.name); add((n.anchors || []).map(a => String(a).replace(/ \(.*$/, ''))); }
  for (const n of ev.neighborhoods_full || []) { add(n.neighborhood); add((n.anchors || []).map(a => a.name)); }
  for (const k of kits || []) { add(k.loves); add(k.listens); add(k.watches); add(k.wears); add(k.reads); add(k.eats); add(k.hangout?.name); add(k.hangout?.neighborhood); }
  const text = ' ' + phrases.map(norm).join(' | ') + ' ';
  return { phrases, text, words: new Set(phrases.flatMap(words)) };
}

/**
 * Returns the terms in `text` that are not grounded in the allowed kit:
 *  - any food/drink word or known brand that does not appear in the kit;
 *  - any capitalised name mid-sentence (a proper noun: venue, brand, artist, place) whose words are not in the kit.
 * `names` are the regulars' own first names, which are allowed.
 */
export function groundingIssues(text, allowed, names = []) {
  const t = norm(text);
  if (!t.trim()) return [];
  const out = new Set();
  for (const term of [...FOOD_DRINK, ...BRANDS]) {
    const re = new RegExp(`(^|[^a-z0-9])${esc(term)}(s|es)?(?![a-z0-9])`);
    const stem = term.replace(/(es|s)$/, '');
    if (re.test(t) && !new RegExp(`(^|[^a-z0-9])${esc(stem.length >= 3 ? stem : term)}`).test(allowed.text)) out.add(term);
  }
  const ok = new Set([...allowed.words, ...names.flatMap(words)]);
  const raw = String(text).replace(/[’`]/g, "'");
  const re = /\p{Lu}[\p{L}\p{M}\p{N}'&.-]*/gu;
  let m;
  while ((m = re.exec(raw))) {
    const before = raw.slice(0, m.index).replace(/[\s"“”'‘(*_]+$/, '');
    const initial = !before || /[.!?:;—–\n]$/.test(before);
    const w = words(m[0])[0];
    if (!w || STOP_CAPS.has(w) || ok.has(w)) continue;
    if (initial) continue; // sentence-initial capitals are ordinary words unless the lexicon above caught them
    out.add(m[0].replace(/[.'-]+$/, ''));
  }
  return [...out];
}

// Activities and identities the copy must not invent (allowed only if the same word is in the Qloo kit).
export const INVENTED = ['hike', 'hikes', 'hiking', 'trail', 'trek', 'marathon', 'jog', 'jogging', 'gym', 'yoga', 'road trip', 'road trips', 'office', 'commute', 'boss', 'coworker', 'queer', 'gay', 'lesbian', 'straight', 'married', 'wife', 'husband', 'girlfriend', 'boyfriend', 'kids', 'children', 'baby'];
const RE_ESC = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Role check: items used in the wrong role ("unwind at Outside Voices" for a brand, "sip aguachile" for a dish),
 * plus invented activities/identities. `kits` give the brands and dishes of this run.
 */
export function roleIssues(text, kits = [], allowed = { text: '' }) {
  const t = String(text || '').toLowerCase().replace(/[’`]/g, "'");
  if (!t.trim()) return [];
  const out = new Set();
  for (const k of kits) {
    const brand = k?.wears?.name?.toLowerCase();
    if (brand && new RegExp(`\\b(at|to|into|inside|visits?|visiting|heads? to|heading to)\\s+(the\\s+)?${RE_ESC(brand)}`).test(t)) out.add(`brand as a place: ${k.wears.name}`);
    const dish = k?.eats?.toLowerCase();
    if (dish && new RegExp(`\\b(sip|sips|sipping|drinks?|drinking)\\s+(\\w+\\s+){0,3}${RE_ESC(dish)}`).test(t)) out.add(`dish sipped: ${k.eats}`);
  }
  for (const w of INVENTED) {
    if (new RegExp(`(^|[^a-z])${RE_ESC(w)}([^a-z]|$)`).test(t) && !new RegExp(`(^|[^a-z])${RE_ESC(w)}`).test(allowed.text || '')) out.add(w);
  }
  return [...out];
}
