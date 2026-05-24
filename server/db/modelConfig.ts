import db from './connection.js'

export function ensureModelConfigTable(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS model_providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      api_base TEXT NOT NULL,
      api_key TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS model_list (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id INTEGER NOT NULL,
      model_id TEXT NOT NULL,
      model_name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (provider_id) REFERENCES model_providers(id),
      UNIQUE(provider_id, model_id)
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS model_scene_mapping (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scene TEXT NOT NULL UNIQUE,
      scene_name TEXT NOT NULL,
      model_id TEXT NOT NULL,
      provider_id INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (provider_id) REFERENCES model_providers(id)
    )
  `)

  db.exec(`CREATE INDEX IF NOT EXISTS idx_model_list_provider ON model_list (provider_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_model_scene ON model_scene_mapping (scene)`)
}

export interface ModelProvider {
  id: number
  name: string
  api_base: string
  api_key: string
  enabled: number
  created_at: number
  updated_at: number
}

export interface ModelItem {
  id: number
  provider_id: number
  model_id: string
  model_name: string
  enabled: number
  created_at: number
  updated_at: number
}

export interface ModelSceneMapping {
  id: number
  scene: string
  scene_name: string
  model_id: string
  provider_id: number
  updated_at: number
}

export function getProviders(): ModelProvider[] {
  return db.prepare('SELECT * FROM model_providers ORDER BY id').all() as ModelProvider[]
}

export function getProviderById(id: number): ModelProvider | undefined {
  return db.prepare('SELECT * FROM model_providers WHERE id = ?').get(id) as ModelProvider | undefined
}

export function getProviderByName(name: string): ModelProvider | undefined {
  return db.prepare('SELECT * FROM model_providers WHERE name = ?').get(name) as ModelProvider | undefined
}

export function addProvider(p: { name: string; api_base: string; api_key: string }): ModelProvider {
  const now = Date.now()
  const result = db.prepare(
    'INSERT INTO model_providers (name, api_base, api_key, enabled, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)'
  ).run(p.name, p.api_base, p.api_key, now, now)
  return getProviderById(result.lastInsertRowid as number)!
}

export function updateProvider(id: number, p: { name?: string; api_base?: string; api_key?: string; enabled?: number }): void {
  const provider = getProviderById(id)
  if (!provider) return
  const now = Date.now()
  db.prepare(
    'UPDATE model_providers SET name = ?, api_base = ?, api_key = ?, enabled = ?, updated_at = ? WHERE id = ?'
  ).run(
    p.name ?? provider.name,
    p.api_base ?? provider.api_base,
    p.api_key ?? provider.api_key,
    p.enabled ?? provider.enabled,
    now, id
  )
}

export function deleteProvider(id: number): boolean {
  const models = db.prepare('SELECT COUNT(*) as c FROM model_list WHERE provider_id = ?').get(id) as { c: number }
  if (models.c > 0) return false
  db.prepare('DELETE FROM model_scene_mapping WHERE provider_id = ?').run(id)
  const result = db.prepare('DELETE FROM model_providers WHERE id = ?').run(id)
  return result.changes > 0
}

export function getModelsByProvider(providerId: number): ModelItem[] {
  return db.prepare('SELECT * FROM model_list WHERE provider_id = ? ORDER BY id').all(providerId) as ModelItem[]
}

export function getAllModels(): (ModelItem & { provider_name: string })[] {
  return db.prepare(
    `SELECT ml.*, mp.name as provider_name FROM model_list ml JOIN model_providers mp ON ml.provider_id = mp.id ORDER BY ml.id`
  ).all() as (ModelItem & { provider_name: string })[]
}

export function addModel(m: { provider_id: number; model_id: string; model_name: string }): void {
  const now = Date.now()
  db.prepare(
    'INSERT INTO model_list (provider_id, model_id, model_name, enabled, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)'
  ).run(m.provider_id, m.model_id, m.model_name, now, now)
}

export function updateModel(id: number, m: { model_name?: string; enabled?: number }): void {
  const model = db.prepare('SELECT * FROM model_list WHERE id = ?').get(id) as ModelItem | undefined
  if (!model) return
  const now = Date.now()
  db.prepare(
    'UPDATE model_list SET model_name = ?, enabled = ?, updated_at = ? WHERE id = ?'
  ).run(m.model_name ?? model.model_name, m.enabled ?? model.enabled, now, id)
}

export function deleteModel(id: number): boolean {
  const model = db.prepare('SELECT * FROM model_list WHERE id = ?').get(id) as ModelItem | undefined
  if (!model) return false
  db.prepare('DELETE FROM model_scene_mapping WHERE model_id = ? AND provider_id = ?').run(model.model_id, model.provider_id)
  const result = db.prepare('DELETE FROM model_list WHERE id = ?').run(id)
  return result.changes > 0
}

export function getSceneMappings(): (ModelSceneMapping & { provider_name: string })[] {
  return db.prepare(
    `SELECT msm.*, mp.name as provider_name FROM model_scene_mapping msm JOIN model_providers mp ON msm.provider_id = mp.id ORDER BY msm.scene`
  ).all() as (ModelSceneMapping & { provider_name: string })[]
}

export function setSceneMapping(mapping: { scene: string; scene_name: string; model_id: string; provider_id: number }): void {
  const now = Date.now()
  const existing = db.prepare('SELECT * FROM model_scene_mapping WHERE scene = ?').get(mapping.scene) as ModelSceneMapping | undefined
  if (existing) {
    db.prepare(
      'UPDATE model_scene_mapping SET scene_name = ?, model_id = ?, provider_id = ?, updated_at = ? WHERE scene = ?'
    ).run(mapping.scene_name, mapping.model_id, mapping.provider_id, now, mapping.scene)
  } else {
    db.prepare(
      'INSERT INTO model_scene_mapping (scene, scene_name, model_id, provider_id, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(mapping.scene, mapping.scene_name, mapping.model_id, mapping.provider_id, now)
  }
}

export interface LLMRuntimeConfig {
  model: string
  apiKey: string
  apiBase: string
}

export function getLLMConfigForScene(scene: string): LLMRuntimeConfig | null {
  const mapping = db.prepare('SELECT * FROM model_scene_mapping WHERE scene = ?').get(scene) as ModelSceneMapping | undefined
  if (!mapping) return null

  const provider = getProviderById(mapping.provider_id)
  if (!provider || !provider.enabled) return null

  return {
    model: mapping.model_id,
    apiKey: provider.api_key,
    apiBase: provider.api_base.replace(/\/v1\/?$/, '')
  }
}

export function getFallbackLLMConfig(): LLMRuntimeConfig {
  return {
    model: process.env.LLM_MODEL || 'deepseek-chat',
    apiKey: process.env.LLM_API_KEY || '',
    apiBase: (process.env.LLM_API_BASE || 'https://api.deepseek.com').replace(/\/v1\/?$/, '')
  }
}
