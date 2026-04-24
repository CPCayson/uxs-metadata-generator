function recoverFromError(errorData) {
  const payloadPreview =
    errorData === undefined
      ? '(no argument — pass e.g. { ruleId: "mission.id.required" } or call from client with an error object)'
      : JSON.stringify(errorData);
  Logger.log('INFO: recoverFromError - Attempting recovery for error: ' + payloadPreview);
  try {
    if (errorData == null || typeof errorData !== 'object') {
      Logger.log(
        'INFO: recoverFromError - No recovery: invalid or missing error payload (need a plain object with ruleId)'
      );
      return { success: false, message: 'Invalid error data: expected an object with ruleId' };
    }
    if (errorData.ruleId == null || errorData.ruleId === '') {
      Logger.log('INFO: recoverFromError - No recovery: missing ruleId');
      return { success: false, message: 'No ruleId on error data' };
    }
    const recoveryActions = {
      'mission.id.required': () => ({
        success: true,
        message: 'Generated default mission ID',
        value: 'PS_' + new Date().toISOString().replace(/[-:.]/g, ''),
        field: 'missionId'
      }),
      'mission.title.required': () => ({
        success: true,
        message: 'Set default mission title',
        value: 'Untitled Mission',
        field: 'missionTitle'
      }),
      'mission.dates.valid': () => ({
        success: true,
        message: 'Set default start date',
        value: new Date().toISOString().slice(0, 16),
        field: 'startDate'
      }),
      'mission.contact.email': () => ({
        success: true,
        message: 'Set default contact email',
        value: 'contact@example.com',
        field: 'contactEmail'
      }),
      'platform.id.required': () => ({
        success: true,
        message: 'Generated default platform ID',
        value: 'Platform_' + new Date().toISOString().replace(/[-:.]/g, ''),
        field: 'platformId'
      }),
      'spatial.coordinates.valid': (context) => {
        const issues = context?.details?.issues || [];
        if (issues.length > 0) {
          const field = Object.keys(context.details.bbox).find(corner => issues.some(issue => issue.includes(corner)));
          if (field) {
            const corner = field.split('.')[1];
            const coordType = issues.find(issue => issue.includes(corner)).includes('latitude') ? 'lat' : 'lon';
            return {
              success: true,
              message: `Set ${corner} ${coordType} to 0`,
              value: '0',
              field: corner + (coordType === 'lat' ? 'Lat' : 'Lon')
            };
          }
        }
        return { success: false, message: 'Cannot auto-fix coordinates' };
      },
      'spreadsheet.access.error': () => ({
        success: false,
        message: 'Spreadsheet access denied. Check spreadsheet configuration and permissions.',
        action: 'check_spreadsheet_configuration'
      }),
      'template.save.error': () => ({
        success: false,
        message: 'Template save failed. Check spreadsheet permissions and try again.',
        action: 'retry_with_fallback'
      }),
      'template.load.error': () => ({
        success: false,
        message: 'Template load failed. Using cached data if available.',
        action: 'use_cache_fallback'
      })
    };
    const action = recoveryActions[errorData.ruleId];
    if (action) {
      const result = action(errorData);
      Logger.log('INFO: recoverFromError - Recovery successful: ' + result.message);
      return result;
    }
    Logger.log('INFO: recoverFromError - No recovery action available');
    return { success: false, message: 'No recovery action available for ' + String(errorData.ruleId) };
  } catch (error) {
    Logger.log('ERROR: recoverFromError - Failed: ' + error.message);
    throw error;
  }
}