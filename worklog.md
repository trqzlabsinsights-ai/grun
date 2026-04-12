---
Task ID: 1
Agent: Main
Task: Rewrite polygon custom mode packer with per-project sheets, no mixing, optimized tessellation

Work Log:
- Rewrote packer-custom.ts with per-project independent sheet allocation
- Each project gets dedicated sheets (no mixing different polygon types on one sheet)
- Added global `sides` parameter instead of per-project sides
- Implemented optimized tessellation per polygon type:
  - Triangle (3): alternate-col ▲▼ columns, 60 outs/sheet on 24x16.5
  - Diamond (4): honeycomb offset, 39 outs/sheet
  - Pentagon (5): double-lattice with 180° rotation, 35 outs/sheet
  - Hexagon (6): honeycomb perfect tessellation, 33 outs/sheet
  - Heptagon (7): double-lattice, 40 outs/sheet
  - Octagon (8): double-lattice, 33 outs/sheet
  - 9+: double-lattice approaching circle density
- Updated custom-input.tsx with global polygon type selector (button group)
- Updated types.ts: added `sheets` to AllocationEntry and PlacedGroup, made sides optional in CustomProjectInput
- Updated API route to accept top-level `sides` parameter for custom mode
- Updated use-calculator-state.ts with customSides state
- Updated input-panel.tsx to pass customSides/setCustomSides
- Updated page.tsx to pass customSides through
- Updated allocation-table.tsx with Sheets column for custom mode
- Updated svg-plate-visualization.tsx with per-project SVG rendering for custom mode
- Updated mode-config.tsx to remove sides from default custom projects
- Fixed multiple JSX syntax errors in SVG visualization
- All TypeScript compilation passes, lint clean

Stage Summary:
- Polygon custom mode now separates each project onto its own sheets
- Global polygon type selector ensures no mixing on sheets
- Optimized tessellation per polygon type maximizes space utilization
- Material yield properly calculated using actual polygon area
---
Task ID: 1
Agent: Main
Task: Implement mixed-size same-shape gang run packing for custom/polygon mode

Work Log:
- Read and analyzed current packer-custom.ts (per-project dedicated sheets approach)
- Read rect-mixed calculator (gang-run-calculator-v2.ts) as reference for MaxRect packing
- Read SVG visualization, allocation table, custom-input, route.ts, and types.ts
- Completely rewrote packer-custom.ts with:
  - New block-based approach: each project occupies a rectangular block on the sheet
  - Polygon tessellation within each block using optimized patterns
  - MaxRect 2D bin packing to place multiple blocks on shared sheets
  - Run-length-based allocation search (searches L=1 upward for minimum feasible)
  - Boosted allocation variants (+1, +2 extra outs per project)
  - Single-project special case (fills entire sheet)
  - tessBlockPositions() for generating visualization positions within placed blocks
  - tessGridDimensions() helper for display
  - Clean buildPlateResult() using actual tessellation counts
- Updated SVG visualization: removed per-project separate-sheet rendering, unified to single shared-sheet view with "Polygon Gang Run" title
- Updated custom-input.tsx: changed description text from "dedicated sheets" to "gang run"
- Updated allocation table: removed "Sheets" column for custom mode (all projects share same run length)
- Fixed allocation search bug: was clamping outs to perProjectMax (making L=1 appear feasible when insufficient)
- Verified with comprehensive test suite: pentagons, hexagons, triangles, octagons, single-project

Stage Summary:
- Mixed-size same-shape gang run packing is fully functional
- Test results: 3 pentagon projects (2"/3"/4") → 5 sheets with 0% overage, 44.1% yield
- Algorithm correctly mixes different sizes on same sheet via MaxRect bin packing
- Different polygon types are NEVER mixed on one sheet (gang run constraint satisfied)
