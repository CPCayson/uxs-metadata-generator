/**
 * Build a catalog-valid fixture from the Navy UxS beta template (heavy `{{placeholders}}`).
 * Writes `fixtures/mission/navy-uxs-swarm-clean.xml` for `swarm:audit:import`.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REACT_PILOT = path.resolve(__dirname, '../..')
const USX_ROOT = path.resolve(REACT_PILOT, '..')
const OUT = path.join(REACT_PILOT, 'fixtures/mission/navy-uxs-swarm-clean.xml')

const SRC =
  process.argv[2] ||
  path.join(USX_ROOT, 'NOAANavyUxSAcquisition_MetadataTempate_19115-2-GMI_2026-2 (1).xml')

const ROR_SNIPPET = `                    <gmd:party>
                        <gmd:CI_Organisation>
                            <gmd:name>
                                <gco:CharacterString>NOAA National Centers for Environmental Information</gco:CharacterString>
                            </gmd:name>
                            <gmd:identifier>
                                <gmd:MD_Identifier>
                                    <gmd:code>
                                        <gmx:Anchor xlink:href="https://ror.org/04r0wrp59" xlink:title="NCEI ROR">NOAA NCEI</gmx:Anchor>
                                    </gmd:code>
                                </gmd:MD_Identifier>
                            </gmd:identifier>
                        </gmd:CI_Organisation>
                    </gmd:party>
`

const PROVIDERS_BLOCK = `
            <gmd:descriptiveKeywords>
                <gmd:MD_Keywords>
                    <gmd:keyword>
                        <gco:CharacterString>U.S. Navy > United States Department of Defense > Department of the Navy</gco:CharacterString>
                    </gmd:keyword>
                    <gmd:type>
                        <gmd:MD_KeywordTypeCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#MD_KeywordTypeCode" codeListValue="theme">theme</gmd:MD_KeywordTypeCode>
                    </gmd:type>
                    <gmd:thesaurusName
                        xlink:href="https://data.noaa.gov/docucomp/placeholder-providers"
                        xlink:title="Global Change Master Directory (GCMD) Provider Keywords"/>
                </gmd:MD_Keywords>
            </gmd:descriptiveKeywords>
`

function applyPairs(xml, pairs) {
  let out = xml
  for (const [from, to] of pairs) {
    if (from && out.includes(from)) out = out.split(from).join(to)
  }
  return out
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Source not found: ${SRC}`)
    process.exit(1)
  }
  let xml = fs.readFileSync(SRC, 'utf8')

  /** @type {Array<[string, string]>} */
  const globalPairs = [
    [
      'gov.noaa.ncei.uxs:{{Unique Identifier Assigned to Metadata Record}}',
      'gov.noaa.ncei.uxs:SWARM_DEMO_001',
    ],
    ['{{DOI}}', '10.25923/swarm-demo-uxs'],
    [
      '<gco:CharacterString>NCEI Accession ID: {{identifier}}</gco:CharacterString>',
      '<gco:CharacterString>0240867</gco:CharacterString>',
    ],
    [
      '<gmx:Anchor xlink:href="https://doi.org/{{DOI}}"',
      '<gmx:Anchor xlink:href="https://doi.org/10.25923/swarm-demo-uxs"',
    ],
    ['<gco:Date>{{2024-10-11}}</gco:Date>', '<gco:Date>2024-10-11</gco:Date>'],
    ['<gco:Date>{{9999-09-09}}</gco:Date>', '<gco:Date>2023-06-01</gco:Date>'],
    [
      '<gml:beginPosition>{{9999-01-01}}</gml:beginPosition>',
      '<gml:beginPosition>2024-05-05T00:00:00Z</gml:beginPosition>',
    ],
    [
      '<gml:endPosition>{{9999-01-02}}</gml:endPosition>',
      '<gml:endPosition>2024-05-06T12:00:00Z</gml:endPosition>',
    ],
    ['{{2025-09-23T18:47:22}}', '2025-09-23T18:47:22'],
    ['{{-180}}', '-97.5'],
    ['{{180}}', '-82.0'],
    ['{{-90}}', '24.0'],
    ['{{90}}', '31.0'],
    ['{{99}}', '512'],
    ['{{UNIT}}', 'meter'],
    ['{{day}}', 'day'],
    ['{{format name}}', 'NetCDF'],
    ['{{accessURL}}', 'https://www.ncei.noaa.gov/data/path/demo-swarm-file.nc'],
    ['{{URL type ID}}', 'HTTPS'],
    ['{{name of accessURL}}', 'NCEI direct download'],
    [
      '{{description of accessURL}}',
      'Gridded demonstration extract for swarm import QA.',
    ],
    ['{{fileIdentifier}}', 'SWARM_DEMO_001'],
    [
      '{{Aquisition (data collection) entity should be globally unique}}',
      'PS2418L0 UUV Swarm acquisition demo',
    ],
    [
      '{{Not a scientific abstract. Describe dataset, goals of mission.}}',
      'Demonstration UxS acquisition for swarm import QA: UUV hydrography in the Gulf of Mexico with CTD and ADCP, May 2024.',
    ],
    [
      '{{Not a scientific abstract. Describe collection purpose/overarching project.}}',
      'Validate catalog-ready metadata assembly for Navy UxS templates in the metadata pilot.',
    ],
    ['{{POC for Dataset}}', 'Jane Analyst'],
    ['{{POC Email}}', 'jane.analyst@noaa.gov'],
    ['{{Website for POC\'s Org}}', 'https://www.noaa.gov'],
    ['{{POC\'s Org}}', 'NOAA Ocean Exploration'],
    [
      '{{AT LEAST ONE OF ORGANISATION, INDIVIDUAL OR POSITION}}',
      'NCEI Data Steward',
    ],
    [
      '{{Contact Email for Responsible Party or Org}}',
      'metadata.steward@noaa.gov',
    ],
    ['{{website for Responsible Party or Org.com}}', 'https://www.ncei.noaa.gov'],
    [
      '{{The connection protocol to be used such as http, ftp, etc.}}',
      'HTTPS',
    ],
    [
      '{{Background Information Name of the online resource.}}',
      'Organization landing page',
    ],
    [
      '{{Background information from the source. Description of the online resource that provides the resource sought.}}',
      'Official NCEI web presence.',
    ],
    ['{{BRIEF DESCRIPTION OF EXTENT}}', 'Gulf of Mexico UUV corridor'],
    ['{{any other information}}', 'Synthetic-but-valid values for automated swarm audit.'],
    [
      '{{BRIEF DESCRIPTION OF PLATFORM}}',
      'Bluefin-21 class UUV with standard sensor payload for hydrographic sorties.',
    ],
    ['{{PLATFORM_ID}}', 'UUV-SWARM-01'],
    ['{{TYPE OF INSTRUMENT}}', 'CTD'],
    ['{{BRIEF DESCRIPTION OF INSTRUMENT}}', 'Conductivity—temperature—depth profiler.'],
    ['{{Variable Name}}', 'temperature'],
    ['{{String}}', 'float'],
    [
      '{{Platform and Instrument/Sensor Used}}',
      'UUV CTD pressure/ temperature',
    ],
    ['{{CITE AS STATEMENT}}', 'Cite as: NOAA NCEI (2024) UxS swarm demo dataset.'],
    [
      '{{OTHER CITE AS STATEMENTS (e.g. reference papers)}}',
      'See associated publication for methodology.',
    ],
    [
      '{{https://data.noaa.gov/docucomp/10bb305d-f440-4b92-8c1c-759dd543bc51}}',
      'https://data.noaa.gov/docucomp/10bb305d-f440-4b92-8c1c-759dd543bc51',
    ],
    ['{{TITLE OF PROJECT}}', 'Navy UxS Swarm Demonstration Cruise'],
    ['{{PROJECT ID}}', 'NAVY-UXS-SWARM-2024'],
    [
      '{{TITLE OF PUBLICATION}}',
      'Demo publication for Navy UxS swarm metadata validation',
    ],
    ['{{ID OF PUBLICATION}}', '10.25923/swarm-pub-001'],
    ['#{{verticalCRSandUnits}}"', '#verticalCRS-demo"'],
    [
      '{{related dataset title}}',
      'Archived related glider transect dataset (demo reference)',
    ],
    ['{{dataset identifier}}', 'GLIDER-DEMO-REL-01'],
    ['{{related data organization name}}', 'NOAA NCEI'],
    ['{{relatedDataURL}}', 'https://www.ncei.noaa.gov'],
    ['{{related data url title}}', 'NCEI home'],
    ['{{related data description}}', 'Related holdings landing.'],
  ]
  xml = applyPairs(xml, globalPairs)

  let typoIdx = 0
  xml = xml.replaceAll(
    '<gco:CharacterString>{INSTRUMENT_ID}}</gco:CharacterString>',
    () => {
      typoIdx += 1
      if (typoIdx === 1) return '<gco:CharacterString>CTD-SWARM-01</gco:CharacterString>'
      return '<gco:CharacterString>ADCP-SWARM-01</gco:CharacterString>'
    },
  )
  const platIx = xml.indexOf('<gmi:platform>')
  const instrToken = '<gco:CharacterString>{{INSTRUMENT_ID}}</gco:CharacterString>'
  if (platIx !== -1) {
    const rel = xml.indexOf(instrToken, platIx)
    if (rel !== -1) {
      xml =
        xml.slice(0, rel) +
        '<gco:CharacterString>ADCP-SWARM-02</gco:CharacterString>' +
        xml.slice(rel + instrToken.length)
    }
  }

  xml = xml.replace(
    `<gmi:MI_CoverageDescription>
            <gmd:attributeDescription gco:nilReason="unknown"/>`,
    `<gmi:MI_CoverageDescription>
            <gmd:identifier>
                <gmd:MD_Identifier>
                    <gmd:code>
                        <gco:CharacterString>UUV-SWARM-01</gco:CharacterString>
                    </gmd:code>
                </gmd:MD_Identifier>
            </gmd:identifier>
            <gmd:name>
                <gco:CharacterString>sea_water_temperature</gco:CharacterString>
            </gmd:name>
            <gmd:attributeDescription gco:nilReason="unknown"/>`,
  )

  /** Contextual (unique surrounding XML). */
  const contextual = [
    [
      `<gmd:keyword>
                        <gco:CharacterString>{{Earth Science > Topic > Term > Variable_Level_1}}</gco:CharacterString>
                    </gmd:keyword>
                    <gmd:type>
                        <gmd:MD_KeywordTypeCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#MD_KeywordTypeCode" codeListValue="theme">theme</gmd:MD_KeywordTypeCode>
                    </gmd:type>
                    <gmd:thesaurusName
                        xlink:href="https://data.noaa.gov/docucomp/227737d0-428b-11df-9879-0800200c9a66"
                        xlink:title="Global Change Master Directory (GCMD) Science Keywords"/>`,
      `<gmd:keyword>
                        <gco:CharacterString>Oceans > Ocean Temperature > Sea Surface Temperature</gco:CharacterString>
                    </gmd:keyword>
                    <gmd:type>
                        <gmd:MD_KeywordTypeCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#MD_KeywordTypeCode" codeListValue="theme">theme</gmd:MD_KeywordTypeCode>
                    </gmd:type>
                    <gmd:thesaurusName
                        xlink:href="https://data.noaa.gov/docucomp/227737d0-428b-11df-9879-0800200c9a66"
                        xlink:title="Global Change Master Directory (GCMD) Science Keywords"/>`,
    ],
    [
      `<gmd:keyword>
                        <gco:CharacterString>{{Location_Category > Location_Type > Location_Subregion1}}</gco:CharacterString>
                    </gmd:keyword>
                    <gmd:type>
                        <gmd:MD_KeywordTypeCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#MD_KeywordTypeCode" codeListValue="place">place</gmd:MD_KeywordTypeCode>
                    </gmd:type>
                    <gmd:thesaurusName
                        xlink:href="https://data.noaa.gov/docucomp/82A5DD19565ACBECE040AC8C5AB41A40"
                        xlink:title="Global Change Master Directory (GCMD) Location Keywords"/>`,
      `<gmd:keyword>
                        <gco:CharacterString>Gulf of Mexico > Gulf of Mexico, North > Gulf of Mexico Basin</gco:CharacterString>
                    </gmd:keyword>
                    <gmd:type>
                        <gmd:MD_KeywordTypeCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#MD_KeywordTypeCode" codeListValue="place">place</gmd:MD_KeywordTypeCode>
                    </gmd:type>
                    <gmd:thesaurusName
                        xlink:href="https://data.noaa.gov/docucomp/82A5DD19565ACBECE040AC8C5AB41A40"
                        xlink:title="Global Change Master Directory (GCMD) Location Keywords"/>`,
    ],
    [
      `<!-- Platform Keywords -->
            <gmd:descriptiveKeywords>
                <gmd:MD_Keywords>
                    <gmd:keyword>
                        <gco:CharacterString>{{Short_Name > Long_Name}}</gco:CharacterString>
                    </gmd:keyword>`,
      `<!-- Platform Keywords -->
            <gmd:descriptiveKeywords>
                <gmd:MD_Keywords>
                    <gmd:keyword>
                        <gco:CharacterString>UUV > Unmanned Underwater Vehicle</gco:CharacterString>
                    </gmd:keyword>`,
    ],
    [
      `<!-- Instrument/Sensor Keywords - REPEATABLE -->
            <gmd:descriptiveKeywords>
                <gmd:MD_Keywords>
                    <gmd:keyword>
                        <gco:CharacterString>{{Short_Name > Long_Name}}</gco:CharacterString>
                    </gmd:keyword>`,
      `<!-- Instrument/Sensor Keywords - REPEATABLE -->
            <gmd:descriptiveKeywords>
                <gmd:MD_Keywords>
                    <gmd:keyword>
                        <gco:CharacterString>ADCP > Acoustic Doppler Current Profiler</gco:CharacterString>
                    </gmd:keyword>`,
    ],
    [
      `<!-- Project Keywords - REPEATABLE -->
            <gmd:descriptiveKeywords>
                <gmd:MD_Keywords>
                    <gmd:keyword>
                        <gco:CharacterString>{{Short_Name > Long_Name}}</gco:CharacterString>
                    </gmd:keyword>`,
      `<!-- Project Keywords - REPEATABLE -->
            <gmd:descriptiveKeywords>
                <gmd:MD_Keywords>
                    <gmd:keyword>
                        <gco:CharacterString>JPSS Initiative > Joint Polar Satellite System</gco:CharacterString>
                    </gmd:keyword>`,
    ],
    [
      `<gmd:keyword>
                        <gco:CharacterString>{{Short_Name > Long_Name}}</gco:CharacterString>
                    </gmd:keyword>
                    <gmd:type>
                        <gmd:MD_KeywordTypeCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#MD_KeywordTypeCode" codeListValue="dataCentre">dataCentre</gmd:MD_KeywordTypeCode>
                    </gmd:type>
                    <gmd:thesaurusName
                        xlink:href="https://data.noaa.gov/docucomp/9f0de6e6-428b-11df-9879-0800200c9a66"
                        xlink:title="Global Change Master Directory (GCMD) Data Center Keywords"/>`,
      `<gmd:keyword>
                        <gco:CharacterString>DOC/NOAA/NESDIS/NCEI > National Centers for Environmental Information, NESDIS, NOAA, U.S. Department of Commerce</gco:CharacterString>
                    </gmd:keyword>
                    <gmd:type>
                        <gmd:MD_KeywordTypeCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#MD_KeywordTypeCode" codeListValue="dataCentre">dataCentre</gmd:MD_KeywordTypeCode>
                    </gmd:type>
                    <gmd:thesaurusName
                        xlink:href="https://data.noaa.gov/docucomp/9f0de6e6-428b-11df-9879-0800200c9a66"
                        xlink:title="Global Change Master Directory (GCMD) Data Center Keywords"/>`,
    ],
  ]
  xml = applyPairs(xml, contextual)

  xml = xml.replace(
    '</gmd:contactInfo>\n                    <gmd:role>\n                        <gmd:CI_RoleCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#CI_RoleCode" codeListValue="pointOfContact">pointOfContact</gmd:CI_RoleCode>',
    `</gmd:contactInfo>
${ROR_SNIPPET}                    <gmd:role>
                        <gmd:CI_RoleCode codeList="https://data.noaa.gov/resources/iso19139/schema/resources/Codelist/gmxCodelists.xml#CI_RoleCode" codeListValue="pointOfContact">pointOfContact</gmd:CI_RoleCode>`,
  )

  xml = xml.replace(
    '<gmi:platform>\n                <gmi:MI_Platform>\n                    <gmi:identifier>',
    '<gmi:platform>\n                <gmi:MI_Platform>\n                    <gmi:type>\n                        <gco:CharacterString>Unmanned Underwater Vehicle</gco:CharacterString>\n                    </gmi:type>\n                    <gmi:identifier>',
  )

  xml = xml.replace(
    `<gmi:instrument>
                        <gmi:MI_Instrument>
                            <gmi:identifier>
                                <gmd:MD_Identifier>
                                    <gmd:code>
                                        <gco:CharacterString>ADCP-SWARM-02</gco:CharacterString>
                                    </gmd:code>
                                </gmd:MD_Identifier>
                            </gmi:identifier>
                            <gmi:type>
                                <gco:CharacterString>CTD</gco:CharacterString>
                            </gmi:type>
                            <gmi:description>
                                <gco:CharacterString>Conductivity—temperature—depth profiler.</gco:CharacterString>
                            </gmi:description>
                        </gmi:MI_Instrument>
                    </gmi:instrument>
                </gmi:MI_Platform>`,
    `<gmi:instrument>
                        <gmi:MI_Instrument>
                            <gmi:identifier>
                                <gmd:MD_Identifier>
                                    <gmd:code>
                                        <gco:CharacterString>ADCP-SWARM-02</gco:CharacterString>
                                    </gmd:code>
                                </gmd:MD_Identifier>
                            </gmi:identifier>
                            <gmi:type>
                                <gco:CharacterString>ADCP</gco:CharacterString>
                            </gmi:type>
                            <gmi:description>
                                <gco:CharacterString>Teledyne RDI 4-beam ADCP (platform-mounted).</gco:CharacterString>
                            </gmi:description>
                        </gmi:MI_Instrument>
                    </gmi:instrument>
                </gmi:MI_Platform>`,
  )

  const dataIdClose = '</gmd:MD_DataIdentification>'
  const ix = xml.indexOf(dataIdClose)
  if (ix === -1) {
    console.error('Could not find MD_DataIdentification close')
    process.exit(1)
  }
  xml = xml.slice(0, ix) + PROVIDERS_BLOCK + xml.slice(ix)

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, xml, 'utf8')
  console.log(`Wrote ${OUT}`)
}

main()
