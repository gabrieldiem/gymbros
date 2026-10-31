# GYMBROS: design system

Gym-brand energy, but easy to use. The prototype went through a very loud version (italic all-caps everywhere, hazard stripes, slanted buttons, grain, giant outlined words). It was rejected because "everything is screaming so nothing is screaming". The current calm version is the baseline, and this file describes it.

## Principle: one loud thing per screen

- The **hero headline** on ATUS Climb ("BETTER THAN YESTERDAY." / "MEJOR QUE AYER.") and the **weekly recap slides** are the only places that use the black italic uppercase display style.
- Everything else is sentence case, upright and calm. Yellow is reserved for **you** and the **primary action**.
- Reward moments (the points total on the finish screen, rank-ups, confetti) may be bright because they answer an action the user just took.

## Color

| Token | Hex | Use |
|---|---|---|
| `--iron` | `#0D0D0D` | App background |
| `--rail` | `#080808` | Navigation background |
| `--plate` | `#171717` | Cards, panels, inputs |
| `--steel` | `#2A2A2A` | Borders, dividers, inactive tracks |
| `--chalk` | `#F2F2EE` | Primary text, most numbers |
| `--smoke` | `#8E8E8A` | Secondary text, labels |
| `--volt` | `#FFE600` | You, primary buttons, active nav, your rank, earned pips |
| `--red` | `#FF3B1F` | PRs, someone passed you, alerts, over-target pips, live dot |

- Tints for chips and banners: the color at 12 to 14% alpha on dark, with a lighter text tone. For example, PR banner `rgba(255,59,31,.12)` with `#FF8470`, and event chip `rgba(0,209,255,.12)` with `#6FE3FF`.
- Crew colors (avatars and markers): you `#FFE600`, Maxo `#FF3B1F`, Santi `#00D1FF`, Jose `#FF4FD8`, Matex `#B48CFF`. In the real app each user picks a color from this palette.

## Type

- **Barlow Condensed** (700/800) for headings and big numbers. The 900 italic uppercase cut is only for the hero headline and recap slides.
- **Barlow** (400 to 700) for everything else: body, buttons, tabs, labels, chips and nav.
- Scale: view title `clamp(2.2rem, 7vw, 3rem)`, h2 1.5rem, h3 1.25rem, body 1rem, small 0.875rem. Hero headline `clamp(3rem, 11vw, 5.6rem)`.
- No all-caps labels. No tracked-out eyebrows.

## Shape and components

- Radius: cards 16px, buttons and inputs 12px (small 10px), chips and pills 999px, sheets 20px (top corners on mobile).
- Buttons: primary (volt on iron), ghost (steel), quiet (text only). Min height 50px (40px small). Sentence case, Barlow 700.
- Segmented control: a plate track with a 3px inset; the selected option is chalk with iron text.
- Bottom sheet on mobile, centered dialog at ≥700px.
- Toast: a plate card with a steel border (red border for alerts). Top center.
- Progress: 8px rounded bars. Pips are 10px circles (16px large), steel outline → volt filled → red for over target.
- Avatars: colored circle with initials, Barlow 700.
- Badges: hexagon icons in the badge color. Locked badges are greyed.

## Motion

- Answer the user: set check → small "+5" float, finish → points lines stagger in → climb animation on the map, reactions pop.
- The trail reveal on first load is the one ambient animation.
- Respect `prefers-reduced-motion` everywhere.

## Layout

- Mobile first at 390px. Bottom nav is 72px plus the safe area, with Train as a raised 54px rounded-square button.
- At ≥960px: a 240px side rail, content max 1240px. ATUS Climb becomes a two-column grid (map | standing panel) at ≥1120px.
- No horizontal overflow at 390px. Touch targets ≥44px.
