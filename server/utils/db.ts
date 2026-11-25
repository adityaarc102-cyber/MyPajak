export async function readCollection<T>(key: string, seed: T[]): Promise<T[]> {
  const storage = useStorage('db')
  const saved = await storage.getItem<T[]>(key)
  if (Array.isArray(saved)) {
    return saved
  }
  const initial = JSON.parse(JSON.stringify(seed)) as T[]
  await storage.setItem(key, initial)
  return initial
}

export async function writeCollection<T>(key: string, items: T[]): Promise<void> {
  const storage = useStorage('db')
  await storage.setItem(key, items)
}
