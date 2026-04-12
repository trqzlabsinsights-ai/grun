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
