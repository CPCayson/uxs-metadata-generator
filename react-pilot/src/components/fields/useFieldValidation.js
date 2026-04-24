import { useCallback } from 'react'

/**
 * Shared hook replacing the duplicated firstIssue / show / invalid / inv pattern
 * that was copy-pasted across all 6 step components.
 *
 * @param {{
 *   issues: Array<{ field: string, message: string, severity: string }>,
 *   touched: Record<string, boolean>,
 *   showAllErrors: boolean,
 * }} params
 *
 * @returns {{
 *   show: (field: string) => string,
 *   invalid: (field: string) => boolean,
 *   issueFor: (field: string) => { field: string, message: string, severity: string } | undefined,
 * }}
 */
export function useFieldValidation({ issues, touched, showAllErrors }) {
  const issueFor = useCallback(
    (field) => issues.find((i) => i.field === field),
    [issues],
  )

  const show = useCallback(
    (field) => {
      const vis = touched[field] || showAllErrors
      const iss = issueFor(field)
      return vis && iss ? iss.message : ''
    },
    [touched, showAllErrors, issueFor],
  )

  const invalid = useCallback((field) => Boolean(show(field)), [show])

  return { show, invalid, issueFor }
}
