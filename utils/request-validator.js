/**
 * Request Validator
 * Validates message requests with schemas
 */

/**
 * Validate request structure
 * @param {Object} request - Request object
 * @param {Object} schema - Validation schema
 * @returns {{valid: boolean, error?: string}}
 */
export function validateRequest(request, schema) {
    if (!request || typeof request !== 'object') {
        return { valid: false, error: 'Request must be an object' };
    }

    // Validate action
    if (schema.requiredAction && request.action !== schema.requiredAction) {
        return { valid: false, error: `Invalid action. Expected: ${schema.requiredAction}` };
    }

    // Validate required fields
    if (schema.requiredFields) {
        for (const field of schema.requiredFields) {
            if (request[field] === undefined || request[field] === null) {
                return { valid: false, error: `Missing required field: ${field}` };
            }
        }
    }

    // Validate nested data
    if (schema.requiredDataFields && request.data) {
        for (const field of schema.requiredDataFields) {
            if (request.data[field] === undefined || request.data[field] === null) {
                return { valid: false, error: `Missing required data field: ${field}` };
            }
        }
    }

    // Validate types
    if (schema.fieldTypes) {
        for (const [field, expectedType] of Object.entries(schema.fieldTypes)) {
            const value = field.includes('.') 
                ? field.split('.').reduce((obj, key) => obj?.[key], request)
                : request[field];
            
            if (value !== undefined && value !== null) {
                const actualType = Array.isArray(value) ? 'array' : typeof value;
                if (actualType !== expectedType) {
                    return { valid: false, error: `Field ${field} must be of type ${expectedType}, got ${actualType}` };
                }
            }
        }
    }

    return { valid: true };
}

/**
 * Request schemas for different actions
 */
export const REQUEST_SCHEMAS = {
    batchSalaryEstimation: {
        requiredAction: 'batchSalaryEstimation',
        requiredDataFields: ['jobs'],
        fieldTypes: {
            'data.jobs': 'array'
        }
    },
    createTailoredResume: {
        requiredAction: 'createTailoredResume',
        fieldTypes: {
            'resumeData': 'object',
            'extractionMethod': 'string',
            'jobDescriptionOverride': 'string'
        }
    },
    getJobDescription: {
        requiredAction: 'getJobDescription',
        fieldTypes: {
            'extractionMethod': 'string',
            'apiToken': 'string'
        }
    },
    jobChanged: {
        requiredAction: 'jobChanged',
        requiredDataFields: ['jobTitle', 'companyName', 'jobUrl'],
        fieldTypes: {
            'data.jobTitle': 'string',
            'data.companyName': 'string',
            'data.jobUrl': 'string',
            'data.location': 'string'
        }
    },
    setAPIToken: {
        requiredAction: 'setAPIToken',
        requiredDataFields: ['token'],
        fieldTypes: {
            'data.token': 'string'
        }
    },
    setResume: {
        requiredAction: 'setResume',
        requiredDataFields: ['filename', 'content', 'mimeType'],
        fieldTypes: {
            'data.filename': 'string',
            'data.content': 'string',
            'data.mimeType': 'string'
        }
    },
    estimateSalaryWithJD: {
        requiredAction: 'estimateSalaryWithJD',
        requiredDataFields: ['jobTitle'],
        fieldTypes: {
            'data.jobTitle': 'string',
            'data.companyName': 'string',
            'data.location': 'string',
            'data.jobUrl': 'string',
            'data.jobDescription': 'string'
        }
    },
    getAIResponse: {
        requiredAction: 'getAIResponse',
        requiredFields: ['prompt'],
        fieldTypes: {
            'prompt': 'string'
        }
    }
};

/**
 * Get schema for action
 */
export function getSchemaForAction(action) {
    return REQUEST_SCHEMAS[action] || null;
}

