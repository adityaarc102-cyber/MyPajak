export default defineNuxtPlugin(() => {
  const { initTheme } = useThemeMode()
  initTheme()
})
