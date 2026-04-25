/**
 * Registry type definitions — the plugin/adapter contracts.
 *
 * @module core/registry/types
 */

/**
 * A step in a metadata workflow.
 *
 * @typedef {{
 *   id: string,
 *   label: string,
 *   component: import('react').ComponentType<any>,
 *   ownedFieldPrefixes: string[],
 *   entityTypes?: import('../entities/types.js').EntityType[],
 * }} StepDefinition
 */

/**
 * A set of validation rules that applies for given validation modes.
 *
 * @typedef {{
 *   id: string,
 *   modes: import('../entities/types.js').ValidationMode[],
 *   rules: ValidationRule[],
 * }} ValidationRuleSet
 */

/**
 * @typedef {{
 *   field: string,
 *   severity: import('../entities/types.js').IssueSeverity,
 *   message: string,
 *   check: (state: object, mode: string) => boolean,
 *   xpath?: string,
 * }} ValidationRule
 */

/**
 * @typedef {{
 *   format: import('../entities/types.js').ExportFormat | string,
 *   mimeType: string,
 *   fileExtension: string,
 *   generate: (state: object) => string | Promise<string>,
 * }} ExportAdapter
 */

/**
 * Origin of values merged into editor state after an external ingest.
 *
 * @typedef {'rawIso'|'comet'|'cruisepack'|'bediXml'|'lensScanner'|'manual'} SourceProvenanceType
 * `cruisepack` is reserved for a future pack intake; not implemented in the app yet.
 */

/**
 * One field-level hint from the Lens Scanner / CV pipeline.
 *
 * `lensPerItem` (optional) is parallel to `value` when that value is a keyword facet array, and stores per-keyword
 * seed/evidence for review UIs. Mission merge reads only `value`.
 *
 * @typedef {{
 *   fieldPath: string,
 *   value: unknown,
 *   confidence?: number,
 *   label?: string,
 *   source?: string,
 *   model?: string,
 *   evidence?: string,
 *   lensPerItem?: Array<{
 *     seedWord: string,
 *     evidence: string,
 *     confidence?: number,
 *     matchType?: string,
 *     score?: number,
 *   }>,
 * }} ScannerSuggestionItem
 */

/**
 * Normalised payload from a scanner service (HTTP, GAS, or local worker).
 *
 * @typedef {{
 *   runId?: string,
 *   profileId?: string,
 *   suggestions: ScannerSuggestionItem[],
 * }} ScannerSuggestionEnvelope
 */

/**
 * Result of turning scanner suggestions into editor partial state.
 *
 * @typedef {(
 *   | { ok: true, partial: object, warnings: string[], provenance?: SourceProvenance }
 *   | { ok: false, error: string, warnings: string[] }
 * )} ScannerSuggestionResult
 */

/**
 * Contract for ingesting Lens Scanner output without coupling the shell to a
 * specific transport.  Implementations merge dot-paths into profile state and
 * stamp {@link SourceProvenance} with `lensScanner`.
 *
 * @typedef {{
 *   id: string,
 *   label: string,
 *   canParse: (input: unknown) => boolean,
 *   parseExternal: (input: unknown, meta?: ImportParseMeta) => Promise<ScannerSuggestionResult>,
 * }} ScannerSuggestionAdapter
 */

/**
 * @typedef {{
 *   sourceType: SourceProvenanceType,
 *   sourceId: string,
 *   importedAt: string,
 *   originalFilename: string,
 *   originalUuid: string,
 * }} SourceProvenance
 */

/**
 * Optional context from the import UI (file picker, CoMET UUID field, etc.).
 *
 * @typedef {{
 *   originalFilename?: string,
 *   originalUuid?: string,
 *   sourceId?: string,
 *   forcedProvenanceType?: 'comet',
 *   minConfidence?: number,
 * }} ImportParseMeta
 */

/**
 * @typedef {(
 *   | { ok: true, partial: object, warnings: string[], provenance?: SourceProvenance }
 *   | { ok: false, error: string, warnings: string[] }
 * )} ImportParserResult
 */

/**
 * @typedef {{
 *   format: string,
 *   parse: (input: string, meta?: ImportParseMeta) => ImportParserResult,
 * }} ImportParser
 */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   suggest: (facet: string, query: string) => Promise<Array<{ label: string, uuid: string }>>,
 * }} EnrichmentProvider
 */

/**
 * Declares which optional shell behaviours a profile supports.
 * WizardShell reads these flags to conditionally render panels and pass
 * actions down to steps — without ever branching on profile.id.
 *
 * Original flags (phase 1):
 *   xmlPreview      — profile can build an ISO XML preview string
 *   geoJsonExport   — profile can generate a GeoJSON export
 *   dcatExport      — profile can generate a DCAT-AP JSON-LD export
 *   serverValidate  — profile supports server-side (GAS/HTTP) validation
 *   platformLibrary — profile supports the platform library panel
 *   templateCatalog — profile supports the template catalog panel
 *
 * Added flags (phase 2 — capability expansion):
 *   iso2Export      — profile generates ISO 19115-2 / gmi:MI_Metadata XML
 *   xmlImport       — profile has an import parser for ISO XML
 *   scannerPrefill  — profile can receive suggestions from the Lens Scanner (`scannerSuggestionAdapters` + shell UI)
 *   contactLibrary  — profile supports the contact library panel (future)
 *   cometPull       — profile can pull an existing record from CoMET by UUID
 *   cometPreflight  — profile can run the CoMET preflight chain before push
 *   cometPush       — profile can push a DRAFT record to CoMET
 *
 * @typedef {{
 *   xmlPreview:      boolean,
 *   geoJsonExport:   boolean,
 *   dcatExport:      boolean,
 *   serverValidate:  boolean,
 *   platformLibrary: boolean,
 *   templateCatalog: boolean,
 *   iso2Export:      boolean,
 *   xmlImport:       boolean,
 *   scannerPrefill:  boolean,
 *   contactLibrary:  boolean,
 *   cometPull:       boolean,
 *   cometPreflight:  boolean,
 *   cometPush:       boolean,
 * }} ProfileCapabilities
 */

/**
 * An entity profile is the plugin unit that wires together all aspects of
 * a specific metadata entity type (mission, collection, dataset, etc.).
 *
 * @typedef {{
 *   id: string,
 *   entityType: import('../entities/types.js').EntityType,
 *   label: string,
 *   capabilities: ProfileCapabilities,
 *   defaultState: () => object,
 *   sanitize: (state: object) => object,
 *   initState?: () => object,
 *   mergeLoaded: (loaded: object) => object,
 *   buildXmlPreview?: (state: object) => string,
 *   getExportId?: (state: object) => string,
 *   getFieldLabel?: (fieldPath: string) => string,
 *   steps: StepDefinition[],
 *   validationRuleSets: ValidationRuleSet[],
 *   exportAdapters: ExportAdapter[],
 *   importParsers: ImportParser[],
 *   scannerSuggestionAdapters?: ScannerSuggestionAdapter[],
 *   enrichmentProviders?: EnrichmentProvider[],
 * }} EntityProfile
 */

export {}
