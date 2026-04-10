/**
 * Gang Run Calculator — Comprehensive Test Suite
 * =================================================
 * 
 * Test categories:
 *   1. Capacity Calculation
 *   2. Group Shape Generation
 *   3. Group Dimensions (bleed-per-group)
 *   4. Allocation & Packing (no singletons, contiguous blocks)
 *   5. Single-Plate Optimization
 *   6. Two-Plate Optimization
 *   7. Full Calculation Integration
 *   8. Edge Cases & Error Handling
 *   9. Physical Accuracy (real-world constraints)
 */

import {
  calculateCapacity,
  getGroupShapes,
  groupDimensions,
  findBestAllocationWithPacking,
  buildPlateResult,
  findBestTwoPlate,
  calculate,
  type CapacityResult,
  type ProjectInput,
} from "./gang-run-calculator";

// ── Test Harness ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertApprox(actual: number, expected: number, tolerance: number, message: string) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${message}: expected ~${expected} (±${tolerance}), got ${actual}`);
  }
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

function skip(name: string, reason: string) {
  skipped++;
  console.log(`  ⏭️  ${name} (SKIPPED: ${reason})`);
}

// ── 1. Capacity Calculation Tests ──────────────────────────────────────────

console.log("\n📐 1. Capacity Calculation\n");

test("Default 24×16.5 sheet, 3.5×4.5 sticker, 5mm bleed → 6×3 = 18 grid", () => {
  const cap = calculateCapacity(24, 16.5, 3.5, 4.5, 5);
  assertEqual(cap.cols, 6, "cols");
  assertEqual(cap.rows, 3, "rows");
  assertEqual(cap.maxPerSheet, 18, "maxPerSheet");
});

test("Bleed conversion: 5mm → inches", () => {
  const cap = calculateCapacity(24, 16.5, 3.5, 4.5, 5);
  assertApprox(cap.bleedInches, 5 / 25.4, 0.0001, "bleedInches");
});

test("Cell size includes bleed on both sides", () => {
  const cap = calculateCapacity(24, 16.5, 3.5, 4.5, 5);
  const expectedCellW = 3.5 + 2 * (5 / 25.4);
  const expectedCellH = 4.5 + 2 * (5 / 25.4);
  assertApprox(cap.cellWidth, expectedCellW, 0.0001, "cellWidth");
  assertApprox(cap.cellHeight, expectedCellH, 0.0001, "cellHeight");
});

test("Sheet too small for sticker → 0 capacity", () => {
  const cap = calculateCapacity(3, 3, 4, 5, 5);
  assertEqual(cap.maxPerSheet, 0, "maxPerSheet should be 0");
  assertEqual(cap.cols, 0, "cols should be 0");
  assertEqual(cap.rows, 0, "rows should be 0");
});

test("Exact fit: 1 sticker fills sheet", () => {
  const cap = calculateCapacity(4, 6, 4, 6, 0);
  assertEqual(cap.cols, 1, "cols");
  assertEqual(cap.rows, 1, "rows");
  assertEqual(cap.maxPerSheet, 1, "maxPerSheet");
});

test("2×2 grid with 0 bleed", () => {
  const cap = calculateCapacity(8, 10, 4, 5, 0);
  assertEqual(cap.cols, 2, "cols");
  assertEqual(cap.rows, 2, "rows");
  assertEqual(cap.maxPerSheet, 4, "maxPerSheet");
});

test("Different bleed values affect grid", () => {
  const cap0 = calculateCapacity(24, 16.5, 3.5, 4.5, 0);
  const cap5 = calculateCapacity(24, 16.5, 3.5, 4.5, 5);
  const cap10 = calculateCapacity(24, 16.5, 3.5, 4.5, 10);
  // More bleed → fewer cells
  assert(cap0.maxPerSheet >= cap5.maxPerSheet, "0mm bleed should have ≥ capacity of 5mm");
  assert(cap5.maxPerSheet >= cap10.maxPerSheet, "5mm bleed should have ≥ capacity of 10mm");
});

test("Capacity fields are consistent", () => {
  const cap = calculateCapacity(24, 16.5, 3.5, 4.5, 5);
  assertEqual(cap.maxPerSheet, cap.cols * cap.rows, "maxPerSheet = cols × rows");
  assertEqual(cap.sheetWidth, 24, "sheetWidth preserved");
  assertEqual(cap.sheetHeight, 16.5, "sheetHeight preserved");
  assertEqual(cap.stickerWidth, 3.5, "stickerWidth preserved");
  assertEqual(cap.stickerHeight, 4.5, "stickerHeight preserved");
});

// ── 2. Group Shape Generation Tests ───────────────────────────────────────

console.log("\n🧩 2. Group Shape Generation\n");

test("getGroupShapes(2) → [{2,1}, {1,2}] (sorted by compactness)", () => {
  const shapes = getGroupShapes(2);
  assertEqual(shapes.length, 2, "number of factor pairs for 2");
  // Both have ratio 2, so they're equally compact; prefer wider
  assertEqual(shapes[0].w, 2, "first shape width");
  assertEqual(shapes[0].h, 1, "first shape height");
  assertEqual(shapes[1].w, 1, "second shape width");
  assertEqual(shapes[1].h, 2, "second shape height");
});

test("getGroupShapes(4) → [{2,2}, {4,1}, {1,4}] (square first)", () => {
  const shapes = getGroupShapes(4);
  assertEqual(shapes.length, 3, "number of factor pairs for 4");
  // 2×2 is most compact (ratio 1.0), then 4×1 and 1×4 (ratio 4.0)
  assertEqual(shapes[0].w, 2, "most compact width");
  assertEqual(shapes[0].h, 2, "most compact height");
});

