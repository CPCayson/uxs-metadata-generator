/**
 * One-time DB setup — creates tables and seeds all data.
 * Run: node db/setup.mjs
 */
import { Pool } from '@neondatabase/serverless'

const DB_URL = 'postgresql://neondb_owner:npg_ktSG20HDYfML@ep-hidden-bar-aelybu8c.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
const pool = new Pool({ connectionString: DB_URL })

async function run(label, sql) {
  process.stdout.write(`  ${label}... `)
  try {
    await pool.query(sql)
    console.log('✓')
  } catch (e) {
    console.log(`✗  ${e.message}`)
  }
}

console.log('\n── Creating tables ──')

await run('platforms', `
  CREATE TABLE IF NOT EXISTS platforms (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL DEFAULT '',
    type              TEXT NOT NULL DEFAULT '',
    manufacturer      TEXT NOT NULL DEFAULT '',
    model             TEXT NOT NULL DEFAULT '',
    weight            NUMERIC       DEFAULT 0,
    length            NUMERIC       DEFAULT 0,
    width             NUMERIC       DEFAULT 0,
    height            NUMERIC       DEFAULT 0,
    power_source      TEXT NOT NULL DEFAULT '',
    navigation_system TEXT NOT NULL DEFAULT '',
    comments          TEXT NOT NULL DEFAULT '',
    serial_number     TEXT NOT NULL DEFAULT '',
    deployment_date   TEXT NOT NULL DEFAULT '',
    updated_at        TIMESTAMPTZ   DEFAULT NOW()
  )
`)

await run('sensors', `
  CREATE TABLE IF NOT EXISTS sensors (
    id                     TEXT PRIMARY KEY,
    type                   TEXT NOT NULL DEFAULT '',
    firmware               TEXT NOT NULL DEFAULT '',
    install_date           TEXT NOT NULL DEFAULT '',
    uncertainty            TEXT NOT NULL DEFAULT '',
    operation_mode         TEXT NOT NULL DEFAULT '',
    frequency              TEXT NOT NULL DEFAULT '',
    beam_count             INTEGER       DEFAULT 0,
    depth_rating           TEXT NOT NULL DEFAULT '',
    confidence_interval    TEXT NOT NULL DEFAULT '',
    sensor_language        TEXT NOT NULL DEFAULT '',
    sensor_character_set   TEXT NOT NULL DEFAULT '',
    event                  TEXT NOT NULL DEFAULT '',
    pressure_range         TEXT NOT NULL DEFAULT '',
    conductivity_range     TEXT NOT NULL DEFAULT '',
    temperature_range      TEXT NOT NULL DEFAULT '',
    manufacturer           TEXT NOT NULL DEFAULT '',
    model                  TEXT NOT NULL DEFAULT '',
    serial_number          TEXT NOT NULL DEFAULT '',
    calibration_date       TEXT NOT NULL DEFAULT '',
    accuracy               TEXT NOT NULL DEFAULT '',
    resolution             TEXT NOT NULL DEFAULT '',
    power_requirement      TEXT NOT NULL DEFAULT '',
    data_format            TEXT NOT NULL DEFAULT '',
    communication_protocol TEXT NOT NULL DEFAULT '',
    operating_temperature  TEXT NOT NULL DEFAULT '',
    operating_pressure     TEXT NOT NULL DEFAULT '',
    dimensions             TEXT NOT NULL DEFAULT '',
    weight                 TEXT NOT NULL DEFAULT '',
    warranty               TEXT NOT NULL DEFAULT '',
    notes                  TEXT NOT NULL DEFAULT '',
    updated_at             TIMESTAMPTZ   DEFAULT NOW()
  )
`)

await run('templates', `
  CREATE TABLE IF NOT EXISTS templates (
    name       TEXT PRIMARY KEY,
    category   TEXT NOT NULL DEFAULT '',
    data       JSONB         DEFAULT '{}',
    updated_at TIMESTAMPTZ   DEFAULT NOW()
  )
`)

await run('validation_log', `
  CREATE TABLE IF NOT EXISTS validation_log (
    id         SERIAL      PRIMARY KEY,
    mission_id TEXT        NOT NULL DEFAULT '',
    result     JSONB       DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`)

console.log('\n── Seeding platforms ──')

const platforms = [
  ['PS_REMUS620',    'REMUS 620',        'UUV', 'HII',     'REMUS 620', 300, 3.25, 0.5,   0.5,   'Lithium-ion Battery', 'GPS/INS', 'Equipped with Kraken Synthetic Aperture Sonar', 'SN-4201',  '2024-05-01'],
  ['REMUS620_401',   'REMUS 620',        'UUV', 'HII',     'REMUS 620', 300, 3.25, 0.5,   0.5,   'Lithium-ion Battery', 'GPS/INS', 'Equipped with Kraken Synthetic Aperture Sonar', 'SN-401',   '2024-05-01'],
  ['REMUS620_SN401', 'REMUS 620',        'UUV', 'HII',     'REMUS 620', 351, 5.2,  0.324, 0.324, 'Lithium-ion Battery', 'GPS/INS', 'Equipped with Kraken Synthetic Aperture Sonar', 'SN-401',   '2025-07-22'],
  ['REMUS620_402',   'REMUS 620',        'UUV', 'HII',     'REMUS 620', 300, 3.25, 0.5,   0.5,   'Lithium-ion Battery', 'GPS/INS', 'Equipped with Kraken Synthetic Aperture Sonar', 'SN-402',   '2024-07-23'],
  ['EAGLE_RAY_UUV',  'Eagle Ray UUV',    'UUV', 'Hydroid', 'REMUS 600', 300, 3.25, 0.5,   0.5,   'Lithium-ion Battery', 'GPS/INS', 'Equipped with Norbit Multibeam Sonar',          'SN-12345', '2024-05-01'],
  ['EAGLE_RAY',      'Eagle Ray UUV',    'UUV', 'Hydroid', 'REMUS 600', 300, 3.25, 0.5,   0.5,   'Lithium-ion Battery', 'GPS/INS', 'Equipped with Norbit Multibeam Sonar',          'SN-12345', '2024-05-01'],
  ['UUV-01',         'Eagle Ray UUV-01', 'UAV', 'Norbit',  'WBMS',      0,   0,    0,     0,     '',                    '',        'Norbit multibeam mapping payload.',             '',         ''],
]

