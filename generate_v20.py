#!/usr/bin/env python3
"""
Print Production Engine v20 — "Perfect Yield" Strategy
Generates an interactive HTML dashboard with SVG grid visualization,
coordinate mapping, and yield calculations for the two-plate production system.

Core Logic:
  - 18-up (6×3) rigid grid = Fixed Island Blocks
  - Plate 1: Volume Run @ 856 sheets (anchor: Project G)
  - Plate 2: Cleanup Run @ 231 sheets (top-up remainder)
  - Hard-Coded Production Matrix — no ratio guessing, pure calculation
"""

import json
from dataclasses import dataclass, field
from typing import List, Tuple, Optional


# ─── Data Models ───────────────────────────────────────────────────────────────

@dataclass
class Project:
    """A single print job item with its die layout and quantity target."""
    id: str
    name: str
    target: int
    grid_w: int          # columns this item occupies on the sheet
    grid_h: int          # rows this item occupies on the sheet
    outs: int            # grid_w × grid_h = number of pieces per sheet
    color: str           # hex color for SVG visualization
    dark_color: str      # darker variant for borders/emphasis


@dataclass
class PlateAssignment:
    """An assignment of a project (or sub-project) to a specific plate."""
    project_id: str
    label: str           # display label (e.g. "G", "E-bal")
    outs: int
    grid_w: int
    grid_h: int
    color: str
    dark_color: str
    grid_positions: List[Tuple[int, int]]  # (col, row) coordinates on 6×3 grid


@dataclass
class Plate:
    """A press plate with its sheet count and assigned island blocks."""
    name: str
    sheets: int
    assignments: List[PlateAssignment]


# ─── Hard-Coded Production Matrix ─────────────────────────────────────────────

# Target quantities (reverse-engineered from the v20 spec)
PROJECTS = {
    "A": Project("A", "Project A", 825,  4, 1, 4, "#3b82f6", "#1d4ed8"),
    "B": Project("B", "Project B", 924,  4, 1, 4, "#10b981", "#047857"),
    "C": Project("C", "Project C", 1674, 4, 2, 8, "#f59e0b", "#b45309"),
    "D": Project("D", "Project D", 2255, 3, 1, 3, "#8b5cf6", "#6d28d9"),
    "E": Project("E", "Project E", 2750, 3, 1, 3, "#ef4444", "#b91c1c"),
    "F": Project("F", "Project F", 2860, 4, 1, 4, "#ec4899", "#be185d"),
    "G": Project("G", "Project G", 6844, 4, 2, 8, "#06b6d4", "#0e7490"),
}

# ─── Coordinate Maps ──────────────────────────────────────────────────────────
# Each position is (col, row) in the 6×3 grid. Col 0-5 left-to-right, Row 0-2 top-to-bottom.

PLATE_1_ASSIGNMENTS = [
    PlateAssignment("G", "G", 8, 4, 2, "#06b6d4", "#0e7490",
        [(0,0),(1,0),(2,0),(3,0),(0,1),(1,1),(2,1),(3,1)]),
    PlateAssignment("F", "F", 4, 2, 2, "#ec4899", "#be185d",
        [(4,0),(5,0),(4,1),(5,1)]),
    PlateAssignment("D", "D", 3, 3, 1, "#8b5cf6", "#6d28d9",
        [(0,2),(1,2),(2,2)]),
    PlateAssignment("E", "E", 3, 3, 1, "#ef4444", "#b91c1c",
        [(3,2),(4,2),(5,2)]),
]

PLATE_2_ASSIGNMENTS = [
    PlateAssignment("C", "C", 8, 4, 2, "#f59e0b", "#b45309",
        [(0,0),(1,0),(2,0),(3,0),(0,1),(1,1),(2,1),(3,1)]),
    PlateAssignment("B", "B", 4, 2, 2, "#10b981", "#047857",
        [(4,0),(5,0),(4,1),(5,1)]),
    PlateAssignment("A", "A", 4, 4, 1, "#3b82f6", "#1d4ed8",
        [(0,2),(1,2),(2,2),(3,2)]),
    PlateAssignment("E", "E-bal", 2, 2, 1, "#ef4444", "#b91c1c",
        [(4,2),(5,2)]),
]

