# Glossary

Use these names in code (tables, classes, endpoints), API fields and UI copy. Add a term here before using a new one.

| Term | Meaning | Code name |
|---|---|---|
| Crew | The group of friends competing together (5 people). Has a name, time zone and invite code | `crew` |
| Member | A user inside a crew | `member` |
| ATUS Climb | The trail-map leaderboard. Also the name of the first tab | `climb` |
| Camp | A rank checkpoint on the trail (Rookie … Unstoppable) | `rank` (index 0 to 6) |
| Rope order | The ranked list of members under the map | `standings` |
| Workout | One logged gym session: name, start, end, exercises | `workout` |
| Routine | A saved template of exercises (Push day, Pull day, Leg day, Cardio) | `routine` |
| Exercise | A catalog movement with type, group and barbell flag | `exercise` |
| Set | One entry inside a workout exercise: load + reps, or minutes + km; done or not | `set` |
| Volume | Σ load × reps over completed sets, in kg | `volume_kg` |
| e1RM | Estimated one-rep max, Epley: load × (1 + reps/30) | `e1rm` |
| PR | Personal record: best e1RM ever for an exercise | `personal_record` |
| Last time | The previous session's sets for the same exercise, used for pre-fill and comparison | `previous_sets` |
| Overload | The pre-filled bump over last time (+2.5 kg barbell, +1 rep, +1 min) | `overload` |
| Week | Monday 00:00 to Sunday 23:59 in crew time | `week_start` (date) |
| Weekly goal | 3 workouts in a week | `weekly_target` |
| Goal week | A week where the member hit the weekly goal | `goal_week` |
| Goal streak | Consecutive goal weeks | `goal_streak` |
| Over target | Workouts beyond 3 in a week | `over_target` |
| Point event | One immutable scoring line (key, vars, points, workout?) | `point_event` |
| Line item | A point event as shown on the finish screen | `line_item` |
| Quest | A weekly personal challenge with progress and a bonus | `quest` |
| Crew quest | A weekly shared target for the whole crew | `crew_quest` |
| Duel | A 1v1 challenge until Sunday by points or bench volume, with a stake | `duel` |
| Bounty | A bonus for passing the current all-time leader | `bounty` |
| Weekly event | The week's twist (v1: Leg day x2) | `weekly_event` |
| Badge | A one-time achievement with points | `badge` |
| Nudge | A poke at a member who hasn't trained in a few days | `nudge` |
| Reaction | 👊 (`fist`) or 🔥 (`fire`) on a feed item | `reaction` |
| Feed item | A workout, badge, rank-up or nudge event in the Crew tab | `feed_item` |
| Recap | The story-style summary of last week | `recap` |
| Training now | A member with a workout in progress | `active_workout` |
| Most improved | Ranking by improvement against yourself over the last 4 weeks | `improvement` |