for (const [id, name, type, mfr, model, weight, length, width, height, ps, nav, comments, sn, dd] of platforms) {
  await run(id, {
    text: `INSERT INTO platforms (id,name,type,manufacturer,model,weight,length,width,height,power_source,navigation_system,comments,serial_number,deployment_date)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, type=EXCLUDED.type, manufacturer=EXCLUDED.manufacturer,
             model=EXCLUDED.model, weight=EXCLUDED.weight, length=EXCLUDED.length, width=EXCLUDED.width,
             height=EXCLUDED.height, power_source=EXCLUDED.power_source, navigation_system=EXCLUDED.navigation_system,
             comments=EXCLUDED.comments, serial_number=EXCLUDED.serial_number, deployment_date=EXCLUDED.deployment_date, updated_at=NOW()`,
    values: [id, name, type, mfr, model, weight, length, width, height, ps, nav, comments, sn, dd],
  })
}

console.log('\n── Seeding sensors ──')

const sensors = [
  ['Anemometer',  'Anemometer',                              'Gill Instruments',               'Windmaster 1590-PK-20', ''],
  ['Radiometer',  'Radiometer',                              'Eppley',                         'PIR',                   ''],
  ['CTD',         'Conductivity/Temp/ODO',                   'Sea-Bird Scientific',            'SBE37-SMP-ODO Microcat',''],
  ['Thermometer', 'Temperature/Humidity Sensor',             'Rotronic',                       'HC2-S3',                ''],
  ['IRPyrometer',  'IR Pyrometer',                           'Heitronics',                     'CT15.10',               ''],
  ['LI-COR',      'PAR in Air Detector',                     'LI-COR',                         'LI-192SA',              ''],
  ['SWRadiometer', 'Shortwave Radiometer',                   'Delta-T',                        'SPN1',                  ''],
  ['PHINS INS',   'Inertial Navigation System',              'Exail',                          'iXBlue 6000',           'NAV_SUBSEA_1_7_7.a'],
  ['AML CTD',     'Conductivity, Temperature, Depth Sensor', 'AML Oceanographic',              '',                      '83.3'],
  ['RDI ADCP',    'Acoustic Doppler Current Profiler',       'Teledyne Marine RD Instruments', '',                      '83.3'],
  ['PDVL 300',    'Doppler Velocity Logger',                 '',                               '',                      ''],
  ['Kraken SAS',  'Synthetic Aperture Sonar',                'Kraken Robotics',                '',                      ''],
]

for (const [id, type, mfr, model, firmware] of sensors) {
  await run(id, {
    text: `INSERT INTO sensors (id, type, manufacturer, model, firmware)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (id) DO UPDATE SET type=EXCLUDED.type, manufacturer=EXCLUDED.manufacturer,
             model=EXCLUDED.model, firmware=EXCLUDED.firmware, updated_at=NOW()`,
    values: [id, type, mfr, model, firmware],
  })
}

console.log('\n── Seeding templates ──')

const templates = [
  ['MGM REMUS', 'uuv', {
    mission: {
      title: 'RV Expedition 2025 LEG 01 REMUS620 KRAKEN SAS MGM Dive 01',
      alternateTitle: 'EN2501_REMUS620_4201_KRAKEN_SAS_202507027T1510Z',
      missionId: 'EN2501_REMUS620_4201_KRAKEN_SAS_202507027T1510Z',
      organization: 'NOAA MESOPHOTIC DEEP BENTHIC COMMUNITIES RESTORATION PROJECT',
      contactEmail: 'errol.ronje@noaa.gov',
      startDate: '2025-07-27T04:10', endDate: '2025-07-27T20:05', status: 'ongoing',
    },
    platform: { id: 'REMUS620_401', platformName: 'REMUS 620', platformType: 'UUV', manufacturer: 'HII', model: 'REMUS 620', serialNumber: 'SN-401' },
    sensors: [],
  }],
  ['AUV Eagle Ray', 'uuv', {
    mission: {
      title: 'Point Sur 2024 Leg 18 Eagle Ray MultiBeam Sonar Data AUV Dive 01',
      missionId: 'PS2418L0_ER_AUV01_Norbit_MB_20240505T1510Z_MD',
      organization: 'NOAA MESOPHOTIC DEEP BENTHIC COMMUNITIES RESTORATION PROJECT',
      contactEmail: 'errol.ronje@noaa.gov',
      startDate: '2024-05-05T15:10', endDate: '2024-05-06T12:00', status: 'ongoing',
    },
    platform: { id: 'EAGLE_RAY_UUV', platformName: 'Eagle Ray AUV', platformType: 'AUV', manufacturer: 'Hydroid', model: 'REMUS 600', serialNumber: 'SN-12345' },
    sensors: [],
  }],
]

for (const [name, category, data] of templates) {
  await run(name, {
    text: `INSERT INTO templates (name, category, data) VALUES ($1,$2,$3)
           ON CONFLICT (name) DO UPDATE SET category=EXCLUDED.category, data=EXCLUDED.data, updated_at=NOW()`,
    values: [name, category, JSON.stringify(data)],
  })
}

await pool.end()
console.log('\n✅  All done — DB is ready!\n')
