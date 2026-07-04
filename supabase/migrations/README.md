# Fragify — Supabase Migrations

This folder brings your Supabase schema under version control, starting now.
Nothing here changes your live database — these files just need to be applied
once as a starting point, then every future schema change goes through a new
migration file instead of the SQL editor alone.

## Step 1 — Install the Supabase CLI (if not already)

```powershell
npm install -g supabase
```

## Step 2 — Link the CLI to your project

```powershell
cd C:\Users\Priyanshu Yadav\TournamentApp
supabase login
supabase link --project-ref <your-project-ref>
```

Your project ref is the string in your Supabase project URL:
`https://<project-ref>.supabase.co`

## Step 3 — Baseline the CURRENT live schema

This is the important part. Your live database already has things in it that
predate this migrations folder (Profiles, tournaments, teams, etc. from v9,
plus the RLS policies, views, and functions). Rather than trying to
hand-reconstruct all of that from memory, pull it directly from Supabase so
nothing is missed:

```powershell
supabase db pull
```

This generates a migration file containing your *entire* current schema
exactly as it exists live right now, and drops it into this folder timestamped
as of today. Treat that generated file as `migration zero` — it's the
source of truth for "everything that existed before we started tracking."

## Step 4 — Apply the reconstructed migrations included here

I've reconstructed the four schema changes made *this session* (v10 → v11)
from the project summary, since those happened before this folder existed:

| File | What it does |
|---|---|
| `20260701090000_add_player_match_results.sql` | Creates the new `player_match_results` table |
| `20260701090100_drop_match_results_player_id_not_null.sql` | Drops the NOT NULL constraint on `match_results.player_id` |
| `20260701090200_fix_registrations_tournaments_fk.sql` | Adds/repairs the FK between `registrations.tournament_id` and `tournaments.id`, and refreshes PostgREST's schema cache |
| `20260701090300_rewrite_get_leaderboard.sql` | Drops and recreates `get_leaderboard()` to aggregate by `player_uid` |

**Important:** since these changes are already live in your database (you
built them this session), do NOT run these against production again — that
would error or double-apply. Instead:

1. Run `supabase db pull` first (Step 3) — this captures the *current* live
   state, which already includes these four changes baked in.
2. Keep these four files in the folder anyway, but reorder them to come
   **before** the baseline pull's timestamp, purely as a historical record of
   *what changed and why* this session. They document intent even though the
   baseline pull is what actually matches the live DB byte-for-byte.
3. Going forward, every new schema change gets `supabase migration new <name>`
   → write the SQL → `supabase db push` to apply it live *and* keep it
   versioned in the same motion.

## Step 5 — New workflow from here on

Instead of editing schema directly in the Supabase SQL editor:

```powershell
supabase migration new add_delete_account_support
# edit the generated .sql file
supabase db push
```

This keeps `supabase/migrations/` and your live database in sync permanently,
and this whole folder gets committed to git like any other code — so schema
history now lives in `TournamentApp` alongside the app code, not just in your
head or a project summary doc.

## Cleanup candidates (safe to fold into a future migration)

Per the known gaps list, these two functions are confirmed unused and safe to
drop whenever convenient:

- `get_broadcast_push_tokens`
- `get_confirmed_player_tokens`

A ready-to-use migration for this is included:
`20260701090400_drop_unused_broadcast_functions.sql` (commented out by
default — uncomment and push when you're ready).
