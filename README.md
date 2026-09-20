# Badger Family App

A shared family app for chores, school assignments, family plans, remodeling projects, and weekly "Rocks" + 4-week goals.

- **Hosting:** GitHub Pages (static files in this repo)
- **Data + sign-in:** Supabase project "Badger Family" (`mcxkpptghdupeeydtdhh`)
- **Stack:** plain HTML/CSS/JS + `@supabase/supabase-js` from CDN. No build step.

## How access works
1. Anyone with the link can create an account (email + password).
2. The **first** account ever created becomes an approved **parent** automatically.
3. Every account after that waits until a parent taps **Approve** on the Family screen (top-right avatar).
4. Parents can manage everything. Kids can check off their own chores, manage their own assignments, rocks, and goals, add family plans, and check off project tasks.

Row Level Security in Postgres enforces all of this server-side, so the public key in `config.js` is safe.

## Home screen rings
The Home tab opens on a row of fitness-style rings, one set per family member, so everyone can see
who has closed their rings today. Rings reset at midnight.

- **Outer (red) — Chores:** fills by chores done ÷ chores due today. With nothing due it stays open
  until a chore is checked off anyway.
- **Middle (green) — School** for kids / **Projects** for parents: closes when at least one assignment
  (or project task assigned to / checked off by that parent) is marked done today.
- **Inner (blue) — Rocks:** closes when at least one rock is checked off today.

A ring with nothing scheduled stays open on purpose — something has to be checked off in each area
every day. The 🔥 count is days this week with all three rings closed. Tapping a person's rings opens
their chores for the week. Timestamps come from `done_at` columns on `assignments`, `rocks` and
`project_tasks` (plus `done_by` on tasks), set by database triggers whenever an item is marked done.

## Files
- `index.html` — app shell
- `app.js` — all screens and data access
- `app.css` — styles (light + dark)
- `config.js` — Supabase URL and publishable key
- `manifest.json`, `icon.svg`, `icon-180.png` — add-to-home-screen support

## Local preview
Any static server works, e.g. `python3 -m http.server 8765` then open http://127.0.0.1:8765
