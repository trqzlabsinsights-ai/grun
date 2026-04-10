---
Task ID: 1
Agent: Main
Task: Create comprehensive test suite for Gang Run Calculator

Work Log:
- Extracted calculator logic from route.ts into src/lib/gang-run-calculator.ts for testability
- Refactored API route (route.ts) to import from the new lib module
- Created 62 tests across 10 categories in src/lib/gang-run-calculator.test.ts
- Fixed 2 test expectation issues (material yield range, equal-project allocation symmetry)
- All 62 tests pass, API endpoint verified working

Stage Summary:
- Calculator logic extracted to testable module: src/lib/gang-run-calculator.ts
- API route now uses: import { calculate } from "@/lib/gang-run-calculator"
- Test suite: 62 tests, 0 failures across 10 categories
- Verified API endpoint returns correct results (1,048 sheets, P1=571, P2=477)
---
Task ID: tessellation-update
Agent: main
Task: Implement hex-like tessellation for triangle and diamond shapes in custom packer

Work Log:
- Analyzed user feedback: triangles "just touch at vertices" — need proper tessellation like hex packing for circles
- Key insight: old code had triangles filling only HALF the bounding box (▲ top + ▼ bottom = 1 cell). Now each triangle fills its FULL bounding box
- Updated PRESET_SHAPES: triangle vertices now fill full cell (▲: (0.5,0)→(1,1)→(0,1), ▼: (0.5,1)→(1,0)→(0,0))
- Added tessellation helper functions: tessCapacity, tessGroupCount, tessGroupDimensions, tessGroupPositions, getTessGroupShapes
- Added TessPosition type (x, y, flip) and tessPositions to PlacedCustomGroup
- Created unified allocation function (findBestCustomAllocation) handling both tessellating and non-tessellating shapes on same sheet
- Updated SVG rendering: tessellated shapes render individually at computed positions with hex offset
- Non-tessellated shapes (star, heart, etc.) still use grid bounding-rect packing
- All 25 V2 tests pass, API tested and working

Stage Summary:
- Triangles now tessellate: even rows ▲ upright, odd rows ▼ inverted + offset by half cell width
- Row height uses hex factor (cellH * √3/2 ≈ 0.866) for tighter vertical packing
- Diamonds also use hex tessellation (no flip needed, just offset rows)
- Mixed shapes on same sheet work correctly (e.g., star + triangle)
