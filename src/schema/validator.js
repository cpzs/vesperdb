const TYPES = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  OBJECT: 'object',
  ARRAY: 'array',
  DATE: 'date',
  ANY: 'any',
  UUID: 'uuid',
  EMAIL: 'email',
  URL: 'url',
  IP: 'ip',
  JSON: 'json'
};

/**
 * @param {any} value
 * @returns {boolean}
 */
function isNullOrUndefined(value) {
  return value === null || value === undefined;
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isValidEmail(value) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof value === 'string' && emailRegex.test(value);
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isValidUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isValidIp(value) {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return typeof value === 'string' && (ipv4Regex.test(value) || ipv6Regex.test(value));
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isValidUuid(value) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return typeof value === 'string' && uuidRegex.test(value);
}

/**
 * @param {any} value
 * @returns {boolean}
 */
function isValidJson(value) {
  if (typeof value === 'object') return true;
  
  if (typeof value !== 'string') return false;
  
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

class Schema {
  /**
   * @param {Object} definition
   */
  constructor(definition = {}) {
    this.definition = definition;
  }

  /**
   * @param {Object} data
   * @returns {Object}
   */
  validate(data) {
    const errors = [];
    if (isNullOrUndefined(data)) {
      if (this.definition.nullable === true) {
        return { valid: true, errors: [] };
      } else {
        return { 
          valid: false, 
          errors: [{ path: '', message: 'La valeur ne peut pas être nulle' }] 
        };
      }
    }
    
    if (this.definition.type === TYPES.OBJECT) {
      if (typeof data !== 'object' || Array.isArray(data)) {
        errors.push({ path: '', message: 'La valeur doit être un objet' });
      } else if (this.definition.properties) {
        for (const [key, propSchema] of Object.entries(this.definition.properties)) {
          const propValue = data[key];
          
          if (propSchema.required && isNullOrUndefined(propValue)) {
            errors.push({ path: key, message: `La propriété '${key}' est requise` });
            continue;
          }
          
          if (isNullOrUndefined(propValue)) {
            continue;
          }
          
          if (!validateType(propValue, propSchema, key, errors)) {
            continue;
          }
          
          validateTypeSpecifics(propValue, propSchema, key, errors);
        }
        
        if (this.definition.additionalProperties === false) {
          const allowedKeys = Object.keys(this.definition.properties);
          const dataKeys = Object.keys(data);
          
          for (const key of dataKeys) {
            if (!allowedKeys.includes(key)) {
              errors.push({ 
                path: key, 
                message: `La propriété '${key}' n'est pas autorisée dans le schéma` 
              });
            }
          }
        }
      }
    } 
    else if (this.definition.type === TYPES.ARRAY) {
      if (!Array.isArray(data)) {
        errors.push({ path: '', message: 'La valeur doit être un tableau' });
      } else {
        if (this.definition.minItems !== undefined && data.length < this.definition.minItems) {
          errors.push({ 
            path: '', 
            message: `Le tableau doit avoir au moins ${this.definition.minItems} élément(s)` 
          });
        }
        
        if (this.definition.maxItems !== undefined && data.length > this.definition.maxItems) {
          errors.push({ 
            path: '', 
            message: `Le tableau doit avoir au plus ${this.definition.maxItems} élément(s)` 
          });
        }
        
        if (this.definition.items) {
          data.forEach((item, index) => {
            if (!validateType(item, this.definition.items, `[${index}]`, errors)) {
              return;
            }
            
            validateTypeSpecifics(item, this.definition.items, `[${index}]`, errors);
          });
        }
      }
    } 
    else {
      if (!validateType(data, this.definition, '', errors)) {
      } else {
        validateTypeSpecifics(data, this.definition, '', errors);
      }
    }
    
    return { valid: errors.length === 0, errors };
  }
}

/**
 * @param {any} value
 * @param {Object} schema
 * @param {string} path
 * @param {Array} errors
 * @returns {boolean}
 */
function validateType(value, schema, path, errors) {
  if (schema.type === TYPES.ANY) {
    return true;
  }
  
  const pathPrefix = path ? `${path}` : '';
  
  switch (schema.type) {
    case TYPES.STRING:
      if (typeof value !== 'string') {
        errors.push({ path, message: `${pathPrefix} doit être une chaîne de caractères` });
        return false;
      }
      break;
      
    case TYPES.NUMBER:
      if (typeof value !== 'number' || isNaN(value)) {
        errors.push({ path, message: `${pathPrefix} doit être un nombre` });
        return false;
      }
      break;
      
    case TYPES.BOOLEAN:
      if (typeof value !== 'boolean') {
        errors.push({ path, message: `${pathPrefix} doit être un booléen` });
        return false;
      }
      break;
      
    case TYPES.OBJECT:
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        errors.push({ path, message: `${pathPrefix} doit être un objet` });
        return false;
      }
      break;
      
    case TYPES.ARRAY:
      if (!Array.isArray(value)) {
        errors.push({ path, message: `${pathPrefix} doit être un tableau` });
        return false;
      }
      break;
      
    case TYPES.DATE:
      if (!(value instanceof Date) && !isValidDate(value)) {
        errors.push({ path, message: `${pathPrefix} doit être une date valide` });
        return false;
      }
      break;
      
    case TYPES.UUID:
      if (!isValidUuid(value)) {
        errors.push({ path, message: `${pathPrefix} doit être un UUID valide` });
        return false;
      }
      break;
      
    case TYPES.EMAIL:
      if (!isValidEmail(value)) {
        errors.push({ path, message: `${pathPrefix} doit être un email valide` });
        return false;
      }
      break;
      
    case TYPES.URL:
      if (!isValidUrl(value)) {
        errors.push({ path, message: `${pathPrefix} doit être une URL valide` });
        return false;
      }
      break;
      
    case TYPES.IP:
      if (!isValidIp(value)) {
        errors.push({ path, message: `${pathPrefix} doit être une adresse IP valide` });
        return false;
      }
      break;
      
    case TYPES.JSON:
      if (!isValidJson(value)) {
        errors.push({ path, message: `${pathPrefix} doit être un JSON valide` });
        return false;
      }
      break;
      
    default:
      errors.push({ path, message: `Type inconnu: ${schema.type}` });
      return false;
  }
  
  return true;
}

/**
 * @param {any} value
 * @returns {boolean}
 */
function isValidDate(value) {
  if (value instanceof Date) return !isNaN(value);
  
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return !isNaN(date);
  }
  
  return false;
}

