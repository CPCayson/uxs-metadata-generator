# NCEI UxS GMI XML template — narrative overview

This document restates how the **ISO 19115-2** UxS acquisition template is organized in XML (`gmi:MI_Metadata` with `gmd`, `gmi`, `gco`, etc.). Use it alongside the machine-oriented map in [uxs-ncei-template-mission-pilot-matrix.md](./uxs-ncei-template-mission-pilot-matrix.md), which ties each area to `pilotState` and `importPilotPartialStateFromXml`.

**Related artifacts (local paths vary by machine)**

- Navy/NCEI GMI template XML (verify fixture in this repo): `../NOAANavyUxSAcquisition_MetadataTempate_19115-2-GMI_2026-2 (1).xml`
- Placeholder workbook crosswalk: [uxs-ncei-placeholder-xlsx-crosswalk.md](./uxs-ncei-placeholder-xlsx-crosswalk.md)
- NCEI overview PDF (same title as some local copies): [UxS Metadata Template Overview (PDF)](https://www.ncei.noaa.gov/sites/default/files/2026-03/UxS%20Metatdata%20Template%20Overview.pdf)

---

## 1. Root and header information

These elements define the document structure, unique identification, and standards compliance.

| Element / idea | Role |
| --- | --- |
| `gmi:MI_Metadata` | Root element; declares namespaces (`xmlns:gmi`, `gmd`, `gco`, …). |
| `gmd:fileIdentifier` | Unique string (often UUID) for this metadata record in a catalog or archive. Template note: often prefixed with `gov.noaa.ncei.uxs:`. |
| `gmd:language` | Language of the metadata record (e.g. `eng; USA`). |
| `gmd:hierarchyLevel` | Scope of the metadata (template: **dataset**). |
| `gmd:contact` | Contact for the **metadata record** (preparer), not necessarily the field scientist. |
| `gmd:dateStamp` | Metadata created/updated (date or ISO timestamp). |
| `gmd:metadataStandardName` & `gmd:metadataStandardVersion` | Citation for the standard (e.g. ISO 19115-2:2009(E)). |

---

## 2. Spatial representation information

`gmd:spatialRepresentationInfo` describes the spatial structure of the data (gridded / multidimensional).

| Element / idea | Role |
| --- | --- |
| `gmd:MD_GridSpatialRepresentation` | Data represented as a grid. |
| `gmd:numberOfDimensions` | Count (e.g. 3 for lat/lon/time or lat/lon/depth). |
| `gmd:axisDimensionProperties` | Repeatable axis: **row**, **column**, **vertical**. |
| `gmd:dimensionSize` | Elements along that axis. |
| `gmd:resolution` | Spacing between grid points. |
| `gmd:cellGeometry` | Point vs area semantics for cells. |

---

## 3. Identification information

`gmd:identificationInfo` holds the core dataset description.

### A. Citation (`gmd:citation`)

- `gmd:title` — Main title of the dataset or collection.
- `gmd:date` — Repeatable: **creation**, **publication**, etc.
- `gmd:identifier` — DOI, NCEI accession, metadata ID, etc.
- `gmd:citedResponsibleParty` — **author**, **publisher**, **originator** roles.

### B. Description

- `gmd:abstract`, `gmd:purpose`, `gmd:status`

### C. Keywords (`gmd:descriptiveKeywords`)

GCMD-style facets: science theme, place, platform, instrument, project, data centre, etc.

### D. Constraints (`gmd:resourceConstraints` / `gmd:MD_LegalConstraints`)

- `useLimitation`, `otherConstraints` (citations, license text, DocuComp links).

### E. Aggregation (`gmd:aggregationInfo`)

Parent project, related datasets/URLs, associated publications.

### F. Extent (`gmd:extent`)

Geographic bounding box, temporal extent, vertical extent and CRS hints.

---

## 4. Content information

`gmd:contentInfo` describes variables/parameters in the files.

- `gmi:MI_CoverageDescription` — coverage wrapper.
- `gmd:contentType` — e.g. physical measurement.
- `gmd:dimension` / variable blocks — `MemberName`, descriptors tying variables to platform/sensor context.

---

## 5. Distribution information

`gmd:distributionInfo` — how to access the data.

- `gmd:distributorContact` — who to contact (often NCEI; may be xlink or embedded party).
- `gmd:fees` — e.g. free electronic download.
- `gmd:distributorFormat` — NetCDF, CSV, etc.
- `gmd:distributorTransferOptions` / `gmd:onLine` — metadata landing page, download URLs, protocols, names, descriptions.

---

## 6. Data quality and maintenance

- `gmd:dataQualityInfo` / `gmd:DQ_DataQuality` — scope at dataset level, quantitative accuracy reports, and **lineage** (`gmd:lineage` / `LI_Lineage`: statement and process steps).
- `gmd:resourceMaintenance` / `gmd:metadataMaintenance` — how often metadata is updated (e.g. **asNeeded**).

---

## 7. Acquisition information (UxS-specific)

`gmi:acquisitionInformation` documents hardware.

- Standalone `gmi:instrument` list (repeatable).
- `gmi:platform` — platform id, description, nested `gmi:instrument` mounted on that platform.

---

## Formatting conventions in the template

- `{{ text }}` — Placeholder values the author must replace.
- `xlink:href` — Links to external code lists, vocabularies, DocuComp components, etc.

---

## Pilot app (`react-pilot`) alignment

Import and preview logic live in `src/lib/xmlPilotImport.js` and `src/lib/xmlPreviewBuilder.js`. Section-by-section import status is maintained in [uxs-ncei-template-mission-pilot-matrix.md](./uxs-ncei-template-mission-pilot-matrix.md). Not every XML leaf has a dedicated wizard field; the matrix marks **Full**, **Partial**, or **None** accordingly.
