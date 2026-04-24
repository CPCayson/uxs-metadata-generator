//ValidationSystem.gs
class ValidationRule {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.level = config.level || 'error';
    this.category = config.category || 'general';
    this.message = config.message;
    this.check = config.check;
    this.fix = config.fix;
  }

  validate(data, context = {}) {
    try {
      const payload =
        data != null && typeof data === 'object' && !Array.isArray(data) ? data : {};
      const result = this.check(payload, context);
      return {
        ruleId: this.id,
        passed: result.passed !== false,
        level: this.level,
        category: this.category,
        message: result.message || this.message,
        details: result.details || {},
        fix: result.fix || this.fix,
        context: context
      };
    } catch (error) {
      Logger.log(`ERROR: ValidationRule ${this.id} - Failed: ${error.message}`);
      return {
        ruleId: this.id,
        passed: false,
        level: 'error',
        category: 'system',
        message: `Validation rule '${this.name}' failed: ${error.message}`,
        details: { error: error.message },
        context: context
      };
    }
  }
}

const VALIDATION_RULES = [
  new ValidationRule({
    id: 'mission.id.required',
    name: 'Mission ID Required',
    level: 'error',
    category: 'mission',
    message: 'Mission ID is required and must be unique',
    check: (data) => {
      const id = data.mission?.id;
      logDebug('DEBUG: Validating mission ID: ' + JSON.stringify(id));
      if (!id || (typeof id === 'string' && id.trim().length === 0)) {
        return {
          passed: false,
          message: 'Mission ID is required. Please enter a unique identifier like "PS2418L0_ER_UUV01_Norbit_MB_20240505T1510Z_MD"',
          details: { field: 'missionId', value: id }
        };
      }
      const trimmedId = typeof id === 'string' ? id.trim() : String(id);
      if (trimmedId.length < 3) {
        return {
          passed: false,
          message: 'Mission ID must be at least 3 characters long',
          details: { field: 'missionId', value: trimmedId, length: trimmedId.length }
        };
      }
      return { passed: true };
    }
  }),
  new ValidationRule({
    id: 'mission.title.required',
    name: 'Mission Title Required',
    level: 'error',
    category: 'mission',
    message: 'Mission title is required',
    check: (data) => {
      const title = data.mission?.title;
      logDebug('DEBUG: Validating mission title: ' + JSON.stringify(title));
      if (!title || (typeof title === 'string' && title.trim().length === 0)) {
        return {
          passed: false,
          message: 'Mission title is required. Please provide a descriptive title for your mission.',
          details: { field: 'missionTitle', value: title }
        };
      }
      return { passed: true };
    }
  }),
  new ValidationRule({
    id: 'mission.abstract.required',
    name: 'Mission Abstract Required',
    level: 'error',
    category: 'mission',
    message: 'Mission abstract is required',
    check: (data) => {
      const abstract = data.mission?.abstract;
      logDebug('DEBUG: Validating mission abstract: ' + JSON.stringify(abstract));
      if (!abstract || (typeof abstract === 'string' && abstract.trim().length === 0)) {
        return {
          passed: false,
          message: 'Mission abstract is required. Please provide a description of the mission purpose and objectives.',
          details: { field: 'abstract', value: abstract }
        };
      }
      return { passed: true };
    }
  }),
  new ValidationRule({
    id: 'mission.dates.valid',
    name: 'Mission Dates Valid',
    level: 'error',
    category: 'mission',
    message: 'Mission dates must be valid',
    check: (data) => {
      const startDate = data.mission?.startDate;
      const endDate = data.mission?.endDate;

      if (!startDate) {
        return {
          passed: false,
          message: 'Start date is required',
          details: { field: 'startDate', value: startDate }
        };
      }

      const start = new Date(startDate);
      if (isNaN(start.getTime())) {
        return {
          passed: false,
          message: 'Start date is not a valid date format',
          details: { field: 'startDate', value: startDate }
        };
      }

      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return {
            passed: false,
            message: 'End date is not a valid date format',
            details: { field: 'endDate', value: endDate }
          };
        }

        if (end <= start) {
          return {
            passed: false,
            message: 'End date must be after start date',
            details: {
              fields: ['startDate', 'endDate'],
              startDate: startDate,
              endDate: endDate
            }
          };
        }
      }

      return { passed: true };
    }
  }),
  new ValidationRule({
    id: 'mission.contact.email',
    name: 'Valid Contact Email',
    level: 'error',
    category: 'mission',
    message: 'Valid contact email is required',
    check: (data) => {
      const email = data.mission?.contactEmail?.trim();
      if (!email) {
        return {
          passed: false,
          message: 'Contact email is required',
          details: { field: 'contactEmail', value: email }
        };
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return {
          passed: false,
          message: 'Contact email must be a valid email address',
          details: { field: 'contactEmail', value: email }
        };
      }

      return { passed: true };
    }
  }),
  new ValidationRule({
    id: 'platform.id.required',
    name: 'Platform ID Required',
    level: 'error',
    category: 'platform',
    message: 'Platform ID is required',
    check: (data) => {
      const rawId =
        data.platform?.id ??
        data.platform?.platformId ??
        data.platform?.platformID ??
        data.platform?.identifier;
      const id = rawId === null || rawId === undefined ? '' : String(rawId).trim();
      if (!id) {
        return {
          passed: false,
          message: 'Platform ID is required.',
          details: { field: 'platformId', value: rawId }
        };
      }
      return { passed: true };
    }
  }),
  new ValidationRule({
    id: 'platform.name.required',
    name: 'Platform Name Required',
    level: 'error',
    category: 'platform',
    message: 'Platform name is required',
    check: (data) => {
      const name = data.platform?.name;
      logDebug('DEBUG: Validating platform name: ' + JSON.stringify(name));
      if (!name || (typeof name === 'string' && name.trim().length === 0)) {
        return {
          passed: false,
          message: 'Platform name is required. Please provide a descriptive name for your platform.',
          details: { field: 'platformName', value: name }
        };
      }
      return { passed: true };
    }
  }),
  new ValidationRule({
    id: 'platform.dimensions.valid',
    name: 'Platform Dimensions Valid',
    level: 'warning',
    category: 'platform',
    message: 'Platform dimensions should be positive numbers',
    check: (data) => {
      const { weight, length, width, height, speed } = data.platform || {};
      const issues = [];

      if (weight && (isNaN(weight) || weight < 0)) {
        issues.push('Weight must be a non-negative number');
      }
      if (length && (isNaN(length) || length < 0)) {
        issues.push('Length must be a non-negative number');
      }
      if (width && (isNaN(width) || width < 0)) {
        issues.push('Width must be a non-negative number');
      }
      if (height && (isNaN(height) || height < 0)) {
        issues.push('Height must be a non-negative number');
      }
      if (speed && (isNaN(speed) || speed < 0)) {
        issues.push('Speed must be a non-negative number');
      }

      if (issues.length > 0) {
        return {
          passed: false,
          message: 'Platform dimension issues: ' + issues.join(', '),
          details: { fields: ['weight', 'length', 'width', 'height', 'speed'], issues }
        };
      }

      return { passed: true };
    }
  }),
  new ValidationRule({
    id: 'spatial.coordinates.valid',
    name: 'Valid Coordinates',
    level: 'error',
    category: 'spatial',
    message: 'Coordinates must be within valid ranges',
    check: (data) => {
      const bbox = data.spatial?.boundingBox;
      if (!bbox) return { passed: true };

      const corners = ['upperLeft', 'upperRight', 'lowerLeft', 'lowerRight'];
      const issues = [];

      corners.forEach(corner => {
        const point = bbox[corner];
        if (point) {
          const { lat, lon } = point;

          if (lat && (isNaN(lat) || lat < -90 || lat > 90)) {
            issues.push(`${corner} latitude ${lat} is out of range (-90 to 90)`);
          }
          if (lon && (isNaN(lon) || lon < -180 || lon > 180)) {
            issues.push(`${corner} longitude ${lon} is out of range (-180 to 180)`);
          }
        }
      });

      if (issues.length > 0) {
        return {
          passed: false,
          message: 'Coordinate validation issues: ' + issues.join(', '),
          details: { bbox, issues }
        };
      }

      return { passed: true };
    },
    fix: (context) => {
      const issues = context?.details?.issues || [];
      if (issues.length > 0) {
        const field = context?.details?.bbox ? Object.keys(context.details.bbox).find(corner => issues.some(issue => issue.includes(corner))) : null;
        if (field) {
          const corner = field.split('.')[1];
          const coordType = issues.find(issue => issue.includes(corner)).includes('latitude') ? 'lat' : 'lon';
          return {
            success: true,
            value: 0,
            message: `Set ${corner} ${coordType} to 0`
          };
        }
      }
      return {
        success: false,
        message: 'Cannot auto-fix coordinates'
      };
    }
  }),
  new ValidationRule({
    id: 'spatial.bounding.box.logical',
    name: 'Logical Bounding Box',
    level: 'warning',
    category: 'spatial',
    message: 'Bounding box coordinates should form a logical rectangle',
    check: (data) => {
      const bbox = data.spatial?.boundingBox;
      if (!bbox) return { passed: true };

      const { upperLeft, upperRight, lowerLeft, lowerRight } = bbox;
      if (!upperLeft || !upperRight || !lowerLeft || !lowerRight) {
        return { passed: true };
      }

      const issues = [];

      if (upperLeft.lat <= lowerLeft.lat) {
        issues.push('Upper left latitude should be greater than lower left latitude');
      }

      if (upperLeft.lon >= upperRight.lon && Math.abs(upperLeft.lon - upperRight.lon) < 180) {
        issues.push('Right longitude should typically be greater than left longitude');
      }

      if (issues.length > 0) {
        return {
          passed: false,
          message: 'Bounding box logic issues: ' + issues.join(', '),
          details: { bbox, issues }
        };
      }

      return { passed: true };
    }
  }),
  new ValidationRule({
    id: 'sensors.at.least.one',
    name: 'At Least One Sensor',
    level: 'warning',
    category: 'sensors',
    message: 'At least one sensor should be defined',
    check: (data) => {
      const sensors = data.sensors || [];
      if (sensors.length === 0) {
        return {
          passed: false,
          message: 'Consider adding at least one sensor to better describe your data collection setup',
          details: { sensorCount: 0 }
        };
      }
      return { passed: true };
    }
  }),
  new ValidationRule({
    id: 'sensors.valid.ids',
    name: 'Valid Sensor IDs',
    level: 'error',
    category: 'sensors',
    message: 'All sensors must have valid IDs',
    check: (data) => {
      const sensors = data.sensors || [];
      const issues = [];
      const ids = new Set();

      sensors.forEach((sensor, index) => {
        if (!sensor.id || !sensor.id.trim()) {
          issues.push(`Sensor ${index + 1} is missing an ID`);
        } else if (ids.has(sensor.id)) {
          issues.push(`Sensor ID "${sensor.id}" is duplicated`);
        } else {
          ids.add(sensor.id);
        }

        if (!sensor.type || !sensor.type.trim()) {
          issues.push(`Sensor ${index + 1} (${sensor.id || 'unnamed'}) is missing a type`);
        }
      });

      if (issues.length > 0) {
        return {
          passed: false,
          message: 'Sensor validation issues: ' + issues.join(', '),
          details: { issues, sensorCount: sensors.length }
        };
      }

      return { passed: true };
    }
  }),
  new ValidationRule({
    id: 'sensors.valid.frequency',
    name: 'Valid Sensor Frequency',
    level: 'error',
    category: 'sensors',
    message: 'Sensor frequency must be in valid format',
    check: (data) => {
      const sensors = data.sensors || [];
      const issues = [];

      sensors.forEach((sensor, index) => {
        const frequency = sensor.frequency?.trim();
        if (frequency && !/^\d+(\s+and\s+\d+)?\s*kHz$/.test(frequency)) {
          issues.push(`Sensor ${index + 1} (${sensor.id || 'unnamed'}) frequency "${frequency}" must be in format "200 kHz" or "200 and 400 kHz"`);
        }
      });

      if (issues.length > 0) {
        return {
          passed: false,
          message: 'Sensor frequency issues: ' + issues.join(', '),
          details: { issues, sensorCount: sensors.length }
        };
      }

      return { passed: true };
    }
  }),
  new ValidationRule({
    id: 'sensors.valid.beamCount',
    name: 'Valid Beam Count',
    level: 'error',
    category: 'sensors',
    message: 'Sensor beam count must be non-negative',
    check: (data) => {
      const sensors = data.sensors || [];
      const issues = [];

      sensors.forEach((sensor, index) => {
        const beamCount = parseInt(sensor.beamCount);
        if (beamCount < 0) {
          issues.push(`Sensor ${index + 1} (${sensor.id || 'unnamed'}) beam count "${beamCount}" must be non-negative`);
        }
      });

      if (issues.length > 0) {
        return {
          passed: false,
          message: 'Sensor beam count issues: ' + issues.join(', '),
          details: { issues, sensorCount: sensors.length }
        };
      }

      return { passed: true };
    }
  }),
  new ValidationRule({
    id: 'sensors.valid.installDate',
    name: 'Valid Install Date',
    level: 'error',
    category: 'sensors',
    message: 'Sensor install date must not be in the future',
    check: (data) => {
      const sensors = data.sensors || [];
      const issues = [];
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      sensors.forEach((sensor, index) => {
        const installDate = sensor.installDate ? new Date(sensor.installDate) : null;
        if (installDate) {
          const d = new Date(installDate);
          d.setHours(0, 0, 0, 0);
          if (d > todayStart) {
            issues.push(`Sensor ${index + 1} (${sensor.id || 'unnamed'}) install date "${sensor.installDate}" cannot be in the future`);
          }
        }
      });

      if (issues.length > 0) {
        return {
          passed: false,
          message: 'Sensor install date issues: ' + issues.join(', '),
          details: { issues, sensorCount: sensors.length }
        };
      }

      return { passed: true };
    }
  })
];

