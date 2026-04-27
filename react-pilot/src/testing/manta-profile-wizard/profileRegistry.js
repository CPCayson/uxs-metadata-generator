/**
 * Manta profile registry
 * ----------------------
 * Single source of truth for every profile's shape, steps, GCMD suggestions,
 * validation rules, and classifier patterns. Add a new profile by adding one
 * entry here — the wizard, Ray panel, and classifier all read from this.
 */

export const PROFILES = {
  uxs: {
    id: "uxs",
    label: "UxS mission",
    chip: "UxS · NCEI/CNMOC beta",
    color: "#534AB7",
    chipBg: "#EEEDFE",
    chipFg: "#3C3489",
    rayProfile: "UxS · Mission/Dataset",
    steps: [
      { key: "platform",   label: "Platform",    icon: "cpu" },
      { key: "mission",    label: "Mission",     icon: "file-text" },
      { key: "coverage",   label: "Coverage",    icon: "map-pin" },
      { key: "sensors",    label: "Sensors",     icon: "activity" },
      { key: "contacts",   label: "Contacts",    icon: "users" },
      { key: "keywords",   label: "Keywords",    icon: "tag" },
      { key: "validation", label: "Validation",  icon: "shield" },
      { key: "xml",        label: "XML preview", icon: "code" },
    ],
    stepPct: { platform: 40, mission: 20, coverage: 0, sensors: 60, contacts: 0, keywords: 80, validation: 0, xml: 0 },
    gcmd: [
      { kw: "Oceans > Bathymetry > Ocean Floor Topography", conf: 96 },
      { kw: "Oceans > Ocean Temperature > Water Temperature", conf: 91 },
      { kw: "Biological Classification > Animals > Invertebrates", conf: 84 },
      { kw: "Oceans > Ocean Chemistry > Ocean Salinity", conf: 79 },
      { kw: "Oceans > Marine Sediments > Sediment Composition", conf: 74 },
    ],
    issues: [
      { sev: "ERR", text: "Platform name required — MI_Platform/identifier missing", loc: "Platform", step: "platform", fixable: false },
      { sev: "ERR", text: "Bounding box not set — EX_GeographicBoundingBox", loc: "Coverage", step: "coverage", fixable: false },
      { sev: "WRN", text: "Operator org uses free text — ROR ID not resolved", loc: "Platform", step: "platform", fixable: true },
      { sev: "WRN", text: "Abstract short — add platform, sensor, area, dates", loc: "Mission", step: "mission", fixable: false },
      { sev: "WRN", text: "WMO platform code absent — register at OceanOPS", loc: "Platform", step: "platform", fixable: false },
    ],
    prefill: {
      platform: { platformName: "Norbit AUV", platformType: "AUV", hullId: "UUV01" },
      mission: { title: "Point Sur 2024 Leg 18 Eagle Ray MultiBeam Sonar Data UUV Dive 01", startDate: "2024-05-05", missionId: "PS2418L0", purpose: "Seafloor mapping", abstract: "The MDBC Mapping, Groundtruthing and Modeling team along with USM will conduct UUV acquisition..." },
      sensors: [
        { name: "Multibeam sonar — Norbit iWBMSh", manufacturer: "Norbit AS", detail: "Resolution: 0.5° × 0.5°", source: "filename" },
        { name: "DVL — Teledyne RDI Workhorse Navigator", manufacturer: "Teledyne Marine", detail: "", source: "library" },
      ],
    },
    comet: { push: false, reason: "Fix 2 errors before pushing" },
  },

  oer: {
    id: "oer",
    label: "OER Mission PED",
    chip: "Mission PED · OER",
    color: "#1D9E75",
    chipBg: "#E1F5EE",
    chipFg: "#085041",
    rayProfile: "OER · Mission/PED",
    steps: [
      { key: "mission",    label: "Mission",      icon: "anchor" },
      { key: "platform",   label: "Platform",     icon: "ship" },
      { key: "sensors",    label: "Sensors",      icon: "activity" },
      { key: "spatial",    label: "Spatial",      icon: "map-pin" },
      { key: "keywords",   label: "Keywords",     icon: "tag" },
      { key: "distribution", label: "Distribution", icon: "upload-cloud" },
      { key: "validation", label: "Validation",   icon: "shield" },
      { key: "xml",        label: "XML preview",  icon: "code" },
    ],
    stepPct: { mission: 55, platform: 30, sensors: 80, spatial: 0, keywords: 70, distribution: 0, validation: 0, xml: 0 },
    gcmd: [
      { kw: "Oceans > Ocean Acoustics > Acoustic Scattering", conf: 94 },
      { kw: "Oceans > Marine Biology > Benthic Habitat", conf: 89 },
      { kw: "Biosphere > Aquatic Ecosystems > Marine Habitat", conf: 83 },
      { kw: "Oceans > Bathymetry > Seafloor Topography", conf: 77 },
      { kw: "Oceans > Coastal Processes > Coral Reefs", conf: 71 },
    ],
    issues: [
      { sev: "ERR", text: "Spatial extent not set — EX_GeographicBoundingBox", loc: "Spatial", step: "spatial", fixable: false },
      { sev: "ERR", text: "Distribution contact missing — Send2NCEI / ATRAC path not set", loc: "Distribution", step: "distribution", fixable: false },
      { sev: "WRN", text: "Platform type not controlled — use MI_PlatformTypeCode list", loc: "Platform", step: "platform", fixable: true },
      { sev: "WRN", text: "Cruise report not attached as supplemental document", loc: "Mission", step: "mission", fixable: false },
    ],
    prefill: {
      mission: { abstract: "", expeditionId: "", chiefScientist: "" },
    },
    comet: { push: false, reason: "Fix 2 errors before pushing" },
  },

  nofo: {
    id: "nofo",
    label: "NOFO closeout",
    chip: "NOFO · Closeout",
    color: "#BA7517",
    chipBg: "#FAEEDA",
    chipFg: "#633806",
    rayProfile: "NOFO · Closeout",
    steps: [
      { key: "project",   label: "Project",          icon: "clipboard" },
      { key: "disp",      label: "DISP / DMP",       icon: "check-square" },
      { key: "products",  label: "Expected products", icon: "database" },
      { key: "archive",   label: "Archive checklist", icon: "archive" },
      { key: "contacts",  label: "Contacts",          icon: "users" },
      { key: "keywords",  label: "Keywords",          icon: "tag" },
      { key: "validation",label: "Validation",        icon: "shield" },
      { key: "handoff",   label: "Handoff",           icon: "send" },
    ],
    stepPct: { project: 60, disp: 40, products: 10, archive: 0, contacts: 70, keywords: 50, validation: 0, handoff: 0 },
    gcmd: [
      { kw: "Oceans > Ocean Acoustics > Acoustic Velocity", conf: 88 },
      { kw: "Oceans > Marine Biology > Fish", conf: 82 },
      { kw: "Biosphere > Ecological Dynamics > Ecosystem Functions", conf: 76 },
      { kw: "Oceans > Salinity/Density > Conductivity", conf: 70 },
      { kw: "Human Dimensions > Natural Hazards > Tsunamis", conf: 64 },
    ],
    issues: [
      { sev: "ERR", text: "Expected products table incomplete — PI must fill all data types", loc: "Expected products", step: "products", fixable: false },
      { sev: "ERR", text: "Archive package path missing — Send2NCEI not linked", loc: "Archive checklist", step: "archive", fixable: false },
      { sev: "WRN", text: "DISP compliance check not submitted", loc: "DISP / DMP", step: "disp", fixable: true },
      { sev: "WRN", text: "Landing page metadata not generated for OER Data Atlas", loc: "Handoff", step: "handoff", fixable: false },
      { sev: "WRN", text: "Cruise report not attached as primary document", loc: "Project", step: "project", fixable: false },
    ],
    prefill: {},
    comet: { push: false, reason: "NOFO records route to Send2NCEI, not CoMET directly" },
  },

  bedi: {
    id: "bedi",
    label: "BEDI granule",
    chip: "BEDI · Granule",
    color: "#D85A30",
    chipBg: "#FAECE7",
    chipFg: "#712B13",
    rayProfile: "BEDI · Granule",
    steps: [
      { key: "identification", label: "Identification", icon: "hash" },
      { key: "images",         label: "Image links",    icon: "image" },
      { key: "taxonomy",       label: "Taxonomy",       icon: "git-branch" },
      { key: "spatial",        label: "Spatial / dive", icon: "map-pin" },
      { key: "keywords",       label: "Keywords",       icon: "tag" },
      { key: "distribution",   label: "Distribution",   icon: "upload-cloud" },
      { key: "validation",     label: "Validation",     icon: "shield" },
      { key: "xml",            label: "XML preview",    icon: "code" },
    ],
    stepPct: { identification: 50, images: 40, taxonomy: 10, spatial: 80, keywords: 70, distribution: 0, validation: 0, xml: 0 },
    gcmd: [
      { kw: "Biological Classification > Animals > Invertebrates", conf: 96 },
      { kw: "Oceans > Marine Biology > Benthic Habitat", conf: 91 },
      { kw: "Biological Classification > Animals > Corals", conf: 85 },
      { kw: "Biosphere > Ecological Dynamics > Species/Population Interactions", conf: 78 },
      { kw: "Biological Classification > Animals > Echinoderms", conf: 72 },
    ],
    issues: [
      { sev: "ERR", text: "WoRMS ID not resolved — taxonomy unvalidated", loc: "Taxonomy", step: "taxonomy", fixable: false },
      { sev: "ERR", text: "Parent collection ID missing — granule must link to collection", loc: "Identification", step: "identification", fixable: false },
      { sev: "WRN", text: "Image WAF path not set — NCEI WAF URL required", loc: "Image links", step: "images", fixable: false },
      { sev: "WRN", text: "Annotation source not specified (SeaTube / VARS / manual)", loc: "Image links", step: "images", fixable: true },
    ],
    prefill: {},
    comet: { push: false, reason: "Fix 2 errors, then push BEDI collection — not granule directly" },
  },

  collection: {
    id: "collection",
    label: "Collection record",
    chip: "Collection · ISO 19115-1",
    color: "#185FA5",
    chipBg: "#E6F1FB",
    chipFg: "#0C447C",
    rayProfile: "Collection · ISO 19115-1",
    steps: [
      { key: "identification", label: "Identification", icon: "file-text" },
      { key: "extent",         label: "Extent",         icon: "map-pin" },
      { key: "distribution",   label: "Distribution",   icon: "upload-cloud" },
      { key: "keywords",       label: "Keywords",       icon: "tag" },
      { key: "contacts",       label: "Contacts",       icon: "users" },
      { key: "validation",     label: "Validation",     icon: "shield" },
      { key: "xml",            label: "XML preview",    icon: "code" },
    ],
    stepPct: { identification: 60, extent: 0, distribution: 0, keywords: 80, contacts: 70, validation: 0, xml: 0 },
    gcmd: [
      { kw: "Oceans > Ocean Temperature > Sea Surface Temperature", conf: 90 },
      { kw: "Oceans > Salinity/Density > Salinity", conf: 85 },
      { kw: "Atmosphere > Atmospheric Winds > Surface Winds", conf: 78 },
      { kw: "Oceans > Sea Ice > Ice Extent", conf: 71 },
      { kw: "Oceans > Ocean Optics > Secchi Depth", conf: 65 },
    ],
    issues: [
      { sev: "ERR", text: "Spatial extent not set — EX_GeographicBoundingBox required", loc: "Extent", step: "extent", fixable: false },
      { sev: "ERR", text: "Distribution info missing — no access link or format", loc: "Distribution", step: "distribution", fixable: false },
      { sev: "WRN", text: "Abstract under 150 characters — too brief for OneStop discovery", loc: "Identification", step: "identification", fixable: false },
    ],
    prefill: {},
    comet: { push: false, reason: "Fix 2 errors before pushing" },
  },
};

