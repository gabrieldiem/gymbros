# GYMBROS: product spec

This is the source of truth for game rules and product behaviour. The prototype (`docs/prototype/index.html`) shows how it should feel. Where the two disagree, this file wins and the prototype gets a `BACKLOG.md` note.

## Who and why

Five friends (Gabi, Santi, Maxo, Jose, Matex) train at the gym and want friendly competition that pushes each of them to get better. The core idea is **better than yesterday**: there is no season and no finish line. You climb a lifetime mountain, and the most respected stat is how much you improved against your own past self.

## Navigation (five tabs)

| Tab | EN / ES | Purpose |
|---|---|---|
| ATUS Climb | ATUS Climb / ATUS Climb | Trail map leaderboard, your standing, weekly goal, "you vs 4 weeks ago", who is training now, rope order list |
| Crew | Crew / Equipo | Feed (workouts, PRs, badges, nudges) with reactions and comments; Hall of fame (most improved, crew records) |
| Train | Train / Entrenar | Pick a routine or empty workout, log sets, rest timer, plate calculator, finish → points breakdown → climb animation |
| Quests | Quests / Retos | Crew quest, weekly quests, duels, badges |
| You | You / Tú | Profile stats, you vs 4 weeks ago, heatmap, weekly tonnage chart, PRs with progress chart, rank ladder, history, settings |

Desktop (≥960 px) shows a side rail with Train as the primary button. Mobile shows a bottom nav with Train as the raised centre button.

## Weekly goal

- **Target: 3 workouts per week.** Exceeding it is allowed and rewarded.
- Each person shows 3 pips for the week, plus one extra pip per workout over 3.
- A **goal week** is a week with ≥3 workouts. The **goal streak** counts consecutive goal weeks.
- A week runs Monday 00:00 to Sunday 23:59 in the crew's time zone.

## Scoring

Points are computed server-side when a workout is finished. Values live in `apps/api/settings.json` → `scoring`.

| Rule | Points | Notes |
|---|---|---|
| Showed up | 50 | Workout with ≥1 completed set |
| Completed set | 5 each | Cardio entries count as one set |
| Leg day x2 event | +5 per leg set | Only while the weekly event is active |
| Volume | 1 per 100 kg | Σ load × reps; bodyweight load = 80 kg + added kg (v1: fixed 80, profile bodyweight later) |
| Cardio | 3 per minute | |
| PR | 100 per exercise | Best e1RM in the workout beats the stored PR. e1RM = load × (1 + reps / 30) (Epley). The first log of an exercise only sets the baseline (no points; see BACKLOG *Decide*) |
| Weekly goal hit | 150 | On the 3rd workout of the week |
| Goal streak | 20 × streak weeks, max 100 | Paid together with the weekly goal |
| Over target | 50 | Each workout after the 3rd in a week |
| Better than last time | 25 | Volume beats the previous session of the same routine |
| Weekly quest complete | quest bonus (100 to 200) | Once per quest per week |
| Crew quest complete | 200 to everyone | Crew total for the week reaches the goal (4,000) |
| Bounty | 150 | Pass the current leader (all-time) while a bounty is active |
| Badge unlocked | badge points (50 to 300) | Once per badge, ever |

The finish screen lists every line item (an i18n key plus variables) and the total, plus "+X% volume vs last time".

A completed set is a checked set with reps > 0 (minutes > 0 for cardio). A workout needs at least one completed set to be finished; otherwise discard it. While logging, the app shows the points the workout would pay if finished now (computed by the API).

**Balance note:** a jackpot day (3rd workout + streak + PR + quest + bounty + badge) reaches about 1,200 pts against a typical 150 to 250. This is intentional for now; the balance pass is in `BACKLOG.md`.

## Progressive overload

When a routine starts, every set is pre-filled from the last session:

- Barbell lifts: +2.5 kg, same reps
- Other weighted lifts and bodyweight: same load, +1 rep
- Cardio: +1 minute

The logger shows the last-time values per set and a "Loaded to beat last time" hint.

## Ranks (lifetime, ATUS Climb camps)

Seven camps at 1,500-point steps, with the summit at 9,000. In "This week" mode the map scales to a 1,500-point week.

| # | EN | ES | From |
|---|---|---|---|
| 0 | Rookie | Novato | 0 |
| 1 | Grinder | Guerrero | 1,500 |
| 2 | Iron | Hierro | 3,000 |
| 3 | Steel | Acero | 4,500 |
| 4 | Beast | Bestia | 6,000 |
| 5 | Titan | Titán | 7,500 |
| 6 | Unstoppable | Imparable | 9,000 |

## ATUS Climb (the leaderboard)

