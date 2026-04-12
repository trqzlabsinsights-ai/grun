---
Task ID: 1
Agent: Main
Task: Architectural refactor — break monolithic page.tsx into granular, industry-specific and mode-specific files

Work Log:
- Read and analyzed current page.tsx (670 lines, already partially refactored from 1650+)
- Identified remaining inline sections to extract: state hook, header, industry selector, mode selector, input panel, results section, error modal
- Created `src/hooks/use-calculator-state.ts` (185 lines) — all state management + calculate logic
- Created `src/components/calculator/calculator-header.tsx` (20 lines) — sticky header
- Created `src/components/calculator/industry-selector.tsx` (52 lines) — industry dropdown
- Created `src/components/calculator/mode-selector.tsx` (48 lines) — packing mode buttons
- Created `src/components/calculator/input-panel.tsx` (186 lines) — collapsible input form
- Created `src/components/calculator/results-section.tsx` (303 lines) — all results display + error modal
- Fixed circular type reference in `src/lib/types.ts` — defined `IndustryTerms` as explicit interface
- Fixed type mismatch in `input-panel.tsx` — setRectSameW/H now uses `React.Dispatch<React.SetStateAction<number>>`
- Replaced inline `ErrorModalInline` with imported `ErrorModal` component
- Refactored `page.tsx` from 670 lines down to 81 lines — now a slim orchestrator

Stage Summary:
- page.tsx: 1650+ → 670 → 81 lines (95% reduction from original)
- All TypeScript errors in src/components, src/hooks, src/app resolved
- ESLint passes clean
- Dev server loads page successfully (HTTP 200)
- File breakdown: 1 hook (185 lines), 15 calculator components (1728 lines total), 3 lib configs (402 lines), 1 slim page (81 lines)