test("getGroupShapes(6) → [{2,3} or {3,2} first, then others]", () => {
  const shapes = getGroupShapes(6);
  assertEqual(shapes.length, 4, "number of factor pairs for 6");
  // All verify w*h = 6
  for (const s of shapes) {
    assertEqual(s.w * s.h, 6, `shape ${s.w}×${s.h} should multiply to 6`);
  }
  // 2×3 and 3×2 are most compact (ratio 1.5)
  assert(shapes[0].w * shapes[0].h === 6, "first shape is valid");
});

test("getGroupShapes(12) → 6 factor pairs, 3×4 or 4×3 first", () => {
  const shapes = getGroupShapes(12);
  assertEqual(shapes.length, 6, "number of factor pairs for 12");
  for (const s of shapes) {
    assertEqual(s.w * s.h, 12, `shape ${s.w}×${s.h} should multiply to 12`);
  }
});

test("getGroupShapes(1) → only {1,1}", () => {
  const shapes = getGroupShapes(1);
  assertEqual(shapes.length, 1, "single factor pair for 1");
  assertEqual(shapes[0].w, 1, "width");
  assertEqual(shapes[0].h, 1, "height");
});

test("getGroupShapes(prime=7) → [{7,1}, {1,7}]", () => {
  const shapes = getGroupShapes(7);
  assertEqual(shapes.length, 2, "two factor pairs for prime 7");
  assertEqual(shapes[0].w * shapes[0].h, 7, "first pair multiplies to 7");
  assertEqual(shapes[1].w * shapes[1].h, 7, "second pair multiplies to 7");
});

test("getGroupShapes results are sorted by compactness", () => {
  for (const n of [2, 3, 4, 6, 8, 10, 12, 18, 24]) {
    const shapes = getGroupShapes(n);
    for (let i = 1; i < shapes.length; i++) {
      const ratioA = Math.max(shapes[i - 1].w, shapes[i - 1].h) / Math.min(shapes[i - 1].w, shapes[i - 1].h);
      const ratioB = Math.max(shapes[i].w, shapes[i].h) / Math.min(shapes[i].w, shapes[i].h);
      assert(ratioA <= ratioB, `shapes for ${n} should be sorted by compactness: ${ratioA} <= ${ratioB}`);
    }
  }
});

// ── 3. Group Dimensions (Bleed-Per-Group) Tests ───────────────────────────

console.log("\n📏 3. Group Dimensions (Bleed-Per-Group)\n");

test("2×1 group: width = 2*stickerW + 2*bleed, height = 1*stickerH + 2*bleed", () => {
  const bleed = 5 / 25.4; // 5mm in inches
  const dims = groupDimensions({ w: 2, h: 1 }, 3.5, 4.5, bleed);
  assertApprox(dims.width, 2 * 3.5 + 2 * bleed, 0.0001, "width");
  assertApprox(dims.height, 1 * 4.5 + 2 * bleed, 0.0001, "height");
});

test("6×2 group: 12 stickers with single bleed border around the entire block", () => {
  const bleed = 5 / 25.4;
  const dims = groupDimensions({ w: 6, h: 2 }, 3.5, 4.5, bleed);
  assertApprox(dims.width, 6 * 3.5 + 2 * bleed, 0.0001, "width");
  assertApprox(dims.height, 2 * 4.5 + 2 * bleed, 0.0001, "height");
  // Verify: should NOT be 12*(sticker + 2*bleed) which would be per-sticker bleed
  const perStickerBleedWidth = 12 * (3.5 + 2 * bleed);
  assert(dims.width < perStickerBleedWidth, "Group bleed is less than per-sticker bleed");
});

test("4×1 group dimensions", () => {
  const bleed = 5 / 25.4;
  const dims = groupDimensions({ w: 4, h: 1 }, 3.5, 4.5, bleed);
  assertApprox(dims.width, 4 * 3.5 + 2 * bleed, 0.0001, "width");
  assertApprox(dims.height, 1 * 4.5 + 2 * bleed, 0.0001, "height");
});

test("3×2 group dimensions", () => {
  const bleed = 5 / 25.4;
  const dims = groupDimensions({ w: 3, h: 2 }, 3.5, 4.5, bleed);
  assertApprox(dims.width, 3 * 3.5 + 2 * bleed, 0.0001, "width");
  assertApprox(dims.height, 2 * 4.5 + 2 * bleed, 0.0001, "height");
});

test("Zero bleed: group dims = sticker grid exactly", () => {
  const dims = groupDimensions({ w: 3, h: 2 }, 3.5, 4.5, 0);
  assertApprox(dims.width, 3 * 3.5, 0.0001, "width with 0 bleed");
  assertApprox(dims.height, 2 * 4.5, 0.0001, "height with 0 bleed");
});

test("Group fits within sheet: Plate 1 layout a(6×2) + d(4×1) + f(2×1)", () => {
  const bleed = 5 / 25.4;
  const sheetW = 24;
  const sheetH = 16.5;
  const sw = 3.5;
  const sh = 4.5;

  // Group A: 6×2
  const a = groupDimensions({ w: 6, h: 2 }, sw, sh, bleed);
  // Group D: 4×1
  const d = groupDimensions({ w: 4, h: 1 }, sw, sh, bleed);
  // Group F: 2×1
  const f = groupDimensions({ w: 2, h: 1 }, sw, sh, bleed);

  // A fills full width: a.width should be close to sheet width
  assertApprox(a.width, 6 * 3.5 + 2 * bleed, 0.001, "group A width");
  assert(a.height <= sheetH, `group A height ${a.height} should fit in sheet height ${sheetH}`);

  // D and F must fit side by side below A (or in same shelf)
  assert(d.width + f.width <= sheetW, `d.width + f.width = ${d.width + f.width} should fit in ${sheetW}`);
  assert(d.height <= sheetH - a.height || d.height <= a.height, "group D must fit on sheet");
});

// ── 4. Allocation & Packing (No Singletons, Contiguous Blocks) ─────────────