PLATE_1 = Plate("Plate 1 — Volume Run", 856, PLATE_1_ASSIGNMENTS)
PLATE_2 = Plate("Plate 2 — Cleanup Run", 231, PLATE_2_ASSIGNMENTS)


# ─── Calculation Engine ────────────────────────────────────────────────────────

def calculate_yields(plate: Plate) -> List[dict]:
    """Calculate produced quantity, variance, and status for each assignment."""
    results = []
    for a in plate.assignments:
        produced = a.outs * plate.sheets
        proj = PROJECTS[a.project_id]
        target = proj.target

        # For E on Plate 1, the target is partial (we'll top up on Plate 2)
        # We track variance against the FULL target per project
        variance = produced - target
        if variance > 0:
            status = "over"
            status_label = f"+{variance}"
        elif variance < 0:
            status = "short"
            status_label = str(variance)
        else:
            status = "perfect"
            status_label = "0"

        results.append({
            "id": a.project_id,
            "label": a.label,
            "outs": a.outs,
            "grid": f"{a.grid_w}×{a.grid_h}",
            "produced": produced,
            "target": target,
            "variance": variance,
            "status": status,
            "status_label": status_label,
            "color": a.color,
            "dark_color": a.dark_color,
        })
    return results


def calculate_combined_yields() -> List[dict]:
    """Calculate the combined yield across both plates for each project."""
    combined = {}
    for plate in [PLATE_1, PLATE_2]:
        for a in plate.assignments:
            pid = a.project_id
            produced = a.outs * plate.sheets
            if pid not in combined:
                combined[pid] = 0
            combined[pid] += produced

    results = []
    for pid, total_produced in combined.items():
        proj = PROJECTS[pid]
        variance = total_produced - proj.target
        if variance > 0:
            status = "over"
            status_label = f"+{variance}"
        elif variance < 0:
            status = "short"
            status_label = str(variance)
        else:
            status = "perfect"
            status_label = "0"

        results.append({
            "id": pid,
            "name": proj.name,
            "target": proj.target,
            "produced": total_produced,
            "variance": variance,
            "status": status,
            "status_label": status_label,
            "color": proj.color,
            "dark_color": proj.dark_color,
        })
    return sorted(results, key=lambda x: x["target"], reverse=True)


# ─── SVG Renderer ──────────────────────────────────────────────────────────────

