/** Validation shared by the host and persistent view store. */
export const MAX_HTML_BYTES = 256 * 1024;
export const MAX_STATE_BYTES = 16 * 1024;

export function inputError(message) {
  return Object.assign(new Error(message), { code: 'INVALID_INPUT' });
}

function record(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw inputError(`${label} must be a JSON object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw inputError(`${label} must be a plain JSON object`);
  }
}

const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor']);

function entries(value, label) {
  return Reflect.ownKeys(value).map((key) => {
    if (typeof key !== 'string' || forbiddenKeys.has(key)) {
      throw inputError(`${label} contains a forbidden property`);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
      throw inputError(`${label} must contain only enumerable data properties`);
    }
    return [key, descriptor.value];
  });
}

function payloadFields(value, permitted) {
  record(value, 'payload');
  const result = {};
  for (const [key, child] of entries(value, 'payload')) {
    if (!permitted.includes(key)) throw inputError(`Unknown payload field: ${key}`);
    result[key] = child;
  }
  return result;
}

function boundedString(value, label, limit, { nonempty = false } = {}) {
  if (typeof value !== 'string' || [...value].length > limit) {
    throw inputError(`${label} must be a string of at most ${limit} characters`);
  }
  if (nonempty && !value.trim()) throw inputError(`${label} must not be empty`);
  return value;
}

function title(value) {
  return boundedString(value, 'title', 200, { nonempty: true });
}

function summary(value) {
  return boundedString(value, 'summary', 8000);
}

function html(value) {
  if (typeof value !== 'string' || !value.trim() || Buffer.byteLength(value, 'utf8') > MAX_HTML_BYTES) {
    throw inputError(`html must be a nonempty string of at most ${MAX_HTML_BYTES} UTF-8 bytes`);
  }
  return value;
}

function schemaVersion(value) {
  boundedString(value, 'stateSchemaVersion', 64, { nonempty: true });
  if (value !== value.trim() || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw inputError('stateSchemaVersion must not contain controls or surrounding whitespace');
  }
  return value;
}

export function validateInteger(value, label, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw inputError(`${label} must be a safe integer greater than or equal to ${minimum}`);
  }
  return value;
}

/** Accepts a JSON object, recursively validates it, and returns an independent copy. */
export function validateState(state) {
  record(state, 'state');
  const ancestors = new WeakSet();
  function copy(value, depth) {
    if (depth > 64) throw inputError('state exceeds the maximum nesting depth');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'object') throw inputError('state contains a value that is not JSON');
    if (ancestors.has(value)) throw inputError('state contains a cycle');
    ancestors.add(value);
    let result;
    if (Array.isArray(value)) {
      const keys = Reflect.ownKeys(value);
      if (keys.length !== value.length + 1) throw inputError('state arrays must be dense and contain no extra properties');
      result = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) {
          throw inputError('state arrays must contain only JSON values');
        }
        result.push(copy(descriptor.value, depth + 1));
      }
    } else {
      record(value, 'state value');
      result = {};
      for (const [key, child] of entries(value, 'state')) result[key] = copy(child, depth + 1);
    }
    ancestors.delete(value);
    return result;
  }
  const result = copy(state, 0);
  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > MAX_STATE_BYTES) {
    throw inputError(`state exceeds ${MAX_STATE_BYTES} UTF-8 bytes`);
  }
  return result;
}

/** validateCreate(payload) -> normalized payload; schema defaults to "1", state to {}. */
export function validateCreate(payload) {
  const fields = payloadFields(payload, ['title', 'html', 'summary', 'initialState', 'stateSchemaVersion']);
  return {
    title: title(fields.title),
    html: html(fields.html),
    summary: summary(fields.summary),
    initialState: Object.hasOwn(fields, 'initialState') ? validateState(fields.initialState) : {},
    stateSchemaVersion: Object.hasOwn(fields, 'stateSchemaVersion') ? schemaVersion(fields.stateSchemaVersion) : '1',
  };
}

/** validateUpdate(payload) -> validated copy, preserving omitted optional fields. */
export function validateUpdate(payload) {
  const fields = payloadFields(payload, ['expectedRevision', 'html', 'title', 'summary', 'initialState', 'stateSchemaVersion']);
  const result = {
    expectedRevision: validateInteger(fields.expectedRevision, 'expectedRevision', 1),
    html: html(fields.html),
  };
  if (Object.hasOwn(fields, 'title')) result.title = title(fields.title);
  if (Object.hasOwn(fields, 'summary')) result.summary = summary(fields.summary);
  if (Object.hasOwn(fields, 'initialState')) result.initialState = validateState(fields.initialState);
  if (Object.hasOwn(fields, 'stateSchemaVersion')) result.stateSchemaVersion = schemaVersion(fields.stateSchemaVersion);
  return result;
}

export function validateStateWrite(payload) {
  const fields = payloadFields(payload, ['revision', 'expectedStateVersion', 'state']);
  return {
    revision: validateInteger(fields.revision, 'revision', 1),
    expectedStateVersion: validateInteger(fields.expectedStateVersion, 'expectedStateVersion', 0),
    state: validateState(fields.state),
  };
}
