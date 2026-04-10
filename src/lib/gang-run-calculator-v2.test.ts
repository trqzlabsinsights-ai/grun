/**
 * Gang Run Calculator V2 — Multi-Size Test Suite
 * =================================================
 * Tests the MaxRect-based multi-size packing engine.
 */

import {
  getGroupShapes,
  groupDimensions,
  calculateCapacity,
  estimateMaxSlots,
  findBestAllocationWithPacking,
  calculateMultiSize,
  type ProjectInput,
} from "./gang-run-calculator-v2";

// ── Test Harness ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

function assertApprox(actual: number, expected: number, tol: number, msg: string) {
  if (Math.abs(actual - expected) > tol) throw new Error(`${msg}: expected ~${expected} (±${tol}), got ${actual}`);
}

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e: any) {
    failed++;
    const msg = `  ❌ ${name}: ${e.message}`;
    console.log(msg);
    failures.push(msg);
  }
}

// ── 1. Backward Compatibility (Same-Size Stickers) ────────────────────────

console.log("\n🔄 1. Backward Compatibility (Same-Size Stickers)\n");

test("Same-size 7 projects: two-plate = 1,048 sheets", () => {
  const result = calculateMultiSize({
    sheetWidth: 24,
    sheetHeight: 16.5,
    bleed: 5,
    projects: [
      { name: "a", quantity: 6844, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "b", quantity: 2860, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "c", quantity: 2750, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "d", quantity: 2255, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "e", quantity: 1674, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "f", quantity: 825, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "g", quantity: 924, stickerWidth: 3.5, stickerHeight: 4.5 },
    ],
  });
  assert(!result.error, `should have no error: ${result.error}`);
  assert(result.twoPlateResult !== null, "should have two-plate result");
  if (result.twoPlateResult) {
    assertEqual(result.twoPlateResult.totalSheets, 1048, "total sheets");
  }
});

test("Same-size: Plate 1 = 571, Plate 2 = 477", () => {
  const result = calculateMultiSize({
    sheetWidth: 24, sheetHeight: 16.5, bleed: 5,
    projects: [
      { name: "a", quantity: 6844, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "b", quantity: 2860, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "c", quantity: 2750, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "d", quantity: 2255, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "e", quantity: 1674, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "f", quantity: 825, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "g", quantity: 924, stickerWidth: 3.5, stickerHeight: 4.5 },
    ],
  });
  if (result.twoPlateResult) {
    assertEqual(result.twoPlateResult.plate1.runLength, 571, "P1 run length");
    assertEqual(result.twoPlateResult.plate2.runLength, 477, "P2 run length");
  }
});

test("Same-size: no singletons", () => {
  const result = calculateMultiSize({
    sheetWidth: 24, sheetHeight: 16.5, bleed: 5,
    projects: [
      { name: "a", quantity: 6844, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "b", quantity: 2860, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "c", quantity: 2750, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "d", quantity: 2255, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "e", quantity: 1674, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "f", quantity: 825, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "g", quantity: 924, stickerWidth: 3.5, stickerHeight: 4.5 },
    ],
  });
  if (result.twoPlateResult) {
    for (const alloc of [...result.twoPlateResult.plate1.allocation, ...result.twoPlateResult.plate2.allocation]) {
      assert(alloc.outs >= 2, `${alloc.name}: outs=${alloc.outs} should be ≥ 2`);
    }
  }
});

// ── 2. Multi-Size Packing ─────────────────────────────────────────────────

console.log("\n📐 2. Multi-Size Packing\n");

test("2 different sizes: packs correctly", () => {
  const result = calculateMultiSize({
    sheetWidth: 24, sheetHeight: 16.5, bleed: 5,
    projects: [
      { name: "big", quantity: 500, stickerWidth: 5, stickerHeight: 8 },
      { name: "small", quantity: 2000, stickerWidth: 2, stickerHeight: 3 },
    ],
  });
  assert(!result.error, `no error: ${result.error}`);
  assert(result.singlePlateResult !== null, "should have single plate result");
  if (result.singlePlateResult) {
    for (const alloc of result.singlePlateResult.allocation) {
      assert(alloc.outs >= 2, `${alloc.name}: outs ≥ 2`);
      assert(alloc.produced >= alloc.quantity, `${alloc.name}: produced ≥ quantity`);
    }
  }
});

