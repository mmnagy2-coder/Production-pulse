/**
 * PDF export via browser print API.
 * Opens a styled print window (Lora serif, red accent, paper-white) and
 * triggers the system print dialog. Users can choose "Save as PDF" from there.
 * No external service required.
 */

export interface CallSheetData {
  label: string;
  date?: string | null;
  dayNumber?: number;
  crewCallTime: string;
  generalCallTime?: string | null;
  scenes: Array<{
    sceneNumber: number | string;
    heading: string;
    location: string;
    intExt: string;
    dayNight: string;
    durationPages?: number | null;
    characters: string[];
  }>;
  castCalls: Array<{
    character: string;
    callTime: string;
    makeupTime?: string | null;
    onSetTime: string;
  }>;
}

export interface SceneData {
  sceneNumber: number | string;
  heading: string;
  location: string;
  intExt: string;
  dayNight: string;
  durationPages?: number | null;
  characters: string[];
  props: string[];
  costumes: string[];
  summary?: string;
}

const PRINT_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Lora', Georgia, serif;
    background: #fff;
    color: #0f0f0f;
    font-size: 10pt;
    line-height: 1.4;
  }

  @page {
    size: A4;
    margin: 18mm 15mm 18mm 15mm;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }

  /* ── Layout ── */
  .page { max-width: 760px; margin: 0 auto; padding: 24px; }

  /* ── Header ── */
  .header {
    border-bottom: 2.5px solid #c41230;
    padding-bottom: 10px;
    margin-bottom: 16px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .header-left {}
  .header-title {
    font-size: 20pt;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #0f0f0f;
  }
  .header-subtitle {
    font-size: 9pt;
    color: #555;
    margin-top: 2px;
    font-family: 'IBM Plex Mono', monospace;
  }
  .header-badge {
    background: #c41230;
    color: #fff;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 8pt;
    font-weight: 500;
    padding: 3px 8px;
    border-radius: 2px;
    white-space: nowrap;
    margin-top: 4px;
  }

  /* ── Section headers ── */
  .section-label {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 7pt;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #888;
    margin-bottom: 6px;
    border-bottom: 1px solid #e5e5e5;
    padding-bottom: 3px;
  }

  /* ── Call times row ── */
  .call-times {
    display: flex;
    gap: 20px;
    padding: 8px 10px;
    background: #fafafa;
    border: 1px solid #e5e5e5;
    border-radius: 2px;
    margin-bottom: 14px;
    font-family: 'IBM Plex Mono', monospace;
  }
  .call-time-item {}
  .call-time-label { font-size: 7pt; color: #888; text-transform: uppercase; letter-spacing: 0.08em; }
  .call-time-value { font-size: 12pt; font-weight: 500; color: #0f0f0f; }

  /* ── Two-column grid ── */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 14px; }

  /* ── Scenes table ── */
  .scenes-section { margin-bottom: 14px; }
  .scene-row {
    padding: 7px 0;
    border-bottom: 1px solid #f0f0f0;
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }
  .scene-row:last-child { border-bottom: none; }
  .scene-num {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 8pt;
    color: #888;
    min-width: 22px;
    padding-top: 1px;
  }
  .scene-body { flex: 1; min-width: 0; }
  .scene-heading { font-weight: 600; font-size: 9.5pt; line-height: 1.3; }
  .scene-meta {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 7.5pt;
    color: #666;
    margin-top: 2px;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .scene-tag {
    background: #f3f4f6;
    padding: 0 4px;
    border-radius: 2px;
    font-size: 7pt;
  }
  .scene-chars { font-size: 7.5pt; color: #555; margin-top: 2px; }

  /* ── Cast calls table ── */
  .cast-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  .cast-table th {
    text-align: left;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 7pt;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #888;
    padding: 4px 6px 4px 0;
    border-bottom: 1px solid #e5e5e5;
    font-weight: 500;
  }
  .cast-table td {
    padding: 5px 6px 5px 0;
    border-bottom: 1px solid #f0f0f0;
    vertical-align: top;
  }
  .cast-table tr:last-child td { border-bottom: none; }
  .cast-table .mono {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 8pt;
  }
  .cast-table .on-set { color: #c41230; font-weight: 500; }

  /* ── Shot list breakdown table ── */
  .breakdown-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  .breakdown-table th {
    text-align: left;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 7pt;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #888;
    padding: 4px 8px 4px 0;
    border-bottom: 1.5px solid #e5e5e5;
    font-weight: 500;
  }
  .breakdown-table td {
    padding: 7px 8px 7px 0;
    border-bottom: 1px solid #f5f5f5;
    vertical-align: top;
  }
  .breakdown-table tr:last-child td { border-bottom: none; }
  .breakdown-table .scene-no {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 8pt;
    color: #888;
    width: 28px;
  }
  .breakdown-table .heading-cell { font-weight: 600; }
  .breakdown-table .tag-list { margin-top: 3px; display: flex; flex-wrap: wrap; gap: 3px; }
  .breakdown-table .tag {
    background: #f3f4f6;
    padding: 1px 5px;
    border-radius: 2px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 6.5pt;
    color: #555;
  }
  .breakdown-table .pages-col { font-family: 'IBM Plex Mono', monospace; font-size: 8pt; color: #888; width: 36px; text-align: right; padding-right: 0; }
  .breakdown-table .intExt-col { font-family: 'IBM Plex Mono', monospace; font-size: 7pt; width: 30px; }
  .breakdown-table .loc-col { font-size: 8pt; color: #444; }

  /* ── Footer ── */
  .footer {
    margin-top: 20px;
    padding-top: 8px;
    border-top: 1px solid #e5e5e5;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 7pt;
    color: #aaa;
    display: flex;
    justify-content: space-between;
  }

  /* ── Page break ── */
  .page-break { page-break-before: always; }
`;

function openPrintWindow(html: string, title: string): void {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    alert("Pop-up blocked. Please allow pop-ups for this site and try again.");
    return;
  }
  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
${html}
<script>
  // Auto-print after fonts load
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function() { window.print(); });
  } else {
    setTimeout(function() { window.print(); }, 800);
  }
<\/script>
</body>
</html>`);
  win.document.close();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function eh(s: string | number | null | undefined): string {
  return escapeHtml(String(s ?? ""));
}

/** Export a call sheet as a formatted PDF via browser print dialog */
export function printCallSheet(cs: CallSheetData, projectTitle?: string): void {
  const totalPages = cs.scenes.reduce((sum, s) => sum + (s.durationPages ?? 1), 0);
  const uniqueLocations = [...new Set(cs.scenes.map((s) => s.location).filter(Boolean))];

  const scenesHtml = cs.scenes
    .map(
      (scene) => `
    <div class="scene-row">
      <span class="scene-num">${eh(scene.sceneNumber)}.</span>
      <div class="scene-body">
        <div class="scene-heading">${eh(scene.heading)}</div>
        <div class="scene-meta">
          <span class="scene-tag">${eh(scene.intExt)}</span>
          <span class="scene-tag">${eh(scene.dayNight)}</span>
          <span>📍 ${eh(scene.location)}</span>
          ${scene.durationPages != null ? `<span>⏱ ${eh(scene.durationPages)}p</span>` : ""}
        </div>
        ${scene.characters.length > 0 ? `<div class="scene-chars">Cast: ${scene.characters.map(eh).join(", ")}</div>` : ""}
      </div>
    </div>`
    )
    .join("");

  const castRowsHtml =
    cs.castCalls.length === 0
      ? `<tr><td colspan="4" style="color:#888;padding:8px 0;font-style:italic;">No cast assigned to scenes.</td></tr>`
      : cs.castCalls
          .map(
            (c) => `
    <tr>
      <td class="mono">${eh(c.callTime)}</td>
      <td class="mono" style="color:#888;">${eh(c.makeupTime ?? "—")}</td>
      <td class="mono on-set">${eh(c.onSetTime)}</td>
      <td style="font-weight:500;">${eh(c.character)}</td>
    </tr>`
          )
          .join("");

  const html = `
<div class="page">
  <div class="header">
    <div class="header-left">
      <div class="header-title">Call Sheet</div>
      <div class="header-subtitle">${projectTitle ? eh(projectTitle) + " · " : ""}${eh(cs.label)}${cs.date ? " · " + eh(cs.date) : ""}</div>
    </div>
    <div class="header-badge">DAY ${cs.dayNumber ?? "—"}</div>
  </div>

  <!-- Call times -->
  <div class="call-times">
    <div class="call-time-item">
      <div class="call-time-label">Crew Call</div>
      <div class="call-time-value">${eh(cs.crewCallTime)}</div>
    </div>
    ${
      cs.generalCallTime
        ? `<div class="call-time-item">
      <div class="call-time-label">General Call</div>
      <div class="call-time-value">${eh(cs.generalCallTime)}</div>
    </div>`
        : ""
    }
    <div class="call-time-item">
      <div class="call-time-label">Scenes</div>
      <div class="call-time-value">${cs.scenes.length}</div>
    </div>
    <div class="call-time-item">
      <div class="call-time-label">Total Pages</div>
      <div class="call-time-value">${totalPages.toFixed(1)}p</div>
    </div>
    ${
      uniqueLocations.length > 0
        ? `<div class="call-time-item" style="flex:1;">
      <div class="call-time-label">Location(s)</div>
      <div class="call-time-value" style="font-size:9pt;margin-top:2px;">${uniqueLocations.map(eh).join(" · ")}</div>
    </div>`
        : ""
    }
  </div>

  <!-- Scenes -->
  <div class="scenes-section">
    <div class="section-label">Scenes</div>
    ${scenesHtml || `<p style="color:#888;font-style:italic;font-size:8.5pt;">No scenes scheduled.</p>`}
  </div>

  <!-- Cast calls -->
  <div>
    <div class="section-label">Cast Call Times</div>
    <table class="cast-table">
      <thead>
        <tr>
          <th>Call</th>
          <th>Makeup</th>
          <th>On Set</th>
          <th>Character</th>
        </tr>
      </thead>
      <tbody>
        ${castRowsHtml}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <span>Production Pulse · ${projectTitle ? eh(projectTitle) + " · " : ""}${eh(cs.label)}</span>
    <span>Printed ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
  </div>
</div>`;

  openPrintWindow(html, `Call Sheet — ${cs.label}`);
}

/** Export a shot list / scene breakdown as a formatted PDF via browser print dialog */
export function printShotList(scenes: SceneData[], projectTitle?: string): void {
  const totalPages = scenes.reduce((sum, s) => sum + (s.durationPages ?? 1), 0);

  const rowsHtml = scenes
    .map(
      (scene) => `
  <tr>
    <td class="scene-no">${eh(scene.sceneNumber)}.</td>
    <td>
      <div class="heading-cell">${eh(scene.heading)}</div>
      ${scene.summary ? `<div style="font-size:7.5pt;color:#666;margin-top:2px;line-height:1.4;">${eh(scene.summary)}</div>` : ""}
      ${
        scene.characters.length > 0 || scene.props.length > 0 || scene.costumes.length > 0
          ? `<div class="tag-list">
          ${scene.characters.map((c) => `<span class="tag" style="background:#fef2f2;color:#c41230;">${eh(c)}</span>`).join("")}
          ${scene.props.map((p) => `<span class="tag">${eh(p)}</span>`).join("")}
          ${scene.costumes.map((co) => `<span class="tag" style="background:#f0f9ff;color:#0369a1;">${eh(co)}</span>`).join("")}
        </div>`
          : ""
      }
    </td>
    <td class="intExt-col">${eh(scene.intExt)}<br/><span style="color:#888;">${eh(scene.dayNight)}</span></td>
    <td class="loc-col">${eh(scene.location)}</td>
    <td class="pages-col">${scene.durationPages != null ? eh(scene.durationPages) + "p" : "—"}</td>
  </tr>`
    )
    .join("");

  const html = `
<div class="page">
  <div class="header">
    <div class="header-left">
      <div class="header-title">Shot List &amp; Scene Breakdown</div>
      ${projectTitle ? `<div class="header-subtitle">${eh(projectTitle)}</div>` : ""}
    </div>
    <div style="text-align:right;">
      <div class="header-badge">${scenes.length} SCENE${scenes.length !== 1 ? "S" : ""}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:7pt;color:#888;margin-top:4px;">${totalPages.toFixed(1)} pages total</div>
    </div>
  </div>

  <!-- Legend -->
  <div style="display:flex;gap:12px;margin-bottom:12px;font-family:'IBM Plex Mono',monospace;font-size:7pt;color:#888;align-items:center;">
    <span style="display:flex;align-items:center;gap:4px;"><span style="display:inline-block;width:10px;height:10px;background:#fef2f2;border-radius:2px;"></span> Characters</span>
    <span style="display:flex;align-items:center;gap:4px;"><span style="display:inline-block;width:10px;height:10px;background:#f3f4f6;border-radius:2px;"></span> Props</span>
    <span style="display:flex;align-items:center;gap:4px;"><span style="display:inline-block;width:10px;height:10px;background:#f0f9ff;border-radius:2px;"></span> Costumes</span>
  </div>

  <table class="breakdown-table">
    <thead>
      <tr>
        <th style="width:28px;">#</th>
        <th>Scene</th>
        <th style="width:40px;">Int/Ext</th>
        <th>Location</th>
        <th style="width:36px;text-align:right;">Pages</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || `<tr><td colspan="5" style="color:#888;font-style:italic;padding:12px 0;">No scenes.</td></tr>`}
    </tbody>
  </table>

  <div class="footer">
    <span>Production Pulse${projectTitle ? " · " + eh(projectTitle) : ""} · Scene Breakdown</span>
    <span>Printed ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
  </div>
</div>`;

  openPrintWindow(html, `Shot List${projectTitle ? " — " + projectTitle : ""}`);
}
