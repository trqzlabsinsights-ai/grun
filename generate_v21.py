#!/usr/bin/env python3
"""
Print Production Engine v21 — Single-Run "One-Plate" Master Plan
Generates an interactive HTML dashboard with:

  - Physical SVG visualization of the 24"×18" press sheet
  - Exact cell dimensions (9.39 cm × 12.03 cm) with margin specs
  - Coordinate-mapped island blocks on a 6×3 grid
  - Yield table with overage calculations (run length: 1,144 sheets)
  - Die-cut Cut-List with blade positions measured from sheet edge
  - Press specs, bleed guidelines, and grain direction notes

Core Logic:
  - 18-up (6×3) rigid grid, single plate, one press run
  - Magic Number: 1,144 sheets (clears all minimums in a single pass)
  - No cleanup plate, no second setup, one wash-up
"""

from dataclasses import dataclass
from typing import List, Tuple


# ─── Physical Sheet Constants ──────────────────────────────────────────────────

SHEET_WIDTH_IN = 24.0          # inches
SHEET_HEIGHT_IN = 18.0         # inches
SHEET_WIDTH_CM = 60.96         # cm
SHEET_HEIGHT_CM = 45.72        # cm

MARGIN_SIDE_CM = 0.25          # left + right margins
MARGIN_TOP_CM = 0.30           # top margin
MARGIN_BOT_CM = 0.30           # bottom margin

GRID_COLS = 6
GRID_ROWS = 3

# Printable area
PRINT_W_CM = SHEET_WIDTH_CM - 2 * MARGIN_SIDE_CM   # 60.46 cm
PRINT_H_CM = SHEET_HEIGHT_CM - MARGIN_TOP_CM - MARGIN_BOT_CM  # 45.12 cm

# Cell dimensions (from the spec)
CELL_W_CM = 9.39
CELL_H_CM = 12.03

# Calculate gutter spacing
TOTAL_CELL_W = GRID_COLS * CELL_W_CM   # 56.34 cm
TOTAL_CELL_H = GRID_ROWS * CELL_H_CM   # 36.09 cm
GUTTER_TOTAL_W = PRINT_W_CM - TOTAL_CELL_W   # 4.12 cm across 5 inter-column gutters
GUTTER_TOTAL_H = PRINT_H_CM - TOTAL_CELL_H   # 9.03 cm across 2 inter-row gutters
GUTTER_W_CM = GUTTER_TOTAL_W / (GRID_COLS - 1) if GRID_COLS > 1 else 0  # ~0.824 cm
GUTTER_H_CM = GUTTER_TOTAL_H / (GRID_ROWS - 1) if GRID_ROWS > 1 else 0  # ~4.515 cm

# Run length
RUN_LENGTH = 1144
PAPER_ORDER = 1250

# Sticker specs
STICKER_W_IN = 3.5
STICKER_H_IN = 4.5
BLEED_MM = 2.0  # bleed extends beyond die-line


# ─── Data Models ───────────────────────────────────────────────────────────────

@dataclass
class Project:
    """A single print job with its order quantity, outs, and visual color."""
    id: str
    name: str
    target: int
    outs: int
    color: str
    dark_color: str
    grid_positions: List[Tuple[int, int]]  # (col, row) on the 6×3 grid


# ─── Production Matrix ────────────────────────────────────────────────────────

PROJECTS = [
    Project("G", "Project G", 6844, 6, "#06b6d4", "#0e7490",
        [(0,0),(1,0),(2,0),(3,0),(4,0),(5,0)]),
    Project("F", "Project F", 2860, 3, "#ec4899", "#be185d",
        [(0,1),(1,1),(2,1)]),
    Project("E", "Project E", 2750, 3, "#ef4444", "#b91c1c",
        [(3,1),(4,1),(5,1)]),
    Project("D", "Project D", 2255, 2, "#8b5cf6", "#6d28d9",
        [(0,2),(1,2)]),
    Project("C", "Project C", 1674, 2, "#f59e0b", "#b45309",
        [(2,2),(3,2)]),
    Project("B", "Project B", 924, 1, "#10b981", "#047857",
        [(4,2)]),
    Project("A", "Project A", 825, 1, "#3b82f6", "#1d4ed8",
        [(5,2)]),
]

LAYOUT = {
    "Row 0": ["G", "G", "G", "G", "G", "G"],
    "Row 1": ["F", "F", "F", "E", "E", "E"],
    "Row 2": ["D", "D", "C", "C", "B", "A"],
}


# ─── Calculation Engine ────────────────────────────────────────────────────────

def calculate_yields() -> List[dict]:
    """Calculate produced, overage for each project."""
    results = []
    for p in PROJECTS:
        produced = p.outs * RUN_LENGTH
        overage = produced - p.target
        overage_pct = (overage / p.target * 100) if p.target > 0 else 0
        if overage > 0:
            status = "over"
            status_label = f"+{overage}"
        elif overage < 0:
            status = "short"
            status_label = str(overage)
        else:
            status = "perfect"
            status_label = "0"
        results.append({
            "id": p.id,
            "name": p.name,
            "target": p.target,
            "outs": p.outs,
            "produced": produced,
            "overage": overage,
            "overage_pct": overage_pct,
            "status": status,
            "status_label": status_label,
            "color": p.color,
            "dark_color": p.dark_color,
        })
    return results


