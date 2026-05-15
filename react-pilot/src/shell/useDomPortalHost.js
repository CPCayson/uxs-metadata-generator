import { useEffect, useState } from 'react'

/**
 * Resolve a portal mount node by id (wizard rail hosts mount after first paint).
 * @param {string} hostId
 * @returns {HTMLElement | null}
 */
export function useDomPortalHost(hostId) {
  const [host, setHost] = useState(() =>
    typeof document !== 'undefined' ? document.getElementById(hostId) : null,
  )

  useEffect(() => {
    function resolve() {
      const el = document.getElementById(hostId)
      setHost((prev) => (prev === el ? prev : el))
    }
    resolve()
    const observer = new MutationObserver(resolve)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [hostId])

  return host
}
