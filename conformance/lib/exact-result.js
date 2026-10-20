import { isDeepStrictEqual } from "node:util";

function printable(value) {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) return String(value);
  return serialized.length <= 1200 ? serialized : `${serialized.slice(0, 1197)}...`;
}

export function compareExactResult(actual, expected) {
  if (isDeepStrictEqual(actual, expected)) {
    return { matches: true };
  }
  return {
    matches: false,
    detail: `actual ${printable(actual)} vs expected ${printable(expected)}`,
  };
}
