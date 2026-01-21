import { isValidArray, isValidAndNotEmptyString } from "./validators";

export const getErrorTitle = (e) => {
  return e?.message || e?.stack || e;
};

export const getNormalizedError = (e) => {
  if (isValidArray(e)) {
    const message = e.map(getErrorTitle).join("\n\n");
    return new Error(message);
  }

  if (e instanceof Error) {
    return e;
  }
  if (isValidAndNotEmptyString(e)) {
    return new Error(e);
  }
  return e;
};
