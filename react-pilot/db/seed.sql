-- UxS Metadata Builder — seed data from existing Google Sheets
-- Run after schema.sql in Neon SQL Editor

-- ── Platforms ──────────────────────────────────────────────────────────────
INSERT INTO platforms (id, name, type, manufacturer, model, weight, length, width, height, power_source, navigation_system, comments, serial_number, deployment_date) VALUES
('PS_REMUS620',       'REMUS 620',       'UUV', 'HII',     'REMUS 620', 300, 3.25, 0.5,   0.5,   'Lithium-ion Battery', 'GPS/INS', 'Equipped with Kraken Synthetic Aperture Sonar', 'SN-4201',  '2024-05-01'),
('REMUS620_401',      'REMUS 620',       'UUV', 'HII',     'REMUS 620', 300, 3.25, 0.5,   0.5,   'Lithium-ion Battery', 'GPS/INS', 'Equipped with Kraken Synthetic Aperture Sonar', 'SN-401',   '2024-05-01'),
('REMUS620_SN401',    'REMUS 620',       'UUV', 'HII',     'REMUS 620', 351, 5.2,  0.324, 0.324, 'Lithium-ion Battery', 'GPS/INS', 'Equipped with Kraken Synthetic Aperture Sonar', 'SN-401',   '2025-07-22'),
('REMUS620_402',      'REMUS 620',       'UUV', 'HII',     'REMUS 620', 300, 3.25, 0.5,   0.5,   'Lithium-ion Battery', 'GPS/INS', 'Equipped with Kraken Synthetic Aperture Sonar', 'SN-402',   '2024-07-23'),
('EAGLE_RAY_UUV',     'Eagle Ray UUV',   'UUV', 'Hydroid', 'REMUS 600', 300, 3.25, 0.5,   0.5,   'Lithium-ion Battery', 'GPS/INS', 'Equipped with Norbit Multibeam Sonar',          'SN-12345', '2024-05-01'),
('EAGLE_RAY',         'Eagle Ray UUV',   'UUV', 'Hydroid', 'REMUS 600', 300, 3.25, 0.5,   0.5,   'Lithium-ion Battery', 'GPS/INS', 'Equipped with Norbit Multibeam Sonar',          'SN-12345', '2024-05-01'),
('UUV-01',            'Eagle Ray UUV-01','UAV', 'Norbit',  'WBMS',      0,   0,    0,     0,     '',                    '',       'Norbit multibeam mapping payload.',             '',         '')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, type = EXCLUDED.type, manufacturer = EXCLUDED.manufacturer,
  model = EXCLUDED.model, weight = EXCLUDED.weight, length = EXCLUDED.length,
  width = EXCLUDED.width, height = EXCLUDED.height, power_source = EXCLUDED.power_source,
  navigation_system = EXCLUDED.navigation_system, comments = EXCLUDED.comments,
  serial_number = EXCLUDED.serial_number, deployment_date = EXCLUDED.deployment_date,
  updated_at = NOW();

-- ── Sensors ────────────────────────────────────────────────────────────────
INSERT INTO sensors (id, type, manufacturer, model, firmware, notes) VALUES
('Anemometer',  'Anemometer',                          'Gill Instruments',               'Windmaster 1590-PK-20',  '',                    ''),
('Radiometer',  'Radiometer',                          'Eppley',                         'PIR',                    '',                    ''),
('CTD',         'Conductivity/Temp/ODO',               'Sea-Bird Scientific',            'SBE37-SMP-ODO Microcat', '',                    ''),
('Thermometer', 'Temperature/Humidity Sensor',         'Rotronic',                       'HC2-S3',                 '',                    ''),
('IRPyrometer',  'IR Pyrometer',                       'Heitronics',                     'CT15.10',                '',                    ''),
('LI-COR',      'PAR in Air Detector',                 'LI-COR',                         'LI-192SA',               '',                    ''),
('SWRadiometer', 'Shortwave Radiometer',               'Delta-T',                        'SPN1',                   '',                    ''),
('PHINS INS',   'Inertial Navigation System',          'Exail',                          'iXBlue 6000',            'NAV_SUBSEA_1_7_7.a',  ''),
('AML CTD',     'Conductivity, Temperature, Depth Sensor', 'AML Oceanographic',         '',                       '83.3',                ''),
('RDI ADCP',    'Acoustic Doppler Current Profiler',   'Teledyne Marine RD Instruments', '',                       '83.3',                ''),
('PDVL 300',    'Doppler Velocity Logger',             '',                               '',                       '',                    ''),
('Kraken SAS',  'Synthetic Aperture Sonar',            'Kraken Robotics',                '',                       '',                    '')
ON CONFLICT (id) DO UPDATE SET
  type = EXCLUDED.type, manufacturer = EXCLUDED.manufacturer,
  model = EXCLUDED.model, firmware = EXCLUDED.firmware, notes = EXCLUDED.notes,
  updated_at = NOW();

