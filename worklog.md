# Worklog

---
Task ID: 1
Agent: Main
Task: Fix hydration error from browser extension (bis_skin_checked)

Work Log:
- Analyzed the hydration mismatch error — Bitdefender browser extension injects `bis_skin_checked="1"` attribute on many DOM elements
- Previous fix only added `suppressHydrationWarning` to `<body>`, which doesn't help nested elements
- Added a MutationObserver script in `<head>` of layout.tsx that strips `bis_skin_checked` attributes as they're injected
- The observer watches `document.documentElement` with `{attributes: true, subtree: true, attributeFilter: ['bis_skin_checked']}`

Stage Summary:
- Fixed hydration error by proactively removing extension attributes before React hydrates
- File modified: `src/app/layout.tsx`

---
Task ID: 2
Agent: Main
Task: Implement alternate-col tessellation for triangles in packer-custom.ts

Work Log:
- Analyzed the geometric requirements for triangle tessellation — triangles should alternate ▲▼ within each row (not separate rows like hex-offset)
- Key insight: with alternating ▲▼, the horizontal step can be `cellW/2 + bleedIn` instead of `cellW`, fitting ~2x more triangles per row
- Added `TessStyle` type: "alternate-col" (for triangles) and "hex-offset" (for diamonds)
- Added `tessStyle` property to all PRESET_SHAPES entries
- Modified `tessCapacity` to handle alternate-col mode with tighter step
- Modified `tessGroupCount` — alternate-col returns simple w*h (no odd-row reduction)
- Modified `tessGroupDimensions` — alternate-col uses different width formula
- Modified `tessGroupPositions` — alternate-col alternates flip within rows
- Modified `getTessGroupShapes` — alternate-col uses grid-like factorization
- Updated all callers to pass shapeName for tess style lookup
- Tested: 44 triangles/sheet vs ~30 with old hex-offset approach (47% improvement)
- All 4 packing modes tested and working

Stage Summary:
- Triangle packing density improved by ~47% (44 vs ~30 per sheet for 3" triangles on 24×16.5 sheet)
- Diamond packing unchanged (still uses hex-offset)
- File modified: `src/lib/packer-custom.ts`

---
Task ID: 3
Agent: Main
Task: Update SVG rendering and descriptions for alternate-col tessellation

Work Log:
- Verified SVG rendering handles alternating positions correctly (already reads tessPositions with flip)
- Updated mode config description from "Tessellated polygons" to "▲▼ tessellated polygons"
- Updated mode description in getModeDescription()
- Linter passes clean

Stage Summary:
- Minor text updates to reflect new tessellation mode
- Files modified: `src/app/page.tsx`
---
Task ID: 1
Agent: main
Task: Fix triangle crash, add plate suggestions, error modal improvements

Work Log:
- Diagnosed the crash: `Cannot read properties of undefined (reading 'w')` at line 763 where `entry.groupShape` is undefined for custom shapes
- Root cause: `CustomAllocationEntry` in packer-custom.ts was missing `groupShape` field, unlike all other packers (rect-same, rect-mixed, circular)
- Fixed packer-custom.ts: Added `groupShape: { w: number; h: number }` to `CustomAllocationEntry` interface and populated it with `shapes[i]` in `buildCustomPlateResult`
- Added defensive null check in AllocationTable: `gs ? `${gs.w}×${gs.h}` : "—"` instead of `gs.w`
- Added plate suggestions card to results view (success state), not just error modal
- Added `buildPlateSuggestions()` function to API route for rect-same, rect-mixed, circular modes (custom mode already had it)
- Improved browser extension hydration warning suppression by adding more attribute filters (bis_register, bis_use, data-bis-config, data-dynamic-id)
- Verified lint passes and custom packer returns groupShape correctly

Stage Summary:
- Triangle/custom shape crash is fixed - groupShape now properly included in CustomAllocationEntry
- Plate suggestions now shown in results view for ALL modes (1, 2, 3, 4+ plates)
- Error modal already existed and works correctly
- Hydration warnings from browser extensions better suppressed