test("3 different sizes: all demands met", () => {
  const result = calculateMultiSize({
    sheetWidth: 24, sheetHeight: 16.5, bleed: 5,
    projects: [
      { name: "a", quantity: 1000, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "b", quantity: 800, stickerWidth: 2, stickerHeight: 3 },
      { name: "c", quantity: 200, stickerWidth: 5, stickerHeight: 8 },
    ],
  });
  assert(!result.error, `no error: ${result.error}`);
  if (result.singlePlateResult) {
    for (const alloc of result.singlePlateResult.allocation) {
      assert(alloc.produced >= alloc.quantity, `${alloc.name}: ${alloc.produced} >= ${alloc.quantity}`);
    }
  }
});

test("Per-project sticker size preserved in results", () => {
  const result = calculateMultiSize({
    sheetWidth: 24, sheetHeight: 16.5, bleed: 5,
    projects: [
      { name: "a", quantity: 500, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "b", quantity: 500, stickerWidth: 2, stickerHeight: 3 },
    ],
  });
  if (result.singlePlateResult) {
    const aAlloc = result.singlePlateResult.allocation.find((a) => a.name === "a");
    const bAlloc = result.singlePlateResult.allocation.find((a) => a.name === "b");
    assert(aAlloc && aAlloc.stickerWidth === 3.5 && aAlloc.stickerHeight === 4.5, "a sticker size preserved");
    assert(bAlloc && bAlloc.stickerWidth === 2 && bAlloc.stickerHeight === 3, "b sticker size preserved");
  }
});

test("Placed groups have correct per-project sticker dimensions", () => {
  const result = calculateMultiSize({
    sheetWidth: 24, sheetHeight: 16.5, bleed: 5,
    projects: [
      { name: "a", quantity: 500, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "b", quantity: 500, stickerWidth: 2, stickerHeight: 3 },
    ],
  });
  if (result.singlePlateResult) {
    for (const pg of result.singlePlateResult.placedGroups) {
      assert(pg.stickerWidth > 0, `${pg.name}: stickerWidth > 0`);
      assert(pg.stickerHeight > 0, `${pg.name}: stickerHeight > 0`);
      // Verify group dimensions match shape * sticker size + bleed
      const bleedIn = 5 / 25.4;
      const expectedW = pg.shape.w * pg.stickerWidth + 2 * bleedIn;
      const expectedH = pg.shape.h * pg.stickerHeight + 2 * bleedIn;
      assertApprox(pg.width, expectedW, 0.001, `${pg.name} width`);
      assertApprox(pg.height, expectedH, 0.001, `${pg.name} height`);
    }
  }
});

// ── 3. Group Dimensions with Different Sizes ──────────────────────────────

console.log("\n📏 3. Group Dimensions (Multi-Size)\n");

test("2×1 group with 5×8 stickers", () => {
  const bleed = 5 / 25.4;
  const dims = groupDimensions({ w: 2, h: 1 }, 5, 8, bleed);
  assertApprox(dims.width, 10 + 2 * bleed, 0.001, "width");
  assertApprox(dims.height, 8 + 2 * bleed, 0.001, "height");
});

test("3×2 group with 2×3 stickers", () => {
  const bleed = 5 / 25.4;
  const dims = groupDimensions({ w: 3, h: 2 }, 2, 3, bleed);
  assertApprox(dims.width, 6 + 2 * bleed, 0.001, "width");
  assertApprox(dims.height, 6 + 2 * bleed, 0.001, "height");
});

test("1×2 group with 5×8 stickers (vertical)", () => {
  const bleed = 5 / 25.4;
  const dims = groupDimensions({ w: 1, h: 2 }, 5, 8, bleed);
  assertApprox(dims.width, 5 + 2 * bleed, 0.001, "width");
  assertApprox(dims.height, 16 + 2 * bleed, 0.001, "height");
});

// ── 4. Max Slots Estimation ───────────────────────────────────────────────

console.log("\n🔢 4. Max Slots Estimation\n");

test("estimateMaxSlots with same sizes is reasonable", () => {
  const maxSlots = estimateMaxSlots(24, 16.5, [
    { width: 3.5, height: 4.5 },
    { width: 3.5, height: 4.5 },
  ], 5);
  assert(maxSlots >= 18, `maxSlots should be >= 18 for same sizes, got ${maxSlots}`);
  assert(maxSlots <= 40, `maxSlots should be capped at 40, got ${maxSlots}`);
});

test("estimateMaxSlots with mixed sizes > 18 (small stickers allow more)", () => {
  const maxSlots = estimateMaxSlots(24, 16.5, [
    { width: 3.5, height: 4.5 },
    { width: 2, height: 3 },
  ], 5);
  assert(maxSlots > 18, `maxSlots should be > 18 with small stickers, got ${maxSlots}`);
});