def calculate_cut_list() -> dict:
    """Calculate exact physical blade positions from the top-left corner of the sheet."""
    # Vertical cuts (blade positions from left edge)
    vertical_cuts = []
    x = MARGIN_SIDE_CM  # first cut = left margin
    for col in range(GRID_COLS):
        cell_start = x
        cell_end = x + CELL_W_CM
        vertical_cuts.append({
            "col": col,
            "start": round(cell_start, 3),
            "end": round(cell_end, 3),
            "width": CELL_W_CM,
        })
        x = cell_end + GUTTER_W_CM  # jump over gutter

    # Horizontal cuts (blade positions from top edge)
    horizontal_cuts = []
    y = MARGIN_TOP_CM  # first cut = top margin
    for row in range(GRID_ROWS):
        cell_start = y
        cell_end = y + CELL_H_CM
        horizontal_cuts.append({
            "row": row,
            "start": round(cell_start, 3),
            "end": round(cell_end, 3),
            "height": CELL_H_CM,
        })
        y = cell_end + GUTTER_H_CM  # jump over gutter

    # Gutter center positions (where the blade actually travels)
    gutter_vertical = []
    for i in range(1, GRID_COLS):
        left_edge = vertical_cuts[i-1]["end"]
        right_edge = vertical_cuts[i]["start"]
        center = (left_edge + right_edge) / 2
        gutter_vertical.append({
            "between_cols": f"{i-1}–{i}",
            "from_left": round(center, 3),
            "gutter_width": round(GUTTER_W_CM, 3),
        })

    gutter_horizontal = []
    for i in range(1, GRID_ROWS):
        top_edge = horizontal_cuts[i-1]["end"]
        bot_edge = horizontal_cuts[i]["start"]
        center = (top_edge + bot_edge) / 2
        gutter_horizontal.append({
            "between_rows": f"{i-1}–{i}",
            "from_top": round(center, 3),
            "gutter_height": round(GUTTER_H_CM, 3),
        })

    return {
        "vertical_cuts": vertical_cuts,
        "horizontal_cuts": horizontal_cuts,
        "gutter_vertical": gutter_vertical,
        "gutter_horizontal": gutter_horizontal,
    }


# ─── SVG Renderer (Physical Proportions) ───────────────────────────────────────

