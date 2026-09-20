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

## Files
- `index.html` — app shell
- `app.js` — all screens and data access
- `app.css` — styles (light + dark)
- `config.js` — Supabase URL and publishable key
- `manifest.json`, `icon.svg`, `icon-180.png` — add-to-home-screen support

## Local preview
Any static server works, e.g. `python3 -m http.server 8765` then open http://127.0.0.1:8765
