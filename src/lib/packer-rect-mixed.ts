// ── Mixed-Size Rectangle Packer ──────────────────────────────────────────────
// Each project can have its own W×H sticker dimensions.
// Uses MaxRect 2D bin packing. Re-exports the v2 calculator with
// a clean standalone interface.

export {
  calculateMultiSize as calculateMixedRect,
  type ProjectInput as MixedRectProject,
  type PlacedGroup as PlacedMixedRectGroup,
  type AllocationEntry as MixedRectAllocationEntry,
  type PlateResult as MixedRectPlateResult,
  type TwoPlateResult as MixedRectTwoPlateResult,
  type MultiSizeCalculateResponse as MixedRectCalculateResponse,
} from "./gang-run-calculator-v2";
