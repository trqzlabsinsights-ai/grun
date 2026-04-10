# Task: Gang Run Calculator - Full Implementation

## Summary
Built a comprehensive Gang Run Calculator web application with server-side optimization engine and dark-themed UI.

## Files Created/Modified
1. `src/app/api/calculate/route.ts` - API endpoint with optimization engine
2. `src/app/page.tsx` - Main page with all UI components
3. `src/app/globals.css` - Added custom scrollbar styles

## Algorithm Implementation
- **Sheet Capacity**: Grid calculation with mm-to-inch bleed conversion
- **Single Plate**: Exhaustive search with pruning for optimal slot allocation
- **Two Plate**: Enumerates all 2^(N-1)-1 non-trivial splits, optimizes each plate independently, finds minimum total sheets

## Verified Results (Default Test Case)
- Grid: 6×3 = 18 slots ✅
- Single Plate: a=6,b=3,c=3,d=2,e=2,f=1,g=1 → L=1141 ✅
- Two Plate: Plate1(a=12,d=4,f=2,L=571) + Plate2(b=6,c=6,e=4,g=2,L=477) → total=1048 ✅
- Sheets Saved: 93 ✅

## UI Components
- Input panel (collapsible with pre-loaded defaults)
- Sheet capacity card with mini grid diagram
- Results tabs (Single Plate / Two Plate)
- KPI cards, allocation tables, bar charts, SVG grid visualizations
- Comparison card with recommendation
- Custom scrollbar styling
- Auto-collapse input on calculation