test("estimateMaxSlots >= projects * 2 (minimum for no singletons)", () => {
  const maxSlots = estimateMaxSlots(24, 16.5, [
    { width: 5, height: 8 },
    { width: 4, height: 6 },
    { width: 3.5, height: 4.5 },
  ], 5);
  assert(maxSlots >= 6, `maxSlots should be >= 6 for 3 projects, got ${maxSlots}`);
});

// ── 5. Packing Validation ─────────────────────────────────────────────────

console.log("\n📦 5. Packing Validation\n");

test("Placed groups fit within sheet bounds", () => {
  const result = calculateMultiSize({
    sheetWidth: 24, sheetHeight: 16.5, bleed: 5,
    projects: [
      { name: "a", quantity: 500, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "b", quantity: 500, stickerWidth: 2, stickerHeight: 3 },
      { name: "c", quantity: 200, stickerWidth: 5, stickerHeight: 8 },
    ],
  });
  if (result.singlePlateResult) {
    for (const pg of result.singlePlateResult.placedGroups) {
      assert(pg.x >= 0, `${pg.name}: x >= 0`);
      assert(pg.y >= 0, `${pg.name}: y >= 0`);
      assert(pg.x + pg.width <= 24, `${pg.name}: right edge <= 24 (got ${pg.x + pg.width})`);
      assert(pg.y + pg.height <= 16.5, `${pg.name}: bottom edge <= 16.5 (got ${pg.y + pg.height})`);
    }
  }
});

test("Placed groups don't overlap", () => {
  const result = calculateMultiSize({
    sheetWidth: 24, sheetHeight: 16.5, bleed: 5,
    projects: [
      { name: "a", quantity: 500, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "b", quantity: 500, stickerWidth: 2, stickerHeight: 3 },
      { name: "c", quantity: 200, stickerWidth: 5, stickerHeight: 8 },
    ],
  });
  if (result.singlePlateResult) {
    const groups = result.singlePlateResult.placedGroups;
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i], b = groups[j];
        const overlapX = a.x < b.x + b.width && a.x + a.width > b.x;
        const overlapY = a.y < b.y + b.height && a.y + a.height > b.y;
        assert(!(overlapX && overlapY), `Groups ${i}(${a.name}) and ${j}(${b.name}) should not overlap`);
      }
    }
  }
});

test("No singletons in multi-size allocation", () => {
  const result = calculateMultiSize({
    sheetWidth: 24, sheetHeight: 16.5, bleed: 5,
    projects: [
      { name: "a", quantity: 500, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "b", quantity: 500, stickerWidth: 2, stickerHeight: 3 },
    ],
  });
  if (result.singlePlateResult) {
    for (const alloc of result.singlePlateResult.allocation) {
      assert(alloc.outs >= 2, `${alloc.name}: outs ≥ 2`);
    }
  }
});

// ── 6. Two-Plate with Mixed Sizes ─────────────────────────────────────────

console.log("\n🔀 6. Two-Plate with Mixed Sizes\n");

test("Two-plate with 4 different sizes", () => {
  const result = calculateMultiSize({
    sheetWidth: 24, sheetHeight: 16.5, bleed: 5,
    projects: [
      { name: "a", quantity: 3000, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "b", quantity: 2000, stickerWidth: 2, stickerHeight: 3 },
      { name: "c", quantity: 500, stickerWidth: 5, stickerHeight: 8 },
      { name: "d", quantity: 1000, stickerWidth: 4, stickerHeight: 6 },
    ],
  });
  assert(!result.error, `no error: ${result.error}`);
  assert(result.twoPlateResult !== null, "should have two-plate result");
  if (result.twoPlateResult) {
    assert(result.twoPlateResult.totalSheets > 0, "positive total sheets");
    // All demands met
    for (const alloc of [...result.twoPlateResult.plate1.allocation, ...result.twoPlateResult.plate2.allocation]) {
      assert(alloc.produced >= alloc.quantity, `${alloc.name}: produced ${alloc.produced} >= ${alloc.quantity}`);
    }
  }
});

test("Two-plate: no project on both plates", () => {
  const result = calculateMultiSize({
    sheetWidth: 24, sheetHeight: 16.5, bleed: 5,
    projects: [
      { name: "a", quantity: 3000, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "b", quantity: 2000, stickerWidth: 2, stickerHeight: 3 },
      { name: "c", quantity: 500, stickerWidth: 5, stickerHeight: 8 },
      { name: "d", quantity: 1000, stickerWidth: 4, stickerHeight: 6 },
    ],
  });
  if (result.twoPlateResult) {
    const p1Names = new Set(result.twoPlateResult.plate1.allocation.map((a) => a.name));
    const p2Names = new Set(result.twoPlateResult.plate2.allocation.map((a) => a.name));
    for (const name of p1Names) {
      assert(!p2Names.has(name), `Project ${name} should not be on both plates`);
    }
  }
});

