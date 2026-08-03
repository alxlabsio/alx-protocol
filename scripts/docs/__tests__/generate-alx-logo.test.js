import assert from "node:assert/strict";
import test from "node:test";

import {
  AXES,
  COLORS,
  CONNECTIONS,
  SPEC,
  createLowercaseAModel,
  createMarkModel,
  createTopAModel,
  renderLowercaseASvg,
  renderMarkSvg,
  renderTopASvg,
} from "../generate-alx-logo.js";

const expectedBridgeRoles = Object.freeze({
  seamed: [],
  integrated: ["bridge-a-l", "bridge-l-x"],
  closed: ["bridge-a-l", "bridge-l-x", "bridge-a-x"],
});

test("the construction system uses one modular specification", () => {
  assert.equal(SPEC.band % SPEC.unit, 0);
  assert.equal(SPEC.gap % SPEC.unit, 0);
  assert.equal(SPEC.counter % SPEC.unit, 0);
  assert.equal(SPEC.notchWidth % SPEC.unit, 0);
  assert.equal(SPEC.notchDepth % SPEC.unit, 0);
  assert.equal(SPEC.opticalNudge, SPEC.unit / 4);
  assert.ok(SPEC.gap < SPEC.band);
});

test("all six candidate models stay inside the viewBox", () => {
  for (const axis of AXES) {
    for (const connection of CONNECTIONS) {
      const model = createMarkModel({ axis, connection });
      assert.ok(model.bounds.minX >= 0, `${axis}-${connection} minX`);
      assert.ok(model.bounds.minY >= 0, `${axis}-${connection} minY`);
      assert.ok(model.bounds.maxX <= SPEC.viewBox, `${axis}-${connection} maxX`);
      assert.ok(model.bounds.maxY <= SPEC.viewBox, `${axis}-${connection} maxY`);
      assert.ok(Math.abs((model.bounds.minX + model.bounds.maxX) / 2 - SPEC.viewBox / 2) < 0.001);
      assert.ok(Math.abs((model.bounds.minY + model.bounds.maxY) / 2 - SPEC.viewBox / 2) < 0.001);
    }
  }
});

test("connection modes add only their declared geometric bridges", () => {
  for (const axis of AXES) {
    for (const connection of CONNECTIONS) {
      const model = createMarkModel({ axis, connection });
      assert.deepEqual(model.bridgeRoles, expectedBridgeRoles[connection]);
      const actualBridgeRoles = model.shapes
        .map((shape) => shape.role)
        .filter((role) => role.startsWith("bridge-"));
      assert.deepEqual(actualBridgeRoles, expectedBridgeRoles[connection]);
    }
  }
});

test("A counter and outer termination are centered and symmetric", () => {
  for (const axis of AXES) {
    const model = createMarkModel({ axis, connection: "seamed" });
    const a = model.shapes.find((shape) => shape.role === "a");
    assert.ok(a);
    assert.equal(a.holes.length, 1);
    const counter = a.holes[0];
    const centerX = counter.reduce((sum, p) => sum + p.x, 0) / counter.length;
    const centerY = counter.reduce((sum, p) => sum + p.y, 0) / counter.length;
    const faceCenter = model.transformPoint(model.frame.topPoint(SPEC.edge / 2, SPEC.edge / 2));
    assert.ok(Math.abs(centerX - faceCenter.x) < 0.001);
    assert.ok(Math.abs(centerY - faceCenter.y) < 0.001);
    const oppositePairs = [
      [counter[0], counter[2]],
      [counter[1], counter[3]],
    ];
    for (const [first, second] of oppositePairs) {
      assert.ok(Math.abs((first.x + second.x) / 2 - centerX) < 0.001);
      assert.ok(Math.abs((first.y + second.y) / 2 - centerY) < 0.001);
    }

    const faceAxisX = faceCenter.x;
    assert.ok(Math.abs(a.outer[0].x - faceAxisX) < 0.001);
    assert.ok(Math.abs(a.outer[3].x - faceAxisX) < 0.001);
    for (const [rightIndex, leftIndex] of [[1, 5], [2, 4]]) {
      assert.ok(Math.abs((a.outer[rightIndex].x + a.outer[leftIndex].x) / 2 - faceAxisX) < 0.001);
      assert.ok(Math.abs(a.outer[rightIndex].y - a.outer[leftIndex].y) < 0.001);
    }
  }
});