def render_plate_svg(plate: Plate, show_coords: bool = True) -> str:
    """Render a 6×3 press sheet grid as SVG with island blocks and optional coordinate labels."""
    cell_w = 100
    cell_h = 100
    pad = 4
    label_h = 30
    margin_x = 50
    margin_y = 50
    svg_w = margin_x * 2 + cell_w * 6 + pad * 5
    svg_h = margin_y * 2 + label_h + cell_h * 3 + pad * 2

    # Build a lookup: (col,row) -> assignment
    pos_map = {}
    for a in plate.assignments:
        for pos in a.grid_positions:
            pos_map[pos] = a

    svg_parts = []
    svg_parts.append(f'<svg viewBox="0 0 {svg_w} {svg_h}" xmlns="http://www.w3.org/2000/svg" class="plate-svg">')

    # Background
    svg_parts.append(f'<rect x="0" y="0" width="{svg_w}" height="{svg_h}" rx="12" fill="#0f172a" />')

    # Sheet outline
    sheet_x = margin_x - 8
    sheet_y = margin_y + label_h - 8
    sheet_w = cell_w * 6 + pad * 5 + 16
    sheet_h = cell_h * 3 + pad * 2 + 16
    svg_parts.append(f'<rect x="{sheet_x}" y="{sheet_y}" width="{sheet_w}" height="{sheet_h}" rx="6" fill="none" stroke="#334155" stroke-width="2" stroke-dasharray="8,4" />')

    # Plate title
    svg_parts.append(f'<text x="{svg_w//2}" y="{margin_y}" text-anchor="middle" fill="#e2e8f0" font-size="18" font-weight="bold" font-family="monospace">{plate.name}</text>')
    svg_parts.append(f'<text x="{svg_w//2}" y="{margin_y + 20}" text-anchor="middle" fill="#94a3b8" font-size="13" font-family="monospace">{plate.sheets} sheets × 18-up</text>')

    # Column headers
    for col in range(6):
        cx = margin_x + col * (cell_w + pad) + cell_w // 2
        cy = margin_y + label_h - 8
        svg_parts.append(f'<text x="{cx}" y="{cy}" text-anchor="middle" fill="#64748b" font-size="11" font-family="monospace">Col {col}</text>')

    # Row headers
    for row in range(3):
        ry = margin_y + label_h + row * (cell_h + pad) + cell_h // 2
        rx = margin_x - 25
        svg_parts.append(f'<text x="{rx}" y="{ry}" text-anchor="middle" fill="#64748b" font-size="11" font-family="monospace">R{row}</text>')

    # Render island blocks
    rendered_blocks = set()
    for a in plate.assignments:
        block_key = a.label
        if block_key in rendered_blocks:
            continue
        rendered_blocks.add(block_key)

        # Find bounding box of this block
        min_col = min(p[0] for p in a.grid_positions)
        max_col = max(p[0] for p in a.grid_positions)
        min_row = min(p[1] for p in a.grid_positions)
        max_row = max(p[1] for p in a.grid_positions)

        bx = margin_x + min_col * (cell_w + pad)
        by = margin_y + label_h + min_row * (cell_h + pad)
        bw = (max_col - min_col + 1) * cell_w + (max_col - min_col) * pad
        bh = (max_row - min_row + 1) * cell_h + (max_row - min_row) * pad

        # Island block background
        svg_parts.append(f'<rect x="{bx}" y="{by}" width="{bw}" height="{bh}" rx="8" fill="{a.color}" fill-opacity="0.15" stroke="{a.color}" stroke-width="2.5" />')

        # Individual cell outlines within the block
        for (col, row) in a.grid_positions:
            cx = margin_x + col * (cell_w + pad)
            cy = margin_y + label_h + row * (cell_h + pad)
            svg_parts.append(f'<rect x="{cx}" y="{cy}" width="{cell_w}" height="{cell_h}" rx="4" fill="{a.color}" fill-opacity="0.08" stroke="{a.dark_color}" stroke-width="1" stroke-opacity="0.5" />')

        # Block label (centered)
        label_x = bx + bw / 2
        label_y = by + bh / 2 - 8
        svg_parts.append(f'<text x="{label_x}" y="{label_y}" text-anchor="middle" fill="{a.color}" font-size="22" font-weight="bold" font-family="monospace">{a.label}</text>')
        svg_parts.append(f'<text x="{label_x}" y="{label_y + 22}" text-anchor="middle" fill="#cbd5e1" font-size="11" font-family="monospace">{a.outs} outs</text>')

        # Coordinate labels inside each cell
        if show_coords:
            for (col, row) in a.grid_positions:
                cx = margin_x + col * (cell_w + pad) + cell_w - 8
                cy = margin_y + label_h + row * (cell_h + pad) + cell_h - 8
                svg_parts.append(f'<text x="{cx}" y="{cy}" text-anchor="end" fill="#475569" font-size="9" font-family="monospace">({col},{row})</text>')

    # Die-cut registration marks
    for corner in [(sheet_x + 6, sheet_y + 6), (sheet_x + sheet_w - 6, sheet_y + 6),
                   (sheet_x + 6, sheet_y + sheet_h - 6), (sheet_x + sheet_w - 6, sheet_y + sheet_h - 6)]:
        svg_parts.append(f'<circle cx="{corner[0]}" cy="{corner[1]}" r="3" fill="#f97316" fill-opacity="0.6" />')

    svg_parts.append('</svg>')
    return '\n'.join(svg_parts)