class ValidationEngine {
  constructor(rules = VALIDATION_RULES) {
    this.rules = rules;
    this.results = [];
  }

  validate(data, options = {}) {
    Logger.log('INFO: ValidationEngine - Starting validation with options: ' + JSON.stringify(options));
    const { level = 'all', category = 'all' } = options;
    const normalizedLevel =
      level === 'basic' ? 'error' :
      level === 'strict' ? 'all' :
      level;
    this.results = [];

    logDebug('DEBUG: ValidationEngine - Total rules available: ' + this.rules.length);
    logDebug('DEBUG: ValidationEngine - Filter criteria - level: ' + normalizedLevel + ', category: ' + category);

    const applicableRules = this.rules.filter(rule => {
      const levelMatch = (normalizedLevel === 'all' || rule.level === normalizedLevel);
      const categoryMatch = (category === 'all' || rule.category === category);
      const passes = levelMatch && categoryMatch;
      
      if (rule.id === 'mission.contact.email') {
        logDebug('DEBUG: ValidationEngine - Contact email rule filter check:');
        logDebug('  Rule level: ' + rule.level + ', Filter level: ' + normalizedLevel + ', Level match: ' + levelMatch);
        logDebug('  Rule category: ' + rule.category + ', Filter category: ' + category + ', Category match: ' + categoryMatch);
        logDebug('  Final result: ' + (passes ? 'INCLUDED' : 'EXCLUDED'));
      }
      
      return passes;
    });

    logDebug('DEBUG: ValidationEngine - Applicable rules count: ' + applicableRules.length);

    applicableRules.forEach(rule => {
      logDebug('DEBUG: ValidationEngine - Running rule: ' + rule.id);
      const result = rule.validate(data);
      logDebug('DEBUG: ValidationEngine - Rule ' + rule.id + ' result: ' + (result.passed ? 'PASSED' : 'FAILED'));
      if (!result.passed) {
        logDebug('DEBUG: ValidationEngine - Rule ' + rule.id + ' failure message: ' + result.message);
      }
      this.results.push(result);
    });

    const summary = this.getValidationSummary();
    logDebug('DEBUG: ValidationEngine - Final summary: ' + JSON.stringify(summary));
    return summary;
  }

