/* Theme before paint — keep plain ES5 for widest compatibility (no module). */
;(function initializeThemeFromStorage() {
  try {
    var storedTheme = localStorage.getItem('uxsTheme')
    if (storedTheme === 'light' || storedTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', storedTheme)
      return
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark')
    }
  } catch {
    /* ignore */
  }
})()
