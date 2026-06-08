import { apiGet, apiPost, apiPatch } from './client'

export type ModuleType = 'lesson' | 'video' | 'pdf' | 'link' | 'checklist' | 'mixed'
export type ModuleStatus = 'draft' | 'published' | 'archived'
export type ProgressStatus = 'not_started' | 'in_progress' | 'completed'

export interface ChecklistItem {
  id: string
  text: string
  required: boolean
}

export interface ModuleMetadata {
  checklist_items?: ChecklistItem[]
  [key: string]: unknown
}

export interface EducationModule {
  id: string
  name: string
  description: string | null
  category: string | null
  module_type: ModuleType
  content_url: string | null
  content_body: string | null
  metadata: ModuleMetadata | string
  is_required: boolean
  estimated_mins: number | null
  order_num: number
  status: ModuleStatus
  is_published: boolean
  published_at: string | null
  audience: string
  created_at: string
  updated_at: string
}

export interface ModuleProgress {
  module_id: string
  user_id?: string
  completion_pct: number
  status: ProgressStatus
  started_at: string | null
  completed_at: string | null
  last_viewed_at: string | null
  checklist_state: Record<string, boolean> | string
  notes?: string | null
}

export interface ModuleResource {
  id: string
  module_id: string
  title: string
  resource_type: 'pdf' | 'link' | 'video' | 'file'
  url: string | null
  storage_path: string | null
  order_num: number
  created_at: string
}

export interface FighterModule extends EducationModule {
  progress: ModuleProgress
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function parseMetadata(raw: ModuleMetadata | string | null | undefined): ModuleMetadata {
  if (!raw) return {}
  if (typeof raw === 'string') { try { return JSON.parse(raw) } catch { return {} } }
  return raw
}

export function parseChecklistState(raw: Record<string, boolean> | string | null | undefined): Record<string, boolean> {
  if (!raw) return {}
  if (typeof raw === 'string') { try { return JSON.parse(raw) } catch { return {} } }
  return raw
}

// ── Fighter endpoints ─────────────────────────────────────────────────────────

export const getFighterModules = () =>
  apiGet<{ ok: boolean; modules: FighterModule[]; completed: number; in_progress: number; not_started: number; overall_pct: number }>('/api/fighter/modules')

export const getFighterModule = (id: string) =>
  apiGet<{ ok: boolean; module: EducationModule; progress: ModuleProgress | null; resources: ModuleResource[] }>(`/api/fighter/modules/${id}`)

export const updateModuleProgress = (id: string, payload: {
  status?: ProgressStatus; completion_pct?: number; checklist_state?: Record<string, boolean>; notes?: string
}) => apiPatch<{ ok: boolean; progress: ModuleProgress }>(`/api/fighter/modules/${id}/progress`, payload)

export const completeModule = (id: string) =>
  apiPost<{ ok: boolean; progress: ModuleProgress }>(`/api/fighter/modules/${id}/complete`)

// ── Admin endpoints ───────────────────────────────────────────────────────────

export const getAdminModuleDetail = (id: string) =>
  apiGet<{ ok: boolean; module: EducationModule; resources: ModuleResource[] }>(`/api/admin/modules/${id}`)

export const setModuleStatus = (id: string, status: ModuleStatus) =>
  apiPatch<{ ok: boolean; module: EducationModule }>(`/api/admin/modules/${id}/status`, { status })

export const getModuleAnalytics = (id: string) =>
  apiGet<{ ok: boolean; enrolled: number; completed: number; in_progress: number; avg_completion: number }>(`/api/admin/modules/${id}/analytics`)

export const addModuleResource = (moduleId: string, data: { title: string; resource_type: string; url?: string; storage_path?: string; order_num?: number }) =>
  apiPost<{ ok: boolean; resource: ModuleResource }>(`/api/admin/modules/${moduleId}/resources`, data)

export const deleteModuleResource = (moduleId: string, resourceId: string) =>
  apiPost<{ ok: boolean }>(`/api/admin/modules/${moduleId}/resources/${resourceId}`, {})

// ── Manager endpoints ─────────────────────────────────────────────────────────

export const getManagerModuleProgress = () =>
  apiGet<{
    ok: boolean
    modules: (EducationModule & { roster_completion_rate: number; completed_count: number; roster_size: number })[]
    fighters: { fighter_id: string; name: string; completed: number; total: number; avg_pct: number }[]
    summary: { total_modules: number; avg_completion: number }
  }>('/api/manager/modules/progress')