  getValidationSummary() {
    const errors = this.results.filter(r => !r.passed && r.level === 'error');
    const warnings = this.results.filter(r => !r.passed && r.level === 'warning');
    const infos = this.results.filter(r => !r.passed && r.level === 'info');

    return {
      valid: errors.length === 0,
      passed: this.results.filter(r => r.passed).length,
      total: this.results.length,
      errors,
      warnings,
      infos,
      results: this.results || [], // Ensure results is always an array
      summary: this.generateSummary(errors, warnings, infos)
    };
  }

  generateSummary(errors, warnings, infos) {
    const parts = [];

    if (errors.length > 0) {
      parts.push(`${errors.length} error${errors.length !== 1 ? 's' : ''}`);
    }
    if (warnings.length > 0) {
      parts.push(`${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`);
    }
    if (infos.length > 0) {
      parts.push(`${infos.length} info${infos.length !== 1 ? 's' : ''}`);
    }

    if (parts.length === 0) {
      return 'All validations passed';
    }

    return `Found ${parts.join(', ')}`;
  }

  getErrorsByCategory() {
    const categories = {};
    this.results.filter(r => !r.passed).forEach(result => {
      if (!categories[result.category]) {
        categories[result.category] = [];
      }
      categories[result.category].push(result);
    });
    return categories;
  }
}

