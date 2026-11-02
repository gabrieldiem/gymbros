# GYMBROS: product spec

This is the source of truth for game rules and product behaviour. The prototype (`docs/prototype/index.html`) shows how it should feel. Where the two disagree, this file wins and the prototype gets a `BACKLOG.md` note.

## Who and why

Five friends (Gabi, Santi, Maxo, Jose, Matex) train at the gym and want friendly competition that pushes each of them to get better. The core idea is **better than yesterday**: there is no season and no finish line. You climb a lifetime mountain, and the most respected stat is how much you improved against your own past self.

## Navigation (five tabs)

| Tab | EN / ES | Purpose |
|---|---|---|
| ATUS Climb | ATUS Climb / ATUS Climb | Trail map leaderboard, your standing, weekly goal, "you vs 4 weeks ago", who is training now, rope order list |
| Crew | Crew / Equipo | Feed (workouts, PRs, badges, nudges) with reactions and comments; Hall of fame (most improved, crew records) |
| Train | Train / Entrenar | Pick a routine or empty workout, log sets, a rest timer you start when you want, plate calculator, finish → points breakdown → climb animation |
| Quests | Quests / Retos | Three sections: this week (crew quest, weekly quests, duels), achievements (each one's condition, reward and your progress), points (what every task pays and an hour of each sport) |
| You | You / Tú | Profile stats, you vs 4 weeks ago, heatmap, weekly tonnage chart, PRs with progress chart, rank ladder, history (tap a workout for its exercises, sets and points), settings |

Desktop (≥960 px) shows a side rail with Train as the primary button and the Quests sections nested under Quests. Mobile shows a floating dock with Train as the raised centre button, and a sticky section bar inside Quests. Achievements and Points are also in the profile menu. The code and API call achievements `badge`; the UI says Achievements / Logros.

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
| Cardio time | 2 per minute | |
| Cardio distance | 8 per run-equivalent km | A swim km counts as 4, a rowing km as 0.8. Capped at 20 km/h equivalent, so a typo can't pay |
| PR | 100 per exercise | Best e1RM in the workout beats the stored PR. e1RM = load × (1 + reps / 30) (Epley). The first log of an exercise only sets the baseline (no points; see BACKLOG *Decide*) |
| Weekly goal hit | 150 | On the 3rd workout of the week |
| Goal streak | 20 × streak weeks, max 100 | Paid together with the weekly goal |
| Over target | 50 | Each workout after the 3rd in a week |
| Better than last time | 25 | Volume beats the previous session of the same routine |
| Stretching | 25 | Fixed, however long (5 or 10 minutes), once per crew-local day. Doesn't count as a set |
| Weekly quest complete | quest bonus (100 to 200) | Once per quest per week |
| Crew quest complete | 200 to everyone | Crew total for the week reaches the goal (4,000) |
| Bounty | 150 | Pass the current leader (all-time) while a bounty is active |
| Badge unlocked | badge points (50 to 300) | Once per badge, ever |

**One hour of any sport pays about the same.** At an ordinary pace, 60 minutes pays 255 for a 10 km run, a 2.5 km swim or a 12.5 km row, against 250 for a 12-tonne, 16-set lifting session. Time always pays, so a longer session earns more in total; over the same time, going further pays more. Logging no distance pays time only. `test_an_hour_of_cardio_pays_about_the_same_as_an_hour_of_lifting` holds this in place: retune the numbers together.

**Cardio PRs and "better than last time" match lifting.** A cardio PR beats your best endurance score for that exercise, the counterpart of e1RM: run-equivalent km^1.06 / minutes × 1000 (Riegel's formula), so going faster over the same distance or further at the same pace both count. Efforts under 1 run-equivalent km (a 250 m swim) don't count, and the first log only sets the baseline. "Better than last time" compares work, where one run-equivalent km counts as the 800 kg that pay the same points.

The finish screen lists every line item (an i18n key plus variables) and the total, plus "+X% volume vs last time".

A completed set is one with reps > 0 (minutes > 0 for cardio). A workout needs at least one completed set to be finished; otherwise discard it. While logging, the app shows the points the workout would pay if finished now (computed by the API).

**Balance note:** a jackpot day (3rd workout + streak + PR + quest + bounty + badge) reaches about 1,200 pts against a typical 150 to 250. This is intentional for now; the balance pass is in `BACKLOG.md`.

## Low signal and offline

Gyms are often in basements, so logging never depends on the connection.

- **The app opens with no signal.** The shell and what's needed to train (you, the catalog, your workout, your gyms, the routines as they'd start, ATUS Climb) are kept on the phone for a week. Other screens say they can't load.
- **Every edit is on the phone first.** A reload never loses a set. The logger says when something is only on the phone.
- **A workout can start with no signal**, loaded from what the phone knows, and it stays on the phone until you finish it. Points show once it arrives, because only the server scores. Photos need signal; add one later from the workout's details.
- **Finishing always works.** If the server can't be reached within a few seconds, the workout waits on the phone and sends itself when there's signal, with a message saying what it paid. It's dated when it really happened: its week, goal and day-based rules go by that time, not when it arrived. Times more than a week old count as now.
- **Nothing counts twice.** A workout arrives whole in one request, and sending it again is safe. If the server refuses one, the member sees it and can discard it.
- **Low signal mode** in settings (also automatic on a phone asking to save data, or on 2G) refreshes the crew's activity every 2 minutes instead of 20 seconds.
- Signing out or deleting the account clears all of this from the phone.

## Gyms

Each member has their own list of up to 10 named gyms, managed in settings, with one default (the first you add, until you pick another; deleting the default hands it to the oldest left). A workout starts at your default and you can change it or choose "No gym", when you start or while logging. Your crew sees the gym in Training now and on the feed post. It's only a name, not a location. A workout keeps the name it was logged with, so renaming or deleting a gym doesn't change your history.

## Workout photos

One photo per workout, added while logging or later from its details on the You tab, and replaceable or removable by its owner. It's resized on your device (1280 px at most) before it's sent, which also drops its metadata, including where it was taken. Your crew sees it on your feed post; nobody outside the crew can open it. It's deleted with the workout or the account. Admins can't remove one yet (GYM-66).

## Stretching

Add it to any workout, or log it alone from its own routine. You tap how long you did (5 or 10 minutes) and it pays fixed points, once per crew-local day, so it can't be farmed.

Alone, it pays only those points. It isn't a workout: it doesn't count towards the weekly goal, pips, streak, over-target bonus or badges, and it doesn't tell the crew you're coming. Its points do count on ATUS Climb, and it shows in your history and the feed. A second session on a day that already paid has nothing to pay, so it can't be finished.

## Entering sets

- **No box to tick:** a set counts as soon as it has reps (minutes for cardio). The numbers a routine loads are grey suggestions worth nothing until you log them, so a set you skip never scores.
- **Repeat:** one tap on the second column logs that row: its own suggestion, else the set above it, else that set from last time. Typing one number in a suggested row logs it with the other suggested number.
- **Remove a row:** the trash button at the end of the row. An exercise always keeps one row; to drop it, remove the exercise.
- **Disks and bar:** on a barbell lift you enter the total weight of the disks, the number shown everywhere you read a barbell lift ("40 kg + bar × 5"). The bar sits beside it and can be 20, 15 or 10 kg, and the row you're on shows the full weight and the kg per side. Points, PRs and badges read the whole weight, bar included, so changing how it's shown changed no scores. Reps with no disks count as the empty bar. Other lifts show plain kg.

## Rest timer

Logging a set doesn't start anything. A button in the logger starts the rest with your length from settings, and it can be adjusted or skipped. At zero the whole screen flashes three slow times and the phone vibrates, so it can be seen from a distance; with reduced motion it's one still screen. There's no rest timer when logging a past workout or stretching alone.

## Past workouts

Forgot to log one? From Train you can log a workout for any of the last 7 days (`game.past_workout_days`, in the crew's time zone). Today isn't one of them: that's a normal workout.

- **It counts on the day you picked**, at noon crew time, so it can't earn the dawn or night badges. Its points, pips, goal, streak, over-target bonus, weekly quests and crew quest all belong to that day's week, so a forgotten workout doesn't break a streak.
- **It's compared with what came before that day:** "better than last time" and the last-time column use the session before it. A PR still has to beat your stored best, and it's dated that day.
- **What's about now stays now:** bounty, badges and "passed" compare where you stand when the points arrive, and they land in this week.
- **Nothing is redone:** bonuses already paid aren't recalculated (a streak paid this week stays as paid), and a settled duel stays settled.
- **The crew can see it:** it's posted to the feed when you log it, with the day it was for and no duration. It isn't "training now", the crew isn't told you're coming, and a goal in a week that's over isn't announced.
- **Logging it:** routines pre-fill what you did last time as it was, without the overload. There's no clock or rest timer.

## Progressive overload

When a routine starts, every set is pre-filled from the last session:

- Barbell lifts: +2.5 kg, same reps
- Other weighted lifts and bodyweight: same load, +1 rep
- Cardio: +1 minute, same distance

The logger shows your current PR on each exercise, the last-time values per set and a "Loaded to beat last time" hint.

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
- **Notifications** (inbox + toast): someone passed you, someone close behind and training now, new bounty, weekly recap ready, reactions, comments on your post and on posts you commented on, duel accepted, goal hit, an admin changing your points.
- **Training now:** live "who's at the gym" chips with their current activity.
- **What's new:** when a feature ships, members hear about it once, as one bell notification that opens the What's new page (also in the profile menu). Several features since your last visit roll into one notification. It never toasts, pops up or emails, and it isn't sent to someone who joined after the feature came out.
- **Weekly recap:** story-style slides (crew total, biggest climber, heaviest PR, your week, most improved, this week's event). This is the one place where the bold, loud visual treatment is allowed.

## Competition mechanics

- **Weekly quests** (reset Monday): Leg day twice (150), Push, pull and legs (120), Move 20 tonnes (200), Run 20 km or swim 5 km (200), Sixty cardio minutes (100).
- **Crew quest:** the crew climbs 4,000 pts in a week → +200 each. Shown as a stacked bar per person.
- **Duels:** a 1v1 until Sunday night, by points or by bench volume, with a stake ("Loser buys the protein shakes"). The opponent accepts or declines. The winner gets 150 once the week is over (paid into the new week); a tie pays nobody.
- **Bounty:** every week the bounty is on the all-time leader; the first member to pass them that week takes 150 (then it's claimed until Monday). Checked after quests and the crew quest, before badges.
- **Weekly event:** one twist per week, shown as a timed event with how long it has left until Sunday night. v1 has only "Leg day x2" (EN prototype name "Leg storm"; the app uses "Leg day x2" in both languages until the backlog decision closes). Every set of a leg exercise pays the bonus, in any workout, whatever the routine: squat, RDL, leg press, lunge and leg curl (the catalog's Legs group), each marked x2 in the logger and the exercise picker. It is always on in v1 (`game.weekly_event` in settings.json).

## Badges (18)

| Badge | Condition | Pts |
|---|---|---|
| First tracks | First workout | 50 |
| Better than yesterday | Beat last-time volume on 5 workouts | 150 |
| Two plates | Back squat 140 kg × 1 | 200 |
| Hundred tonnes | 100 t lifetime volume | 150 |
| Iron month | 4 goal weeks in a row | 150 |
| Plate club | Bench press 100 kg | 200 |
| Ten K | Run 10 km in one go | 200 |
| Full mile | Swim 1.5 km in one go | 200 |
| The long road | Run 100 km or swim 25 km in total | 150 |
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

Each exercise has an id, an English name, a group (Chest, Legs, Back, Shoulders, Arms, Cardio, Mobility), a type (`w` weight × reps, `bw` bodyweight ± kg × reps, `c` cardio minutes + km, `s` stretching minutes), a `barbell` flag, a push/pull/legs class, and for cardio a `km_factor`.

Bench press, Incline dumbbell press, Cable fly, Back squat, Romanian deadlift, Leg press, Walking lunge, Leg curl, Deadlift, Barbell row, Pull-up, Lat pulldown, Overhead press, Lateral raise, Barbell curl, Dips, Outdoor run, Treadmill run, Rowing machine, Pool swim, Stretching.

Routines: Push day (bench, ohp, incline, dips), Pull day (deadlift, row, pull-up, curl), Leg day (squat, rdl, leg press, lunge), Cardio (treadmill, rower), Run (outdoor run), Swim (pool swim), Stretching, and Empty workout.

## i18n

- English and Spanish are complete for every screen, line item, feed event, notification and recap slide.
- **Spanish uses classic English gym terms.** Exercise names stay in English (Bench press, Back squat, RDL…), and so do routine names (Push day, Pull day, Leg day) and the core vocabulary: sets, reps, PR, 1RM, spotter, "Light weight", "Beast mode". Sentences around them stay Spanish: "Nuevo PR: Bench press 110 kg × 3", "12 sets completados", "Nunca se salta el leg day". Muscle groups and the general UI are Spanish (Pecho, Piernas, Retos, Equipo).
- Exercise search also matches Spanish aliases (typing "sentadilla" finds Back squat).
- Numbers use the locale format (`3,880` / `3.880`).

## Public landing page

Anyone can see `/` without signing in: a sample crew on the real map and rope order with a demo that finishes a workout, an hour of each sport compared, what every task pays and every achievement. All numbers come from the public `GET /api/rules`, so the page can't drift from what the game pays.

## Joining a crew

A crew's invite link (`/invite/<code>`) shows the crew's name and size before signing in, and joins you to the crew once you're signed in, whether your account is new or existing. Share it from the profile menu. Typing the code still works. It's one crew per person: if you're already in another crew the link says so and moves nobody.

An invite code can have a maximum number of uses and an expiry. A code that's used up or expired stops working and says why. People who already joined stay.

## Email

Sent through Resend. Nothing goes out without `RESEND_API_KEY` on the server, and the backoffice says so.

- **Welcome email:** when someone signs up with Google. It can be turned off in the backoffice.
- **Weekly digest:** on Monday morning, from an hour chosen in the backoffice, in each crew's time zone: your week, the crew's total, the biggest climber and the heaviest PR, in your language. **It starts off** until an admin turns it on. A crew with no points last week gets nothing. Each member gets it once a week, however many servers are looking. If sending fails, it tries again on the next look that Monday.
- **Messages from admins:** the backoffice can write to everyone, one crew or one person, in plain text. It shows how many people a message reaches before sending, and the log keeps the subject, not who got it or what it said.
- **Stopping them:** the digest and messages from admins can be turned off in settings or from the link in each email, without signing in. Mail apps can offer one-click unsubscribe. People who stopped them are skipped. The welcome email and invites aren't affected.

## Privacy policy

`/privacy` follows Google's OAuth verification requirements (support.google.com/cloud/answer/13806988): what Google data is accessed, how it's used, who it's shared with, how it's protected, retention and deletion, and a Limited Use statement. It's plain HTML, linked from the home page and from settings. Everything it says has to be true of the code: when data handling changes, change the policy and tell members in the app before the change applies.

## Your account

The avatar opens a menu with your profile, Edit profile, settings, inviting friends and log out. Edit profile is also a button on the You tab.

- **Edit profile:** your name; your picture, either uploaded or up to two characters as a person counts them, so emoji work (a family emoji is one); and your color, from eleven presets or any color from the picker. A new name changes your characters only if you never chose your own. An uploaded picture is cropped square and resized on your device before it's sent, which also drops its metadata, and only you, your crew and admins can see it.
- **Settings:** your gyms, language and rest time, downloading your data, and deleting your account and everything in it by typing your email.
- **Your data:** Download my data gives you a JSON file with every finished session (its sets as logged, gym, day and what it paid), your PRs and your gyms. Photos appear as links, which need you signed in.
- **Send feedback:** in the menu, an idea, a bug or anything else, up to 10 a day. Admins read it in the backoffice and it goes when the account goes.

## Backoffice

`/admin` is for the accounts listed in the `ADMIN_EMAILS` server setting. Nobody can grant it from the app.

- **Overview:** accounts, crews, workouts, and the last 7 days.
- **Crews:** create, rename, change the time zone. Set a custom invite code (4 to 12 letters and digits), maximum uses and an expiry, or replace the code with a random one. A new code stops the old one working and starts counting from zero; members stay. Email someone the invite link: they join when they open it and sign in. If the email can't be sent, the link is offered to copy.
- **Accounts:** search, adjust points with a reason (±5,000, counted like any other points; the member gets a notification with the amount and the reason), remove from a crew (history stays), delete.
- **Feedback:** what members sent, newest first, with who sent it, to mark as handled.
- **Email:** the welcome email and weekly digest on or off, the digest's hour, a test digest to yourself, and a box to write to members.
- **Log:** every change, with who made it. It stores ids, so a deleted account leaves no personal data behind.

## Not in v1

kg/lb toggle, photo or video proof, multiple crews per user, push notifications, Apple/Google Health import. Each of these is tracked in `BACKLOG.md`.
