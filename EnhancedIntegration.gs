// EnhancedIntegration.gs
// Integration functions for the enhanced XML system

function logValidationResultSummary_(label, validation) {
  if (!validation || typeof validation !== 'object') {
    Logger.log('INFO: ' + label + ' - (no validation object)');
    return;
  }
  const errors = validation.errors || [];
  const warnings = validation.warnings || [];
  Logger.log(
    'INFO: ' +
      label +
      ' - valid=' +
      validation.valid +
      ', errors=' +
      errors.length +
      ', warnings=' +
      warnings.length
  );
  if (errors.length > 0) {
    Logger.log(
      'INFO: ' + label + ' - first errors: ' + errors.slice(0, 5).map((e) => e.message || e.ruleId || '').join(' | ')
    );
  }
}

function generateXMLWithValidation(data, validationLevel) {
  try {
    logDebug('DEBUG: generateXMLWithValidation - Starting generation with validation');
    const mappedData = requireMapClientDataToServer()(data);
    const level = validationLevel != null && validationLevel !== '' ? validationLevel : 'strict';
    const validation = new ValidationEngine().validate(mappedData, { level: level });
    if (!validation.valid) {
      const errorDetails = validation.errors.map((e) => e.message).join('; ');
      throw new XMLGenerationError(`Data validation failed: ${errorDetails}`, 'validation', validation);
    }
    const xml = generateXMLWithSchema(mappedData, 'iso19115-2', { alreadyMapped: true });
    logDebug('DEBUG: generateXMLWithValidation - XML generated successfully');
    return xml;
  } catch (error) {
    Logger.log('ERROR: generateXMLWithValidation - Error: ' + error);
    if (error instanceof XMLGenerationError) {
      if (error.type === 'validation' && error.context) {
        const validation = error.context;
        logValidationResultSummary_('generateXMLWithValidation', validation);
        const errorMessage = `Cannot generate XML due to validation errors:\n${(validation.errors || []).map((e) => '• ' + (e.message || e.ruleId || '')).join('\n')}`;
        notifyChatSpace(errorMessage);
        return null;
      }
    }
    notifyChatSpace('Failed to generate XML: ' + error.message);
    throw error;
  }
}

function refreshXMLPreviewWithValidation(data, validationLevel = 'strict') {
  logDebug('DEBUG: refreshXMLPreviewWithValidation - Starting with level: ' + validationLevel);

  if (data == null || data === '') {
    Logger.log(
      'WARN: refreshXMLPreviewWithValidation - No form payload (null/undefined/empty). ' +
        'Typical causes: running this function from the script editor without arguments, or a client omitting the first google.script.run parameter.'
    );
    return {
      success: false,
      error: 'No form data provided to refreshXMLPreviewWithValidation function',
      validation: null
    };
  }

  try {
    const mappedData = requireMapClientDataToServer()(data);
    const validation = validateFormDataWithRules(mappedData, validationLevel);
    logValidationResultSummary_('refreshXMLPreviewWithValidation', validation);

    if (validation.valid) {
      try {
        const xml = generateXMLWithValidation(mappedData, validationLevel);
        if (xml) {
          logDebug('DEBUG: refreshXMLPreviewWithValidation - XML generated successfully, length: ' + xml.length);
          let xmlValidation = { valid: true, errors: [], warnings: [], summary: '' };
          try {
            xmlValidation = validateXML(xml, validationLevel);
          } catch (xmlValErr) {
            Logger.log('WARN: refreshXMLPreviewWithValidation - validateXML failed: ' + xmlValErr);
            xmlValidation = {
              valid: false,
              errors: [{ message: String(xmlValErr.message || xmlValErr) }],
              warnings: [],
              summary: 'XML schema validation failed'
            };
          }
          return { success: true, xml: xml, validation: validation, xmlValidation: xmlValidation };
        }
      } catch (xmlError) {
        Logger.log('ERROR: refreshXMLPreviewWithValidation - XML generation failed: ' + xmlError);
        return { success: false, error: 'XML generation failed: ' + xmlError.message, validation: validation };
      }
    } else {
      logDebug('DEBUG: refreshXMLPreviewWithValidation - Validation failed, cannot generate XML');
      return { success: false, error: 'Fix validation errors to generate XML preview', validation: validation };
    }
  } catch (error) {
    Logger.log('ERROR: refreshXMLPreviewWithValidation - General error: ' + error);
    return { success: false, error: 'Failed to refresh preview: ' + error.message };
  }
} 