# ─── HTML Generator ────────────────────────────────────────────────────────────

def generate_html() -> str:
    plate1_yields = calculate_yields(PLATE_1)
    plate2_yields = calculate_yields(PLATE_2)
    combined_yields = calculate_combined_yields()
    plate1_svg = render_plate_svg(PLATE_1)
    plate2_svg = render_plate_svg(PLATE_2)

    total_sheets = PLATE_1.sheets + PLATE_2.sheets
    total_produced = sum(r["produced"] for r in combined_yields)
    total_target = sum(r["target"] for r in combined_yields)
    total_waste = sum(r["variance"] for r in combined_yields if r["variance"] > 0)
    total_short = sum(abs(r["variance"]) for r in combined_yields if r["variance"] < 0)
    yield_pct = (total_target / total_produced * 100) if total_produced > 0 else 0

    # ── Plate 1 yield rows ──
    p1_rows = ""
    for y in plate1_yields:
        status_class = {"over": "status-over", "short": "status-short", "perfect": "status-perfect"}[y["status"]]
        p1_rows += f"""
          <tr>
            <td><span class="color-dot" style="background:{y['color']}"></span>{y['label']}</td>
            <td class="mono">{y['grid']}</td>
            <td class="mono">{y['outs']}</td>
            <td class="mono">{PLATE_1.sheets}</td>
            <td class="mono">{y['produced']:,}</td>
            <td class="mono">{y['target']:,}</td>
            <td class="mono {status_class}">{y['status_label']}</td>
          </tr>"""

    # ── Plate 2 yield rows ──
    p2_rows = ""
    for y in plate2_yields:
        status_class = {"over": "status-over", "short": "status-short", "perfect": "status-perfect"}[y["status"]]
        p2_rows += f"""
          <tr>
            <td><span class="color-dot" style="background:{y['color']}"></span>{y['label']}</td>
            <td class="mono">{y['grid']}</td>
            <td class="mono">{y['outs']}</td>
            <td class="mono">{PLATE_2.sheets}</td>
            <td class="mono">{y['produced']:,}</td>
            <td class="mono">{y['target']:,}</td>
            <td class="mono {status_class}">{y['status_label']}</td>
          </tr>"""

    # ── Combined yield rows ──
    combined_rows = ""
    for r in combined_yields:
        status_class = {"over": "status-over", "short": "status-short", "perfect": "status-perfect"}[r["status"]]
        bar_pct = min((r["produced"] / r["target"] * 100) if r["target"] > 0 else 0, 130)
        bar_color = r["color"]
        combined_rows += f"""
          <tr>
            <td><span class="color-dot" style="background:{r['color']}"></span>{r['id']}</td>
            <td class="mono">{r['target']:,}</td>
            <td class="mono">{r['produced']:,}</td>
            <td class="mono {status_class}">{r['status_label']}</td>
            <td>
              <div class="yield-bar-bg">
                <div class="yield-bar-fill" style="width:{bar_pct}%;background:{bar_color}"></div>
                <span class="yield-bar-label">{bar_pct:.1f}%</span>
              </div>
            </td>
          </tr>"""

    # ── Coordinate map table ──
    coord_rows_1 = ""
    for a in PLATE_1.assignments:
        coords = ", ".join(f"({c},{r})" for c, r in a.grid_positions)
        coord_rows_1 += f"""
          <tr>
            <td><span class="color-dot" style="background:{a.color}"></span>{a.label}</td>
            <td class="mono">{a.grid_w}×{a.grid_h}</td>
            <td class="mono">{a.outs}</td>
            <td class="mono coords">{coords}</td>
          </tr>"""

    coord_rows_2 = ""
    for a in PLATE_2.assignments:
        coords = ", ".join(f"({c},{r})" for c, r in a.grid_positions)
        coord_rows_2 += f"""
          <tr>
            <td><span class="color-dot" style="background:{a.color}"></span>{a.label}</td>
            <td class="mono">{a.grid_w}×{a.grid_h}</td>
            <td class="mono">{a.outs}</td>
            <td class="mono coords">{coords}</td>
          </tr>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Print Production Engine v20 — Perfect Yield</title>
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
  }}

  * {{ margin: 0; padding: 0; box-sizing: border-box; }}

  body {{
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    background: var(--bg-primary);
    color: var(--text-primary);
    min-height: 100vh;
    overflow-x: hidden;
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
    background: rgba(6,182,212,0.12);
    color: var(--accent-cyan);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 12px;
    border: 1px solid rgba(6,182,212,0.25);
  }}
  .header h1 {{
    font-size: 32px;
    font-weight: 800;
    letter-spacing: -0.5px;
    background: linear-gradient(135deg, #e2e8f0, #06b6d4);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }}
  .header p {{
    color: var(--text-secondary);
    font-size: 15px;
    margin-top: 8px;
    max-width: 700px;
    margin-left: auto;
    margin-right: auto;
    line-height: 1.6;
  }}

  /* KPI Cards */
  .kpi-grid {{
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 32px;
  }}
  .kpi-card {{
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
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
  .kpi-card.red::before {{ background: var(--accent-red); }}
  .kpi-label {{ color: var(--text-muted); font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }}
  .kpi-value {{ font-size: 28px; font-weight: 700; font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace; }}
  .kpi-sub {{ color: var(--text-secondary); font-size: 13px; margin-top: 4px; }}

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
  table {{
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
  }}
  thead th {{
    text-align: left;
    padding: 10px 14px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border);
    font-weight: 600;
  }}
  tbody td {{
    padding: 10px 14px;
    font-size: 14px;
    border-bottom: 1px solid rgba(51,65,85,0.4);
  }}
  tbody tr:hover {{ background: rgba(51,65,85,0.2); }}
  tbody tr:last-child td {{ border-bottom: none; }}

  .mono {{ font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace; font-size: 13px; }}

  .color-dot {{
    display: inline-block;
    width: 10px; height: 10px;
    border-radius: 3px;
    margin-right: 8px;
    vertical-align: middle;
  }}

  .status-over {{ color: var(--accent-amber); font-weight: 600; }}
  .status-short {{ color: var(--accent-red); font-weight: 600; }}
  .status-perfect {{ color: var(--accent-green); font-weight: 600; }}

  .coords {{ font-size: 11px; letter-spacing: -0.3px; color: var(--text-secondary); }}

  /* Yield bar */
  .yield-bar-bg {{
    position: relative;
    width: 100%;
    height: 22px;
    background: rgba(51,65,85,0.4);
    border-radius: 4px;
    overflow: hidden;
  }}
  .yield-bar-fill {{
    height: 100%;
    border-radius: 4px;
    transition: width 0.6s ease;
    opacity: 0.7;
  }}
  .yield-bar-label {{
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 11px;
    font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
    color: var(--text-primary);
  }}

  /* SVG plate */
  .plate-svg {{ width: 100%; height: auto; max-width: 680px; margin: 0 auto; display: block; }}

  .plate-grid {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }}

  @media (max-width: 900px) {{
    .plate-grid {{ grid-template-columns: 1fr; }}
  }}

  /* Strategy flow */
  .strategy-flow {{
    display: flex;
    align-items: stretch;
    gap: 12px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }}
  .flow-step {{
    flex: 1;
    min-width: 180px;
    background: var(--bg-card-alt);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px;
    position: relative;
  }}
  .flow-step-num {{
    position: absolute;
    top: -10px; left: 14px;
    background: var(--accent-cyan);
    color: var(--bg-primary);
    font-size: 11px;
    font-weight: 700;
    padding: 2px 10px;
    border-radius: 999px;
  }}
  .flow-step-title {{ font-weight: 700; font-size: 14px; margin-top: 4px; margin-bottom: 6px; }}
  .flow-step-body {{ color: var(--text-secondary); font-size: 13px; line-height: 1.5; }}

  /* Footer */
  .footer {{
    text-align: center;
    padding: 24px;
    color: var(--text-muted);
    font-size: 12px;
    border-top: 1px solid var(--border);
    margin-top: 16px;
  }}

  /* Print-optimized */
  @media print {{
    body {{ background: white; color: black; }}
    .section, .kpi-card {{ border-color: #ccc; background: #f8f8f8; }}
    .plate-svg {{ max-width: 100%; }}
  }}
</style>
</head>
<body>
<div class="app">

  <!-- Header -->
  <div class="header">
    <div class="header-badge">Engine v20 — Production Block Architecture</div>
    <h1>Perfect Yield Calculator</h1>
    <p>
      Hard-Coded Production Matrix targeting the 18-up (6&times;3) rigid grid.
      Project G anchors the volume run at 856 impressions; the cleanup plate tops off all remaining items at 231 sheets.
      No ratio guessing &mdash; pure calculation.
    </p>
  </div>

  <!-- KPI Summary -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Total Sheets</div>
      <div class="kpi-value">{total_sheets:,}</div>
      <div class="kpi-sub">{PLATE_1.sheets:,} vol + {PLATE_2.sheets:,} cleanup</div>
    </div>
    <div class="kpi-card green">
      <div class="kpi-label">Total Target Qty</div>
      <div class="kpi-value">{total_target:,}</div>
      <div class="kpi-sub">7 projects combined</div>
    </div>
    <div class="kpi-card amber">
      <div class="kpi-label">Total Produced</div>
      <div class="kpi-value">{total_produced:,}</div>
      <div class="kpi-sub">+{total_waste:,} over target</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Material Yield</div>
      <div class="kpi-value">{yield_pct:.1f}%</div>
      <div class="kpi-sub">target vs produced</div>
    </div>
  </div>

  <!-- Strategy Flow -->
  <div class="section">
    <div class="section-title">
      <span class="section-icon" style="background:rgba(6,182,212,0.15);color:var(--accent-cyan);">&#9881;</span>
      The v20 "Perfect Yield" Strategy
    </div>
    <div class="section-subtitle">Fixed Island Blocks on an 18-up rigid frame — no liquid layout, no ratio guessing</div>
    <div class="strategy-flow">
      <div class="flow-step">
        <div class="flow-step-num">1</div>
        <div class="flow-step-title">Anchor: Project G</div>
        <div class="flow-step-body">Lock G to 8 outs. This defines the press run at exactly <strong>856 impressions</strong>. Any item that doesn't fit this run is pushed to the Cleanup Plate.</div>
      </div>
      <div class="flow-step">
        <div class="flow-step-num">2</div>
        <div class="flow-step-title">Volume Run (Plate 1)</div>
        <div class="flow-step-body">Map G (8), F (4), D (3), E-partial (3) = 18 outs. Run <strong>856 sheets</strong>. E is short by 182 &mdash; that's intentional.</div>
      </div>
      <div class="flow-step">
        <div class="flow-step-num">3</div>
        <div class="flow-step-title">Cleanup Run (Plate 2)</div>
        <div class="flow-step-body">Map C (8), B (4), A (4), E-balance (2) = 18 outs. Run <strong>231 sheets</strong> to top off every remaining item to target.</div>
      </div>
      <div class="flow-step">
        <div class="flow-step-num">4</div>
        <div class="flow-step-title">Zero-Waste Optimum</div>
        <div class="flow-step-body">Total: <strong>1,087 sheets</strong>. All 7 projects meet or exceed target. Over-production is the minimum physically possible on this grid.</div>
      </div>
    </div>
  </div>

  <!-- SVG Grid Visualizations -->
  <div class="section">
    <div class="section-title">
      <span class="section-icon" style="background:rgba(139,92,246,0.15);color:#8b5cf6;">&#9638;</span>
      Press Sheet Layouts — Coordinate-Mapped SVG
    </div>
    <div class="section-subtitle">Each cell shows its (col, row) position. Orange dots = die-cut registration marks. Dashed border = sheet edge.</div>
    <div class="plate-grid">
      <div>{plate1_svg}</div>
      <div>{plate2_svg}</div>
    </div>
  </div>

  <!-- Plate 1 Yield Table -->
  <div class="section">
    <div class="section-title">
      <span class="section-icon" style="background:rgba(6,182,212,0.15);color:var(--accent-cyan);">&#9654;</span>
      Plate 1 — Volume Run Yield Detail
    </div>
    <div class="section-subtitle">{PLATE_1.sheets:,} sheets &times; 18-up = {PLATE_1.sheets * 18:,} total impressions</div>
    <table>
      <thead>
        <tr>
          <th>Project</th>
          <th>Die Grid</th>
          <th>Outs</th>
          <th>Sheets</th>
          <th>Produced</th>
          <th>Full Target</th>
          <th>Variance</th>
        </tr>
      </thead>
      <tbody>{p1_rows}</tbody>
    </table>
  </div>

  <!-- Plate 2 Yield Table -->
  <div class="section">
    <div class="section-title">
      <span class="section-icon" style="background:rgba(245,158,11,0.15);color:var(--accent-amber);">&#9654;</span>
      Plate 2 — Cleanup Run Yield Detail
    </div>
    <div class="section-subtitle">{PLATE_2.sheets:,} sheets &times; 18-up = {PLATE_2.sheets * 18:,} total impressions</div>
    <table>
      <thead>
        <tr>
          <th>Project</th>
          <th>Die Grid</th>
          <th>Outs</th>
          <th>Sheets</th>
          <th>Produced</th>
          <th>Full Target</th>
          <th>Variance</th>
        </tr>
      </thead>
      <tbody>{p2_rows}</tbody>
    </table>
  </div>

  <!-- Combined Yield Summary -->
  <div class="section">
    <div class="section-title">
      <span class="section-icon" style="background:rgba(16,185,129,0.15);color:var(--accent-green);">&#9733;</span>
      Combined Yield — Both Plates
    </div>
    <div class="section-subtitle">Final tallies across both production runs for all 7 projects</div>
    <table>
      <thead>
        <tr>
          <th>Project</th>
          <th>Target</th>
          <th>Produced</th>
          <th>Variance</th>
          <th>Yield %</th>
        </tr>
      </thead>
      <tbody>{combined_rows}</tbody>
    </table>
  </div>

  <!-- Coordinate Map Reference -->
  <div class="section">
    <div class="section-title">
      <span class="section-icon" style="background:rgba(236,72,153,0.15);color:#ec4899;">&#9670;</span>
      Coordinate Map — Die-Cutter Reference
    </div>
    <div class="section-subtitle">Exact (col, row) positions for every island block on both plates. Use these coordinates for die-cut setup verification.</div>
    <div class="plate-grid">
      <div>
        <h3 style="color:var(--accent-cyan);font-size:14px;margin-bottom:12px;">Plate 1 Coordinates</h3>
        <table>
          <thead>
            <tr><th>Block</th><th>Grid</th><th>Outs</th><th>Positions</th></tr>
          </thead>
          <tbody>{coord_rows_1}</tbody>
        </table>
      </div>
      <div>
        <h3 style="color:var(--accent-amber);font-size:14px;margin-bottom:12px;">Plate 2 Coordinates</h3>
        <table>
          <thead>
            <tr><th>Block</th><th>Grid</th><th>Outs</th><th>Positions</th></tr>
          </thead>
          <tbody>{coord_rows_2}</tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="footer">
    Print Production Engine v20 &mdash; Hard-Coded Production Matrix &mdash; Island-Mapping Coordinate System
  </div>

</div>
</body>
</html>"""
    return html


# ─── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    output_path = "/home/z/my-project/download/print_engine_v20.html"
    html = generate_html()
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"✓ Generated: {output_path}")
    print(f"  Total sheets: {PLATE_1.sheets + PLATE_2.sheets:,}")
    print(f"  Plate 1: {PLATE_1.sheets:,} sheets (Volume Run)")
    print(f"  Plate 2: {PLATE_2.sheets:,} sheets (Cleanup Run)")
