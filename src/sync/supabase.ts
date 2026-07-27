import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { api } from '../api'
import type { Bookmark, Note } from '../../shared/types'

// Cloud sync via Supabase, run in the renderer. The anon key is public (safe to
// embed); user data is isolated by Row-Level Security keyed on auth.uid().
// Session persists automatically in localStorage across restarts.

let client: SupabaseClient | null = null
let clientKey = ''

export function getClient(url: string, anonKey: string): SupabaseClient | null {
  if (!url || !anonKey) return null
  const key = url + '|' + anonKey
  if (!client || clientKey !== key) {
    client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
    clientKey = key
  }
  return client
}

export async function currentUser(url: string, anonKey: string): Promise<{ email: string } | null> {
  const c = getClient(url, anonKey)
  if (!c) return null
  const { data } = await c.auth.getUser()
  return data.user?.email ? { email: data.user.email } : null
}

export async function signUp(url: string, anonKey: string, email: string, password: string) {
  const c = getClient(url, anonKey)
  if (!c) throw new Error('Sync is not configured.')
  const { error } = await c.auth.signUp({ email, password })
  if (error) throw new Error(error.message)
}

export async function signIn(url: string, anonKey: string, email: string, password: string) {
  const c = getClient(url, anonKey)
  if (!c) throw new Error('Sync is not configured.')
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
}

export async function signOut(url: string, anonKey: string) {
  const c = getClient(url, anonKey)
  await c?.auth.signOut()
}

// --- mappers (local camelCase <-> supabase snake_case) --------------------
function bmToRemote(b: Bookmark, userId: string) {
  return {
    id: b.id,
    user_id: userId,
    folder_id: b.folderId,
    workspace_id: b.workspaceId,
    title: b.title,
    url: b.url,
    favicon: b.favicon,
    pinned: b.pinned,
    position: b.position,
    created_at: b.createdAt,
    updated_at: b.updatedAt,
  }
}
function bmToLocal(r: Record<string, unknown>): Bookmark {
  return {
    id: String(r.id),
    folderId: (r.folder_id as string) ?? null,
    workspaceId: (r.workspace_id as string) ?? null,
    title: (r.title as string) ?? '',
    url: (r.url as string) ?? '',
    favicon: (r.favicon as string) ?? null,
    pinned: Number(r.pinned ?? 0),
    position: Number(r.position ?? 0),
    createdAt: Number(r.created_at ?? 0),
    updatedAt: Number(r.updated_at ?? 0),
  }
}
function noteToRemote(n: Note, userId: string) {
  return {
    id: n.id,
    user_id: userId,
    workspace_id: n.workspaceId,
    title: n.title,
    content: n.content,
    source_url: n.sourceUrl,
    created_at: n.createdAt,
    updated_at: n.updatedAt,
  }
}
function noteToLocal(r: Record<string, unknown>): Note {
  return {
    id: String(r.id),
    workspaceId: (r.workspace_id as string) ?? null,
    title: (r.title as string) ?? '',
    content: (r.content as string) ?? '',
    sourceUrl: (r.source_url as string) ?? null,
    createdAt: Number(r.created_at ?? 0),
    updatedAt: Number(r.updated_at ?? 0),
  }
}

// Two-way sync: pull remote → merge into local (last-write-wins), then push the
// merged local set back up.
export async function syncNow(url: string, anonKey: string): Promise<{ pulled: number; pushed: number }> {
  const c = getClient(url, anonKey)
  if (!c) throw new Error('Sync is not configured.')
  const { data: userData } = await c.auth.getUser()
  const userId = userData.user?.id
  if (!userId) throw new Error('Not signed in.')

  // 1) Pull remote and merge into local.
  const [remoteBm, remoteNotes] = await Promise.all([
    c.from('bookmarks').select('*').eq('user_id', userId),
    c.from('notes').select('*').eq('user_id', userId),
  ])
  if (remoteBm.error) throw new Error(`bookmarks pull: ${remoteBm.error.message}`)
  if (remoteNotes.error) throw new Error(`notes pull: ${remoteNotes.error.message}`)

  const pulledBm = (remoteBm.data ?? []).map(bmToLocal)
  const pulledNotes = (remoteNotes.data ?? []).map(noteToLocal)
  await api.sync.applyBookmarks(pulledBm)
  await api.sync.applyNotes(pulledNotes)

  // 2) Push merged local set up.
  const localBm = ((await api.bookmarks.list()) as { items: Bookmark[] })?.items ?? []
  const localNotes = ((await api.notes.list()) as Note[]) ?? []
  if (localBm.length) {
    const { error } = await c.from('bookmarks').upsert(localBm.map((b) => bmToRemote(b, userId)))
    if (error) throw new Error(`bookmarks push: ${error.message}`)
  }
  if (localNotes.length) {
    const { error } = await c.from('notes').upsert(localNotes.map((n) => noteToRemote(n, userId)))
    if (error) throw new Error(`notes push: ${error.message}`)
  }

  return { pulled: pulledBm.length + pulledNotes.length, pushed: localBm.length + localNotes.length }
}
