import { isDeepStrictEqual } from "node:util";

export function extractProtocolErrorCode(error) {
  if (typeof error?.code === "string") return error.code;
  return String(error?.message ?? error).match(/\[(ALX_[A-Z0-9_]+)\]/)?.[1];
}

export async function captureImplementationCall(impl, operation, input) {
  try {
    return { kind: "output", value: await impl.call(operation, input) };
  } catch (error) {
    return {
      kind: "error",
      errorCode: extractProtocolErrorCode(error) ?? null,
      message: String(error?.message ?? error),
    };
  }
}

export function normativeCapture(capture) {
  return capture.kind === "output"
    ? { kind: "output", value: capture.value }
    : { kind: "error", errorCode: capture.errorCode };
}

export function pairwiseMismatches(captures) {
  const entries = Object.entries(captures);
  const mismatches = [];
  for (let left = 0; left < entries.length; left += 1) {
    for (let right = left + 1; right < entries.length; right += 1) {
      const [leftName, leftCapture] = entries[left];
      const [rightName, rightCapture] = entries[right];
      if (!isDeepStrictEqual(normativeCapture(leftCapture), normativeCapture(rightCapture))) {
        mismatches.push({
          implementations: [leftName, rightName],
          left: normativeCapture(leftCapture),
          right: normativeCapture(rightCapture),
        });
      }
    }
  }
  return mismatches;
}

export function reverseRecord(record) {
  return Object.fromEntries(Object.entries(record).reverse());
}

export function reverseFiniteSource(input) {
  if (input?.source?.kind !== "finite" || !Array.isArray(input.source.blocks)) return input;
  return {
    ...input,
    source: { ...input.source, blocks: [...input.source.blocks].reverse() },
  };
}

export function seededShuffle(values, seed = 0x41_4c_58) {
  const shuffled = [...values];
  let state = seed >>> 0;
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const target = (state >>> 0) % (index + 1);
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

export function shuffleFiniteSource(input) {
  if (input?.source?.kind !== "finite" || !Array.isArray(input.source.blocks)) return input;
  return {
    ...input,
    source: { ...input.source, blocks: seededShuffle(input.source.blocks) },
  };
}
