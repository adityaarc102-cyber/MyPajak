export type ThemeMode = 'light' | 'dark'

const THEME_STORAGE_KEY = 'mypajak_theme'

export function useThemeMode() {
  const mode = useState<ThemeMode>('mypajak-theme-mode', () => 'light')

  const applyTheme = (nextMode: ThemeMode) => {
    mode.value = nextMode
    if (!import.meta.client) return

    const root = document.documentElement
    root.classList.toggle('dark', nextMode === 'dark')
    root.dataset.theme = nextMode
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextMode)
    } catch {
      // Abaikan jika penyimpanan browser dibatasi
    }
  }

  const initTheme = () => {
    if (!import.meta.client) return
    let saved: string | null = null
    try {
      saved = localStorage.getItem(THEME_STORAGE_KEY)
    } catch {
      saved = null
    }

    if (saved === 'dark' || saved === 'light') {
      applyTheme(saved)
      return
    }

    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    applyTheme(prefersDark ? 'dark' : 'light')
  }

  const toggleTheme = () => {
    applyTheme(mode.value === 'dark' ? 'light' : 'dark')
  }

  const isDark = computed(() => mode.value === 'dark')

  return {
    mode,
    isDark,
    initTheme,
    applyTheme,
    toggleTheme
  }
}
