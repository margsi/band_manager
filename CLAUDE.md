# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This file is also the canonical design document for the game. All formulas, economy values, and event tables here are the source of truth — do not deviate from them during implementation.

---

## Project overview

A browser-based band management sim where the player grows a solo musician into a signed band. The game ends when followers reach 1,000,000 and a record label deal fires.

**Stack:** plain HTML / JS / CSS, no build step, no frameworks. Opens directly in a browser.  
**Save:** `localStorage`.
**AI**: Anthropic Claude API (claude-sonnet-4-20250514) for song and concert reviews.

---

## Running the game

Open `index.html` directly in a browser — no build step, no server required.

---

## Architecture

The game is a single-page app with no framework. Expected file structure:

- `index.html` — shell and UI layout
- `style.css` — all styling
- `game.js` — all game logic (state, formulas, event system, week tick, Claude API calls)

All game state lives in a single JS object and is serialised to `localStorage` on each week tick. The Claude API key must be provided by the player at runtime (not hardcoded).

### State shape (implement as a single `gameState` object)

The player enters a band name before the game starts. This is the only setup screen.

Key top-level fields: `week`, `money`, `followers`, `bandName`, `members[]`, `songs[]`, `chemistry`, `viralFired`, `lowChemWeeks` (per-member counter for the "member quits" trigger).

### Week tick order

1. Resolve player actions (train / concert / social activity / hire)
2. Check and fire random events (see event table)
3. Check win condition (followers ≥ 1,000,000 → label deal ending)
4. Persist state to `localStorage`

---

## Core game loop

Train → Record → Release/Perform → Earn → repeat.

Skills improve → songs get better → more income → faster growth.

---

## Weekly structure

Each week has two independent slots:

| Slot | Quantity | Notes |
|---|---|---|
| Member action | 1 per band member | Each member independently chooses an action (e.g. train a skill) |
| Band slot | 1 (required) | Play a concert at the chosen venue **or** do a social activity (raises chemistry). Injured/absent members are simply absent, not a blocker. |
| Rehearsal room | 1 (optional) | Choose one focus for the whole band this week (see below) |

Hiring more members increases weekly throughput via additional action slots, not just better stats.

### Social activities

Chosen in the band slot instead of playing a concert. All raise chemistry. Only available with 2+ members.

| Activity | Chemistry boost | Cost |
|---|---|---|
| Movie night | +3 | free |
| Band dinner | +5 | $60 |
| Go to a show | +6 | $40 |
| Sports & games | +7 | $20 |
| Road trip | +15 | $120 |

---

### Member training options

One action per member per week.

| Training option | Skill | Cost | Gain |
|---|---|---|---|
| Practice | Technical | free | +2–4 |
| Paid lesson | Technical | $150 | +5–8 |
| Write | Songwriting | free | +2–4 |
| Co-write | Songwriting | free | +3–5 for both; requires 2 members |
| Busk | Stage | free | +2–4 stage, earn $20–40 |
| Stage workshop | Stage | $80 | +5–8 |

---


### Rehearsal room options

| Option | Effect |
|---|---|
| Learn a new song | Adds 2–4 cover songs to the setlist (quality 40–60 each, random) |
| Write a new song | Adds 1 original song to the setlist (quality uses the song score formula) |
| Work on live performance | +2–4 Stage for each member, +3–6 Chemistry |

---

## Setlist

The band maintains a list of songs they can play. Each song has a **quality** stat.

| Song type | Source | Quality |
|---|---|---|
| Cover | Rehearsal room — "Learn a new song" | 40–60 (random) |
| Original | Rehearsal room — "Write a new song" | Song score formula |
- Max **20 songs**. The player can edit the setlist at any time (add/remove songs freely).
- A band with no songs cannot play a concert.
- Concert income uses the **average quality of the current setlist** as an additional multiplier (see concert formula below).

---

## Band

- **Starting size:** 1 (solo musician — no chemistry system active yet)
- **Maximum size:** 5
- **Roles:** Vocalist, Guitarist, Bassist, Drummer, Keys

### Hiring

The "Hire member" button opens a panel listing available candidates. Candidates are generated based on follower count — at 0 followers nobody wants to join. The pool grows as the band's following grows.

| Followers | Candidates available |
|---|---|
| 0 | 0 |
| 100+ | 1 |
| 1,000+ | 2 |
| 10,000+ | 3 |
| 100,000+ | 4 |