/**
 * @param {any} value
 * @param {Object} schema
 * @param {string} path
 * @param {Array} errors
 * @returns {boolean}
 */
function validateTypeSpecifics(value, schema, path, errors) {
  const pathPrefix = path ? `${path}` : '';
  
  // Validations communes à plusieurs types
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push({ 
      path, 
      message: `${pathPrefix} doit être l'une des valeurs suivantes: ${schema.enum.join(', ')}` 
    });
  }
  
  // Validations spécifiques au type
  switch (schema.type) {
    case TYPES.STRING:
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push({ 
          path, 
          message: `${pathPrefix} doit contenir au moins ${schema.minLength} caractère(s)` 
        });
      }
      
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push({ 
          path, 
          message: `${pathPrefix} doit contenir au plus ${schema.maxLength} caractère(s)` 
        });
      }
      
      if (schema.pattern) {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(value)) {
          errors.push({ 
            path, 
            message: `${pathPrefix} doit correspondre au modèle défini` 
          });
        }
      }
      break;
      
    case TYPES.NUMBER:
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push({ 
          path, 
          message: `${pathPrefix} doit être supérieur ou égal à ${schema.minimum}` 
        });
      }
      
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push({ 
          path, 
          message: `${pathPrefix} doit être inférieur ou égal à ${schema.maximum}` 
        });
      }
      
      if (schema.multipleOf !== undefined && value % schema.multipleOf !== 0) {
        errors.push({ 
          path, 
          message: `${pathPrefix} doit être un multiple de ${schema.multipleOf}` 
        });
      }
      break;
      
    case TYPES.ARRAY:
      if (schema.uniqueItems && new Set(value).size !== value.length) {
        errors.push({ 
          path, 
          message: `${pathPrefix} doit contenir des éléments uniques` 
        });
      }
      break;
      
    case TYPES.DATE:
      const date = new Date(value);
      
      if (schema.minimum !== undefined) {
        const minDate = new Date(schema.minimum);
        if (date < minDate) {
          errors.push({ 
            path, 
            message: `${pathPrefix} doit être après ${minDate.toISOString()}` 
          });
        }
      }
      
      if (schema.maximum !== undefined) {
        const maxDate = new Date(schema.maximum);
        if (date > maxDate) {
          errors.push({ 
            path, 
            message: `${pathPrefix} doit être avant ${maxDate.toISOString()}` 
          });
        }
      }
      break;
  }
}

/**
 * @param {Object} definition
 * @returns {Schema}
 */
function createSchema(definition) {
  return new Schema(definition);
}

module.exports = {
  TYPES,
  Schema,
  createSchema
}; 