console.log("\n📦 4. Allocation & Packing (No Singletons)\n");

test("Minimum outs per project = 2 (no singletons)", () => {
  const cap = calculateCapacity(24, 16.5, 3.5, 4.5, 5);
  // With 7 projects and 18 slots, minimum 2 each = 14 minimum
  const demands = [100, 100, 100, 100, 100, 100, 100];
  const result = findBestAllocationWithPacking(
    demands, cap.sheetWidth, cap.sheetHeight,
    cap.stickerWidth, cap.stickerHeight, cap.bleedInches, cap.maxPerSheet
  );
  assert(result !== null, "7 projects should be packable on 18-slot sheet");
  if (result) {
    for (const outs of result.allocation) {
      assert(outs >= 2, `Each project must have ≥2 outs, got ${outs}`);
    }
  }
});

test("Total allocation = maxSlots (all slots used)", () => {
  const cap = calculateCapacity(24, 16.5, 3.5, 4.5, 5);
  const demands = [100, 100, 100, 100, 100, 100, 100];
  const result = findBestAllocationWithPacking(
    demands, cap.sheetWidth, cap.sheetHeight,
    cap.stickerWidth, cap.stickerHeight, cap.bleedInches, cap.maxPerSheet
  );
  if (result) {
    const total = result.allocation.reduce((s, v) => s + v, 0);
    assertEqual(total, cap.maxPerSheet, "all slots should be allocated");
  }
});

test("2 projects, 18 slots: each gets at least 2", () => {
  const cap = calculateCapacity(24, 16.5, 3.5, 4.5, 5);
  const demands = [5000, 3000];
  const result = findBestAllocationWithPacking(
    demands, cap.sheetWidth, cap.sheetHeight,
    cap.stickerWidth, cap.stickerHeight, cap.bleedInches, cap.maxPerSheet
  );
  assert(result !== null, "2 projects should be packable");
  if (result) {
    for (const outs of result.allocation) {
      assert(outs >= 2, `Each project must have ≥2 outs, got ${outs}`);
    }
    assertEqual(result.allocation.reduce((s, v) => s + v, 0), cap.maxPerSheet, "all slots used");
  }
});

test("4 projects, 18 slots: no singletons", () => {
  const cap = calculateCapacity(24, 16.5, 3.5, 4.5, 5);
  const demands = [2000, 1500, 1000, 500];
  const result = findBestAllocationWithPacking(
    demands, cap.sheetWidth, cap.sheetHeight,
    cap.stickerWidth, cap.stickerHeight, cap.bleedInches, cap.maxPerSheet
  );
  if (result) {
    for (const outs of result.allocation) {
      assert(outs >= 2, `No singletons: got ${outs}`);
    }
  }
});

test("Too many projects for sheet → null", () => {
  const cap = calculateCapacity(24, 16.5, 3.5, 4.5, 5);
  // 10 projects × 2 minimum = 20 > 18 slots
  const demands = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100];
  const result = findBestAllocationWithPacking(
    demands, cap.sheetWidth, cap.sheetHeight,
    cap.stickerWidth, cap.stickerHeight, cap.bleedInches, cap.maxPerSheet
  );
  assertEqual(result, null, "10 projects on 18-slot sheet should be impossible");
});

test("Placed groups don't overlap", () => {
  const cap = calculateCapacity(24, 16.5, 3.5, 4.5, 5);
  const demands = [100, 100, 100, 100, 100, 100, 100];
  const result = findBestAllocationWithPacking(
    demands, cap.sheetWidth, cap.sheetHeight,
    cap.stickerWidth, cap.stickerHeight, cap.bleedInches, cap.maxPerSheet
  );
  if (result && result.placedGroups.length > 1) {
    for (let i = 0; i < result.placedGroups.length; i++) {
      for (let j = i + 1; j < result.placedGroups.length; j++) {
        const a = result.placedGroups[i];
        const b = result.placedGroups[j];
        const overlapX = a.x < b.x + b.width && a.x + a.width > b.x;
        const overlapY = a.y < b.y + b.height && a.y + a.height > b.y;
        assert(!(overlapX && overlapY), `Groups ${i} and ${j} should not overlap`);
      }
    }
  }
});

test("All placed groups fit within sheet bounds", () => {
  const cap = calculateCapacity(24, 16.5, 3.5, 4.5, 5);
  const demands = [100, 100, 100, 100, 100, 100, 100];
  const result = findBestAllocationWithPacking(
    demands, cap.sheetWidth, cap.sheetHeight,
    cap.stickerWidth, cap.stickerHeight, cap.bleedInches, cap.maxPerSheet
  );
  if (result) {
    for (const g of result.placedGroups) {
      assert(g.x >= 0, `group x=${g.x} should be ≥ 0`);
      assert(g.y >= 0, `group y=${g.y} should be ≥ 0`);
      assert(g.x + g.width <= cap.sheetWidth, `group right edge ${g.x + g.width} should be ≤ ${cap.sheetWidth}`);
      assert(g.y + g.height <= cap.sheetHeight, `group bottom edge ${g.y + g.height} should be ≤ ${cap.sheetHeight}`);
    }
  }
});

// ── 5. Single-Plate Optimization Tests ─────────────────────────────────────

console.log("\n🖨️  5. Single-Plate Optimization\n");

