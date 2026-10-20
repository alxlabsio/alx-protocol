/** Decode one raw ALX JSON input without replacement or duplicate-member loss. */
export function decodeStrictJsonBytes(bytes) {
  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("invalid UTF-8");
  }
  return parseStrictJson(source);
}

/** Parse JSON while rejecting duplicate object member names at every depth. */
export function parseStrictJson(source) {
  const value = JSON.parse(source);
  scanValue(source, skipWhitespace(source, 0));
  return value;
}

function scanValue(source, start) {
  const token = source[start];
  if (token === "{") return scanObject(source, start + 1);
  if (token === "[") return scanArray(source, start + 1);
  if (token === '"') return scanString(source, start);
  let index = start;
  while (index < source.length && !/[,}\]\s]/u.test(source[index])) index += 1;
  return index;
}

function scanObject(source, start) {
  let index = skipWhitespace(source, start);
  const members = new Set();
  if (source[index] === "}") return index + 1;
  while (index < source.length) {
    const end = scanString(source, index);
    const name = JSON.parse(source.slice(index, end));
    if (members.has(name)) throw new Error(`duplicate JSON member: ${name}`);
    members.add(name);
    index = skipWhitespace(source, end);
    if (source[index] !== ":") throw new SyntaxError("invalid JSON object");
    index = skipWhitespace(source, scanValue(source, skipWhitespace(source, index + 1)));
    if (source[index] === "}") return index + 1;
    if (source[index] !== ",") throw new SyntaxError("invalid JSON object");
    index = skipWhitespace(source, index + 1);
  }
  throw new SyntaxError("unterminated JSON object");
}

function scanArray(source, start) {
  let index = skipWhitespace(source, start);
  if (source[index] === "]") return index + 1;
  while (index < source.length) {
    index = skipWhitespace(source, scanValue(source, index));
    if (source[index] === "]") return index + 1;
    if (source[index] !== ",") throw new SyntaxError("invalid JSON array");
    index = skipWhitespace(source, index + 1);
  }
  throw new SyntaxError("unterminated JSON array");
}

function scanString(source, start) {
  if (source[start] !== '"') throw new SyntaxError("JSON object member must be a string");
  let index = start + 1;
  while (index < source.length) {
    if (source[index] === '"') return index + 1;
    if (source[index] === "\\") index += 1;
    index += 1;
  }
  throw new SyntaxError("unterminated JSON string");
}

function skipWhitespace(source, start) {
  let index = start;
  while (index < source.length && /\s/u.test(source[index])) index += 1;
  return index;
}