Candidate skills (Technical, Songwriting, Stage) are randomly generated within a range determined by follower count — more followers attract more experienced musicians:

| Followers | Skill range |
|---|---|
| 100+ | 10–25 |
| 1,000+ | 15–35 |
| 10,000+ | 25–50 |
| 100,000+ | 40–70 |

Each candidate is assigned a role (from the unfilled roles in the band) and a randomly generated name. Hiring costs $300. The pool refreshes each week.

### Solo mode rule
With only 1 member, chemistry is locked at 0 and its multiplier does not apply. The chemistry system activates when the first hire is made. This makes the first hire feel like a threshold, not just a stat bump.

---

## Skills

Each musician has 4 personal skills plus a shared band-wide chemistry stat.

| Skill | Description |
|---|---|
| Technical | Precision and complexity of playing |
| Songwriting | Quality of melodies and lyrics |
| Stage | Live performance skill |
| Chemistry | Shared band stat — multiplies everything |

### Skill ceilings (diminishing returns by tier)

Skills are gated into 3 tiers. Training alone only gets you to tier 1.

| Skill | Solo cap (T1) | Tier 2 unlock | Tier 3 unlock |
|---|---|---|---|
| Technical | 40 | Paid lessons ($150/session) | Gear upgrade event + chemistry ≥ 50 |
| Songwriting | 40 | 3+ co-write sessions | Song score ≥ 80 + 3 songs written |
| Stage | 40 | 5+ concerts played | Tier 2 venue unlocked + followers ≥ 10,000 |
| Chemistry | — | 2+ members train in same week | Band retreat event ($500, 2 weeks off) |

### Skill description thresholds (hover tooltip)

Raw skill values are never shown to the player. Hover tooltips use these labels:

| Range | Label |
|---|---|
| 0–15 | Poor |
| 16–30 | Below average |
| 31–45 | Average |
| 46–60 | Good |
| 61–79 | Excellent |
| 80–100 | Exceptional |

### Chemistry multiplier

Chemistry acts as a global multiplier on all effective skills:

```
effective_skill = raw_skill × (0.8 + chemistry / 100 × 0.6)
```

- Chemistry = 0: ×0.80
- Chemistry = 50: ×1.10
- Chemistry = 100: ×1.40

---

## Song score formula

```
base_score = (eff_technical × 0.3) + (eff_songwriting × 0.4) + (chemistry × 0.3)
final_score = clamp(base_score + random(−10, +10), 1, 100)
```

Where `eff_technical` and `eff_songwriting` are already multiplied by the chemistry multiplier.

