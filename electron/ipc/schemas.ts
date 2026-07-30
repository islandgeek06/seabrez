import { z } from 'zod'

// Every IPC channel that carries a payload validates it against one of these
// schemas before the handler runs (see handlers.ts). Untrusted/invalid payloads
// are rejected rather than reaching business logic.

export const S = {
  id: z.string().min(1).max(200),
  url: z.string().max(4096),
  optionalId: z.string().min(1).max(200).nullable().optional(),

  settingsPatch: z.record(z.string(), z.unknown()),

  workspaceCreate: z.object({
    name: z.string().min(1).max(120),
    icon: z.string().max(16).optional(),
    color: z.string().max(32).optional(),
  }),
  workspaceUpdate: z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(120).optional(),
    icon: z.string().max(16).optional(),
    color: z.string().max(32).optional(),
    position: z.number().int().optional(),
  }),

  tabCreate: z.object({
    url: z.string().max(4096).optional(),
    background: z.boolean().optional(),
    isPrivate: z.boolean().optional(),
    workspaceId: z.string().nullable().optional(),
  }),
  tabId: z.object({ id: z.number().int() }),
  tabReorder: z.object({ id: z.number().int(), toIndex: z.number().int() }),
  tabBool: z.object({ id: z.number().int(), value: z.boolean() }),
  tabMoveWorkspace: z.object({ id: z.number().int(), workspaceId: z.string().nullable() }),

  navLoad: z.object({ url: z.string().max(4096) }),

  findStart: z.object({
    text: z.string().max(500),
    forward: z.boolean().optional(),
    matchCase: z.boolean().optional(),
    findNext: z.boolean().optional(),
  }),

  bookmarkCreate: z.object({
    title: z.string().max(500),
    url: z.string().max(4096),
    favicon: z.string().nullable().optional(),
    folderId: z.string().nullable().optional(),
    workspaceId: z.string().nullable().optional(),
  }),
  bookmarkUpdate: z.object({
    id: z.string().min(1),
    title: z.string().max(500).optional(),
    url: z.string().max(4096).optional(),
    folderId: z.string().nullable().optional(),
    pinned: z.number().int().min(0).max(1).optional(),
    position: z.number().int().optional(),
  }),
  folderCreate: z.object({ name: z.string().min(1).max(200), parentId: z.string().nullable().optional() }),

  historySearch: z.object({ query: z.string().max(500).optional() }),
  historyClear: z.object({
    range: z.enum(['hour', 'day', 'week', 'month', 'all']),
  }),

  noteCreate: z.object({
    title: z.string().max(500).optional(),
    content: z.string().max(100000).optional(),
    sourceUrl: z.string().max(4096).nullable().optional(),
    workspaceId: z.string().nullable().optional(),
  }),
  noteUpdate: z.object({
    id: z.string().min(1),
    title: z.string().max(500).optional(),
    content: z.string().max(100000).optional(),
    sourceUrl: z.string().max(4096).nullable().optional(),
    workspaceId: z.string().nullable().optional(),
  }),
  noteQuery: z.object({ query: z.string().max(500).optional() }),

  permissionSet: z.object({
    origin: z.string().max(2048),
    permission: z.string().max(64),
    decision: z.enum(['allow', 'deny', 'ask']),
  }),

  aiProvider: z.enum(['openai', 'anthropic']),
  aiSetKey: z.object({
    provider: z.enum(['openai', 'anthropic']),
    key: z.string().max(400),
  }),
  aiChat: z.object({
    provider: z.enum(['openai', 'anthropic']),
    model: z.string().max(120),
    system: z.string().max(200000).optional(),
    requestId: z.string().min(1).max(200),
    messages: z
      .array(
        z.object({
          role: z.enum(['system', 'user', 'assistant']),
          content: z.string().max(400000),
        }),
      )
      .max(100),
  }),
  requestId: z.object({ requestId: z.string().min(1).max(200) }),

  clearData: z.object({ history: z.boolean().optional(), downloads: z.boolean().optional() }),
  openExternal: z.object({ url: z.string().max(4096) }),

  searchWeb: z.object({ query: z.string().min(1).max(500) }),
  searchSetKey: z.object({ key: z.string().max(400) }),

  syncBookmarks: z.object({
    rows: z
      .array(
        z.object({
          id: z.string().min(1),
          folderId: z.string().nullable(),
          workspaceId: z.string().nullable(),
          title: z.string(),
          url: z.string(),
          favicon: z.string().nullable(),
          pinned: z.number().int(),
          position: z.number().int(),
          createdAt: z.number(),
          updatedAt: z.number(),
          deleted: z.number().int(),
        }),
      )
      .max(10000),
  }),
  syncNotes: z.object({
    rows: z
      .array(
        z.object({
          id: z.string().min(1),
          workspaceId: z.string().nullable(),
          title: z.string(),
          content: z.string(),
          sourceUrl: z.string().nullable(),
          createdAt: z.number(),
          updatedAt: z.number(),
          deleted: z.number().int(),
        }),
      )
      .max(10000),
  }),
}

export type Schemas = typeof S