function emptyMappedClientData() {
  return {
    mission: {},
    platform: {},
    sensors: [],
    spatial: {},
    output: {}
  };
}

// Map client field names to server-expected field names
function mapClientDataToServer(clientData) {
  if (clientData == null) {
    return emptyMappedClientData();
  }
  if (typeof clientData !== 'object' || Array.isArray(clientData)) {
    Logger.log('WARN: mapClientDataToServer - Expected a plain object; using empty payload');
    return emptyMappedClientData();
  }

  logDebug('DEBUG: mapClientDataToServer - Input data: ' + JSON.stringify(clientData));
  
  // Helper function to clean values - convert empty strings to null
  function cleanValue(value) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    }
    return value;
  }

  function firstDefinedValue(...values) {
    for (const value of values) {
      if (value !== undefined && value !== null) {
        return value;
      }
    }
    return null;
  }
  
  const result = {
    mission: {
      ...clientData.mission,
      id: cleanValue(clientData.mission?.missionId || clientData.mission?.id),      // Accept both client and server formats, clean whitespace
      title: cleanValue(clientData.mission?.missionTitle || clientData.mission?.title),  // Accept both client and server formats, clean whitespace
      abstract: cleanValue(clientData.mission?.abstract),  // Clean abstract field
      startDate: cleanValue(clientData.mission?.startDate),
      endDate: cleanValue(clientData.mission?.endDate),
      contactEmail: cleanValue(clientData.mission?.contactEmail), // Clean contact email
      contactAddress: cleanValue(clientData.mission?.contactAddress) // Clean contact address
    },
    platform: {
      ...clientData.platform,
      id: cleanValue(firstDefinedValue(
        clientData.platform?.platformId,
        clientData.platform?.platformID,
        clientData.platform?.id,
        clientData.platform?.identifier
      )),
      name: cleanValue(clientData.platform?.platformName || clientData.platform?.name), // Clean platform name
      description: cleanValue(
        firstDefinedValue(
          clientData.platform?.description,
          clientData.platform?.platformComments
        )
      )
    },
    sensors: (clientData.sensors || [])
      .filter((s) => s != null && typeof s === 'object')
      .map((s) => {
        const id = cleanValue(s.id || s.sensorId || s.serialNumber);
        const type = cleanValue(s.type || s.sensorType);
        return {
          ...s,
          id: id,
          type: type
        };
      }),
    spatial: clientData.spatial || {},
    output: clientData.output || {}
  };
  
  logDebug(
    'DEBUG: mapClientDataToServer - mapped missionId=' +
      (result.mission?.id || 'none') +
      ', platformId=' +
      (result.platform?.id || 'none') +
      ', sensors=' +
      (result.sensors?.length || 0)
  );
  return result;
}