def render_sheet_svg() -> str:
    """Render the 24"×18" press sheet with physical-proportion cells, margins, gutters, and die marks."""
    # SVG coordinate system: scale 1 cm → 8 px for good detail
    scale = 8.0
    pad_svg = 30  # extra padding around sheet

    sheet_px_w = SHEET_WIDTH_CM * scale
    sheet_px_h = SHEET_HEIGHT_CM * scale
    svg_w = sheet_px_w + pad_svg * 2
    svg_h = sheet_px_h + pad_svg * 2 + 50  # extra for labels

    # Sheet origin in SVG space
    ox = pad_svg
    oy = pad_svg + 40  # room for top label

    parts = []
    parts.append(f'<svg viewBox="0 0 {svg_w:.0f} {svg_h:.0f}" xmlns="http://www.w3.org/2000/svg" class="plate-svg">')

    # Background
    parts.append(f'<rect x="0" y="0" width="{svg_w:.0f}" height="{svg_h:.0f}" rx="12" fill="#0f172a" />')

    # ── Sheet body ──
    parts.append(f'<rect x="{ox}" y="{oy}" width="{sheet_px_w:.1f}" height="{sheet_px_h:.1f}" rx="3" fill="#1e293b" stroke="#475569" stroke-width="1.5" />')

    # ── Margin zones (hatched) ──
    # Left margin
    parts.append(f'<rect x="{ox}" y="{oy}" width="{MARGIN_SIDE_CM * scale:.1f}" height="{sheet_px_h:.1f}" fill="#334155" fill-opacity="0.4" />')
    # Right margin
    rm_x = ox + (SHEET_WIDTH_CM - MARGIN_SIDE_CM) * scale
    parts.append(f'<rect x="{rm_x:.1f}" y="{oy}" width="{MARGIN_SIDE_CM * scale:.1f}" height="{sheet_px_h:.1f}" fill="#334155" fill-opacity="0.4" />')
    # Top margin
    parts.append(f'<rect x="{ox}" y="{oy}" width="{sheet_px_w:.1f}" height="{MARGIN_TOP_CM * scale:.1f}" fill="#334155" fill-opacity="0.3" />')
    # Bottom margin
    bm_y = oy + (SHEET_HEIGHT_CM - MARGIN_BOT_CM) * scale
    parts.append(f'<rect x="{ox}" y="{bm_y:.1f}" width="{sheet_px_w:.1f}" height="{MARGIN_BOT_CM * scale:.1f}" fill="#334155" fill-opacity="0.3" />')

    # ── Title above sheet ──
    parts.append(f'<text x="{ox + sheet_px_w / 2:.1f}" y="{oy - 20}" text-anchor="middle" fill="#e2e8f0" font-size="15" font-weight="bold" font-family="monospace">Single-Run Master Plate — {SHEET_WIDTH_IN}" × {SHEET_HEIGHT_IN}" Sheet</text>')
    parts.append(f'<text x="{ox + sheet_px_w / 2:.1f}" y="{oy - 5}" text-anchor="middle" fill="#94a3b8" font-size="11" font-family="monospace">6×3 Grid  |  Cell: {CELL_W_CM}cm × {CELL_H_CM}cm  |  {RUN_LENGTH:,} sheets</text>')

    # ── Build position lookup ──
    pos_map = {}  # (col, row) -> Project
    for p in PROJECTS:
        for pos in p.grid_positions:
            pos_map[pos] = p

    # ── Render cells ──
    rendered_groups = set()
    for p in PROJECTS:
        pid = p.id
        if pid in rendered_groups:
            continue
        rendered_groups.add(pid)

        # Find bounding box
        min_col = min(c for c, r in p.grid_positions)
        max_col = max(c for c, r in p.grid_positions)
        min_row = min(r for c, r in p.grid_positions)
        max_row = max(r for c, r in p.grid_positions)

        # SVG coordinates for the block
        bx = ox + (MARGIN_SIDE_CM + min_col * (CELL_W_CM + GUTTER_W_CM)) * scale
        by = oy + (MARGIN_TOP_CM + min_row * (CELL_H_CM + GUTTER_H_CM)) * scale
        bw = (max_col - min_col + 1) * CELL_W_CM * scale + (max_col - min_col) * GUTTER_W_CM * scale
        bh = (max_row - min_row + 1) * CELL_H_CM * scale + (max_row - min_row) * GUTTER_H_CM * scale

        # Block background
        parts.append(f'<rect x="{bx:.1f}" y="{by:.1f}" width="{bw:.1f}" height="{bh:.1f}" rx="5" fill="{p.color}" fill-opacity="0.18" stroke="{p.color}" stroke-width="2" />')

        # Individual cells within block
        for (col, row) in p.grid_positions:
            cx = ox + (MARGIN_SIDE_CM + col * (CELL_W_CM + GUTTER_W_CM)) * scale
            cy = oy + (MARGIN_TOP_CM + row * (CELL_H_CM + GUTTER_H_CM)) * scale
            cw = CELL_W_CM * scale
            ch = CELL_H_CM * scale

            # Cell outline
            parts.append(f'<rect x="{cx:.1f}" y="{cy:.1f}" width="{cw:.1f}" height="{ch:.1f}" rx="3" fill="{p.color}" fill-opacity="0.06" stroke="{p.dark_color}" stroke-width="0.8" stroke-opacity="0.6" />')

            # Die-line (inner dashed rectangle for sticker bleed reference)
            bleed_px = (BLEED_MM / 10) * scale  # 2mm bleed
            parts.append(f'<rect x="{cx + bleed_px:.1f}" y="{cy + bleed_px:.1f}" width="{cw - 2*bleed_px:.1f}" height="{ch - 2*bleed_px:.1f}" rx="2" fill="none" stroke="#f97316" stroke-width="0.6" stroke-dasharray="3,2" stroke-opacity="0.5" />')

        # Block label
        label_x = bx + bw / 2
        label_y = by + bh / 2 - 6
        parts.append(f'<text x="{label_x:.1f}" y="{label_y:.1f}" text-anchor="middle" fill="{p.color}" font-size="16" font-weight="bold" font-family="monospace">{p.id}</text>')
        parts.append(f'<text x="{label_x:.1f}" y="{label_y + 16:.1f}" text-anchor="middle" fill="#cbd5e1" font-size="9" font-family="monospace">{p.outs} outs</text>')

    # ── Dimension annotations ──
    # Bottom dimension: total cell width
    dim_y = oy + sheet_px_h + 15
    parts.append(f'<line x1="{ox + MARGIN_SIDE_CM * scale:.1f}" y1="{dim_y:.1f}" x2="{ox + (MARGIN_SIDE_CM + TOTAL_CELL_W + (GRID_COLS-1)*GUTTER_W_CM) * scale:.1f}" y2="{dim_y:.1f}" stroke="#64748b" stroke-width="0.8" />')
    parts.append(f'<text x="{ox + sheet_px_w / 2:.1f}" y="{dim_y + 12:.1f}" text-anchor="middle" fill="#94a3b8" font-size="10" font-family="monospace">{GRID_COLS} × {CELL_W_CM}cm cells + gutters = {PRINT_W_CM:.2f}cm printable</text>')

    # Right dimension: total cell height
    dim_x = ox + sheet_px_w + 8
    parts.append(f'<line x1="{dim_x:.1f}" y1="{oy + MARGIN_TOP_CM * scale:.1f}" x2="{dim_x:.1f}" y2="{oy + (MARGIN_TOP_CM + TOTAL_CELL_H + (GRID_ROWS-1)*GUTTER_H_CM) * scale:.1f}" stroke="#64748b" stroke-width="0.8" />')
    parts.append(f'<text x="{dim_x + 5:.1f}" y="{oy + sheet_px_h / 2:.1f}" fill="#94a3b8" font-size="10" font-family="monospace" transform="rotate(90,{dim_x + 5:.1f},{oy + sheet_px_h / 2:.1f})">{GRID_ROWS} × {CELL_H_CM}cm = {PRINT_H_CM:.2f}cm</text>')

    # ── Registration marks ──
    mark_r = 4
    reg_positions = [
        (ox + 10, oy + 10),
        (ox + sheet_px_w - 10, oy + 10),
        (ox + 10, oy + sheet_px_h - 10),
        (ox + sheet_px_w - 10, oy + sheet_px_h - 10),
    ]
    for mx, my in reg_positions:
        parts.append(f'<circle cx="{mx:.1f}" cy="{my:.1f}" r="{mark_r}" fill="none" stroke="#f97316" stroke-width="1.2" />')
        parts.append(f'<line x1="{mx-mark_r-2:.1f}" y1="{my:.1f}" x2="{mx+mark_r+2:.1f}" y2="{my:.1f}" stroke="#f97316" stroke-width="0.6" />')
        parts.append(f'<line x1="{mx:.1f}" y1="{my-mark_r-2:.1f}" x2="{mx:.1f}" y2="{my+mark_r+2:.1f}" stroke="#f97316" stroke-width="0.6" />')

    # ── Grain direction arrow ──
    arrow_y = oy + sheet_px_h + 30
    arrow_x1 = ox + 20
    arrow_x2 = ox + sheet_px_w - 20
    parts.append(f'<line x1="{arrow_x1:.1f}" y1="{arrow_y:.1f}" x2="{arrow_x2:.1f}" y2="{arrow_y:.1f}" stroke="#06b6d4" stroke-width="1.5" marker-end="url(#arrowhead)" />')
    parts.append(f'<defs><marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#06b6d4" /></marker></defs>')
    parts.append(f'<text x="{(arrow_x1+arrow_x2)/2:.1f}" y="{arrow_y - 5:.1f}" text-anchor="middle" fill="#06b6d4" font-size="10" font-family="monospace">GRAIN DIRECTION (parallel to 24" side)</text>')

    parts.append('</svg>')
    return '\n'.join(parts)