/**
 * Classifier — call with any text (pasted XML, doc text, filename)
 * Returns { profileId, confidence, label, fieldsNote } or null
 */
const CLASSIFIER_RULES = [
  {
    id: "uxs",
    patterns: ["MI_Metadata","gmi:","UxS","UUV","AUV","glider","saildrone",
               "uncrewed","USV","UAS","MDBC","norbit","autonomo","dive identifier"],
    confidence: 94,
    label: "UxS mission record",
    fieldsNote: "gmi:MI_Metadata detected · 12 fields extractable",
  },
  {
    id: "bedi",
    patterns: ["BEDI","benthic","granule","WoRMS","SeaTube","annotation",
               "taxon","species","coral","sponge","aphia"],
    confidence: 92,
    label: "BEDI granule record",
    fieldsNote: "BEDI granule pattern detected · 8 fields extractable",
  },
  {
    id: "oer",
    patterns: ["EX-","expedition","okeanos","ROV","OER","NOFO","geophysical",
               "multibeam","cruisepack","dive","chief scientist"],
    confidence: 89,
    label: "OER Mission PED record",
    fieldsNote: "Mission PED pattern detected · 9 fields extractable",
  },
  {
    id: "nofo",
    patterns: ["NOFO","DISP","DMP","closeout","final report","grant",
               "award","proposal","principal investigator","data management plan"],
    confidence: 85,
    label: "NOFO closeout record",
    fieldsNote: "NOFO closeout pattern detected · 7 fields extractable",
  },
  {
    id: "collection",
    patterns: ["MD_Metadata","gmd:","collection","dataset","archive","accession",
               "ISO 19115-1","Dublin Core"],
    confidence: 80,
    label: "Collection record (ISO 19115-1)",
    fieldsNote: "ISO MD_Metadata pattern detected · 6 fields extractable",
  },
];

export function classifyInput(text) {
  if (!text || text.trim().length < 10) return null;
  const lower = text.toLowerCase();
  for (const rule of CLASSIFIER_RULES) {
    const hits = rule.patterns.filter(p => lower.includes(p.toLowerCase()));
    if (hits.length > 0) {
      return {
        profileId: rule.id,
        confidence: rule.confidence,
        label: rule.label,
        fieldsNote: rule.fieldsNote,
        matchedPatterns: hits,
      };
    }
  }
  return null;
}