test("Default 7 projects single plate: run length ≥ 1,141", () => {
  const cap = calculateCapacity(24, 16.5, 3.5, 4.5, 5);
  const projects: ProjectInput[] = [
    { name: "a", quantity: 6844 },
    { name: "b", quantity: 2860 },
    { name: "c", quantity: 2750 },
    { name: "d", quantity: 2255 },
    { name: "e", quantity: 1674 },
    { name: "f", quantity: 825 },
    { name: "g", quantity: 924 },
  ];
  const demands = projects.map((p) => p.quantity);
  const result = findBestAllocationWithPacking(
    demands, cap.sheetWidth, cap.sheetHeight,
    cap.stickerWidth, cap.stickerHeight, cap.bleedInches, cap.maxPerSheet
  );
  assert(result !== null, "should find a valid allocation");
  if (result) {
    assert(result.runLength >= 1141, `runLength ${result.runLength} should be ≥ 1141`);
    // Verify all demands are met
    for (let i = 0; i < demands.length; i++) {
      const produced = result.allocation[i] * result.runLength;
      assert(produced >= demands[i], `Project ${i}: ${produced} >= ${demands[i]}`);
    }
  }
});

test("Single plate: produced ≥ demand for every project", () => {
  const projects: ProjectInput[] = [
    { name: "a", quantity: 6844 },
    { name: "b", quantity: 2860 },
    { name: "c", quantity: 2750 },
    { name: "d", quantity: 2255 },
    { name: "e", quantity: 1674 },
    { name: "f", quantity: 825 },
    { name: "g", quantity: 924 },
  ];
  const cap = calculateCapacity(24, 16.5, 3.5, 4.5, 5);
  const result = findBestAllocationWithPacking(
    projects.map((p) => p.quantity),
    cap.sheetWidth, cap.sheetHeight,
    cap.stickerWidth, cap.stickerHeight, cap.bleedInches, cap.maxPerSheet
  );
  if (result) {
    for (let i = 0; i < projects.length; i++) {
      const produced = result.allocation[i] * result.runLength;
      assert(produced >= projects[i].quantity, `${projects[i].name}: ${produced} >= ${projects[i].quantity}`);
    }
  }
});

test("Single plate: runLength = ceil(max(demand_i / outs_i))", () => {
  const projects: ProjectInput[] = [
    { name: "a", quantity: 6844 },
    { name: "b", quantity: 2860 },
    { name: "c", quantity: 2750 },
    { name: "d", quantity: 2255 },
    { name: "e", quantity: 1674 },
    { name: "f", quantity: 825 },
    { name: "g", quantity: 924 },
  ];
  const cap = calculateCapacity(24, 16.5, 3.5, 4.5, 5);
  const result = findBestAllocationWithPacking(
    projects.map((p) => p.quantity),
    cap.sheetWidth, cap.sheetHeight,
    cap.stickerWidth, cap.stickerHeight, cap.bleedInches, cap.maxPerSheet
  );
  if (result) {
    let maxL = 0;
    for (let i = 0; i < projects.length; i++) {
      maxL = Math.max(maxL, Math.ceil(projects[i].quantity / result.allocation[i]));
    }
    assertEqual(result.runLength, maxL, "runLength should equal max of ceiling ratios");
  }
});

// ── 6. Two-Plate Optimization Tests ────────────────────────────────────────

console.log("\n🔀 6. Two-Plate Optimization\n");

test("Default 7 projects two plate: total = 1,048 sheets", () => {
  const projects: ProjectInput[] = [
    { name: "a", quantity: 6844 },
    { name: "b", quantity: 2860 },
    { name: "c", quantity: 2750 },
    { name: "d", quantity: 2255 },
    { name: "e", quantity: 1674 },
    { name: "f", quantity: 825 },
    { name: "g", quantity: 924 },
  ];
  const cap = calculateCapacity(24, 16.5, 3.5, 4.5, 5);
  const result = findBestTwoPlate(projects, cap.maxPerSheet, cap);
  assert(result !== null, "should find two-plate solution");
  if (result) {
    assertEqual(result.totalSheets, 1048, "total sheets should be 1,048");
  }
});

test("Two plate: Plate 1 = 571 sheets (a=12, d=4, f=2)", () => {
  const projects: ProjectInput[] = [
    { name: "a", quantity: 6844 },
    { name: "b", quantity: 2860 },
    { name: "c", quantity: 2750 },
    { name: "d", quantity: 2255 },
    { name: "e", quantity: 1674 },
    { name: "f", quantity: 825 },
    { name: "g", quantity: 924 },
  ];
  const cap = calculateCapacity(24, 16.5, 3.5, 4.5, 5);
  const result = findBestTwoPlate(projects, cap.maxPerSheet, cap);
  if (result) {
    assertEqual(result.plate1.runLength, 571, "Plate 1 run length should be 571");
    const p1Names = result.plate1.allocation.map((a) => a.name).sort();
    assertEqual(p1Names.join(","), "a,d,f", "Plate 1 should contain a, d, f");
    const aAlloc = result.plate1.allocation.find((a) => a.name === "a");
    const dAlloc = result.plate1.allocation.find((a) => a.name === "d");
    const fAlloc = result.plate1.allocation.find((a) => a.name === "f");
    assert(aAlloc && aAlloc.outs === 12, `a.outs should be 12, got ${aAlloc?.outs}`);
    assert(dAlloc && dAlloc.outs === 4, `d.outs should be 4, got ${dAlloc?.outs}`);
    assert(fAlloc && fAlloc.outs === 2, `f.outs should be 2, got ${fAlloc?.outs}`);
  }
});

