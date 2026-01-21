import { isValidAndNotEmptyString, isValidNumber } from "../lib/validators";

export const parseFrameRate = (value) => {
  if (!isValidAndNotEmptyString(value)) {
    return -1;
  }
  const result = /^(\d+)\/(\d+)$/.exec(value);
  if (!result) {
    return -1;
  }

  const numeratorString = result[1];
  const denominatorString = result[2];
  const numerator = parseFloat(numeratorString);
  const denominator = parseFloat(denominatorString);
  if (!isValidNumber(numerator) && !isValidNumber(denominator)) {
    return -1;
  }

  return numerator / denominator;
};
