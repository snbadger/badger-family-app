Edge function `gcal` — deployed to the Badger Family Supabase project via MCP on 2026-09-20.
Reads `family_settings.gcal_ics_url` with the service role, fetches the private iCal feed,
expands recurrences with ical.js, and returns the next 120 days of events to approved members.
Source of truth is the deployed version in the Supabase dashboard (Edge Functions → gcal).