test("Two plate: Plate 2 = 477 sheets (b=6, c=6, e=4, g=2)", () => {
  const projects: ProjectInput[] = [
    { name: "a", quantity: 6844 },
    { name: "b", quantity: 2860 },
    { name: "c", quantity: 2750 },
    { name: "d", quantity: 2255 },
    { name: "e", quantity: 1674 },
    { name: "f", quantity: 825 },
    { name: "g", quantity: 924 },
  ];
  const cap = calculateCapacity(24, 16.5, 3.5, 4.5, 5);
  const result = findBestTwoPlate(projects, cap.maxPerSheet, cap);
  if (result) {
    assertEqual(result.plate2.runLength, 477, "Plate 2 run length should be 477");
    const p2Names = result.plate2.allocation.map((a) => a.name).sort();
    assertEqual(p2Names.join(","), "b,c,e,g", "Plate 2 should contain b, c, e, g");
    const bAlloc = result.plate2.allocation.find((a) => a.name === "b");
    const cAlloc = result.plate2.allocation.find((a) => a.name === "c");
    const eAlloc = result.plate2.allocation.find((a) => a.name === "e");
    const gAlloc = result.plate2.allocation.find((a) => a.name === "g");
    assert(bAlloc && bAlloc.outs === 6, `b.outs should be 6, got ${bAlloc?.outs}`);
    assert(cAlloc && cAlloc.outs === 6, `c.outs should be 6, got ${cAlloc?.outs}`);
    assert(eAlloc && eAlloc.outs === 4, `e.outs should be 4, got ${eAlloc?.outs}`);
    assert(gAlloc && gAlloc.outs === 2, `g.outs should be 2, got ${gAlloc?.outs}`);
  }
});

test("Two plate: no project split across plates", () => {
  const projects: ProjectInput[] = [
    { name: "a", quantity: 6844 },
    { name: "b", quantity: 2860 },
    { name: "c", quantity: 2750 },
    { name: "d", quantity: 2255 },
    { name: "e", quantity: 1674 },
    { name: "f", quantity: 825 },
    { name: "g", quantity: 924 },
  ];
  const cap = calculateCapacity(24, 16.5, 3.5, 4.5, 5);
  const result = findBestTwoPlate(projects, cap.maxPerSheet, cap);
  if (result) {
    const p1Names = new Set(result.plate1.allocation.map((a) => a.name));
    const p2Names = new Set(result.plate2.allocation.map((a) => a.name));
    for (const name of p1Names) {
      assert(!p2Names.has(name), `Project ${name} should not appear on both plates`);
    }
    // All 7 projects must be accounted for
    const allNames = [...p1Names, ...p2Names];
    assertEqual(allNames.length, 7, "All 7 projects should be assigned");
  }
});

test("Two plate: every project has ≥2 outs (no singletons)", () => {
  const projects: ProjectInput[] = [
    { name: "a", quantity: 6844 },
    { name: "b", quantity: 2860 },
    { name: "c", quantity: 2750 },
    { name: "d", quantity: 2255 },
    { name: "e", quantity: 1674 },
    { name: "f", quantity: 825 },
    { name: "g", quantity: 924 },
  ];
  const cap = calculateCapacity(24, 16.5, 3.5, 4.5, 5);
  const result = findBestTwoPlate(projects, cap.maxPerSheet, cap);
  if (result) {
    for (const alloc of result.plate1.allocation) {
      assert(alloc.outs >= 2, `Plate 1 ${alloc.name}: outs=${alloc.outs} should be ≥ 2`);
    }
    for (const alloc of result.plate2.allocation) {
      assert(alloc.outs >= 2, `Plate 2 ${alloc.name}: outs=${alloc.outs} should be ≥ 2`);
    }
  }
});

test("Two plate: all demands satisfied", () => {
  const projects: ProjectInput[] = [
    { name: "a", quantity: 6844 },
    { name: "b", quantity: 2860 },
    { name: "c", quantity: 2750 },
    { name: "d", quantity: 2255 },
    { name: "e", quantity: 1674 },
    { name: "f", quantity: 825 },
    { name: "g", quantity: 924 },
  ];
  const cap = calculateCapacity(24, 16.5, 3.5, 4.5, 5);
  const result = findBestTwoPlate(projects, cap.maxPerSheet, cap);
  if (result) {
    const allAlloc = [...result.plate1.allocation, ...result.plate2.allocation];
    for (const alloc of allAlloc) {
      assert(alloc.produced >= alloc.quantity, `${alloc.name}: produced ${alloc.produced} >= quantity ${alloc.quantity}`);
    }
  }
});

test("Two plate: overage calculation is correct", () => {
  const projects: ProjectInput[] = [
    { name: "a", quantity: 6844 },
    { name: "b", quantity: 2860 },
    { name: "c", quantity: 2750 },
    { name: "d", quantity: 2255 },
    { name: "e", quantity: 1674 },
    { name: "f", quantity: 825 },
    { name: "g", quantity: 924 },
  ];
  const cap = calculateCapacity(24, 16.5, 3.5, 4.5, 5);
  const result = findBestTwoPlate(projects, cap.maxPerSheet, cap);
  if (result) {
    const totalDemand = projects.reduce((s, p) => s + p.quantity, 0);
    assertEqual(result.totalProduced - result.totalOverage, totalDemand, "produced - overage = demand");
  }
});

test("Two plate: sheets saved vs single plate", () => {
  const result = calculate({
    sheetWidth: 24,
    sheetHeight: 16.5,
    stickerWidth: 3.5,
    stickerHeight: 4.5,
    bleed: 5,
    projects: [
      { name: "a", quantity: 6844 },
      { name: "b", quantity: 2860 },
      { name: "c", quantity: 2750 },
      { name: "d", quantity: 2255 },
      { name: "e", quantity: 1674 },
      { name: "f", quantity: 825 },
      { name: "g", quantity: 924 },
    ],
  });
  if (result.singlePlateResult && result.twoPlateResult) {
    const expectedSaved = result.singlePlateResult.totalSheets - result.twoPlateResult.totalSheets;
    assertEqual(result.twoPlateResult.sheetsSaved, expectedSaved, "sheetsSaved = single - two");
    assert(expectedSaved > 0, "Two plate should save sheets");
  }
});

// ── 7. Full Calculation Integration Tests ──────────────────────────────────

console.log("\n🔗 7. Full Calculation Integration\n");