### Claude API prompt
Claude is given raw band stats and returns a JSON object with:
- `review` — 2–3 sentence fictional critic blurb, calls out specific strengths/weaknesses by musician name
- `score` — 1–100 (advisory; game uses the formula score but Claude's value can be used for flavour)

Low songwriting (<40) → clichéd lyrics. High chemistry → critic notices tight arrangements. Low technical → sloppy playing mentioned in review.

---

## Economy

| Parameter | Value |
|---|---|
| Starting money | $500 |
| Private lesson (tier 2 skill unlock) | $150 |
| Instrument upgrade | $400 |
| Band retreat (tier 3 chemistry unlock) | $500, 2 weeks off |
| Hire new member | $300 |

### Concert score formula

```
score = (1 + eff_stage / 100 × 0.8)
      × (1 + chemistry / 100 × 0.4)
      × (1 + min(followers / 1_000_000, 0.5))
      × (1 + avg_setlist_score / 100 × 0.5)

income = base_pay × score
followers gained = base_followers × score
```

### Concert venues

| Venue | Followers required | Min. setlist | Base pay | Base followers |
|---|---|--------------|---|---|
| The Basement | 0 | 3            | $80 | 100 |
| The Crow Bar | 1,000 | 6            | $200 | 400 |
| Midnight Stage | 10,000 | 10           | $500 | 2,000 |
| The Rex Theater | 100,000 | 15           | $1,200 | 10,000 |
| City Arena | 500,000 (post-ending) | 20           | $3,500 | 50,000 |

### Album release income

```
revenue = avg_song_score × 30
```

One-time payout on release. Streaming royalties continue regardless.

### Hiring cost/benefit note
New member's contribution needs to raise song scores by ≥3 points within ~10 songs to justify the chemistry hit. Hiring is a real tradeoff, not routine progression.

---

## Random events

- **Presentation:** interrupting popup modal — player must make a choice before continuing
- **Negative events:** unavoidable — some things just happen, no spending money to prevent them

### Event table

| Event | Type | Effect | Trigger condition |
|---|---|---|---|
| Local press feature | Good | +5,000 followers | followers 1,000–50,000 |
| Gear sponsor | Good | Free instrument upgrade, unlocks T3 technical | any song score ≥ 70 |
| Creative breakthrough | Good | +20 songwriting for one member | any member songwriting ≥ 65 |
| Viral moment | Good | +100,000 followers, +$400. Fires once per game only. | stage ≥ 60 + concert played that week |
| Mentorship offer | Good | Unlocks T3 songwriting for all members | 3+ songs recorded, avg score ≥ 75 |
| Band argument | Bad | Chemistry −15. No choice. | 8% chance per week (requires 2+ members) |
| Member quits | Bad | Lose them permanently. Chemistry −20 for remaining members. | chemistry < 25 for 3+ consecutive weeks |
| Bad review | Bad | Followers −5,000 | song score < 35 on release |
| Injury | Bad | One member misses 3 weeks of training | 2% chance per week per member |
| **Label deal** | **Ending** | **Game over — you made it.** | **followers ≥ 1,000,000** |

### Event implementation notes
- Check events at the end of each week tick, after all other state updates
- Each event should only fire once unless noted (band argument and injury are repeatable)
- Viral moment: use a `viralFired` flag in state, never fires twice
- Member quits: track consecutive low-chemistry weeks per member in state

---

## Win condition

Followers ≥ 1,000,000 triggers the "Label deal" event as an interrupting popup. It's the ending — display a closing screen summarising the band's journey (weeks played, songs recorded, best song, total followers gained). No continue after this.

---

## Pacing arc

| Phase | Approx. weeks | Feel |
|---|---|---|
| Solo grind | 1–6 | Scrappy, limited options. First hire is a big moment. |
| Early band | 7–20 | Chemistry building. First songs. First real concerts. |
| Ceiling hit | 20–35 | Skills plateau at tier 1. Events matter. Retreat-or-grind decision. |
| Late push | 35–50 | Albums, followers climbing. Events become high-stakes. |
| Endgame | 50+ | Label deal imminent. One bad event could stall you. |

---

## UI design

**Style:** newspaper comic — scrappy, inky, retro.

### Palette
- Background: off-white / cream (`#f5f0e8`)
- Ink: near-black (`#1a1a1a`)
- Accent 1: faded yellow (`#e8c84a`)
- Accent 2: dusty red (`#c0392b` desaturated)
- Accent 3: slate blue (`#4a6fa5` desaturated)
- No gradients. Flat fills only.

### Typography
- Headers: bold serif (e.g. `Georgia` or a newspaper-style web font)
- Body / stats: monospace or typewriter-style (e.g. `Courier New`)

### Layout
- The **main viewscreen** (largest, central panel) displays the **rehearsal room** — all band members are visible inside the room. Below each member is a panel showing their chosen weekly action. The rehearsal room choice for the week is also set here.
- Secondary panels surround it for stats, setlist, economy, and the band slot (concert/record)
- **Left:** the setlist panel. Shows the current setlist (up to 20 songs). Below it, an expandable section lists all available songs not currently in the setlist. Songs are added/removed via drag-and-drop between the two lists.
- **Bottom-right:** the band slot panel. Choose a venue to play a concert, or choose a social activity instead. Confirming either option advances the week — this is the implicit "end week" action, never labelled as such
- **Top-left:** band name, with a "Hire member" button below it
- **Top-center:** week counter
- **Member skill stats:** not displayed directly. Hovering over a member shows a tooltip with approximate descriptions per skill — never raw numbers.
- **Top-right corner:** a comic-drawn smartphone displaying a fictional social media app — the follower counter is the primary element, with the money counter shown below it

### Texture & detail
- Halftone dot pattern on panel backgrounds: pure CSS `radial-gradient`, no images
- All cards/panels have thick black borders (`3–4px solid #1a1a1a`)
- Slight imperfection encouraged — mild rotation (`rotate(0.5deg)`) on cards to feel hand-placed
- Buttons: flat fill, thick black outline, no drop shadows, no border-radius (or very slight)
- No smooth transitions or animations that break the static-panel feel