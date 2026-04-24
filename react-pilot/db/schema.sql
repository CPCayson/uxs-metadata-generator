-- UxS Metadata Builder — Neon PostgreSQL schema
-- Run once: paste into Neon SQL Editor or run via psql
-- Tables mirror the existing Google Sheets structure exactly.

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
);

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
);

CREATE TABLE IF NOT EXISTS templates (
  name       TEXT PRIMARY KEY,
  category   TEXT NOT NULL DEFAULT '',
  data       JSONB         DEFAULT '{}',
  updated_at TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS validation_log (
  id         SERIAL      PRIMARY KEY,
  mission_id TEXT        NOT NULL DEFAULT '',
  result     JSONB       DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
