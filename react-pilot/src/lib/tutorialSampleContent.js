/**
 * Canned “average” email + document for the in-app Manta tutorial.
 * Fictional — not real people or systems.
 *
 * @module lib/tutorialSampleContent
 */

export const TUTORIAL_SAMPLE_AVERAGE_EMAIL = `Subject: [EXT] UxS data package — Eagle Ray / Leg 18 — 2024-05-05

From: mdbc.metadata@noaa.example.gov
To: cdr.division@navy.mil, dataset.curator@ncei.example.gov
Date: 2024-05-10 14:22 -0400

Team,

We’re finalizing the MBES bathymetry deliverable for the Point Sur 2024 Leg 18
Eagle Ray UUV sortie. Please use this for the NCEI ISO record and OneStop.

- Title: Point Sur 2024 Leg 18 Eagle Ray Multibeam Sonar Data (UUV Dive 01)
- Collection file ID: PS2418L0_ER_UUV01_Norbit_MB_20240505T1510Z_MD
- Time window: 2024-05-05T15:10Z to 2024-05-06T12:00Z
- W/E/S/N: -120.4 / -120.0 / 36.2 / 36.4  (Northeast Pacific, offshore CA)
- Abstract (draft): The MDBC team collected multibeam bathymetry with a Norbit
  WBMS payload. Data support benthic habitat and slope stability objectives.
- Primary contact: jane.researcher@noaa.gov
- DOI (pending): 10.7289/V5EXAMPLE01

We need a landing page and HTTPS download for catalog mode.

— MDBC PDM
`

export const TUTORIAL_SAMPLE_AVERAGE_DOC = `DATASET SUMMARY (INTERNAL WORKSHEET)
Version: 0.2 | Updated: 2024-05-10

1. Identification
   Title: Point Sur 2024 Leg 18 Eagle Ray Multibeam — UUV Dive 01
   File / granule id: PS2418L0_ER_UUV01_Norbit_MB_20240505T1510Z_MD
   Time: 2024-05-05T15:10Z  →  2024-05-06T12:00Z

2. Extent
   Bounding box: West -120.4  East -120.0  South 36.2  North 36.4
   Vertical: 0 m to 4000 m (MSL)

3. Product
   Format: NetCDF-4, CF-1.8 where applicable
   License: CC-BY-4.0
   Project code: MDBC-2024-PS18
`