// ── 7. Edge Cases ─────────────────────────────────────────────────────────

console.log("\n🛡️ 7. Edge Cases\n");

test("Single project: no two-plate", () => {
  const result = calculateMultiSize({
    sheetWidth: 24, sheetHeight: 16.5, bleed: 5,
    projects: [{ name: "a", quantity: 1000, stickerWidth: 3.5, stickerHeight: 4.5 }],
  });
  assert(result.twoPlateResult === null, "single project should not have two-plate");
  assert(result.singlePlateResult !== null, "single project should have single-plate");
});

test("Sticker too large for sheet: null result", () => {
  const result = calculateMultiSize({
    sheetWidth: 5, sheetHeight: 5, bleed: 5,
    projects: [{ name: "a", quantity: 100, stickerWidth: 10, stickerHeight: 10 }],
  });
  assert(result.singlePlateResult === null, "oversized sticker should yield null");
});

test("Missing dimensions: error", () => {
  const result = calculateMultiSize({
    sheetWidth: 0, sheetHeight: 16.5, bleed: 5,
    projects: [{ name: "a", quantity: 100, stickerWidth: 3.5, stickerHeight: 4.5 }],
  });
  assert(result.error !== undefined, "should have error for missing sheet dimensions");
});

test("Zero quantity filtered out", () => {
  const result = calculateMultiSize({
    sheetWidth: 24, sheetHeight: 16.5, bleed: 5,
    projects: [
      { name: "a", quantity: 500, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "b", quantity: 0, stickerWidth: 2, stickerHeight: 3 },
    ],
  });
  if (result.singlePlateResult) {
    assertEqual(result.singlePlateResult.allocation.length, 1, "only 1 project with positive qty");
  }
});

test("Very large sticker (5×8) still gets ≥2 outs", () => {
  const result = calculateMultiSize({
    sheetWidth: 24, sheetHeight: 16.5, bleed: 5,
    projects: [
      { name: "big", quantity: 500, stickerWidth: 5, stickerHeight: 8 },
    ],
  });
  if (result.singlePlateResult) {
    for (const alloc of result.singlePlateResult.allocation) {
      assert(alloc.outs >= 2, `${alloc.name}: outs ≥ 2 (got ${alloc.outs})`);
    }
  }
});

// ── 8. Material Yield ─────────────────────────────────────────────────────

console.log("\n📊 8. Material Yield\n");

test("Same-size yield is consistent", () => {
  const result = calculateMultiSize({
    sheetWidth: 24, sheetHeight: 16.5, bleed: 5,
    projects: [
      { name: "a", quantity: 6844, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "b", quantity: 2860, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "c", quantity: 2750, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "d", quantity: 2255, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "e", quantity: 1674, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "f", quantity: 825, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "g", quantity: 924, stickerWidth: 3.5, stickerHeight: 4.5 },
    ],
  });
  if (result.twoPlateResult) {
    assert(result.twoPlateResult.materialYield > 0, "yield should be positive");
    assert(result.twoPlateResult.materialYield < 100, "yield should be < 100%");
  }
});

test("Multi-size yield accounts for different sticker areas", () => {
  const result = calculateMultiSize({
    sheetWidth: 24, sheetHeight: 16.5, bleed: 5,
    projects: [
      { name: "a", quantity: 500, stickerWidth: 3.5, stickerHeight: 4.5 },
      { name: "b", quantity: 500, stickerWidth: 2, stickerHeight: 3 },
    ],
  });
  if (result.singlePlateResult) {
    assert(result.singlePlateResult.materialYield > 0, "yield should be positive");
    // Manually verify: yield = total sticker area / total sheet area
    let totalStickerArea = 0;
    for (const alloc of result.singlePlateResult.allocation) {
      totalStickerArea += alloc.produced * alloc.stickerWidth * alloc.stickerHeight;
    }
    const totalSheetArea = result.singlePlateResult.runLength * 24 * 16.5;
    const expectedYield = (totalStickerArea / totalSheetArea) * 100;
    assertApprox(result.singlePlateResult.materialYield, expectedYield, 0.1, "yield");
  }
});

// ── Summary ────────────────────────────────────────────────────────────────

console.log("\n" + "═".repeat(60));
console.log(`  TEST RESULTS: ${passed} passed, ${failed} failed`);
console.log("═".repeat(60));

if (failures.length > 0) {
  console.log("\n❌ FAILURES:");
  for (const f of failures) console.log(f);
  process.exit(1);
} else {
  console.log("\n🎉 All tests passed!");
  process.exit(0);
}