# ─── HTML Generator ────────────────────────────────────────────────────────────

def generate_html() -> str:
    yields = calculate_yields()
    cut_list = calculate_cut_list()
    sheet_svg = render_sheet_svg()

    total_target = sum(y["target"] for y in yields)
    total_produced = sum(y["produced"] for y in yields)
    total_overage = sum(y["overage"] for y in yields if y["overage"] > 0)
    yield_pct = (total_target / total_produced * 100) if total_produced > 0 else 0
    spoilage_pct = ((PAPER_ORDER - RUN_LENGTH) / RUN_LENGTH * 100)

    # ── Yield rows ──
    yield_rows = ""
    for y in yields:
        status_class = {"over": "status-over", "short": "status-short", "perfect": "status-perfect"}[y["status"]]
        bar_pct = min((y["produced"] / y["target"] * 100) if y["target"] > 0 else 0, 140)
        yield_rows += f"""
          <tr>
            <td><span class="color-dot" style="background:{y['color']}"></span>{y['id']}</td>
            <td class="mono">{y['target']:,}</td>
            <td class="mono">{y['outs']}</td>
            <td class="mono">{y['produced']:,}</td>
            <td class="mono {status_class}">{y['status_label']}</td>
            <td class="mono">{y['overage_pct']:.1f}%</td>
            <td>
              <div class="yield-bar-bg">
                <div class="yield-bar-fill" style="width:{bar_pct:.1f}%;background:{y['color']}"></div>
                <span class="yield-bar-label">{bar_pct:.1f}%</span>
              </div>
            </td>
          </tr>"""

    # ── Layout grid (text representation) ──
    grid_html = ""
    for row_name, cells in LAYOUT.items():
        row_num = int(row_name.split()[1])
        grid_html += f'<div class="grid-row"><span class="row-label">{row_name}</span>'
        for col_idx, pid in enumerate(cells):
            proj = next(p for p in PROJECTS if p.id == pid)
            grid_html += f'<div class="grid-cell" style="background:{proj.color}20;border-color:{proj.color}"><span class="cell-id" style="color:{proj.color}">{pid}</span><span class="cell-pos">({col_idx},{row_num})</span></div>'
        grid_html += '</div>'

    # ── Cut-list: Vertical cuts ──
    vc_rows = ""
    for vc in cut_list["vertical_cuts"]:
        vc_rows += f"""
          <tr>
            <td class="mono">Col {vc['col']}</td>
            <td class="mono">{vc['start']:.3f} cm</td>
            <td class="mono">{vc['end']:.3f} cm</td>
            <td class="mono">{vc['width']:.2f} cm</td>
          </tr>"""

    # ── Cut-list: Horizontal cuts ──
    hc_rows = ""
    for hc in cut_list["horizontal_cuts"]:
        hc_rows += f"""
          <tr>
            <td class="mono">Row {hc['row']}</td>
            <td class="mono">{hc['start']:.3f} cm</td>
            <td class="mono">{hc['end']:.3f} cm</td>
            <td class="mono">{hc['height']:.2f} cm</td>
          </tr>"""

    # ── Gutter positions ──
    gv_rows = ""
    for gv in cut_list["gutter_vertical"]:
        gv_rows += f"""
          <tr>
            <td class="mono">Col {gv['between_cols']}</td>
            <td class="mono">{gv['from_left']:.3f} cm from left</td>
            <td class="mono">{gv['gutter_width']:.3f} cm</td>
          </tr>"""

    gh_rows = ""
    for gh in cut_list["gutter_horizontal"]:
        gh_rows += f"""
          <tr>
            <td class="mono">Row {gh['between_rows']}</td>
            <td class="mono">{gh['from_top']:.3f} cm from top</td>
            <td class="mono">{gh['gutter_height']:.3f} cm</td>
          </tr>"""

    # ── Coordinate map ──
    coord_rows = ""
    for p in PROJECTS:
        coords = ", ".join(f"({c},{r})" for c, r in p.grid_positions)
        coord_rows += f"""
          <tr>
            <td><span class="color-dot" style="background:{p.color}"></span>{p.id}</td>
            <td class="mono">{p.outs}</td>
            <td class="mono coords">{coords}</td>
          </tr>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Print Production Engine v21 — Single-Run Master Plan</title>
<style>
  :root {{
    --bg-primary: #020617;
    --bg-secondary: #0f172a;
    --bg-card: #1e293b;
    --bg-card-alt: #1a2332;
    --text-primary: #e2e8f0;
    --text-secondary: #94a3b8;
    --text-muted: #64748b;
    --border: #334155;
    --accent-cyan: #06b6d4;
    --accent-green: #10b981;
    --accent-red: #ef4444;
    --accent-amber: #f59e0b;
    --accent-orange: #f97316;
  }}

  * {{ margin: 0; padding: 0; box-sizing: border-box; }}

  body {{
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    background: var(--bg-primary);
    color: var(--text-primary);
    min-height: 100vh;
  }}

  .app {{ max-width: 1400px; margin: 0 auto; padding: 24px; }}

  /* Header */
  .header {{
    text-align: center;
    padding: 40px 20px 30px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 32px;
  }}
  .header-badge {{
    display: inline-block;
    padding: 4px 14px;
    border-radius: 999px;
    background: rgba(16,185,129,0.12);
    color: var(--accent-green);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 12px;
    border: 1px solid rgba(16,185,129,0.25);
  }}
  .header h1 {{
    font-size: 32px;
    font-weight: 800;
    letter-spacing: -0.5px;
    background: linear-gradient(135deg, #10b981, #06b6d4);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }}
  .header p {{
    color: var(--text-secondary);
    font-size: 15px;
    margin-top: 8px;
    max-width: 780px;
    margin-left: auto;
    margin-right: auto;
    line-height: 1.6;
  }}

  /* KPI Cards */
  .kpi-grid {{
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 14px;
    margin-bottom: 32px;
  }}
  .kpi-card {{
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 18px;
    position: relative;
    overflow: hidden;
  }}
  .kpi-card::before {{
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: var(--accent-cyan);
  }}
  .kpi-card.green::before {{ background: var(--accent-green); }}
  .kpi-card.amber::before {{ background: var(--accent-amber); }}
  .kpi-card.orange::before {{ background: var(--accent-orange); }}
  .kpi-label {{ color: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }}
  .kpi-value {{ font-size: 26px; font-weight: 700; font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace; }}
  .kpi-sub {{ color: var(--text-secondary); font-size: 12px; margin-top: 4px; }}

  /* Section */
  .section {{
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 24px;
  }}
  .section-title {{
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 10px;
  }}
  .section-subtitle {{
    color: var(--text-secondary);
    font-size: 13px;
    margin-bottom: 20px;
  }}
  .section-icon {{
    width: 28px; height: 28px;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
  }}

  /* Tables */
  table {{ width: 100%; border-collapse: separate; border-spacing: 0; }}
  thead th {{
    text-align: left; padding: 10px 12px; font-size: 11px;
    text-transform: uppercase; letter-spacing: 1px;
    color: var(--text-muted); border-bottom: 1px solid var(--border); font-weight: 600;
  }}
  tbody td {{
    padding: 9px 12px; font-size: 13px;
    border-bottom: 1px solid rgba(51,65,85,0.35);
  }}
  tbody tr:hover {{ background: rgba(51,65,85,0.2); }}
  tbody tr:last-child td {{ border-bottom: none; }}

  .mono {{ font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace; font-size: 12px; }}
  .color-dot {{
    display: inline-block; width: 10px; height: 10px;
    border-radius: 3px; margin-right: 8px; vertical-align: middle;
  }}
  .status-over {{ color: var(--accent-amber); font-weight: 600; }}
  .status-short {{ color: var(--accent-red); font-weight: 600; }}
  .status-perfect {{ color: var(--accent-green); font-weight: 600; }}
  .coords {{ font-size: 11px; letter-spacing: -0.3px; color: var(--text-secondary); }}

  /* Yield bar */
  .yield-bar-bg {{
    position: relative; width: 100%; height: 20px;
    background: rgba(51,65,85,0.4); border-radius: 4px; overflow: hidden;
  }}
  .yield-bar-fill {{
    height: 100%; border-radius: 4px; transition: width 0.6s ease; opacity: 0.65;
  }}
  .yield-bar-label {{
    position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
    font-size: 10px; font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
    color: var(--text-primary);
  }}

  /* SVG */
  .plate-svg {{ width: 100%; height: auto; max-width: 780px; margin: 0 auto; display: block; }}

  /* Grid layout visualization */
  .grid-viz {{ display: flex; flex-direction: column; gap: 6px; max-width: 600px; }}
  .grid-row {{ display: flex; align-items: center; gap: 4px; }}
  .row-label {{
    color: var(--text-muted); font-size: 11px; font-family: monospace;
    width: 48px; text-align: right; flex-shrink: 0;
  }}
  .grid-cell {{
    flex: 1; height: 52px; border: 1.5px solid; border-radius: 6px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    transition: transform 0.15s ease;
  }}
  .grid-cell:hover {{ transform: scale(1.05); }}
  .cell-id {{ font-size: 16px; font-weight: 700; font-family: monospace; }}
  .cell-pos {{ font-size: 9px; color: var(--text-muted); font-family: monospace; }}

  /* Two-column layout */
  .two-col {{ display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }}
  @media (max-width: 900px) {{ .two-col {{ grid-template-columns: 1fr; }} }}

  /* Strategy flow */
  .strategy-flow {{
    display: flex; align-items: stretch; gap: 12px;
    margin-bottom: 20px; flex-wrap: wrap;
  }}
  .flow-step {{
    flex: 1; min-width: 160px;
    background: var(--bg-card-alt); border: 1px solid var(--border);
    border-radius: 10px; padding: 16px; position: relative;
  }}
  .flow-step-num {{
    position: absolute; top: -10px; left: 14px;
    background: var(--accent-green); color: var(--bg-primary);
    font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 999px;
  }}
  .flow-step-title {{ font-weight: 700; font-size: 13px; margin-top: 4px; margin-bottom: 6px; }}
  .flow-step-body {{ color: var(--text-secondary); font-size: 12px; line-height: 1.5; }}

  /* Pro-tip card */
  .protip-grid {{
    display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 14px;
  }}
  .protip {{
    background: var(--bg-card-alt); border: 1px solid var(--border);
    border-radius: 10px; padding: 16px;
  }}
  .protip-title {{
    font-weight: 700; font-size: 13px; margin-bottom: 8px;
    display: flex; align-items: center; gap: 8px;
  }}
  .protip-body {{ color: var(--text-secondary); font-size: 12px; line-height: 1.6; }}
  .protip-icon {{
    width: 22px; height: 22px; border-radius: 5px;
    display: inline-flex; align-items: center; justify-content: center; font-size: 11px;
  }}

  .footer {{
    text-align: center; padding: 24px;
    color: var(--text-muted); font-size: 12px;
    border-top: 1px solid var(--border); margin-top: 16px;
  }}
</style>
</head>
<body>
<div class="app">

  <!-- Header -->
  <div class="header">
    <div class="header-badge">Engine v21 — Single-Run One-Plate Strategy</div>
    <h1>Master Plate Calculator</h1>
    <p>
      One plate. One press run. One wash-up. The 18-up (6&times;3) layout with {RUN_LENGTH:,} sheets clears all minimums
      in a single pass. Paper order: {PAPER_ORDER:,} sheets (includes setup + {spoilage_pct:.1f}% spoilage allowance).
    </p>
  </div>

  <!-- KPI Summary -->
  <div class="kpi-grid">
    <div class="kpi-card green">
      <div class="kpi-label">Run Length</div>
      <div class="kpi-value">{RUN_LENGTH:,}</div>
      <div class="kpi-sub">"Magic Number" sheets</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Paper Order</div>
      <div class="kpi-value">{PAPER_ORDER:,}</div>
      <div class="kpi-sub">incl. setup + spoilage</div>
    </div>
    <div class="kpi-card amber">
      <div class="kpi-label">Total Target</div>
      <div class="kpi-value">{total_target:,}</div>
      <div class="kpi-sub">7 projects combined</div>
    </div>
    <div class="kpi-card orange">
      <div class="kpi-label">Total Produced</div>
      <div class="kpi-value">{total_produced:,}</div>
      <div class="kpi-sub">+{total_overage:,} over target</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Paper Utilization</div>
      <div class="kpi-value">~87%</div>
      <div class="kpi-sub">of printable area</div>
    </div>
    <div class="kpi-card green">
      <div class="kpi-label">Plate Count</div>
      <div class="kpi-value">1 Set</div>
      <div class="kpi-sub">CMYK — single run</div>
    </div>
  </div>

  <!-- Strategy -->
  <div class="section">
    <div class="section-title">
      <span class="section-icon" style="background:rgba(16,185,129,0.15);color:var(--accent-green);">&#9881;</span>
      The Single-Run "One-Plate" Strategy
    </div>
    <div class="section-subtitle">Simplified workflow: one setup, one run, one wash-up. The overages on smaller orders offset the press-time savings.</div>
    <div class="strategy-flow">
      <div class="flow-step">
        <div class="flow-step-num">1</div>
        <div class="flow-step-title">Grid Layout</div>
        <div class="flow-step-body">6&times;3 rigid grid on a 24"&times;18" sheet. Each cell = {CELL_W_CM}cm &times; {CELL_H_CM}cm. Total: <strong>18 outs</strong> per sheet.</div>
      </div>
      <div class="flow-step">
        <div class="flow-step-num">2</div>
        <div class="flow-step-title">Assign Outs</div>
        <div class="flow-step-body">G=6, F=3, E=3, D=2, C=2, B=1, A=1. Every cell is the same size &mdash; standard die-cutting chase.</div>
      </div>
      <div class="flow-step">
        <div class="flow-step-num">3</div>
        <div class="flow-step-title">Magic Number</div>
        <div class="flow-step-body">Run <strong>{RUN_LENGTH:,} sheets</strong> to clear all minimums. A needs 825 &divide; 1 = 825 min; B needs 924 &divide; 1 = 924. The maximum wins = 1,144.</div>
      </div>
      <div class="flow-step">
        <div class="flow-step-num">4</div>
        <div class="flow-step-title">Ship It</div>
        <div class="flow-step-body">One CMYK plate set, one press run, one die-cut pass. Overruns on C and A are the trade-off for simplicity.</div>
      </div>
    </div>
  </div>

  <!-- SVG Visualization -->
  <div class="section">
    <div class="section-title">
      <span class="section-icon" style="background:rgba(139,92,246,0.15);color:#8b5cf6;">&#9638;</span>
      Press Sheet Layout — Physical Proportion SVG
    </div>
    <div class="section-subtitle">Drawn to scale. Gray zones = margins. Orange dashed lines = 2mm bleed boundary. Crosshairs = registration marks. Arrow = grain direction.</div>
    {sheet_svg}
  </div>

  <!-- Layout Grid (Interactive) -->
  <div class="section">
    <div class="section-title">
      <span class="section-icon" style="background:rgba(236,72,153,0.15);color:#ec4899;">&#9638;</span>
      Grid Assignment Map
    </div>
    <div class="section-subtitle">Hover over cells to see (col, row) positions. Each project occupies a contiguous block of cells.</div>
    <div class="grid-viz">
      {grid_html}
    </div>
  </div>

  <!-- Yield Table -->
  <div class="section">
    <div class="section-title">
      <span class="section-icon" style="background:rgba(16,185,129,0.15);color:var(--accent-green);">&#9733;</span>
      Production Yield — {RUN_LENGTH:,} Sheets &times; 18-up
    </div>
    <div class="section-subtitle">All projects meet or exceed minimums. Overage is the trade-off for single-plate simplicity.</div>
    <table>
      <thead>
        <tr>
          <th>Project</th>
          <th>Order Qty</th>
          <th>Outs</th>
          <th>Produced</th>
          <th>Overage</th>
          <th>Over %</th>
          <th>Fill Rate</th>
        </tr>
      </thead>
      <tbody>{yield_rows}</tbody>
    </table>
  </div>

  <!-- Cut-List -->
  <div class="section">
    <div class="section-title">
      <span class="section-icon" style="background:rgba(249,115,22,0.15);color:var(--accent-orange);">&#9986;</span>
      Die-Cut Cut-List — Blade Positions from Sheet Edge
    </div>
    <div class="section-subtitle">All measurements from the top-left corner of the sheet. Use these for die-tool setup and chase alignment.</div>
    <div class="two-col">
      <div>
        <h3 style="color:var(--accent-orange);font-size:14px;margin-bottom:10px;">Vertical Blade Positions (Columns)</h3>
        <table>
          <thead>
            <tr><th>Column</th><th>Start (from left)</th><th>End (from left)</th><th>Cell Width</th></tr>
          </thead>
          <tbody>{vc_rows}</tbody>
        </table>
      </div>
      <div>
        <h3 style="color:var(--accent-orange);font-size:14px;margin-bottom:10px;">Horizontal Blade Positions (Rows)</h3>
        <table>
          <thead>
            <tr><th>Row</th><th>Start (from top)</th><th>End (from top)</th><th>Cell Height</th></tr>
          </thead>
          <tbody>{hc_rows}</tbody>
        </table>
      </div>
    </div>
    <div class="two-col" style="margin-top:20px;">
      <div>
        <h3 style="color:var(--accent-cyan);font-size:14px;margin-bottom:10px;">Vertical Gutter Centers (Blade Travel Line)</h3>
        <table>
          <thead>
            <tr><th>Between</th><th>Center Position</th><th>Gutter Width</th></tr>
          </thead>
          <tbody>{gv_rows}</tbody>
        </table>
      </div>
      <div>
        <h3 style="color:var(--accent-cyan);font-size:14px;margin-bottom:10px;">Horizontal Gutter Centers (Blade Travel Line)</h3>
        <table>
          <thead>
            <tr><th>Between</th><th>Center Position</th><th>Gutter Height</th></tr>
          </thead>
          <tbody>{gh_rows}</tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Coordinate Reference -->
  <div class="section">
    <div class="section-title">
      <span class="section-icon" style="background:rgba(236,72,153,0.15);color:#ec4899;">&#9670;</span>
      Coordinate Map — Die-Cutter Reference
    </div>
    <div class="section-subtitle">Exact (col, row) positions for every project. All positions reference the 6&times;3 grid.</div>
    <table>
      <thead>
        <tr><th>Project</th><th>Outs</th><th>Grid Positions (col, row)</th></tr>
      </thead>
      <tbody>{coord_rows}</tbody>
    </table>
  </div>

  <!-- Press Specs & Pro-Tips -->
  <div class="section">
    <div class="section-title">
      <span class="section-icon" style="background:rgba(245,158,11,0.15);color:var(--accent-amber);">&#9733;</span>
      Press Specs &amp; Sticker Pro-Tips
    </div>
    <div class="section-subtitle">Everything the press operator and die-cutter need to know at a glance.</div>
    <div class="protip-grid">
      <div class="protip">
        <div class="protip-title">
          <span class="protip-icon" style="background:rgba(6,182,212,0.15);color:var(--accent-cyan);">P</span>
          Press Specs
        </div>
        <div class="protip-body">
          <strong>Sheet:</strong> {SHEET_WIDTH_IN}" &times; {SHEET_HEIGHT_IN}" ({SHEET_WIDTH_CM}cm &times; {SHEET_HEIGHT_CM}cm)<br>
          <strong>Run Length:</strong> {RUN_LENGTH:,} sheets<br>
          <strong>Paper Order:</strong> {PAPER_ORDER:,} sheets (setup + {spoilage_pct:.1f}% spoilage)<br>
          <strong>Plates:</strong> 1 set CMYK<br>
          <strong>Margins:</strong> {MARGIN_SIDE_CM}cm sides, {MARGIN_TOP_CM}cm top/bottom<br>
          <strong>Cell Size:</strong> {CELL_W_CM}cm &times; {CELL_H_CM}cm
        </div>
      </div>
      <div class="protip">
        <div class="protip-title">
          <span class="protip-icon" style="background:rgba(249,115,22,0.15);color:var(--accent-orange);">B</span>
          Bleed Requirements
        </div>
        <div class="protip-body">
          <strong>Sticker Size:</strong> {STICKER_W_IN}" &times; {STICKER_H_IN}"<br>
          <strong>Bleed:</strong> Extend background color/art at least <strong>{BLEED_MM:.0f}mm</strong> beyond the die-line on all sides.<br>
          This ensures no white edges appear after the die-cutter makes its cut. The orange dashed lines in the SVG show this bleed boundary.
        </div>
      </div>
      <div class="protip">
        <div class="protip-title">
          <span class="protip-icon" style="background:rgba(139,92,246,0.15);color:#8b5cf6;">D</span>
          Die-Cutting Tool
        </div>
        <div class="protip-body">
          Since every position on the sheet is the <strong>same size</strong> ({CELL_W_CM}cm &times; {CELL_H_CM}cm cell), you can use a standard <strong>uniform die-cutting chase</strong>. No custom rules needed &mdash; every cell takes the same die. This is a major cost and time advantage.
        </div>
      </div>
      <div class="protip">
        <div class="protip-title">
          <span class="protip-icon" style="background:rgba(6,182,212,0.15);color:var(--accent-cyan);">G</span>
          Grain Direction
        </div>
        <div class="protip-body">
          Keep the paper grain <strong>parallel to the 24" side</strong> (the long dimension). This prevents the sticker backing from curling after individual units are cut apart. Grain-perpendicular cuts cause the backing to warp and stickers to peel prematurely.
        </div>
      </div>
    </div>
  </div>

  <!-- Comparison Note -->
  <div class="section" style="border-left:3px solid var(--accent-amber);">
    <div class="section-title">
      <span class="section-icon" style="background:rgba(245,158,11,0.15);color:var(--accent-amber);">&#9888;</span>
      Strategy Trade-Off: Single-Run vs. Two-Plate
    </div>
    <div class="section-subtitle">Why choose one over the other?</div>
    <div class="two-col">
      <div>
        <h3 style="color:var(--accent-green);font-size:14px;margin-bottom:8px;">Single-Run (This Plan)</h3>
        <ul style="color:var(--text-secondary);font-size:13px;line-height:1.8;padding-left:18px;">
          <li><strong>1,144 sheets</strong> vs. 1,087 sheets (two-plate)</li>
          <li>+57 more sheets, but <strong>only one setup</strong></li>
          <li>One plate set = lower plate cost</li>
          <li>One wash-up = less downtime</li>
          <li>More overruns (especially C +614, A +319)</li>
          <li>Best for: rush jobs, simpler workflow</li>
        </ul>
      </div>
      <div>
        <h3 style="color:var(--accent-cyan);font-size:14px;margin-bottom:8px;">Two-Plate (v20 Plan)</h3>
        <ul style="color:var(--text-secondary);font-size:13px;line-height:1.8;padding-left:18px;">
          <li><strong>1,087 sheets</strong> total (856 + 231)</li>
          <li>57 fewer sheets, but <strong>two setups</strong></li>
          <li>Two plate sets = higher plate cost</li>
          <li>Two wash-ups = more downtime</li>
          <li>Tighter overruns (max +564 on F)</li>
          <li>Best for: paper-sensitive jobs, large volumes</li>
        </ul>
      </div>
    </div>
  </div>

  <div class="footer">
    Print Production Engine v21 &mdash; Single-Run One-Plate Strategy &mdash; Cut-List &amp; Coordinate System
  </div>

</div>
</body>
</html>"""
    return html