function requireMapClientDataToServer() {
  if (typeof mapClientDataToServer !== 'function') {
    throw new Error('mapClientDataToServer is required but unavailable. Ensure ValidationSystem.gs is deployed.');
  }
  return mapClientDataToServer;
}

function validateFormDataWithRules(formData, level) {
  Logger.log(
    'INFO: validateFormDataWithRules - Validating form data with level: ' +
      (level !== undefined && level !== null ? level : '(not set; engine uses its default)')
  );
  logDebug(
    'DEBUG: validateFormDataWithRules - Input summary missionId=' +
      (formData?.mission?.missionId || formData?.mission?.id || 'none') +
      ', platformId=' +
      (formData?.platform?.platformId || formData?.platform?.id || 'none') +
      ', sensors=' +
      (formData?.sensors?.length || 0)
  );
  try {
    if (formData == null) {
      const missingPayload = {
        ruleId: 'client.formData.missing',
        passed: false,
        level: 'error',
        category: 'system',
        message: 'No form data was sent for validation. Check the client call or reload and try again.',
        details: {},
        context: {}
      };
      return {
        valid: false,
        passed: 0,
        total: 1,
        errors: [missingPayload],
        warnings: [],
        infos: [],
        results: [missingPayload],
        summary: '1 error'
      };
    }

    // Map client field names to server expectations
    const mappedData = mapClientDataToServer(formData);
    logDebug('DEBUG: validateFormDataWithRules - Mapped data keys: ' + Object.keys(mappedData).join(', '));
    logDebug(
      'DEBUG: validateFormDataWithRules - Mapped summary missionId=' +
        (mappedData.mission?.id || 'none') +
        ', platformId=' +
        (mappedData.platform?.id || 'none') +
        ', sensors=' +
        (mappedData.sensors?.length || 0) +
        ', hasContactEmail=' +
        (mappedData.mission?.contactEmail ? 'yes' : 'no')
    );
    
    const validator = new ValidationEngine();
    
    // Debug: Check how many rules we have
    logDebug('DEBUG: validateFormDataWithRules - Total validation rules: ' + validator.rules.length);
    
    // Debug: Find the contact email rule
    const emailRule = validator.rules.find(r => r.id === 'mission.contact.email');
    logDebug('DEBUG: validateFormDataWithRules - Contact email rule found: ' + (emailRule ? 'YES' : 'NO'));
    if (emailRule) {
      logDebug('DEBUG: validateFormDataWithRules - Email rule level: ' + emailRule.level);
      logDebug('DEBUG: validateFormDataWithRules - Validation level filter: ' + level);
    }
    
    const result = validator.validate(mappedData, { level });
    Logger.log('INFO: validateFormDataWithRules - Validation completed: ' + result.summary);
    logDebug('DEBUG: validateFormDataWithRules - Number of results: ' + result.results.length);
    logDebug('DEBUG: validateFormDataWithRules - Number of errors: ' + result.errors.length);

    if (result.errors.length > 0) {
      const topErrors = result.errors
        .slice(0, 3)
        .map((e) => e.message)
        .join(' | ');
      Logger.log('WARN: validateFormDataWithRules - Top errors: ' + topErrors);
    }
    
    return result;
  } catch (error) {
    Logger.log('ERROR: validateFormDataWithRules - Failed: ' + error.message + ', Stack: ' + error.stack);
    throw error;
  }
} 