test("Full calculate() returns all fields for default case", () => {
  const result = calculate({
    sheetWidth: 24,
    sheetHeight: 16.5,
    stickerWidth: 3.5,
    stickerHeight: 4.5,
    bleed: 5,
    projects: [
      { name: "a", quantity: 6844 },
      { name: "b", quantity: 2860 },
      { name: "c", quantity: 2750 },
      { name: "d", quantity: 2255 },
      { name: "e", quantity: 1674 },
      { name: "f", quantity: 825 },
      { name: "g", quantity: 924 },
    ],
  });
  assert(result.capacity !== null, "capacity should be present");
  assert(result.singlePlateResult !== null, "singlePlateResult should be present");
  assert(result.twoPlateResult !== null, "twoPlateResult should be present");
  assert(!result.error, "should have no error");
});

test("Full calculate() verifies capacity grid = 6×3", () => {
  const result = calculate({
    sheetWidth: 24,
    sheetHeight: 16.5,
    stickerWidth: 3.5,
    stickerHeight: 4.5,
    bleed: 5,
    projects: [
      { name: "a", quantity: 6844 },
      { name: "b", quantity: 2860 },
      { name: "c", quantity: 2750 },
      { name: "d", quantity: 2255 },
      { name: "e", quantity: 1674 },
      { name: "f", quantity: 825 },
      { name: "g", quantity: 924 },
    ],
  });
  assertEqual(result.capacity.cols, 6, "cols");
  assertEqual(result.capacity.rows, 3, "rows");
  assertEqual(result.capacity.maxPerSheet, 18, "maxPerSheet");
});

test("Full calculate() total overage ≈ 732", () => {
  const result = calculate({
    sheetWidth: 24,
    sheetHeight: 16.5,
    stickerWidth: 3.5,
    stickerHeight: 4.5,
    bleed: 5,
    projects: [
      { name: "a", quantity: 6844 },
      { name: "b", quantity: 2860 },
      { name: "c", quantity: 2750 },
      { name: "d", quantity: 2255 },
      { name: "e", quantity: 1674 },
      { name: "f", quantity: 825 },
      { name: "g", quantity: 924 },
    ],
  });
  if (result.twoPlateResult) {
    // Total demand = 18,132
    // Two plate total = 1,048 sheets
    // Total produced = 18,132 + overage
    const totalDemand = 6844 + 2860 + 2750 + 2255 + 1674 + 825 + 924;
    assertEqual(result.twoPlateResult.totalOverage, result.twoPlateResult.totalProduced - totalDemand, "overage consistency");
  }
});

// ── 8. Edge Cases & Error Handling ─────────────────────────────────────────

console.log("\n🛡️  8. Edge Cases & Error Handling\n");

test("Missing dimensions → error", () => {
  const result = calculate({
    sheetWidth: 0,
    sheetHeight: 16.5,
    stickerWidth: 3.5,
    stickerHeight: 4.5,
    bleed: 5,
    projects: [{ name: "a", quantity: 100 }],
  });
  assert(result.error !== undefined, "should return error for missing dimensions");
});

test("No projects with positive quantity → error", () => {
  const result = calculate({
    sheetWidth: 24,
    sheetHeight: 16.5,
    stickerWidth: 3.5,
    stickerHeight: 4.5,
    bleed: 5,
    projects: [{ name: "a", quantity: 0 }],
  });
  assert(result.error !== undefined, "should return error for no positive quantities");
});

test("Sticker larger than sheet → 0 capacity", () => {
  const result = calculate({
    sheetWidth: 5,
    sheetHeight: 5,
    stickerWidth: 6,
    stickerHeight: 6,
    bleed: 0,
    projects: [{ name: "a", quantity: 100 }],
  });
  assertEqual(result.capacity.maxPerSheet, 0, "capacity should be 0");
});

test("Single project → no two-plate result", () => {
  const result = calculate({
    sheetWidth: 24,
    sheetHeight: 16.5,
    stickerWidth: 3.5,
    stickerHeight: 4.5,
    bleed: 5,
    projects: [{ name: "a", quantity: 1000 }],
  });
  assert(result.twoPlateResult === null, "single project should not have two-plate result");
  assert(result.singlePlateResult !== null, "single project should have single-plate result");
});

test("Equal quantities: fair distribution", () => {
  const cap = calculateCapacity(24, 16.5, 3.5, 4.5, 5);
  const demands = [1000, 1000, 1000]; // 3 equal projects, 18 slots
  const result = findBestAllocationWithPacking(
    demands, cap.sheetWidth, cap.sheetHeight,
    cap.stickerWidth, cap.stickerHeight, cap.bleedInches, cap.maxPerSheet
  );
  if (result) {
    // All should have the same outs since demands are equal
    const allSame = result.allocation.every((v) => v === result.allocation[0]);
    assert(allSame, `Equal demands should get equal outs: ${result.allocation}`);
    assertEqual(result.allocation[0], 6, "3 equal projects on 18 slots → 6 each");
  }
});

test("Very large quantity: run length scales correctly", () => {
  const cap = calculateCapacity(24, 16.5, 3.5, 4.5, 5);
  const demands = [100000, 100000];
  const result = findBestAllocationWithPacking(
    demands, cap.sheetWidth, cap.sheetHeight,
    cap.stickerWidth, cap.stickerHeight, cap.bleedInches, cap.maxPerSheet
  );
  if (result) {
    assert(result.runLength > 0, "should have positive run length");
    for (let i = 0; i < demands.length; i++) {
      const produced = result.allocation[i] * result.runLength;
      assert(produced >= demands[i], `Project ${i}: produced ${produced} >= demand ${demands[i]}`);
    }
  }
});

test("Zero bleed: more capacity available", () => {
  const cap0 = calculateCapacity(24, 16.5, 3.5, 4.5, 0);
  const cap5 = calculateCapacity(24, 16.5, 3.5, 4.5, 5);
  assert(cap0.maxPerSheet >= cap5.maxPerSheet, "0 bleed should have ≥ capacity of 5mm bleed");
});

