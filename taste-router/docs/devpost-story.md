## Inspiration
I have run a small online shop of my own, so I know what it means to put your savings on the line for something you believe in. A physical place is the scarier version of that bet. You empty an account it took years to fill, you sit across from a landlord with a five-year lease, and in the nights before you sign you lie awake asking the same question: *will anyone like me actually walk through that door?*

Most of the time that bet is placed on a foot-traffic map or a friend's hunch, and too many of those places close within a year. Not because the idea was bad, but because it opened where its people weren't. And when it does work, the relief has nothing to do with spreadsheets. It is the evening someone walks in, hears the record you chose, and says "finally". You have found your people.

Artists feel the same fear on tour ("will this room be half empty?"), and so do pop-up makers and promoters. The data that answers the question exists: Qloo knows where taste lives. I wanted to put it in the hands of a nervous first-time founder before they sign anything: *your people are here, this is who they are, and this is what your first night could feel like.*

## What it does
Describe the place you dream of in one sentence — "a tiny vinyl listening bar with natural wine in New York, for people who love Khruangbin, Wong Kar-wai films and Aesop-style design". In about 20 seconds TasteRouter's agent gives you:

- **A Taste-Fit Score (0–100) and a verdict**: "Your people are here", "Worth a visit" or "A harder road", for the best neighbourhood (Long Island City, 71/100, +8 ahead of Bushwick), with the three parts behind it and how much evidence supports it.
- **Meet your regulars**: three portraits of the people who will walk through your door. Mara, somewhere between 35 and 44, has loved Khruangbin for years, is usually around MoMA PS1 with Rhye in their headphones, and will order the pork buns before taking their coat off. Every concrete noun comes from that run's Qloo results: an over-indexed age band, the artists, films, brands and books this crowd loves, a dish from their taste DNA, a real venue near your hotspot.
- **Opening night**: a short story of your first evening there, with your regulars arriving by name.
- **Ranked neighbourhoods**, each with a "why you'll belong here" line built from that neighbourhood's own Qloo evidence (its anchor venues, audience overlap, competitor count and Taste-Fit, shown underneath), taste-matched anchor venues, and an honest competitor count within 900 m (*white space*, *healthy demand* or *proven but crowded*).
- **An opening-week plan and collab partners** from Qloo cross-domain recommendations.
- **Ask a follow-up**: "What about a smaller budget?", "Compare #1 and #2", "I care most about low competition". Answers use only that report's Qloo evidence, plus one tool when needed (a re-score of the Taste-Fit, or a Qloo lookup of *inexpensive* taste-matched venues around each area).
- **A share link and a PDF report** for your co-founder, your landlord or your bank.
- **Tour router / fan mode** for artists: where a touring artist's fans actually are, the shortest route through the strongest cities, and an **intimate fan night** in the best market (a taste-matched room near the fans plus local openers Qloo suggests, e.g. Mitski → Chicago's West Loop with Japanese Breakfast opening).
- **"LLM alone vs. TasteRouter"**: the same brief answered without Qloo, side by side.

It also ships as an **MCP server**, so Claude, Cursor or Codex agents can call `scout_location`, `plan_tour` and each Qloo tool directly.

## TasteRouter vs. the alternatives
| | Gut feel / asking friends | Foot-traffic & site-selection tools | ChatGPT alone | **TasteRouter** |
|---|---|---|---|---|
| Answers "will people who *love this* come?" | hopefully | no (counts bodies, not taste) | guesses | **yes: Qloo taste graph, street-level heatmap** |
| Data source | anecdotes | phone pings, census | training data | **Qloo heatmap, place index, demographics, cross-domain recs** |
| Who your customers are | imagined | demographics only | stereotypes | **Qloo-grounded regulars: what they listen to, watch, wear, eat, where they go** |
| Competition check | walking around | yes | no | **same-category venues within 900 m, from Qloo** |
| Time / cost | weeks, free | days, usually paid subscriptions or consultants | seconds, free | **~20 seconds, free** |
| Auditable | no | partly | no | **every step and Qloo call shown; shareable report** |

