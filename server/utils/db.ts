import type { RowDataPacket } from 'mysql2/promise'
import { getTiDbPool, syncTiDbMirrorTable } from './tidb'

export async function readDocument<T>(key: string, defaultValue: T): Promise<T> {
  const storage = useStorage('db')
  const pool = await getTiDbPool()

  if (pool) {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT payload FROM mypajak_store WHERE store_key = ? LIMIT 1',
        [key]
      )
      if (rows.length > 0 && typeof rows[0]?.payload === 'string') {
        const parsed = JSON.parse(rows[0].payload) as T
        return parsed
      }

      // Belum ada di TiDB: migrasikan data lokal jika tersedia, atau gunakan seed awal
      const localSaved = await storage.getItem<T>(key)
      const initial =
        localSaved !== null && localSaved !== undefined
          ? localSaved
          : (JSON.parse(JSON.stringify(defaultValue)) as T)

      await pool.query(
        'INSERT INTO mypajak_store (store_key, payload) VALUES (?, ?) ON DUPLICATE KEY UPDATE payload = VALUES(payload)',
        [key, JSON.stringify(initial)]
      )
      await syncTiDbMirrorTable(key, initial)
      return initial
    } catch (err) {
      console.warn(`[TiDB] Gagal baca key "${key}", beralih ke storage lokal:`, err)
    }
  }

  const saved = await storage.getItem<T>(key)
  if (saved !== null && saved !== undefined) {
    return saved
  }
  const initial = JSON.parse(JSON.stringify(defaultValue)) as T
  await storage.setItem(key, initial as never)
  return initial
}

export async function writeDocument<T>(key: string, value: T): Promise<void> {
  const storage = useStorage('db')
  const pool = await getTiDbPool()

  if (pool) {
    try {
      await pool.query(
        'INSERT INTO mypajak_store (store_key, payload) VALUES (?, ?) ON DUPLICATE KEY UPDATE payload = VALUES(payload)',
        [key, JSON.stringify(value)]
      )
      await syncTiDbMirrorTable(key, value)
    } catch (err) {
      console.warn(`[TiDB] Gagal simpan key "${key}" ke TiDB:`, err)
    }
  }

  // Tetap simpan salinan lokal sebagai cadangan
  await storage.setItem(key, value as never)
}

export async function readCollection<T>(key: string, seed: T[]): Promise<T[]> {
  const result = await readDocument<T[]>(key, seed)
  if (Array.isArray(result)) {
    return result
  }
  const initial = JSON.parse(JSON.stringify(seed)) as T[]
  await writeDocument(key, initial)
  return initial
}

export async function writeCollection<T>(key: string, items: T[]): Promise<void> {
  await writeDocument(key, items)
}