- A topographic SVG map with a winding trail from Rookie (bottom) to Unstoppable (summit). Each person's marker sits along the trail by points. Markers that would overlap are nudged along the trail's normal.
- Toggle between **All time** and **This week**.
- Your marker is volt yellow with a halo. A red dot means training now. 🎯 marks the bounty target.
- After finishing a workout, your marker animates up the trail, and a toast announces who you passed.
- The side panel shows your rank, points, goal pips, the gap to the person above, your lead over the person below, the next camp, "You vs 4 weeks ago" (strength %, volume %, workouts), and a weekly recap entry.
- Rope order: the ranked list with each person's pips and status.

## Self-improvement

- **You vs 4 weeks ago:** strength (mean e1RM change across squat, bench and deadlift), volume (last 3 weeks vs the 3 before), workouts (last 4 weeks vs the 4 before).
- **Most improved** (Hall of fame): ranks the crew by improvement against themselves this month, so last place on the rope can win it.
- **Better than last time** bonus and badge.

## Social

- **Feed:** finished workouts (title, duration, sets, kg, +% vs last time, PR banner, expandable exercise list), badge unlocks, rank-ups and inactivity nudges ("Matex hasn't trained in 3 days" with a Nudge button).
- **Reactions:** 👊 and 🔥 (toggle), comments with quick replies.
- **Notifications** (inbox + toast): someone passed you, someone close behind and training now, new bounty, weekly recap ready, reactions, replies, duel accepted, goal hit.
- **Training now:** live "who's at the gym" chips with their current activity.
- **Weekly recap:** story-style slides (crew total, biggest climber, heaviest PR, your week, most improved, this week's event). This is the one place where the bold, loud visual treatment is allowed.

## Competition mechanics

- **Weekly quests** (reset Monday): Leg day twice (150), Push, pull and legs (120), Move 20 tonnes (200), Sixty cardio minutes (100).
- **Crew quest:** the crew climbs 4,000 pts in a week → +200 each. Shown as a stacked bar per person.
- **Duels:** a 1v1 until Sunday night, by points or by bench volume, with a stake ("Loser buys the protein shakes"). The opponent accepts or declines. The winner gets 150 once the week is over (paid into the new week); a tie pays nobody.
- **Bounty:** every week the bounty is on the all-time leader; the first member to pass them that week takes 150 (then it's claimed until Monday). Checked after quests and the crew quest, before badges.
- **Weekly event:** one twist per week. v1 has only "Leg day x2" (EN prototype name "Leg storm"; the app uses "Leg day x2" in both languages until the backlog decision closes). It is always on in v1 (`game.weekly_event` in settings.json).

## Badges (15)

| Badge | Condition | Pts |
|---|---|---|
| First tracks | First workout | 50 |
| Better than yesterday | Beat last-time volume on 5 workouts | 150 |
| Two plates | Back squat 140 kg × 1 | 200 |
| Hundred tonnes | 100 t lifetime volume | 150 |
| Iron month | 4 goal weeks in a row | 150 |
| Plate club | Bench press 100 kg | 200 |
| Dawn patrol | 5 workouts finished before 07:00 | 100 |
| Leg day loyalist | 10 leg days | 150 |
| Bounty hunter | Claim a bounty | 100 |
| Rope team | 3 crew quests | 200 |
| Hype crew | 50 reactions given | 50 |
| Trash talker | 10 comments | 50 |
| Night owl | Finish a workout after 22:00 | 75 |
| Comeback | Return after 14 days away | 100 |
| Unstoppable | Reach 9,000 pts | 300 |

## Exercise catalog (v1)

Each exercise has an id, an English name, a group (Chest, Legs, Back, Shoulders, Arms, Cardio), a type (`w` weight × reps, `bw` bodyweight ± kg × reps, `c` cardio minutes + km), a `barbell` flag, and a push/pull/legs class.

Bench press, Incline dumbbell press, Cable fly, Back squat, Romanian deadlift, Leg press, Walking lunge, Leg curl, Deadlift, Barbell row, Pull-up, Lat pulldown, Overhead press, Lateral raise, Barbell curl, Dips, Treadmill run, Rowing machine.

Routines: Push day (bench, ohp, incline, dips), Pull day (deadlift, row, pull-up, curl), Leg day (squat, rdl, leg press, lunge), Cardio (run, rower), and Empty workout.

## i18n

- English and Spanish are complete for every screen, line item, feed event, notification and recap slide.
- **Spanish uses classic English gym terms.** Exercise names stay in English (Bench press, Back squat, RDL…), and so do routine names (Push day, Pull day, Leg day) and the core vocabulary: sets, reps, PR, 1RM, spotter, "Light weight", "Beast mode". Sentences around them stay Spanish: "Nuevo PR: Bench press 110 kg × 3", "12 sets completados", "Nunca se salta el leg day". Muscle groups and the general UI are Spanish (Pecho, Piernas, Retos, Equipo).
- Exercise search also matches Spanish aliases (typing "sentadilla" finds Back squat).
- Numbers use the locale format (`3,880` / `3.880`).

## Not in v1

kg/lb toggle, photo or video proof, multiple crews per user, push notifications, Apple/Google Health import. Each of these is tracked in `BACKLOG.md`.
