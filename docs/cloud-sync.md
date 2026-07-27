# Cloud Sync (Supabase)

Intelleson syncs your **bookmarks and notes** across devices using **your own**
free Supabase project. Your data lives in your Supabase account, isolated per
user by Row-Level Security. Intelleson never sees or stores your data on any
server we run — it's local-first with your Supabase as the sync hub.

> Scope: bookmarks + notes today. History, tabs, and settings sync are planned
> next (same mechanism).

## One-time setup (~5 minutes, no credit card)

### 1. Create a Supabase project
- Go to <https://supabase.com>, sign up (free), and **New project**.
- Pick any name/password/region. Wait ~1 minute for it to provision.

### 2. Create the tables + security rules
- In the project, open **SQL Editor → New query**, paste this, and **Run**:

```sql
create table if not exists public.bookmarks (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  folder_id text,
  workspace_id text,
  title text not null default '',
  url text not null default '',
  favicon text,
  pinned int not null default 0,
  position int not null default 0,
  created_at bigint not null default 0,
  updated_at bigint not null default 0
);

create table if not exists public.notes (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workspace_id text,
  title text not null default '',
  content text not null default '',
  source_url text,
  created_at bigint not null default 0,
  updated_at bigint not null default 0
);

alter table public.bookmarks enable row level security;
alter table public.notes enable row level security;

create policy "own bookmarks" on public.bookmarks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own notes" on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

### 3. Copy your two connection values
- **Project Settings → API**:
  - **Project URL** (e.g. `https://abcd1234.supabase.co`)
  - **Project API keys → `anon` `public`** key (a long `eyJ…` string — this one is
    safe to use in a client app; **do not** use the `service_role` key).

### 4. Connect Intelleson
- In the app: **Settings → Account & Sync**.
- Paste the **Project URL** and **anon public key**.
- Click **Create account** (enter an email + password). By default Supabase sends
  a confirmation email — click the link, then come back and **Sign in**.
  - _Optional:_ to skip email confirmation, in Supabase go to
    **Authentication → Providers → Email** and turn off "Confirm email".

### 5. Sync
- After signing in, Intelleson syncs automatically, and on every launch. You can
  also click **Sync now** anytime.
- Repeat steps 4–5 on your other device (same Supabase URL + key + account) and
  your bookmarks and notes come with you.

## How it works

- The Supabase client runs in the renderer; the **anon key is public** and safe
  to embed — your rows are protected by RLS keyed on `auth.uid()`.
- Sync is **two-way, last-write-wins** on `updated_at`: pull remote → merge into
  local (keeping the newer copy) → push the merged set back up.
- Session persists locally (auto-refreshed), so you stay signed in across
  restarts.

## Known limitations

- **Deletes don't propagate yet.** Deleting a bookmark/note on one device won't
  remove it from others (it'll re-sync back). Tombstone-based delete sync is a
  planned follow-up.
- Conflict resolution is last-write-wins per item (no field-level merge).
- History/tabs/settings are not synced yet.
