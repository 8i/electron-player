// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Value = any;

/**
 * @type {RegExp}
 */
export const RGX_URL = /^(rtmp|https?:\/\/|mailto:|data:|tel:)/;

/**
 * @type {RegExp}
 */
export const RGX_COLOR_HEX = /^#([A-Fa-f0-9]{8}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

/**
 * @type {RegExp}
 */
export const RGX_FLOAT = /^(-)?\d+(\.)?(\d+)?$/;

/**
 * @type {RegExp}
 */
export const RGX_INTEGER = /^(-)?\d+$/;

/**
 * @type {RegExp}
 * http://emailregex.com/
 */
export const RGX_EMAIL =
  /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/; // eslint-disable-line

/**
 * @type {RegExp}
 */
export const RGX_PHONE_NUMBER = /^\+?(?:[0-9] ?){6,14}[0-9]$/;

/**
 * Matches UUID v1 - v5 and `nil` UUID.
 * @type {RegExp}
 * @see https://stackoverflow.com/questions/136505/searching-for-uuids-in-text-with-regex
 */
export const RGX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @type {RegExp}
 * starts with alpha / ends with alpha or digit
 * allows only lower case / no special chars except `-`
 */
export const RGX_SLUG = /^[a-z]([a-z0-9-]*[a-z0-9])?$/;

/**
 * @method isDefined
 * @param  {*} value
 * @return {Boolean}
 */
export const isDefined = (value: Value) => typeof value !== "undefined";

/**
 * @method isValidNumber
 * @param  {*} value
 * @return {Boolean}
 */
export const isValidNumber = (value: Value) => typeof value === "number" && !isNaN(value);

/**
 * @method isValidObject
 * @param  {*} value
 * @return {Boolean}
 */
export const isValidObject = (value: Value) =>
  typeof value === "object" && !isValidArray(value) && value !== null && value.constructor === Object;

/**
 * @method isValidInteger
 * @param  {*} value
 * @return {Boolean}
 */
export const isValidInteger = (value: Value) => {
  if (!isValidNumber(value)) {
    return false;
  }
  return RGX_INTEGER.test(value.toString());
};

/**
 * @method isValidFloat
 * @param  {*} value
 * @return {Boolean}
 */
export const isValidFloat = (value: Value) => {
  if (!isValidNumber(value)) {
    return false;
  }
  return RGX_FLOAT.test(value.toString());
};

/**
 * @method isValidBoolean
 * @param  {*} value
 * @return {Boolean}
 */
export const isValidBoolean = (value: Value) => value === true || value === false;

/**
 * @method isValidString
 * @param  {*} value
 * @return {Boolean}
 */
export const isValidString = (value: Value) => typeof value === "string";

/**
 * @method isValidAndNotEmptyString
 * @param  {*} value
 * @return {Boolean}
 */
export const isValidAndNotEmptyString = (value: Value) => isValidString(value) && value.trim().length > 0;

/**
 * @method isValidArray
 * @param  {*} value
 * @return {Boolean}
 */
export const isValidArray = (value: Value) => Array.isArray(value);

/**
 * @method isValidJSON
 * @param  {*} value
 * @return {Boolean}
 */
export const isValidJSON = (value: Value) =>
  isValidArray(value) ||
  isValidObject(value) ||
  isValidAndNotEmptyString(value) ||
  isValidNumber(value) ||
  value === null;

/**
 * @method isValidEmail
 * @param  {*} value
 * @return {Boolean}
 */
export const isValidEmail = (value: Value) => {
  if (!isValidString(value)) {
    return false;
  }
  return RGX_EMAIL.test(value);
};

/**
 * @method isValidFunction
 * @param  {*} value
 * @return {Boolean}
 */
export const isValidFunction = (value: Value) => typeof value === "function";

/**
 * @method isValidURL
 * @param  {*} value
 * @return {Boolean}
 */
export const isValidURL = (value: Value) => {
  if (!isValidString(value)) {
    return false;
  }
  return RGX_URL.test(value);
};

/**
 * @method isValidHexColor
 * @param  {*} value
 * @return {Boolean}
 */
export const isValidHexColor = (value: Value) => {
  if (!isValidString(value)) {
    return false;
  }
  return RGX_COLOR_HEX.test(value);
};

/**
 * @method isValidUUID
 * @param  {*} value
 * @return {Boolean}
 */
export const isValidUUID = (value: Value) => {
  if (!isValidString(value)) {
    return false;
  }
  return RGX_UUID.test(value);
};

/**
 * @method isNull
 * @param  {*} value
 * @return {Boolean}
 */
export const isNull = (value: Value) => {
  return value === null;
};

/**
 * @method isEmptyObject
 * @param  {*} value
 * @return {Boolean}
 */
export const isEmptyObject = (value: Value) => {
  return isValidObject(value) && !isNull(value) && value.constructor === Object && Object.keys(value).length === 0;
};

/**
 * @method isValidDate
 * @param  {*} value
 * @return {Boolean}
 */
export const isValidDate = (value: Value) => {
  return value instanceof Date && !isNaN(value.getDate());
};

/**
 * @method isValidPhoneNumber
 * Accepts all international and local phone numbers,
 * but without Value special characters,
 * except `+` and ` `.
 * @param  {*} value
 * @return {Boolean}
 */
export const isValidPhoneNumber = (value: Value) => {
  if (!isValidString(value)) {
    return false;
  }

  // Remove braces, dots, hyphens.
  const clean = value.replace(/[().-]/g, "");

  return RGX_PHONE_NUMBER.test(clean);
};

/**
 * @method isJsonString
 * @param  {string} value
 * @return {Boolean}
 */
export const isJsonString = (value: Value) => {
  try {
    JSON.parse(value);
    return true;
  } catch (e) {
    return false;
  }
};
