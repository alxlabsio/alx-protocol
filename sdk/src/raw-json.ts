/** Decode UTF-8 without replacement and parse JSON without losing duplicate members. */
export function parseStrictJsonBytes(bytes: Uint8Array): unknown {
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new SyntaxError("Input is not valid UTF-8");
  }
  return parseStrictJson(source);
}

export function parseStrictJson(source: string): unknown {
  const value: unknown = JSON.parse(source);
  scanValue(source, skipWhitespace(source, 0));
  return value;
}

function scanValue(source: string, start: number): number {
  const token = source[start];
  if (token === "{") return scanObject(source, start + 1);
  if (token === "[") return scanArray(source, start + 1);
  if (token === '"') return scanString(source, start);
  let index = start;
  while (index < source.length && !/[,}\]\s]/u.test(source[index])) index += 1;
  return index;
}

function scanObject(source: string, start: number): number {
  let index = skipWhitespace(source, start);
  const members = new Set<string>();
  if (source[index] === "}") return index + 1;
  while (index < source.length) {
    const end = scanString(source, index);
    const name = JSON.parse(source.slice(index, end)) as string;
    if (members.has(name)) throw new SyntaxError(`Duplicate JSON member: ${name}`);
    members.add(name);
    index = skipWhitespace(source, end);
    if (source[index] !== ":") throw new SyntaxError("Invalid JSON object");
    index = skipWhitespace(source, scanValue(source, skipWhitespace(source, index + 1)));
    if (source[index] === "}") return index + 1;
    if (source[index] !== ",") throw new SyntaxError("Invalid JSON object");
    index = skipWhitespace(source, index + 1);
  }
  throw new SyntaxError("Unterminated JSON object");
}

function scanArray(source: string, start: number): number {
  let index = skipWhitespace(source, start);
  if (source[index] === "]") return index + 1;
  while (index < source.length) {
    index = skipWhitespace(source, scanValue(source, index));
    if (source[index] === "]") return index + 1;
    if (source[index] !== ",") throw new SyntaxError("Invalid JSON array");
    index = skipWhitespace(source, index + 1);
  }
  throw new SyntaxError("Unterminated JSON array");
}

function scanString(source: string, start: number): number {
  if (source[start] !== '"') throw new SyntaxError("JSON object member must be a string");
  let index = start + 1;
  while (index < source.length) {
    if (source[index] === '"') return index + 1;
    if (source[index] === "\\") index += 1;
    index += 1;
  }
  throw new SyntaxError("Unterminated JSON string");
}

function skipWhitespace(source: string, start: number): number {
  let index = start;
  while (index < source.length && /\s/u.test(source[index])) index += 1;
  return index;
}
