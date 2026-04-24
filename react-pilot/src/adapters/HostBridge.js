/**
 * HostBridge — the interface contract between the metadata engine and
 * any host environment (HTTP `/api/db`, standalone no-op, etc.).
 *
 * All transport is behind this interface. The shell (WizardShell, EmbeddableShell)
 * receives a HostBridge instance via props/context and never imports transport
 * modules directly.
 *
 * @module adapters/HostBridge
 */

/**
 * @typedef {{
 *   name: string,
 *   category?: string,
 *   data: { pilot?: object, mission?: object, [k: string]: unknown },
 *   updatedAt?: string,
 * }} TemplateRecord
 */

/**
 * @typedef {{
 *   key: string,
 *   name: string,
 *   category?: string,
 * }} TemplateCatalogRow
 */

/**
 * @typedef {{
 *   key: string,
 *   row: Record<string, unknown>,
 * }} PlatformLibraryRow
 */

/**
 * @typedef {{
 *   rows: Array<Record<string, unknown>>,
 *   unexpectedShape: boolean,
 *   raw?: unknown,
 * }} SensorListResult
 */

/**
 * @typedef {{
 *   rows: TemplateCatalogRow[],
 *   unexpectedShape: boolean,
 *   raw?: unknown,
 * }} TemplateListResult
 */

/**
 * @typedef {{
 *   rows: PlatformLibraryRow[],
 *   unexpectedShape: boolean,
 *   raw?: unknown,
 * }} PlatformListResult
 */

/**
 * @typedef {{
 *   issues: Array<{ severity: string, field: string, message: string }>,
 *   summary?: string,
 * }} ServerValidationResult
 */

/**
 * The HostBridge interface.
 *
 * Implementations:
 *   HttpHostAdapter       — `POST /api/db` (Postgres + stateless helpers)
 *   StandaloneHostAdapter — no-op / offline (`isAvailable()` false)
 *
 * Optional **`lensScan`**: HttpHostAdapter posts to `/api/db`; StandaloneHostAdapter can run the same in-browser
 * GCMD heuristic when `lensScan` is wired locally.
 *
 * @typedef {{
 *   isAvailable(): boolean,
 *   listTemplates(): Promise<TemplateListResult>,
 *   loadTemplate(name: string): Promise<TemplateRecord>,
 *   saveTemplate(template: TemplateRecord): Promise<void>,
 *   listPlatforms(): Promise<PlatformListResult>,
 *   savePlatform(platform: Record<string, unknown>): Promise<void>,
 *   listSensors(): Promise<SensorListResult>,
 *   saveSensor(sensor: Record<string, unknown>): Promise<void>,
 *   saveSensorsBatch(sensors: Array<Record<string, unknown>>): Promise<void>,
 *   validateOnServer(formData: object, level: string): Promise<ServerValidationResult>,
 *   generateGeoJSON(formData: object): Promise<string>,
 *   generateDCAT(formData: object): Promise<string>,
 *   lensScan?: (payload: { title?: string, abstract?: string, xmlSnippet?: string, profileId?: string }) => Promise<{
 *     runId?: string,
 *     profileId?: string,
 *     suggestions: Array<Record<string, unknown>>,
 *   }>,
 * }} HostBridge
 */

export {}
