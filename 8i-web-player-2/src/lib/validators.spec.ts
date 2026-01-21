import {
  isDefined,
  isValidNumber,
  isValidObject,
  isValidInteger,
  isValidFloat,
  isValidBoolean,
  isValidString,
  isValidAndNotEmptyString,
  isValidArray,
  isValidJSON,
  isValidEmail,
  isValidFunction,
  isValidURL,
  isValidHexColor,
  isEmptyObject,
  isValidPhoneNumber,
  isValidUUID,
} from "./validators";

describe("Validators", () => {
  it("isDefined", () => {
    expect(isDefined(0)).toBeTruthy();
    expect(isDefined(null)).toBeTruthy();
    expect(isDefined(false)).toBeTruthy();
    expect(isDefined(undefined)).toBeFalsy();
  });

  it("isValidNumber", () => {
    expect(isValidNumber(0)).toBeTruthy();
    expect(isValidNumber("0")).toBeFalsy();
  });

  it("isValidObject", () => {
    expect(isValidObject({})).toBeTruthy();
    expect(isValidObject(0)).toBeFalsy();
    expect(isValidObject([])).toBeFalsy();
    expect(isValidObject(null)).toBeFalsy();
  });

  it("isValidInteger", () => {
    expect(isValidInteger(0)).toBeTruthy();
    expect(isValidInteger(1)).toBeTruthy();
    expect(isValidInteger(-1)).toBeTruthy();
    expect(isValidInteger(1.1)).toBeFalsy();
  });

  it("isValidFloat", () => {
    expect(isValidFloat(0)).toBeTruthy();
    expect(isValidFloat(1.1)).toBeTruthy();
    expect(isValidFloat(-1.1)).toBeTruthy();
    expect(isValidFloat("0")).toBeFalsy();
  });

  it("isValidBoolean", () => {
    expect(isValidBoolean(true)).toBeTruthy();
    expect(isValidBoolean(false)).toBeTruthy();
    expect(isValidBoolean(0)).toBeFalsy();
  });

  it("isValidString", () => {
    expect(isValidString("")).toBeTruthy();
    expect(isValidString(null)).toBeFalsy();
  });

  it("isValidAndNotEmptyString", () => {
    expect(isValidAndNotEmptyString("")).toBeFalsy();
    expect(isValidAndNotEmptyString("   ")).toBeFalsy();
    expect(isValidString(null)).toBeFalsy();
  });

  it("isValidArray", () => {
    expect(isValidArray([])).toBeTruthy();
    expect(isValidArray(0)).toBeFalsy();
  });

  it("isValidJSON", () => {
    expect(isValidJSON("{}")).toBeTruthy();
    expect(isValidJSON("[]")).toBeTruthy();
    expect(isValidJSON("0")).toBeTruthy();
    expect(isValidJSON("")).toBeFalsy();
  });

  it("isValidEmail", () => {
    expect(isValidEmail("foo@bar.com")).toBeTruthy();
    expect(isValidEmail("amanda@redtag.digital")).toBeTruthy();
    expect(isValidEmail("russ@redtag.digital")).toBeTruthy();
    expect(isValidEmail("test@bar.ninja")).toBeTruthy();
    expect(isValidEmail("foobar@")).toBeFalsy();
  });

  it("isValidFunction", () => {
    expect(isValidFunction(Math.max)).toBeTruthy();
    expect(isValidFunction(0)).toBeFalsy();
  });

  it("isValidURL", () => {
    expect(isValidURL(false)).toBeFalsy();
    expect(isValidURL("mailto:email@domain.com")).toBeTruthy();
    expect(isValidURL("tel:+12130000000")).toBeTruthy();
    expect(isValidURL("data:")).toBeTruthy();
    expect(isValidURL("https://buzzcast.com")).toBeTruthy();
  });

  it("isValidHexColor", () => {
    expect(isValidHexColor("#ffffff")).toBeTruthy();
    expect(isValidHexColor("#FFFFFF")).toBeTruthy();
    expect(isValidHexColor("#ffffff00")).toBeTruthy();
    expect(isValidHexColor("#FFFFFF00")).toBeTruthy();
    expect(isValidHexColor("#fff")).toBeTruthy();
    expect(isValidHexColor("#FFF")).toBeTruthy();
    expect(isValidHexColor("#FFFFFF0000")).toBeFalsy();
    expect(isValidHexColor("#ffffff0000")).toBeFalsy();
  });

  it("isEmptyObject", () => {
    expect(isEmptyObject({})).toBeTruthy();
    expect(isEmptyObject({ empty: false })).toBeFalsy();
    expect(isEmptyObject(null)).toBeFalsy();
  });

  it("isValidPhoneNumber", () => {
    const validFormats = [
      "415 555 2671",
      "(415) 555 2671",
      "415-555-2671",
      "4155552671",
      "+1 415 555 2671",
      "001 415 555 2671",
      "020 7183 8750",
      "+442071838750",
      "+44 20 7183 8750",
      "0044 20 7183 8750",
    ];

    const invalidFormats = ["415 a55 2671", "++44 20 7183 8750", "0044 20 7183 8750034"];

    validFormats.forEach((item) => {
      expect(isValidPhoneNumber(item)).toBe(true);
    });

    invalidFormats.forEach((item) => {
      expect(isValidPhoneNumber(item)).toBe(false);
    });
  });

  it("isValidUUID", () => {
    expect(isValidUUID("14a88468-f0d1-7067-642b-1457c06268e7")).toBeTruthy();
  });
});
