# GYMBROS

A gym tracker for a crew of friends. You log workouts, and every set, PR and goal week moves you up **ATUS Climb**, a trail-map leaderboard. The theme is getting better than you were yesterday. English and Spanish, mobile first.

- Try the prototype: open `docs/prototype/index.html` in a browser.
- Product rules: [docs/PRODUCT.md](docs/PRODUCT.md)
- Design system: [docs/DESIGN.md](docs/DESIGN.md)
- Backlog and tech debt: [BACKLOG.md](BACKLOG.md)
- Working on the code (people and Claude): [CLAUDE.md](CLAUDE.md)

Stack: FastAPI (Python 3.13) + Postgres in `apps/api`, React + TypeScript (Vite) served by nginx in `apps/web`, Docker Compose for dev and prod.