## How it's Qloo-powered
Every number and name on screen comes from Qloo:
1. `/search` resolves the brief's cultural references to entities (name-checked so fuzzy matches don't drift).
2. `/v2/insights` `urn:tag` gives the crowd's taste DNA; `urn:demographics` the age lift used for the regulars.
3. `/v2/insights` `urn:heatmap` with a point + radius window returns street-level affinity, clustered into hotspots.
4. For each hotspot, `urn:entity:place` with `filter.location=POINT(..)` and `signal.interests.entities` names the neighbourhood and finds taste-matched venues; the same query with `filter.tags=<category tag from /v2/tags>` counts competitors.
5. Cross-domain `urn:entity:artist / movie / brand / book` (plus `signal.location.query` for local-leaning artists and tour openers) fill the regulars, programming and collabs.
6. **Taste-Fit Score** = 40% taste depth (mean heatmap affinity within 1.5 km) + 30% audience overlap (mean Qloo affinity of the top-3 taste-matched venues) + 30% white space (1 − category saturation).
Without Qloo there is no heatmap, no regulars, no competitor count: just guesswork.

## How I built it
- **Agent loop**: plan → ground → reflect → parallel fan-out → adapt → scout → score → write + story, streamed to the UI as an auditable trace with a live Qloo-call counter. If fewer than two references resolve, it reflects and asks for stand-ins; if the heatmap is sparse, it widens the window and retries.
- **Grounded storytelling**: the regulars, the opening night and every "why you'll belong here" line are composed only from that run's Qloo results (age lift, artists, films, brands, books, dishes, venues, Taste-Fit parts, competitor counts) and never assume gender. I first let an LLM write them, but even behind a noun-level validator it kept inventing small things: a Starbucks stop, a commute, a hike, a brand treated as a place to go. A founder about to sign a lease deserves nothing invented, so that copy is now built from Qloo facts with hand-written sentences. The LLM still plans the run, writes the launch brief and answers follow-ups, only from the stored evidence.
- **Runs entirely on free tiers**: a Cloudflare Worker serves the UI and a streaming API; Workers AI (Llama 3.3 70B and gpt-oss-120b) plans, writes and answers; Workers KV caches Qloo responses, finished runs and shareable reports. Cities are geocoded with OpenStreetMap Nominatim; maps are Leaflet with OpenStreetMap tiles.
- **Quota-aware Qloo client**: zero dependencies, 4 req/s queue (the key allows 5/s and 10k/month), bounded retries, persistent cache. Repeat briefs replay from cache, so judges' clicks don't burn quota.
- Same code runs on plain Node 20 (`npm start`), with unit and agent tests on a fake Qloo.

## Challenges
- A city-name query returns a region-wide heatmap; a geocoded point + radius gives street-level cells.
- Heatmap affinity is rank-normalised inside each city, so it can find *where* in a city but cannot compare cities. Venue affinity can, which is what the tour router and the audience-overlap part of the score use.
- Making the story warm without inventing anything. Validators caught invented nouns, but not invented lives (a night shift, a ferry, "unwinding at" a clothing brand). The fix was to stop asking the LLM for that copy and write it from Qloo facts directly.
- Keeping a public demo alive on a 10k/month key: caching at the call, run and report level.

## Accomplishments
- Answers that are specific and checkable: Long Island City for the vinyl wine bar, Brook Green for a Ghibli ramen pop-up in London, Logan Square for a Phoebe Bridgers-and-Sally-Rooney bookshop café, Eagle Rock for a Mitski secret show, each with a Taste-Fit, named venues and competitor counts.
- Regulars that feel like real neighbours, built only from Qloo data.
- A full product on $0 of infrastructure.

## What I learned
Taste is geographic, and it is personal. Qloo's heatmap plus place index is a location-intelligence product hiding in plain sight, and the most useful thing it can give a nervous founder isn't only a score; it's a picture of the actual people they are opening for. An agent is the right interface: the hard part isn't one API call, it's chaining many of them and knowing when to retry.

## What's next
Rent and foot-traffic overlays, saved comparisons across cities, tour dates tied to ticketing data, and a version for community spaces (libraries, youth clubs, senior centres) to find where their people already are.

## Significant update note
TasteRouter is a new project written from scratch during the submission period, in its own top-level folder of my existing repo unified-ai-system; none of its code existed before Sep 30, 2026.