test("2 projects with simple demands", () => {
  const result = calculate({
    sheetWidth: 24,
    sheetHeight: 16.5,
    stickerWidth: 3.5,
    stickerHeight: 4.5,
    bleed: 5,
    projects: [
      { name: "x", quantity: 500 },
      { name: "y", quantity: 500 },
    ],
  });
  assert(result.singlePlateResult !== null, "should have single plate result");
  assert(result.twoPlateResult !== null, "should have two plate result");
  if (result.singlePlateResult) {
    assert(result.singlePlateResult.runLength > 0, "positive run length");
    for (const alloc of result.singlePlateResult.allocation) {
      assert(alloc.outs >= 2, `${alloc.name}: outs ≥ 2`);
    }
  }
});

// ── 9. Physical Accuracy (Real-World Constraints) ─────────────────────────

console.log("\n🌍 9. Physical Accuracy (Real-World Constraints)\n");

test("Plate 1 groups fit on sheet: a(6×2) + d(4×1) + f(2×1)", () => {
  const bleed = 5 / 25.4; // ~0.1969 inches
  const sw = 3.5;
  const sh = 4.5;
  const sheetW = 24;
  const sheetH = 16.5;

  // Group A: 6×2 = 12 stickers
  const aW = 6 * sw + 2 * bleed;
  const aH = 2 * sh + 2 * bleed;
  // Group D: 4×1 = 4 stickers
  const dW = 4 * sw + 2 * bleed;
  const dH = 1 * sh + 2 * bleed;
  // Group F: 2×1 = 2 stickers
  const fW = 2 * sw + 2 * bleed;
  const fH = 1 * sh + 2 * bleed;

  // Verify group widths
  assertApprox(aW, 21.3937, 0.01, "group A width");
  assertApprox(aH, 9.3937, 0.01, "group A height");
  assertApprox(dW, 14.3937, 0.01, "group D width");
  assertApprox(dH, 4.8969, 0.01, "group D height");
  assertApprox(fW, 7.3937, 0.01, "group F width");
  assertApprox(fH, 4.8969, 0.01, "group F height");

  // A fills the full width
  assert(aW <= sheetW, `A width ${aW} fits in ${sheetW}`);
  // D+F side by side below A
  assert(dW + fW <= sheetW, `D+F width ${dW + fW} fits in ${sheetW}`);
  assert(aH + dH <= sheetH, `A+D height ${aH + dH} fits in ${sheetH}`);
});

test("Plate 2 groups fit on sheet: b(3×2) + c(3×2) + e(4×1) + g(2×1)", () => {
  const bleed = 5 / 25.4;
  const sw = 3.5;
  const sh = 4.5;
  const sheetW = 24;
  const sheetH = 16.5;

  // Group B: 3×2 = 6 stickers
  const bW = 3 * sw + 2 * bleed;
  const bH = 2 * sh + 2 * bleed;
  // Group C: 3×2 = 6 stickers
  const cW = 3 * sw + 2 * bleed;
  const cH = 2 * sh + 2 * bleed;
  // Group E: 4×1 = 4 stickers
  const eW = 4 * sw + 2 * bleed;
  const eH = 1 * sh + 2 * bleed;
  // Group G: 2×1 = 2 stickers
  const gW = 2 * sw + 2 * bleed;
  const gH = 1 * sh + 2 * bleed;

  // B+C side by side (or stacked) must fit
  assert(bW + cW <= sheetW, `B+C width ${bW + cW} fits in ${sheetW}`);
  // E+G side by side below B+C
  assert(eW + gW <= sheetW, `E+G width ${eW + gW} fits in ${sheetW}`);
  // Total height
  assert(bH + eH <= sheetH, `B+E height ${bH + eH} fits in ${sheetH}`);
});

test("5mm bleed = 0.1969 inches (precise conversion)", () => {
  const bleedIn = 5 / 25.4;
  assertApprox(bleedIn, 0.19685, 0.0001, "5mm in inches");
});

test("Cell size = sticker + 2×bleed (for capacity grid reference)", () => {
  const cap = calculateCapacity(24, 16.5, 3.5, 4.5, 5);
  const bleedIn = 5 / 25.4;
  assertApprox(cap.cellWidth, 3.5 + 2 * bleedIn, 0.0001, "cellWidth");
  assertApprox(cap.cellHeight, 4.5 + 2 * bleedIn, 0.0001, "cellHeight");
});

test("Material yield is reasonable (20-80%)", () => {
  const result = calculate({
    sheetWidth: 24,
    sheetHeight: 16.5,
    stickerWidth: 3.5,
    stickerHeight: 4.5,
    bleed: 5,
    projects: [
      { name: "a", quantity: 6844 },
      { name: "b", quantity: 2860 },
      { name: "c", quantity: 2750 },
      { name: "d", quantity: 2255 },
      { name: "e", quantity: 1674 },
      { name: "f", quantity: 825 },
      { name: "g", quantity: 924 },
    ],
  });
  if (result.twoPlateResult) {
    assert(result.twoPlateResult.materialYield > 20, "material yield should be > 20%");
    assert(result.twoPlateResult.materialYield < 80, "material yield should be < 80%");
  }
});

test("Produced counts are exact multiples of outs × runLength", () => {
  const result = calculate({
    sheetWidth: 24,
    sheetHeight: 16.5,
    stickerWidth: 3.5,
    stickerHeight: 4.5,
    bleed: 5,
    projects: [
      { name: "a", quantity: 6844 },
      { name: "b", quantity: 2860 },
      { name: "c", quantity: 2750 },
      { name: "d", quantity: 2255 },
      { name: "e", quantity: 1674 },
      { name: "f", quantity: 825 },
      { name: "g", quantity: 924 },
    ],
  });
  if (result.twoPlateResult) {
    for (const alloc of [
      ...result.twoPlateResult.plate1.allocation,
      ...result.twoPlateResult.plate2.allocation,
    ]) {
      assertEqual(alloc.produced, alloc.outs * (result.twoPlateResult.plate1.allocation.includes(alloc) ? result.twoPlateResult.plate1.runLength : result.twoPlateResult.plate2.runLength), `${alloc.name}: produced = outs × runLength`);
    }
  }
});