test("candidate SVGs contain only flat vector mark geometry", () => {
  const forbidden = [
    /<image\b/i,
    /<filter\b/i,
    /<(?:linear|radial)Gradient\b/i,
    /<pattern\b/i,
    /<text\b/i,
    /\brx=/i,
    /\bry=/i,
    /stroke-linecap/i,
    /stroke-linejoin/i,
  ];
  for (const axis of AXES) {
    for (const connection of CONNECTIONS) {
      for (const color of COLORS) {
        const svg = renderMarkSvg({ axis, connection, color });
        assert.match(svg, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
        assert.match(svg, /viewBox="0 0 1024 1024"/);
        assert.match(svg, /fill-rule="nonzero"/);
        const pathData = [...svg.matchAll(/\sd="([^"]+)"/g)].map((match) => match[1]);
        assert.ok(pathData.length > 0);
        for (const data of pathData) assert.doesNotMatch(data, /[CQAHV]/);
        for (const pattern of forbidden) assert.doesNotMatch(svg, pattern);
      }
    }
  }
});

test("A-X seam remains at least one nominal pixel at 32px", () => {
  const nominalPixels = (SPEC.gap / SPEC.viewBox) * 32;
  assert.ok(nominalPixels >= 1);
});

test("isolated top A retains the cube A geometry without other components", () => {
  const model = createTopAModel({ axis: "isometric" });
  assert.equal(model.shapes.length, 1);
  assert.equal(model.shapes[0].role, "a");
  assert.ok(model.bounds.minX >= 0);
  assert.ok(model.bounds.minY >= 0);
  assert.ok(model.bounds.maxX <= SPEC.viewBox);
  assert.ok(model.bounds.maxY <= SPEC.viewBox);

  const svg = renderTopASvg({ axis: "isometric", color: "currentColor" });
  assert.match(svg, /component&quot;:&quot;a/);
  assert.match(svg, /data-roles="a"/);
  assert.doesNotMatch(svg, /data-roles="[^"]*(?:l|x-)/);
  assert.doesNotMatch(svg, /<image\b|<filter\b|<text\b|\brx=|\bry=/i);
});

test("lowercase a is a clean compound logo with balanced negative space", () => {
  const model = createLowercaseAModel();
  assert.equal(model.shapes.length, 1);
  assert.equal(model.shapes[0].role, "lowercase-a");
  assert.equal(model.shapes[0].holes.length, 1);
  assert.deepEqual(model.bounds, { minX: 96, minY: 152, maxX: 928, maxY: 872 });

  const { counter, notch } = model.construction;
  assert.equal(counter.x % SPEC.unit, 0);
  assert.equal(counter.y % SPEC.unit, 0);
  assert.equal(counter.width % SPEC.unit, 0);
  assert.equal(counter.height % SPEC.unit, 0);
  assert.equal(notch.apex.x - notch.left.x, notch.right.x - notch.apex.x);
  assert.equal(notch.left.y, notch.right.y);
  assert.equal(counter.x + counter.width + 24, notch.left.x);
  assert.equal(notch.right.x + 24, model.construction.outer.x + model.construction.outer.width);

  const svg = renderLowercaseASvg({ color: "currentColor" });
  assert.match(svg, /component&quot;:&quot;lowercase-a/);
  assert.match(svg, /data-roles="lowercase-a"/);
  assert.match(svg, /fill="currentColor"/);
  assert.doesNotMatch(svg, /<image\b|<filter\b|<text\b|\brx=|\bry=|<rect\b/i);
});
