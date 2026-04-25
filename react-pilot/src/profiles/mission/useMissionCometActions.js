/**
 * Mission-profile CoMET orchestration: pull, preflight chain, push.
 *
 * WizardShell stays thin; this hook owns busy flags and merges CoMET payloads
 * into pilot state using the active profile's mergeLoaded/sanitize.
 *
 * @module profiles/mission/useMissionCometActions
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  checkLinks,
  detectGaps,
  extractUuid,
  fetchCometRecord,
  getRubricScore,
  pushCometRecord,
  resolveXlinks,
  validateIsoXml,
} from '../../lib/cometClient.js'
import { buildPilotPayloadFromCometXml } from '../../lib/cometProfileImport.js'
import { emitPilotAuditEvent } from '../../lib/pilotAuditEvents.js'

/**
 * Human-readable CoMET push description for the active profile (not mission-only).
 *
 * @param {import('../../core/registry/types.js').EntityProfile} profile
 * @param {object} pilotState
 * @returns {string}
 */
export function cometPushDescriptionForProfile(profile, pilotState) {
  const et = profile?.entityType
  if (et === 'bediCollection') {
    return (
      String(pilotState?.title || '').trim()
      || String(pilotState?.collectionId || '').trim()
      || String(pilotState?.fileId || '').trim()
      || 'BEDI collection'
    )
  }
  if (et === 'bediGranule') {
    return (
      String(pilotState?.title || '').trim()
      || String(pilotState?.granuleId || '').trim()
      || String(pilotState?.fileId || '').trim()
      || 'BEDI granule'
    )
  }
  return String(pilotState?.mission?.title || '').trim() || 'Untitled Record'
}

/**
 * @param {unknown} payload
 * @returns {number | null}
 */
function cometErrorCount(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const o = /** @type {Record<string, unknown>} */ (payload)
  if (o.raw != null && o.error_count == null) return null
  const n = Number.parseInt(String(o.error_count ?? '0'), 10)
  return Number.isFinite(n) ? n : null
}

/**
 * @param {{
 *   profile: import('../../core/registry/types.js').EntityProfile,
 *   pilotState: object,
 *   buildXml: (state: object) => string,
 *   cometUuid: string,
 *   setCometUuid: (v: string) => void,
 *   setPilotState: (updater: object | ((p: object) => object)) => void,
 *   setTouched: (v: object) => void,
 *   setShowAllErrors: (v: boolean) => void,
 *   setMode: (mode: string) => void,
 *   baselineSerializedRef: import('react').MutableRefObject<string>,
 *   onStatus: (msg: string) => void,
 *   onPublish?: (result: { uuid: string, cometUrl: string, message?: string }) => void,
 *   capabilities: import('../../core/registry/types.js').ProfileCapabilities,
 * }} args
 */