-- ── Templates ──────────────────────────────────────────────────────────────
INSERT INTO templates (name, category, data) VALUES
('kk,lll', 'basic', '{"spatial":{"boundingBox":{"upperRight":{"lon":-89,"lat":29},"upperLeft":{"lat":29,"lon":-91},"lowerLeft":{"lat":27,"lon":-91},"lowerRight":{"lat":27,"lon":-89}},"errorLevel":"95% Confidence","accuracyValue":"1.5","dimensions":"2","accuracyStandard":"RMS Error","errorValue":"2.0","referenceSystem":"EPSG:4326","hasTrajectory":false,"geographicDescription":"Gulf of Mexico, 29N to 27N, 91W to 89W","trajectorySampling":"10"},"platform":{"weight":"300","deploymentDate":"2024-05-01","platformId":"PS_EagleRay_001","height":"0.5","platformType":"AUV","model":"REMUS 600","serialNumber":"SN-12345","length":"3.25","platformName":"Eagle Ray AUV","powerSource":"Lithium-ion Battery","id":"PS_EagleRay_001","width":"0.5","platformComments":"Equipped with Norbit Multibeam Sonar","speed":"2.3","navigationSystem":"GPS/INS","manufacturer":"Hydroid","sensorMounts":"Forward Payload Bay"},"mission":{"accessConstraints":"Data should not be distributed beyond members of the Science Team...","organization":"NOAA MESOPHOTIC DEEP BENTHIC COMMUNITIES RESTORATION PROJECT","title":"Point Sur 2024 Leg 18 Eagle Ray MultiBeam Sonar Data AUV Dive 01","abstract":"The MDBC Mapping, Groundtruthing and Modeling team along with USM will conduct AUV acquisition...","id":"PS2418L0_ER_AUV01_Norbit_MB_20240505T1510Z_MD","contactEmail":"errol.ronje@noaa.gov","characterSet":"utf8","contactAddress":"Suite 1003, 1021 Balch Boulevard, Stennis Space Center, MS 39529, USA","scopeCode":"dataset","endDate":"2024-05-06T12:00","language":"eng","missionTitle":"Point Sur 2024 Leg 18 Eagle Ray MultiBeam Sonar Data AUV Dive 01","alternateTitle":"PS2418L0_ER_AUV01_Norbit_MB_20240505T1510Z","missionId":"PS2418L0_ER_AUV01_Norbit_MB_20240505T1510Z_MD","contactPhone":"(555) 555-5555","status":"ongoing","startDate":"2024-05-05T15:10"},"output":{"outputLocation":"download","doi":"","outputFormat":"xml","saveAsTemplate":true,"metadataStandard":"ISO 19115-3","templateName":"AUV Mission Template","validationLevel":"basic","metadataVersion":"2.0","metadataSchema":"iso19115-3"},"sensors":[]}'),
('MGM REMUS', 'uuv', '{"mission":{"alternateTitle":"EN2501_REMUS620_4201_KRAKEN_SAS_202507027T1510Z","endDate":"2025-07-27T20:05","abstract":"The MDBC Mapping, Ground truthing and Modeling team along with USM will conduct UUV missions to collect synthetic aperture sonar data using the REMUS 620 platform equipped with the KRAKEN Sonar sensor and other oceanographic equipment","organization":"NOAA MESOPHOTIC DEEP BENTHIC COMMUNITIES RESTORATION PROJECT","missionId":"EN2501_REMUS620_4201_KRAKEN_SAS_202507027T1510Z","characterSet":"utf8","language":"eng","contactUrl":"https://www.diver.orr.noaa.gov/dwh-mdbc-portfolio","contactPhone":"(555) 555-5555","scopeCode":"dataset","startDate":"2025-07-27T04:10","id":"EN2501_REMUS620_4201_KRAKEN_SAS_202507027T1510Z","status":"ongoing","accessConstraints":"Data should not be distributed beyond members of the Science Team...","contactEmail":"errol.ronje@noaa.gov","title":"RV Expedition 2025 LEG 01 REMUS620 KRAKEN SAS MGM Dive 01","missionTitle":"RV Expedition 2025 LEG 01 REMUS620 KRAKEN SAS MGM Dive 01","contactAddress":"Suite 1003, 1021 Balch Boulevard, Stennis Space Center, MS 39529, USA"},"platform":{"platformName":"REMUS 620","weight":"300","serialNumber":"SN-401","navigationSystem":"GPS/INS","material":"Aluminum","platformComments":"Equipped with Kraken Synthetic Aperture Sonar","width":"0.5","platformType":"UUV","speed":"2.3","length":"3.25","id":"REMUS620_401","deploymentDate":"2024-05-01","height":"0.5","powerSource":"Lithium-ion Battery","model":"REMUS 620","platformId":"REMUS620_401","manufacturer":"HII"}}')
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category, data = EXCLUDED.data, updated_at = NOW();