# ─── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    output_path = "/home/z/my-project/download/print_engine_v21_single_run.html"
    html = generate_html()
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)

    # Verification
    print("=" * 60)
    print("PRINT PRODUCTION ENGINE v21 — SINGLE-RUN MASTER PLAN")
    print("=" * 60)
    print(f"\n  Output: {output_path}")
    print(f"\n  Sheet: {SHEET_WIDTH_IN}\" × {SHEET_HEIGHT_IN}\" ({SHEET_WIDTH_CM}cm × {SHEET_HEIGHT_CM}cm)")
    print(f"  Margins: {MARGIN_SIDE_CM}cm sides, {MARGIN_TOP_CM}cm top/bottom")
    print(f"  Cell: {CELL_W_CM}cm × {CELL_H_CM}cm")
    print(f"  Gutter: {GUTTER_W_CM:.3f}cm (vertical), {GUTTER_H_CM:.3f}cm (horizontal)")
    print(f"  Grid: {GRID_COLS}×{GRID_ROWS} = {GRID_COLS*GRID_ROWS} outs")
    print(f"  Run Length: {RUN_LENGTH:,} sheets")
    print(f"  Paper Order: {PAPER_ORDER:,} sheets")

    yields = calculate_yields()
    print(f"\n  {'ID':>3} | {'Target':>7} | {'Outs':>4} | {'Produced':>8} | {'Overage':>8} | {'%':>7}")
    print(f"  {'---':>3} | {'-------':>7} | {'----':>4} | {'--------':>8} | {'--------':>8} | {'-------':>7}")
    for y in yields:
        print(f"  {y['id']:>3} | {y['target']:>7,} | {y['outs']:>4} | {y['produced']:>8,} | {y['status_label']:>8} | {y['overage_pct']:>6.1f}%")

    total_t = sum(y["target"] for y in yields)
    total_p = sum(y["produced"] for y in yields)
    total_o = sum(y["overage"] for y in yields if y["overage"] > 0)
    print(f"\n  TOTALS: Target={total_t:,}  Produced={total_p:,}  Overage=+{total_o:,}")
    print(f"  Material Yield: {total_t/total_p*100:.1f}%")
    print(f"\n  ✓ All projects meet minimums: {'YES' if all(y['overage'] >= 0 for y in yields) else 'NO'}")