export function useMissionCometActions({
  profile,
  pilotState,
  buildXml,
  cometUuid,
  setCometUuid,
  setPilotState,
  setTouched,
  setShowAllErrors,
  setMode,
  baselineSerializedRef,
  onStatus,
  onPublish,
  capabilities,
}) {
  const capPull      = Boolean(capabilities?.cometPull)
  const capPreflight = Boolean(capabilities?.cometPreflight)
  const capPush      = Boolean(capabilities?.cometPush)

  const [pullBusy, setPullBusy] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [preflightBusy, setPreflightBusy] = useState(false)
  const [localUuidInput, setLocalUuidInput] = useState('')
  const [preflightSummary, setPreflightSummary] = useState(null)

  const applyCometPayload = useCallback(
    (payload, uuid, gaps) => {
      const merged = profile.mergeLoaded
        ? profile.mergeLoaded(payload ?? {})
        : { ...profile.defaultState(), ...(payload ?? {}) }
      const sanitized = profile.sanitize(merged)
      baselineSerializedRef.current = JSON.stringify(sanitized)
      setPilotState(sanitized)
      setTouched({})
      setShowAllErrors(false)
      setMode('catalog')
      setCometUuid(uuid)
      setLocalUuidInput(uuid)
      onStatus(
        `CoMET record ${uuid.slice(0, 8)}… loaded — ${(gaps ?? []).length} gap(s) detected. Validation in catalog mode.`,
      )
      emitPilotAuditEvent({
        profileId: profile.id,
        action: 'cometPull',
        result: 'ok',
        recordUuid: uuid,
        gapCount: (gaps ?? []).length,
      })
    },
    [
      profile,
      baselineSerializedRef,
      setPilotState,
      setTouched,
      setShowAllErrors,
      setMode,
      setCometUuid,
      setLocalUuidInput,
      onStatus,
    ],
  )

  useEffect(() => {
    function onCometLoadEvent(e) {
      const { parsed, uuid, gaps } = e.detail ?? {}
      if (!uuid) return
      applyCometPayload(parsed ?? {}, uuid, gaps ?? [])
    }
    window.addEventListener('manta:comet-load', onCometLoadEvent)
    return () => window.removeEventListener('manta:comet-load', onCometLoadEvent)
  }, [applyCometPayload])

  const pullFromComet = useCallback(async () => {
    if (!capPull) return
    const uuid = extractUuid(localUuidInput)
    if (!uuid) {
      onStatus('Enter a valid CoMET UUID or full collection URL.')
      return
    }
    setPullBusy(true)
    onStatus('Pulling ISO from CoMET…')
    try {
      const xml = await fetchCometRecord(uuid)
      const payload =
        xml === null ? {} : buildPilotPayloadFromCometXml(profile, xml, { forcedProvenanceType: 'comet', originalUuid: uuid })
      const gaps = detectGaps(payload, profile)
      applyCometPayload(payload, uuid, gaps)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      onStatus(`CoMET pull failed: ${msg}`)
    } finally {
      setPullBusy(false)
    }
  }, [capPull, localUuidInput, profile, applyCometPayload, onStatus])

  const runPreflightChain = useCallback(async () => {
    if (!capPreflight) return
    const rawXml = buildXml(pilotState)
    if (!rawXml?.trim()) {
      onStatus('Preflight: no XML preview available.')
      return
    }
    setPreflightBusy(true)
    setPreflightSummary(null)
    onStatus('Running CoMET preflight…')
    /** @type {Array<{ id: string, label: string, ok: boolean, detail?: string }>} */
    const steps = []
    let overall = 'PASS'

    try {
      let xml = rawXml
      try {
        xml = await resolveXlinks(rawXml)
        steps.push({ id: 'resolver', label: 'Resolver (XLinks)', ok: true })
      } catch (e) {
        const d = e instanceof Error ? e.message : String(e)
        steps.push({ id: 'resolver', label: 'Resolver (XLinks)', ok: false, detail: d })
        overall = 'BLOCK'
        setPreflightSummary({ overall: 'BLOCK', steps })
        onStatus(`Preflight blocked at resolver: ${d}`)
        return
      }

      try {
        const fn = cometUuid ? `${cometUuid.slice(0, 8)}.xml` : 'record.xml'
        const validateResult = await validateIsoXml(xml, fn)
        const count = cometErrorCount(validateResult)
        if (count == null) {
          steps.push({ id: 'validate', label: 'ISO validate', ok: false, detail: 'Unparseable CoMET validate response' })
          overall = 'BLOCK'
          setPreflightSummary({ overall: 'BLOCK', steps })
          onStatus('Preflight blocked at ISO validate: CoMET response did not include an error count.')
          return
        }
        if (count > 0) {
          steps.push({ id: 'validate', label: 'ISO validate', ok: false, detail: `${count} CoMET issue(s)` })
          overall = 'BLOCK'
          setPreflightSummary({ overall: 'BLOCK', steps })
          onStatus(`Preflight blocked at ISO validate: ${count} CoMET issue(s).`)
          return
        }
        steps.push({ id: 'validate', label: 'ISO validate', ok: true, detail: '0 CoMET issues' })
      } catch (e) {
        const d = e instanceof Error ? e.message : String(e)
        steps.push({ id: 'validate', label: 'ISO validate', ok: false, detail: d })
        overall = 'BLOCK'
        setPreflightSummary({ overall: 'BLOCK', steps })
        onStatus(`Preflight blocked at ISO validate: ${d}`)
        return
      }

      try {
        const linkResult = await checkLinks(xml)
        const count = cometErrorCount(linkResult)
        if (count == null) {
          steps.push({ id: 'linkcheck', label: 'Link check', ok: false, detail: 'Unparseable CoMET link-check response' })
          overall = 'BLOCK'
        } else if (count > 0) {
          steps.push({ id: 'linkcheck', label: 'Link check', ok: false, detail: `${count} link issue(s)` })
          overall = 'BLOCK'
        } else {
          steps.push({ id: 'linkcheck', label: 'Link check', ok: true, detail: '0 link issues' })
        }
      } catch (e) {
        const d = e instanceof Error ? e.message : String(e)
        steps.push({ id: 'linkcheck', label: 'Link check', ok: false, detail: d })
        overall = 'BLOCK'
      }

      try {
        const rubric = await getRubricScore(cometUuid || 'draft', xml)
        const count = Number.parseInt(String(rubric?.errorCount ?? '0'), 10)
        if (Number.isFinite(count) && count > 0) {
          steps.push({ id: 'rubric', label: 'Rubric V2', ok: false, detail: `${count} rubric error(s); score ${rubric.totalScore}` })
          overall = 'BLOCK'
        } else {
          steps.push({ id: 'rubric', label: 'Rubric V2', ok: true, detail: `Score ${rubric?.totalScore ?? '—'}` })
        }
      } catch (e) {
        const d = e instanceof Error ? e.message : String(e)
        steps.push({ id: 'rubric', label: 'Rubric V2', ok: false, detail: d })
        overall = 'BLOCK'
      }

      setPreflightSummary({ overall, steps })
      emitPilotAuditEvent({
        profileId: profile.id,
        action: 'cometPreflight',
        result: overall,
        stepCount: steps.length,
        cometUuid: cometUuid || null,
      })
      onStatus(
        overall === 'BLOCK'
          ? 'Preflight: BLOCK — fix validate, link, or rubric issues before push.'
          : 'Preflight: PASS — CoMET validate, link check, and rubric reported no blocking issues.',
      )
    } finally {
      setPreflightBusy(false)
    }
  }, [capPreflight, buildXml, pilotState, cometUuid, onStatus, profile.id])

  const pushDraftToComet = useCallback(async () => {
    if (!capPush || !cometUuid || pushBusy) return
    setPushBusy(true)
    onStatus('Pushing to CoMET…')
    try {
      const xml = buildXml(pilotState)
      const description = cometPushDescriptionForProfile(profile, pilotState)
      const result = await pushCometRecord(cometUuid, xml, { description })
      onStatus(`Pushed to CoMET. ${result.message}`)
      emitPilotAuditEvent({
        profileId: profile.id,
        action: 'cometPush',
        result: 'ok',
        cometUuid: result.uuid || cometUuid,
      })
      onPublish?.({ uuid: result.uuid || cometUuid, cometUrl: result.cometUrl, message: result.message })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      onStatus(`CoMET push failed: ${msg}`)
    } finally {
      setPushBusy(false)
    }
  }, [capPush, cometUuid, pushBusy, buildXml, pilotState, profile, onStatus, onPublish])

  return useMemo(
    () => ({
      capPull,
      capPreflight,
      capPush,
      pullBusy,
      pushBusy,
      preflightBusy,
      localUuidInput,
      setLocalUuidInput,
      preflightSummary,
      pullFromComet,
      runPreflightChain,
      pushDraftToComet,
    }),
    [
      capPull,
      capPreflight,
      capPush,
      pullBusy,
      pushBusy,
      preflightBusy,
      localUuidInput,
      preflightSummary,
      pullFromComet,
      runPreflightChain,
      pushDraftToComet,
    ],
  )
}
