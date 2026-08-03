#!/usr/bin/env node
/**
 * Generate deterministic ALX logo exploration SVGs from one geometric system.
 *
 * Usage:
 *   node scripts/docs/generate-alx-logo.js
 *   node scripts/docs/generate-alx-logo.js \
 *     --axis isometric --connection integrated --color currentColor --out mark.svg
 *
 * The generator creates vector candidates only. PNG exports remain derivatives of
 * the selected SVG master and are intentionally deferred until a candidate wins.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const DEFAULT_OUT_DIR = path.join(ROOT, "docs/assets/brand/exploration");

export const AXES = Object.freeze(["isometric", "diamond45"]);
export const CONNECTIONS = Object.freeze(["integrated", "seamed", "closed"]);
export const COLORS = Object.freeze(["currentColor", "black", "white"]);

export const SPEC = Object.freeze({
  viewBox: 1024,
  unit: 8,
  edge: 352,
  band: 96,
  gap: 32,
  counter: 96,
  notchWidth: 80,
  notchDepth: 128,
  targetExtent: 760,
  opticalNudge: 2,
  diamondDepthRatio: 0.68,
});

const AXIS_ANGLES = Object.freeze({
  isometric: 30,
  diamond45: 45,
});

const CONNECTION_LABELS = Object.freeze({
  integrated: "A-L + L-X joined / A-X open",
  seamed: "Equal face seams",
  closed: "Closed perimeter",
});

const COLOR_VALUES = Object.freeze({
  currentColor: "currentColor",
  black: "#000000",
  white: "#ffffff",
});

function point(x, y) {
  return { x, y };
}

function add(a, b) {
  return point(a.x + b.x, a.y + b.y);
}

function scale(a, amount) {
  return point(a.x * amount, a.y * amount);
}

function fmt(value) {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function ringPath(points) {
  return `${points
    .map((p, index) => `${index === 0 ? "M" : "L"}${fmt(p.x)} ${fmt(p.y)}`)
    .join(" ")} Z`;
}

function signedArea(points) {
  return points.reduce((area, current, index) => {
    const next = points[(index + 1) % points.length];
    return area + current.x * next.y - next.x * current.y;
  }, 0) / 2;
}

function orientedRing(points, positive) {
  const isPositive = signedArea(points) > 0;
  return isPositive === positive ? points : [...points].reverse();
}

function compoundMarkPath(model) {
  const rings = [];
  for (const shape of model.shapes) {
    rings.push(orientedRing(shape.outer, true));
    for (const hole of shape.holes ?? []) rings.push(orientedRing(hole, false));
  }
  return rings.map(ringPath).join(" ");
}

function clipAgainst(poly, inside, intersect) {
  if (poly.length === 0) return [];
  const output = [];
  let previous = poly.at(-1);
  let previousInside = inside(previous);

  for (const current of poly) {
    const currentInside = inside(current);
    if (currentInside !== previousInside) {
      output.push(intersect(previous, current));
    }
    if (currentInside) output.push(current);
    previous = current;
    previousInside = currentInside;
  }
  return output;
}

function clipToRect(poly, minX, minY, maxX, maxY) {
  const verticalIntersection = (x) => (a, b) => {
    const t = (x - a.x) / (b.x - a.x);
    return point(x, a.y + (b.y - a.y) * t);
  };
  const horizontalIntersection = (y) => (a, b) => {
    const t = (y - a.y) / (b.y - a.y);
    return point(a.x + (b.x - a.x) * t, y);
  };

  let result = poly;
  result = clipAgainst(result, (p) => p.x >= minX, verticalIntersection(minX));
  result = clipAgainst(result, (p) => p.x <= maxX, verticalIntersection(maxX));
  result = clipAgainst(result, (p) => p.y >= minY, horizontalIntersection(minY));
  result = clipAgainst(result, (p) => p.y <= maxY, horizontalIntersection(maxY));
  return result;
}

function makeFrame(axis) {
  if (!AXES.includes(axis)) throw new Error(`Unsupported axis: ${axis}`);
  const angle = (AXIS_ANGLES[axis] * Math.PI) / 180;
  const right = point(SPEC.edge * Math.cos(angle), SPEC.edge * Math.sin(angle));
  const left = point(-right.x, right.y);
  const depth = axis === "diamond45" ? SPEC.edge * SPEC.diamondDepthRatio : SPEC.edge;
  const down = point(0, depth);
  const top = point(0, 0);
  const shoulderLeft = add(top, left);
  const shoulderRight = add(top, right);
  const center = add(add(top, left), right);
  const bottom = add(center, down);
  const lowerLeft = add(shoulderLeft, down);
  const lowerRight = add(shoulderRight, down);

  return {
    axis,
    angle: AXIS_ANGLES[axis],
    vectors: { right, left, down },
    vertices: { top, shoulderLeft, shoulderRight, center, bottom, lowerLeft, lowerRight },
    topPoint(u, v) {
      return add(top, add(scale(right, u / SPEC.edge), scale(left, v / SPEC.edge)));
    },
    leftPoint(s, t) {
      return add(shoulderLeft, add(scale(right, s / SPEC.edge), scale(down, t / SPEC.edge)));
    },
    rightPoint(s, t) {
      return add(center, add(scale(right, s / SPEC.edge), scale(down, t / SPEC.edge)));
    },
  };
}

function topLetter(frame) {
  const max = SPEC.edge - SPEC.gap;
  const center = SPEC.edge / 2;
  const counterHalf = SPEC.counter / 2;
  const diagonal = 1 / Math.sqrt(2);
  const innerCenter = max - SPEC.notchDepth * diagonal;
  const openingOffset = SPEC.notchWidth * diagonal;
  const outer = [
    frame.topPoint(0, 0),
    frame.topPoint(max, 0),
    frame.topPoint(max, max - openingOffset),
    frame.topPoint(innerCenter, innerCenter),
    frame.topPoint(max - openingOffset, max),
    frame.topPoint(0, max),
  ];
  const counter = [
    frame.topPoint(center - counterHalf, center - counterHalf),
    frame.topPoint(center + counterHalf, center - counterHalf),
    frame.topPoint(center + counterHalf, center + counterHalf),
    frame.topPoint(center - counterHalf, center + counterHalf),
  ];

  return { role: "a", outer, holes: [counter], local: { counter } };
}

function leftLetter(frame) {
  const start = SPEC.gap;
  const end = SPEC.edge - SPEC.gap;
  const outer = [
    frame.leftPoint(0, start),
    frame.leftPoint(SPEC.band, start),
    frame.leftPoint(SPEC.band, SPEC.edge - SPEC.band),
    frame.leftPoint(end, SPEC.edge - SPEC.band),
    frame.leftPoint(end, SPEC.edge),
    frame.leftPoint(0, SPEC.edge),
  ];
  return { role: "l", outer, holes: [] };
}

function diagonalBand(start, end, width) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const offset = point((-dy / length) * (width / 2), (dx / length) * (width / 2));
  return [
    add(start, offset),
    add(end, offset),
    add(end, scale(offset, -1)),
    add(start, scale(offset, -1)),
  ];
}

function rightLetter(frame) {
  const localArms = [
    diagonalBand(point(0, 0), point(SPEC.edge, SPEC.edge), SPEC.band),
    diagonalBand(point(SPEC.edge, 0), point(0, SPEC.edge), SPEC.band),
  ];
  const clipped = localArms.map((poly) =>
    clipToRect(poly, SPEC.gap, SPEC.gap, SPEC.edge, SPEC.edge),
  );
  return clipped.map((poly, index) => ({
    role: `x-${index + 1}`,
    outer: poly.map((p) => frame.rightPoint(p.x, p.y)),
    holes: [],
  }));
}

function connectionBridge(frame, junction) {
  const max = SPEC.edge - SPEC.gap;
  if (junction === "a-l") {
    return {
      role: "bridge-a-l",
      outer: [
        frame.topPoint(0, max),
        frame.vertices.shoulderLeft,
        frame.leftPoint(0, SPEC.gap),
        frame.leftPoint(SPEC.band, SPEC.gap),
        frame.topPoint(SPEC.band, max),
      ],
      holes: [],
    };
  }
  if (junction === "a-x") {
    return {
      role: "bridge-a-x",
      outer: [
        frame.topPoint(max, 0),
        frame.vertices.shoulderRight,
        frame.rightPoint(SPEC.edge, SPEC.gap),
        frame.rightPoint(SPEC.edge - SPEC.band, SPEC.gap),
        frame.topPoint(max, SPEC.band),
      ],
      holes: [],
    };
  }
  if (junction === "l-x") {
    return {
      role: "bridge-l-x",
      outer: [
        frame.leftPoint(max, SPEC.edge),
        frame.vertices.bottom,
        frame.rightPoint(SPEC.gap, SPEC.edge),
        frame.rightPoint(SPEC.gap, SPEC.edge - SPEC.band),
        frame.leftPoint(max, SPEC.edge - SPEC.band),
      ],
      holes: [],
    };
  }
  throw new Error(`Unsupported junction: ${junction}`);
}

function modelBounds(shapes) {
  const points = shapes.flatMap((shape) => [shape.outer, ...(shape.holes ?? [])]).flat();
  return points.reduce(
    (bounds, p) => ({
      minX: Math.min(bounds.minX, p.x),
      minY: Math.min(bounds.minY, p.y),
      maxX: Math.max(bounds.maxX, p.x),
      maxY: Math.max(bounds.maxY, p.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
}

function normalizeShapes(shapes) {
  const bounds = modelBounds(shapes);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const factor = SPEC.targetExtent / Math.max(width, height);
  const rawCenter = point((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2);
  const targetCenter = SPEC.viewBox / 2;
  const transformPoint = (p) =>
    point(
      targetCenter + (p.x - rawCenter.x) * factor,
      targetCenter + (p.y - rawCenter.y) * factor,
    );
  const normalized = shapes.map((shape) => ({
    ...shape,
    outer: shape.outer.map(transformPoint),
    holes: (shape.holes ?? []).map((ring) => ring.map(transformPoint)),
  }));
  return { shapes: normalized, transformPoint, factor, rawBounds: bounds };
}

export function createMarkModel({ axis, connection }) {
  if (!AXES.includes(axis)) throw new Error(`axis must be one of: ${AXES.join(", ")}`);
  if (!CONNECTIONS.includes(connection)) {
    throw new Error(`connection must be one of: ${CONNECTIONS.join(", ")}`);
  }

  const frame = makeFrame(axis);
  const shapes = [topLetter(frame), leftLetter(frame), ...rightLetter(frame)];
  const junctions = connection === "seamed"
    ? []
    : connection === "integrated"
      ? ["a-l", "l-x"]
      : ["a-l", "l-x", "a-x"];
  for (const junction of junctions) shapes.push(connectionBridge(frame, junction));

  const normalized = normalizeShapes(shapes);
  const transformedVertices = Object.fromEntries(
    Object.entries(frame.vertices).map(([key, value]) => [key, normalized.transformPoint(value)]),
  );

  return {
    axis,
    connection,
    angle: frame.angle,
    shapes: normalized.shapes,
    bridgeRoles: junctions.map((junction) => `bridge-${junction}`),
    bounds: modelBounds(normalized.shapes),
    factor: normalized.factor,
    frame,
    transformPoint: normalized.transformPoint,
    transformedVertices,
  };
}

export function createTopAModel({ axis = "isometric" } = {}) {
  if (!AXES.includes(axis)) throw new Error(`axis must be one of: ${AXES.join(", ")}`);
  const frame = makeFrame(axis);
  const normalized = normalizeShapes([topLetter(frame)]);
  return {
    axis,
    component: "a",
    angle: frame.angle,
    shapes: normalized.shapes,
    bounds: modelBounds(normalized.shapes),
    factor: normalized.factor,
    frame,
    transformPoint: normalized.transformPoint,
  };
}

export function createLowercaseAModel() {
  const outer = [
    point(96, 152),
    point(928, 152),
    point(928, 872),
    point(904, 872),
    point(800, 720),
    point(696, 872),
    point(96, 872),
  ];
  const counter = [
    point(336, 376),
    point(672, 376),
    point(672, 656),
    point(336, 656),
  ];
  const shapes = [{ role: "lowercase-a", outer, holes: [counter] }];
  return {
    component: "lowercase-a",
    shapes,
    bounds: modelBounds(shapes),
    source: "alx logo.svg and drawing.svg",
    construction: {
      outer: { x: 96, y: 152, width: 832, height: 720 },
      counter: { x: 336, y: 376, width: 336, height: 280 },
      notch: { apex: point(800, 720), left: point(696, 872), right: point(904, 872) },
    },
  };
}

function markPaths(model, fill) {
  const roles = model.shapes.map((shape) => shape.role).join(" ");
  return `<path data-roles="${roles}" d="${compoundMarkPath(model)}" fill="${fill}" fill-rule="nonzero"/>`;
}

function svgDocument({ width, height, title, description, body, background }) {
  const backgroundElement = background
    ? `<rect width="${width}" height="${height}" fill="${background}"/>\n  `
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc" shape-rendering="geometricPrecision">
  <title id="title">${xmlEscape(title)}</title>
  <desc id="desc">${xmlEscape(description)}</desc>
  ${backgroundElement}${body}
</svg>
`;
}

export function renderMarkSvg({ axis, connection, color = "currentColor" }) {
  if (!COLORS.includes(color)) throw new Error(`color must be one of: ${COLORS.join(", ")}`);
  const model = createMarkModel({ axis, connection });
  const metadata = JSON.stringify({
    system: "ALX geometric mark",
    axis,
    connection,
    angle: model.angle,
    viewBox: SPEC.viewBox,
    unit: SPEC.unit,
    edge: SPEC.edge,
    band: SPEC.band,
    gap: SPEC.gap,
    counter: SPEC.counter,
    opticalNudge: SPEC.opticalNudge,
  });
  const title = `ALX logo candidate: ${axis}, ${connection}`;
  const description = `Geometric ALX cube mark using ${model.angle}-degree face axes and ${CONNECTION_LABELS[connection].toLowerCase()}.`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SPEC.viewBox}" height="${SPEC.viewBox}" viewBox="0 0 ${SPEC.viewBox} ${SPEC.viewBox}" role="img" aria-labelledby="title desc" shape-rendering="geometricPrecision">
  <title id="title">${xmlEscape(title)}</title>
  <desc id="desc">${xmlEscape(description)}</desc>
  <metadata>${xmlEscape(metadata)}</metadata>
  <g fill="${COLOR_VALUES[color]}">
    ${markPaths(model, COLOR_VALUES[color])}
  </g>
</svg>
`;
}

export function renderTopASvg({
  axis = "isometric",
  color = "currentColor",
  background,
} = {}) {
  if (!COLORS.includes(color)) throw new Error(`color must be one of: ${COLORS.join(", ")}`);
  const model = createTopAModel({ axis });
  const title = `Isolated ALX A mark: ${axis}`;
  const description = `The symmetric top-face A isolated from the ALX cube, using ${model.angle}-degree face axes, a centered diamond counter, and zero-radius corners.`;
  const metadata = JSON.stringify({
    system: "ALX geometric mark",
    component: "a",
    axis,
    angle: model.angle,
    viewBox: SPEC.viewBox,
    unit: SPEC.unit,
    edge: SPEC.edge,
    gap: SPEC.gap,
    counter: SPEC.counter,
  });
  const backgroundElement = background
    ? `<rect width="${SPEC.viewBox}" height="${SPEC.viewBox}" fill="${background}"/>\n  `
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SPEC.viewBox}" height="${SPEC.viewBox}" viewBox="0 0 ${SPEC.viewBox} ${SPEC.viewBox}" role="img" aria-labelledby="title desc" shape-rendering="geometricPrecision">
  <title id="title">${xmlEscape(title)}</title>
  <desc id="desc">${xmlEscape(description)}</desc>
  <metadata>${xmlEscape(metadata)}</metadata>
  ${backgroundElement}<g fill="${COLOR_VALUES[color]}">
    ${markPaths(model, COLOR_VALUES[color])}
  </g>
</svg>
`;
}

export function renderLowercaseASvg({ color = "currentColor", background } = {}) {
  if (!COLORS.includes(color)) throw new Error(`color must be one of: ${COLORS.join(", ")}`);
  const model = createLowercaseAModel();
  const title = "ALX lowercase a logo";
  const description = "A production-ready geometric lowercase a mark with a rectangular counter, symmetric triangular terminal, sharp corners, and transparent negative space.";
  const metadata = JSON.stringify({
    system: "ALX geometric mark",
    component: model.component,
    source: model.source,
    viewBox: SPEC.viewBox,
    unit: SPEC.unit,
    construction: model.construction,
  });
  const backgroundElement = background
    ? `<rect width="${SPEC.viewBox}" height="${SPEC.viewBox}" fill="${background}"/>\n  `
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SPEC.viewBox}" height="${SPEC.viewBox}" viewBox="0 0 ${SPEC.viewBox} ${SPEC.viewBox}" role="img" aria-labelledby="title desc" shape-rendering="geometricPrecision">
  <title id="title">${xmlEscape(title)}</title>
  <desc id="desc">${xmlEscape(description)}</desc>
  <metadata>${xmlEscape(metadata)}</metadata>
  ${backgroundElement}<g fill="${COLOR_VALUES[color]}">
    ${markPaths(model, COLOR_VALUES[color])}
  </g>
</svg>
`;
}

function candidateGroup(model, fill, x, y, size) {
  const scaleAmount = size / SPEC.viewBox;
  return `<g transform="translate(${fmt(x)} ${fmt(y)}) scale(${fmt(scaleAmount)})" aria-label="${model.axis} ${model.connection}">
      ${markPaths(model, fill)}
    </g>`;
}

function comparisonSheet({ dark }) {
  const width = 1800;
  const height = 1320;
  const marginX = 120;
  const top = 180;
  const cardWidth = 520;
  const cardHeight = 520;
  const markSize = 420;
  const background = dark ? "#000000" : "#ffffff";
  const foreground = dark ? "#ffffff" : "#000000";
  const secondary = dark ? "#a3a3a3" : "#5c5c5c";
  const divider = dark ? "#262626" : "#dedede";
  const body = [];
  body.push(`<text x="${marginX}" y="74" fill="${foreground}" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="700">ALX geometric reconstruction — six-candidate matrix</text>`);
  body.push(`<text x="${marginX}" y="116" fill="${secondary}" font-family="Arial, Helvetica, sans-serif" font-size="22">One grid · one band width · one gap · zero corner radius</text>`);

  CONNECTIONS.forEach((connection, column) => {
    const x = marginX + column * cardWidth + cardWidth / 2;
    body.push(`<text x="${fmt(x)}" y="158" fill="${secondary}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700">${xmlEscape(CONNECTION_LABELS[connection])}</text>`);
  });

  AXES.forEach((axis, row) => {
    const rowY = top + row * cardHeight;
    body.push(`<text x="34" y="${fmt(rowY + 218)}" fill="${secondary}" transform="rotate(-90 34 ${fmt(rowY + 218)})" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700">${axis === "isometric" ? "TRUE ISOMETRIC · 30°" : "DIAMOND · 45°"}</text>`);
    CONNECTIONS.forEach((connection, column) => {
      const cardX = marginX + column * cardWidth;
      const model = createMarkModel({ axis, connection });
      body.push(`<rect x="${fmt(cardX + 14)}" y="${fmt(rowY + 14)}" width="${cardWidth - 28}" height="${cardHeight - 28}" fill="none" stroke="${divider}" stroke-width="2"/>`);
      body.push(candidateGroup(model, foreground, cardX + (cardWidth - markSize) / 2, rowY + 30, markSize));
      body.push(`<text x="${fmt(cardX + cardWidth / 2)}" y="${fmt(rowY + 482)}" fill="${secondary}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="18">${axis}-${connection}</text>`);
    });
  });

  body.push(`<line x1="${marginX}" y1="1236" x2="1680" y2="1236" stroke="${divider}" stroke-width="2"/>`);
  body.push(`<text x="${marginX}" y="1276" fill="${secondary}" font-family="Arial, Helvetica, sans-serif" font-size="18">Review gate: select one axis system and one connection treatment before final exports.</text>`);
  return svgDocument({
    width,
    height,
    title: `ALX logo comparison — ${dark ? "white on black" : "black on white"}`,
    description: "Six ALX logo candidates arranged by 30-degree or 45-degree axes and by integrated, seamed, or closed connection treatment.",
    background,
    body: body.join("\n  "),
  });
}

function smallSizeSheet() {
  const sizes = [16, 24, 32, 48, 64, 128];
  const width = 1560;
  const height = 1100;
  const labelWidth = 300;
  const columnWidth = 190;
  const rowHeight = 145;
  const top = 160;
  const body = [];
  body.push(`<text x="70" y="64" fill="#000000" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="700">ALX candidate small-size test</text>`);
  body.push(`<text x="70" y="106" fill="#5c5c5c" font-family="Arial, Helvetica, sans-serif" font-size="20">Native-size previews; inspect counter survival, face seams, and terminal clarity.</text>`);
  sizes.forEach((size, column) => {
    const x = labelWidth + column * columnWidth + columnWidth / 2;
    body.push(`<text x="${x}" y="142" fill="#5c5c5c" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700">${size}px</text>`);
  });

  let row = 0;
  for (const axis of AXES) {
    for (const connection of CONNECTIONS) {
      const y = top + row * rowHeight;
      const model = createMarkModel({ axis, connection });
      body.push(`<text x="70" y="${fmt(y + rowHeight / 2 + 6)}" fill="#000000" font-family="Arial, Helvetica, sans-serif" font-size="18">${axis}-${connection}</text>`);
      sizes.forEach((size, column) => {
        const cellCenterX = labelWidth + column * columnWidth + columnWidth / 2;
        const cellCenterY = y + rowHeight / 2;
        body.push(candidateGroup(model, "#000000", cellCenterX - size / 2, cellCenterY - size / 2, size));
      });
      body.push(`<line x1="70" y1="${fmt(y + rowHeight - 1)}" x2="1490" y2="${fmt(y + rowHeight - 1)}" stroke="#e5e5e5"/>`);
      row += 1;
    }
  }
  return svgDocument({
    width,
    height,
    title: "ALX logo candidate small-size test",
    description: "All six ALX logo candidates displayed at 16, 24, 32, 48, 64, and 128 pixels.",
    background: "#ffffff",
    body: body.join("\n  "),
  });
}

function constructionSheet(axis) {
  const model = createMarkModel({ axis, connection: "integrated" });
  const width = 1400;
  const height = 1240;
  const offsetX = 188;
  const offsetY = 136;
  const constructionScale = 1;
  const map = (p) => point(offsetX + p.x * constructionScale, offsetY + p.y * constructionScale);
  const body = [];
  body.push(`<text x="72" y="62" fill="#000000" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="700">ALX construction · ${axis === "isometric" ? "true isometric 30°" : "diamond 45°"}</text>`);
  body.push(`<text x="72" y="102" fill="#5c5c5c" font-family="Arial, Helvetica, sans-serif" font-size="20">Base unit ${SPEC.unit} · edge ${SPEC.edge} · band ${SPEC.band} · gap ${SPEC.gap} · counter ${SPEC.counter} · radius 0</text>`);

  const gridStep = SPEC.unit * 4;
  const rawFrame = model.frame;
  for (let value = 0; value <= SPEC.edge; value += gridStep) {
    const topA = map(model.transformPoint(rawFrame.topPoint(value, 0)));
    const topB = map(model.transformPoint(rawFrame.topPoint(value, SPEC.edge)));
    const topC = map(model.transformPoint(rawFrame.topPoint(0, value)));
    const topD = map(model.transformPoint(rawFrame.topPoint(SPEC.edge, value)));
    body.push(`<line x1="${fmt(topA.x)}" y1="${fmt(topA.y)}" x2="${fmt(topB.x)}" y2="${fmt(topB.y)}" stroke="#b8d8e8" stroke-width="1"/>`);
    body.push(`<line x1="${fmt(topC.x)}" y1="${fmt(topC.y)}" x2="${fmt(topD.x)}" y2="${fmt(topD.y)}" stroke="#b8d8e8" stroke-width="1"/>`);

    const leftA = map(model.transformPoint(rawFrame.leftPoint(value, 0)));
    const leftB = map(model.transformPoint(rawFrame.leftPoint(value, SPEC.edge)));
    const leftC = map(model.transformPoint(rawFrame.leftPoint(0, value)));
    const leftD = map(model.transformPoint(rawFrame.leftPoint(SPEC.edge, value)));
    body.push(`<line x1="${fmt(leftA.x)}" y1="${fmt(leftA.y)}" x2="${fmt(leftB.x)}" y2="${fmt(leftB.y)}" stroke="#d8e8f0" stroke-width="1"/>`);
    body.push(`<line x1="${fmt(leftC.x)}" y1="${fmt(leftC.y)}" x2="${fmt(leftD.x)}" y2="${fmt(leftD.y)}" stroke="#d8e8f0" stroke-width="1"/>`);

    const rightA = map(model.transformPoint(rawFrame.rightPoint(value, 0)));
    const rightB = map(model.transformPoint(rawFrame.rightPoint(value, SPEC.edge)));
    const rightC = map(model.transformPoint(rawFrame.rightPoint(0, value)));
    const rightD = map(model.transformPoint(rawFrame.rightPoint(SPEC.edge, value)));
    body.push(`<line x1="${fmt(rightA.x)}" y1="${fmt(rightA.y)}" x2="${fmt(rightB.x)}" y2="${fmt(rightB.y)}" stroke="#d8e8f0" stroke-width="1"/>`);
    body.push(`<line x1="${fmt(rightC.x)}" y1="${fmt(rightC.y)}" x2="${fmt(rightD.x)}" y2="${fmt(rightD.y)}" stroke="#d8e8f0" stroke-width="1"/>`);
  }

  const vertices = Object.values(model.transformedVertices).map(map);
  const [top, shoulderLeft, shoulderRight, center, bottom, lowerLeft, lowerRight] = [
    "top",
    "shoulderLeft",
    "shoulderRight",
    "center",
    "bottom",
    "lowerLeft",
    "lowerRight",
  ].map((key) => map(model.transformedVertices[key]));
  const faceOutlines = [
    [top, shoulderRight, center, shoulderLeft],
    [shoulderLeft, center, bottom, lowerLeft],
    [center, shoulderRight, lowerRight, bottom],
  ];
  for (const face of faceOutlines) {
    body.push(`<path d="${ringPath(face)}" fill="none" stroke="#287aa3" stroke-width="2" stroke-dasharray="8 8"/>`);
  }
  for (const vertex of vertices) {
    body.push(`<rect x="${fmt(vertex.x - 3)}" y="${fmt(vertex.y - 3)}" width="6" height="6" fill="#287aa3"/>`);
  }

  body.push(`<g transform="translate(${offsetX} ${offsetY})">${markPaths(model, "#000000")}</g>`);
  body.push(`<text x="72" y="1170" fill="#000000" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700">Construction rule</text>`);
  body.push(`<text x="72" y="1204" fill="#5c5c5c" font-family="Arial, Helvetica, sans-serif" font-size="18">All mark polygons derive from the same face basis; the A counter and notch mirror across the top-face median.</text>`);
  return svgDocument({
    width,
    height,
    title: `ALX ${axis} construction grid`,
    description: `Construction grid for the ${axis} ALX logo candidate with face axes, modular spacing, and integrated junctions.`,
    background: "#ffffff",
    body: body.join("\n  "),
  });
}

function manifest() {
  const candidates = [];
  for (const axis of AXES) {
    for (const connection of CONNECTIONS) {
      candidates.push({
        id: `alx-${axis}-${connection}`,
        axis,
        angle: AXIS_ANGLES[axis],
        connection,
        svg: `alx-${axis}-${connection}.svg`,
        altText: `ALX cube logo candidate using ${AXIS_ANGLES[axis]}-degree axes and ${CONNECTION_LABELS[connection].toLowerCase()}.`,
      });
    }
  }
  return {
    status: "exploration",
    authority: "Non-normative publication asset; does not define ALX Protocol behavior.",
    source: "scripts/docs/generate-alx-logo.js",
    referenceRaster: "exec-077f28c2-15c2-4bbc-9f45-001aef71a6b0.png",
    specification: SPEC,
    candidates,
    reviewAssets: [
      {
        svg: "comparison-black-on-white.svg",
        png: "comparison-black-on-white.png",
        altText: "Six black ALX geometric logo candidates on white, arranged by axis system and connection treatment.",
      },
      {
        svg: "comparison-white-on-black.svg",
        png: "comparison-white-on-black.png",
        altText: "Six white ALX geometric logo candidates on black, arranged by axis system and connection treatment.",
      },
      {
        svg: "construction-isometric.svg",
        png: "construction-isometric.png",
        altText: "True-isometric ALX logo construction view with modular face grid and sharp filled geometry.",
      },
      {
        svg: "construction-diamond45.svg",
        png: "construction-diamond45.png",
        altText: "Forty-five-degree ALX logo construction view with modular face grid and sharp filled geometry.",
      },
      {
        svg: "small-size-test.svg",
        png: "small-size-test.png",
        altText: "Six ALX logo candidates displayed from sixteen through one hundred twenty-eight pixels.",
      },
    ],
    isolatedComponents: [
      {
        id: "alx-a-isolated",
        axis: "isometric",
        master: "alx-a-isolated.svg",
        transparent: {
          black: {
            svg: "alx-a-isolated-black.svg",
            png: "alx-a-isolated-black.png",
          },
          white: {
            svg: "alx-a-isolated-white.svg",
            png: "alx-a-isolated-white.png",
          },
        },
        blackOnWhite: {
          svg: "alx-a-isolated-black-on-white.svg",
          png: "alx-a-isolated-black-on-white.png",
        },
        whiteOnBlack: {
          svg: "alx-a-isolated-white-on-black.svg",
          png: "alx-a-isolated-white-on-black.png",
        },
        altText: "The sharp geometric A from the top face of the isometric ALX cube, isolated as a standalone mark.",
      },
      {
        id: "alx-lowercase-a",
        master: "alx-lowercase-a.svg",
        transparent: {
          black: {
            svg: "alx-lowercase-a-black.svg",
            png: "alx-lowercase-a-black.png",
          },
          white: {
            svg: "alx-lowercase-a-white.svg",
            png: "alx-lowercase-a-white.png",
          },
        },
        blackOnWhite: {
          svg: "alx-lowercase-a-black-on-white.svg",
          png: "alx-lowercase-a-black-on-white.png",
        },
        whiteOnBlack: {
          svg: "alx-lowercase-a-white-on-black.svg",
          png: "alx-lowercase-a-white-on-black.png",
        },
        altText: "A sharp geometric lowercase a logo with a rectangular counter and a symmetric triangular terminal.",
      },
    ],
    selection: null,
  };
}

function writeFile(target, content) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
  console.log(`Wrote ${path.relative(ROOT, target)}`);
}

export function generateExploration(outDir = DEFAULT_OUT_DIR) {
  for (const axis of AXES) {
    for (const connection of CONNECTIONS) {
      writeFile(
        path.join(outDir, `alx-${axis}-${connection}.svg`),
        renderMarkSvg({ axis, connection, color: "currentColor" }),
      );
    }
  }
  writeFile(path.join(outDir, "comparison-black-on-white.svg"), comparisonSheet({ dark: false }));
  writeFile(path.join(outDir, "comparison-white-on-black.svg"), comparisonSheet({ dark: true }));
  writeFile(path.join(outDir, "construction-isometric.svg"), constructionSheet("isometric"));
  writeFile(path.join(outDir, "construction-diamond45.svg"), constructionSheet("diamond45"));
  writeFile(path.join(outDir, "small-size-test.svg"), smallSizeSheet());
  writeFile(
    path.join(outDir, "alx-a-isolated.svg"),
    renderTopASvg({ axis: "isometric", color: "currentColor" }),
  );
  writeFile(
    path.join(outDir, "alx-a-isolated-black.svg"),
    renderTopASvg({ axis: "isometric", color: "black" }),
  );
  writeFile(
    path.join(outDir, "alx-a-isolated-white.svg"),
    renderTopASvg({ axis: "isometric", color: "white" }),
  );
  writeFile(
    path.join(outDir, "alx-a-isolated-black-on-white.svg"),
    renderTopASvg({ axis: "isometric", color: "black", background: "#ffffff" }),
  );
  writeFile(
    path.join(outDir, "alx-a-isolated-white-on-black.svg"),
    renderTopASvg({ axis: "isometric", color: "white", background: "#000000" }),
  );
  writeFile(
    path.join(outDir, "alx-lowercase-a.svg"),
    renderLowercaseASvg({ color: "currentColor" }),
  );
  writeFile(
    path.join(outDir, "alx-lowercase-a-black.svg"),
    renderLowercaseASvg({ color: "black" }),
  );
  writeFile(
    path.join(outDir, "alx-lowercase-a-white.svg"),
    renderLowercaseASvg({ color: "white" }),
  );
  writeFile(
    path.join(outDir, "alx-lowercase-a-black-on-white.svg"),
    renderLowercaseASvg({ color: "black", background: "#ffffff" }),
  );
  writeFile(
    path.join(outDir, "alx-lowercase-a-white-on-black.svg"),
    renderLowercaseASvg({ color: "white", background: "#000000" }),
  );
  writeFile(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest(), null, 2)}\n`);
}

function parseArguments(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`);
    const key = argument.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
    parsed[key] = value;
    index += 1;
  }
  return parsed;
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  const hasCandidateArgs = args.axis || args.connection || args.color || args.out;
  if (!hasCandidateArgs) {
    generateExploration();
    return;
  }
  const isTopA = args.component === "a";
  const isLowercaseA = args.component === "lowercase-a";
  const hasTopAArgs = isTopA && args.axis && args.out;
  const hasLowercaseAArgs = isLowercaseA && args.out;
  const hasCubeArgs = !args.component && args.axis && args.connection && args.out;
  if (!hasTopAArgs && !hasLowercaseAArgs && !hasCubeArgs) {
    throw new Error("Single-candidate mode requires --axis, --connection, and --out; component modes use --component a with --axis, or --component lowercase-a, plus --out");
  }
  const color = args.color ?? "currentColor";
  const out = path.resolve(ROOT, args.out);
  const svg = isTopA
    ? renderTopASvg({ axis: args.axis, color })
    : isLowercaseA
      ? renderLowercaseASvg({ color })
      : renderMarkSvg({ axis: args.axis, connection: args.connection, color });
  writeFile(out, svg);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