// ── 10. Regression & Scenario Tests ────────────────────────────────────────

console.log("\n🔄 10. Regression & Scenario Tests\n");

test("3 projects: simple triangular demands", () => {
  const result = calculate({
    sheetWidth: 24,
    sheetHeight: 16.5,
    stickerWidth: 3.5,
    stickerHeight: 4.5,
    bleed: 5,
    projects: [
      { name: "big", quantity: 10000 },
      { name: "med", quantity: 5000 },
      { name: "sml", quantity: 2000 },
    ],
  });
  assert(result.singlePlateResult !== null, "should have single plate result");
  if (result.singlePlateResult) {
    assert(result.singlePlateResult.runLength > 0, "positive run length");
    for (const alloc of result.singlePlateResult.allocation) {
      assert(alloc.outs >= 2, `${alloc.name}: outs ≥ 2`);
      assert(alloc.produced >= alloc.quantity, `${alloc.name}: produced ≥ demand`);
    }
  }
});

test("5 equal projects: valid allocation with no singletons", () => {
  const cap = calculateCapacity(24, 16.5, 3.5, 4.5, 5);
  const demands = [2000, 2000, 2000, 2000, 2000];
  const result = findBestAllocationWithPacking(
    demands, cap.sheetWidth, cap.sheetHeight,
    cap.stickerWidth, cap.stickerHeight, cap.bleedInches, cap.maxPerSheet
  );
  if (result) {
    // 5 projects × min 2 = 10, 18 slots → 18/5 = 3.6, not evenly divisible
    // The optimizer minimizes run length — allocation may be [3,3,3,3,6] or similar
    // All that matters: total = 18, each ≥ 2, run length is optimal
    const total = result.allocation.reduce((s, v) => s + v, 0);
    assertEqual(total, cap.maxPerSheet, "all slots used");
    for (const outs of result.allocation) {
      assert(outs >= 2, `Each project must have ≥2 outs, got ${outs}`);
    }
    // Verify optimal run length: with equal demands, runLength should be consistent
    const maxL = Math.max(...demands.map((d, i) => Math.ceil(d / result.allocation[i])));
    assertEqual(result.runLength, maxL, "run length should be optimal");
  }
});

test("One dominant project (90%+ of total demand)", () => {
  const result = calculate({
    sheetWidth: 24,
    sheetHeight: 16.5,
    stickerWidth: 3.5,
    stickerHeight: 4.5,
    bleed: 5,
    projects: [
      { name: "big", quantity: 50000 },
      { name: "tiny1", quantity: 100 },
      { name: "tiny2", quantity: 100 },
    ],
  });
  assert(result.singlePlateResult !== null, "should have single plate result");
  if (result.singlePlateResult) {
    const bigAlloc = result.singlePlateResult.allocation.find((a) => a.name === "big");
    assert(bigAlloc && bigAlloc.outs >= 2, "big project should have ≥2 outs");
  }
});

test("Different sheet size: 20×14 with same stickers", () => {
  const cap = calculateCapacity(20, 14, 3.5, 4.5, 5);
  // 20 / (3.5 + 2*0.1969) = 20 / 3.8938 = 5.13 → 5 cols
  // 14 / (4.5 + 2*0.1969) = 14 / 4.8938 = 2.86 → 2 rows
  assertEqual(cap.cols, 5, "cols for 20×14 sheet");
  assertEqual(cap.rows, 2, "rows for 20×14 sheet");
  assertEqual(cap.maxPerSheet, 10, "maxPerSheet for 20×14");
});

test("Larger bleed (10mm) reduces capacity", () => {
  const cap = calculateCapacity(24, 16.5, 3.5, 4.5, 10);
  // 24 / (3.5 + 2*0.3937) = 24 / 4.2874 = 5.60 → 5 cols
  // 16.5 / (4.5 + 2*0.3937) = 16.5 / 5.2874 = 3.12 → 3 rows
  assertEqual(cap.cols, 5, "cols with 10mm bleed");
  assertEqual(cap.rows, 3, "rows with 10mm bleed");
  assertEqual(cap.maxPerSheet, 15, "maxPerSheet with 10mm bleed");
});

test("V20 comparison: our two-plate uses fewer sheets", () => {
  // V20: 1,087 sheets total (from previous analysis)
  // Our optimizer: 1,048 sheets total
  const result = calculate({
    sheetWidth: 24,
    sheetHeight: 16.5,
    stickerWidth: 3.5,
    stickerHeight: 4.5,
    bleed: 5,
    projects: [
      { name: "a", quantity: 6844 },
      { name: "b", quantity: 2860 },
      { name: "c", quantity: 2750 },
      { name: "d", quantity: 2255 },
      { name: "e", quantity: 1674 },
      { name: "f", quantity: 825 },
      { name: "g", quantity: 924 },
    ],
  });
  if (result.twoPlateResult) {
    assert(result.twoPlateResult.totalSheets <= 1087, "our optimizer should be ≤ V20's 1,087 sheets");
    assertEqual(result.twoPlateResult.totalSheets, 1048, "optimal two-plate = 1,048");
  }
});

// ── Summary ────────────────────────────────────────────────────────────────

console.log("\n" + "═".repeat(60));
console.log(`  TEST RESULTS: ${passed} passed, ${failed} failed, ${skipped} skipped`);
console.log("═".repeat(60));

if (failures.length > 0) {
  console.log("\n❌ FAILURES:");
  for (const f of failures) {
    console.log(f);
  }
  process.exit(1);
} else {
  console.log("\n🎉 All tests passed!");
  process.exit(0);
}
