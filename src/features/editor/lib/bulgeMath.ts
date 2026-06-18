// bulgeMath.ts
// ─────────────────────────────────────────────────────────────────────────────
// Geometrie voor het BOGEN / BULGE-systeem + HOEKAFRONDING op de
// beplantingstekening-editor.
//
// KERNIDEE 1 — BOGEN (bulge per ZIJDE)
//   bulge = 2 · sagitta / koorde  (signed, dimensieloos).
//     • bulge = 0          → rechte lijn
//     • |bulge| = 0.4142…  → kwartcirkel
//     • |bulge| = 1.0      → halve cirkel
//
// KERNIDEE 2 — HOEKAFRONDING (corner/fillet per HOEKPUNT)
//   corner = straal in EDITOR-UNITS (niet dimensieloos!).
//     • corner = 0         → scherpe hoek
//     • corner = r         → ronde hoek met straal r
//
// BACKWARDS COMPATIBLE: alle bestaande aanroepen blijven werken.
// ─────────────────────────────────────────────────────────────────────────────

export type Point = [number, number];

const EPS = 1e-9;
const TAU = Math.PI * 2;
/** Onder deze |bulge| behandelen we het segment als recht (geen boog tekenen). */
export const STRAIGHT_THRESHOLD = 0.004;
/** Clamp: |bulge| > ~3 wordt geometrisch onhandelbaar (>270° boog). */
export const MAX_BULGE = 3;

export function dist(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Apex (= handle-positie) van een gebogen segment. */
export function apexPoint(
  x1: number, y1: number, x2: number, y2: number, bulge: number
): Point {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  if (Math.abs(bulge) < EPS) return [mx, my];
  const dx = x2 - x1, dy = y2 - y1, chord = Math.sqrt(dx * dx + dy * dy);
  const plx = -dy / chord, ply = dx / chord; // linker-normaal
  const sag = (bulge * chord) / 2;
  return [mx + plx * sag, my + ply * sag];
}

/** Middelpunt van de cirkel door 3 punten (null bij ~colineair). */
function circumcenter(
  ax: number, ay: number, bx: number, by: number, cx: number, cy: number
): Point | null {
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-7) return null;
  const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
  const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
  const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
  return [ux, uy];
}

function normAngle(a: number): number {
  while (a <= -Math.PI) a += TAU;
  while (a > Math.PI) a -= TAU;
  return a;
}

/**
 * Tussenpunten LANGS de boog (exclusief beide eindpunten).
 * `seg` = aantal subsegmenten (resolutie). Hoger = gladder.
 */
export function arcSamples(
  x1: number, y1: number, x2: number, y2: number, bulge: number, seg = 36
): Point[] {
  if (Math.abs(bulge) < STRAIGHT_THRESHOLD) return [];
  const [ax, ay] = apexPoint(x1, y1, x2, y2, bulge);
  const c = circumcenter(x1, y1, ax, ay, x2, y2);
  if (!c) return [];
  const [cx, cy] = c;
  const r = Math.sqrt((x1 - cx) ** 2 + (y1 - cy) ** 2);
  const a0 = Math.atan2(y1 - cy, x1 - cx);
  const aA = Math.atan2(ay - cy, ax - cx);
  const a2 = Math.atan2(y2 - cy, x2 - cx);
  const dApex = normAngle(aA - a0);
  const dir = dApex >= 0 ? 1 : -1;
  let total = normAngle(a2 - a0);
  if (dir > 0 && total <= 0) total += TAU;
  if (dir < 0 && total >= 0) total -= TAU;
  const n = Math.max(6, Math.min(64, seg));
  const out: Point[] = [];
  for (let k = 1; k < n; k++) {
    const ang = a0 + total * (k / n);
    out.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOEKAFRONDING (fillet) — geometrie
// ─────────────────────────────────────────────────────────────────────────────

export interface CornerGeom {
  /** unit-richting hoekpunt → vorige buur */
  ix: number; iy: number;
  /** unit-richting hoekpunt → volgende buur */
  ox: number; oy: number;
  /** unit binnen-bissectrice */
  bx: number; by: number;
  /** halve binnenhoek (rad) */
  half: number;
  sinHalf: number;
  /** koorde-lengtes naar de buren */
  li: number; lo: number;
  /** max trim-afstand langs een zijde */
  maxT: number;
  /** grootste straal die past op dit hoekpunt */
  maxR: number;
}

export interface CornerFillet {
  Tin: Point;
  Tout: Point;
  center: Point;
  r: number;
  t: number;
  apex: Point;
  g: CornerGeom;
}

/**
 * Richting-only data voor een hoekpunt.
 * p = vorige buur, v = hoekpunt zelf, n = volgende buur.
 * Geeft null bij colineaire punten.
 */
export function cornerGeom(
  px: number, py: number, vx: number, vy: number, nx: number, ny: number
): CornerGeom | null {
  let ix = px - vx, iy = py - vy; const li = Math.hypot(ix, iy); if (li < EPS) return null; ix /= li; iy /= li;
  let ox = nx - vx, oy = ny - vy; const lo = Math.hypot(ox, oy); if (lo < EPS) return null; ox /= lo; oy /= lo;
  const dot = Math.max(-1, Math.min(1, ix * ox + iy * oy));
  const phi = Math.acos(dot);
  if (phi < 1e-3 || Math.PI - phi < 1e-3) return null; // colineair → geen hoek
  const half = phi / 2;
  let bx = ix + ox, by = iy + oy; const lb = Math.hypot(bx, by); if (lb < EPS) return null;
  bx /= lb; by /= lb;
  const maxT = Math.min(li, lo) * 0.5;
  const maxR = maxT * Math.tan(half);
  return { ix, iy, ox, oy, bx, by, half, sinHalf: Math.sin(half), li, lo, maxT, maxR };
}

/**
 * Volledige fillet voor een hoekpunt met straal r.
 * Geeft null bij straal 0 of colineair.
 */
export function cornerFillet(
  px: number, py: number, vx: number, vy: number, nx: number, ny: number, r: number
): CornerFillet | null {
  const g = cornerGeom(px, py, vx, vy, nx, ny); if (!g) return null;
  r = Math.min(r, g.maxR);
  if (r <= EPS) return null;
  const t = r / Math.tan(g.half);
  const distC = r / g.sinHalf;
  const Tin: Point = [vx + g.ix * t, vy + g.iy * t];
  const Tout: Point = [vx + g.ox * t, vy + g.oy * t];
  const center: Point = [vx + g.bx * distC, vy + g.by * distC];
  const apex: Point = [vx + g.bx * (distC - r), vy + g.by * (distC - r)];
  return { Tin, Tout, center, r, t, apex, g };
}

/** Sample een fillet-boog van Tin tot Tout (inclusief beide eindpunten). */
export function cornerArcSamples(c: CornerFillet): Point[] {
  const { center, r, Tin, Tout } = c;
  const a0 = Math.atan2(Tin[1] - center[1], Tin[0] - center[0]);
  const a1 = Math.atan2(Tout[1] - center[1], Tout[0] - center[0]);
  let d = a1 - a0; while (d <= -Math.PI) d += TAU; while (d > Math.PI) d -= TAU;
  const steps = Math.max(2, Math.ceil(Math.abs(d) / (Math.PI / 24)));
  const out: Point[] = [];
  for (let k = 0; k <= steps; k++) {
    const ang = a0 + d * (k / steps);
    out.push([center[0] + r * Math.cos(ang), center[1] + r * Math.sin(ang)]);
  }
  return out;
}

/** Grootste straal die past op hoekpunt `i` van een ring (editor-units). 0 = geen hoek. */
export function cornerMaxRadius(points: number[], i: number): number {
  const n = points.length / 2, p = (i - 1 + n) % n, q = (i + 1) % n;
  const g = cornerGeom(
    points[p * 2], points[p * 2 + 1], points[i * 2], points[i * 2 + 1], points[q * 2], points[q * 2 + 1]
  );
  return g ? g.maxR : 0;
}

/** Zorg dat de corners-array exact `n` elementen heeft (n = aantal vertices). */
export function normalizeCorners(points: number[], corners?: number[]): number[] {
  const n = Math.floor(points.length / 2);
  if (!corners || corners.length === 0) return new Array(n).fill(0);
  if (corners.length === n) return corners;
  const out = new Array(n).fill(0);
  for (let i = 0; i < Math.min(n, corners.length); i++) out[i] = corners[i] || 0;
  return out;
}

/**
 * Remap corner-stralen van een bronring naar een nieuwe ring.
 * Voor elk doelpunt wordt het dichtstbijzijnde bronpunt gezocht;
 * als dat binnen eps (0.5 editor-unit) ligt, wordt de straal overgenomen.
 * Geeft `undefined` terug als er geen niet-nul corners zijn of als de bron
 * geen corners heeft.
 */
export function remapCornersToRing(
  sourcePoints: number[],
  sourceCorners: number[] | undefined,
  targetPoints: number[]
): number[] | undefined {
  if (!sourceCorners || sourceCorners.length === 0) return undefined;
  if (sourcePoints.length < 6 || targetPoints.length < 6) return undefined;

  const srcNorm = normalizeCorners(sourcePoints, sourceCorners);
  if (!srcNorm.some((c) => c > 0)) return undefined;

  const srcCount = Math.floor(sourcePoints.length / 2);
  const dstCount = Math.floor(targetPoints.length / 2);
  const out = new Array(dstCount).fill(0);
  const eps = 0.5; // ruim boven clipper-afrondingsfout (~0.001 units)

  for (let i = 0; i < dstCount; i++) {
    const tx = targetPoints[i * 2];
    const ty = targetPoints[i * 2 + 1];
    let bestDist = Infinity;
    let bestCorner = 0;
    for (let j = 0; j < srcCount; j++) {
      const d = Math.hypot(tx - sourcePoints[j * 2], ty - sourcePoints[j * 2 + 1]);
      if (d < bestDist) {
        bestDist = d;
        bestCorner = srcNorm[j] || 0;
      }
    }
    out[i] = bestDist < eps ? bestCorner : 0;
  }

  return out.some((c) => c > 0) ? out : undefined;
}

/**
 * Volledige rand als dichte puntenlijst (flat [x,y,...]),
 * inclusief bogen EN ronde hoeken.
 */
export function densifyRing(
  points: number[], bulges: number[], corners?: number[], seg = 48
): number[] {
  const n = points.length / 2;
  const fil: (CornerFillet | null)[] = new Array(n).fill(null);
  if (corners) {
    for (let i = 0; i < n; i++) {
      const r = corners[i] || 0; if (r <= EPS) continue;
      const p = (i - 1 + n) % n, q = (i + 1) % n;
      fil[i] = cornerFillet(
        points[p * 2], points[p * 2 + 1], points[i * 2], points[i * 2 + 1], points[q * 2], points[q * 2 + 1], r
      );
    }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    let sx: number, sy: number;
    const c = fil[i];
    if (c) {
      for (const [ax, ay] of cornerArcSamples(c)) out.push(ax, ay);
      sx = c.Tout[0]; sy = c.Tout[1];
    } else {
      out.push(points[i * 2], points[i * 2 + 1]);
      sx = points[i * 2]; sy = points[i * 2 + 1];
    }
    const cj = fil[j];
    const ex = cj ? cj.Tin[0] : points[j * 2];
    const ey = cj ? cj.Tin[1] : points[j * 2 + 1];
    for (const [mx, my] of arcSamples(sx, sy, ex, ey, bulges[i] || 0, seg)) out.push(mx, my);
  }
  return out;
}

/**
 * Volledige rand als dichte puntenlijst. Backwards compatible:
 * bestaande 3-argument aanroepen blijven werken.
 * `corners` is optioneel 4e argument.
 */
export function densifyBulgedRing(
  points: number[], bulges: number[], seg = 48, corners?: number[]
): number[] {
  return densifyRing(points, bulges, corners, seg);
}

/**
 * Middelpunt en straal van de cirkelboog die bij een bulge-segment hoort.
 */
export function arcCenterRadius(
  x1: number, y1: number,
  x2: number, y2: number,
  bulge: number
): { cx: number; cy: number; r: number } | null {
  if (Math.abs(bulge) < STRAIGHT_THRESHOLD) return null;
  const [ax, ay] = apexPoint(x1, y1, x2, y2, bulge);
  const c = circumcenter(x1, y1, ax, ay, x2, y2);
  if (!c) return null;
  const [cx, cy] = c;
  const r = Math.sqrt((x1 - cx) ** 2 + (y1 - cy) ** 2);
  return { cx, cy, r };
}

/** Shoelace-oppervlakte (absoluut) van een gebogen + afgerond polygoon, in editor-units². */
export function bulgedPolygonArea(points: number[], bulges: number[], corners?: number[]): number {
  const b = densifyRing(points, bulges, corners, 48);
  let area = 0;
  const m = b.length / 2;
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m;
    area += b[i * 2] * b[j * 2 + 1] - b[j * 2] * b[i * 2 + 1];
  }
  return Math.abs(area) / 2;
}

/** Omtrek (booglengte) van een gebogen + afgerond polygoon, in editor-units. */
export function bulgedPolygonPerimeter(points: number[], bulges: number[], corners?: number[]): number {
  const b = densifyRing(points, bulges, corners, 48);
  let p = 0;
  const m = b.length / 2;
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m;
    p += dist(b[i * 2], b[i * 2 + 1], b[j * 2], b[j * 2 + 1]);
  }
  return p;
}

/**
 * Teken een gesloten (mogelijk gebogen + afgerond) pad op een Canvas2D ctx of Path2D.
 * Backwards compatible: `corners` is optioneel 5e argument.
 */
export function traceBulgedPath(
  ctx: { moveTo(x: number, y: number): void; lineTo(x: number, y: number): void },
  points: number[], bulges: number[], closed = true, corners?: number[]
): void {
  const hasCorners = !!corners && corners.some((c) => (c || 0) > EPS);
  if (hasCorners) {
    const ring = densifyRing(points, bulges, corners, 40);
    if (ring.length < 2) return;
    ctx.moveTo(ring[0], ring[1]);
    for (let k = 2; k < ring.length; k += 2) ctx.lineTo(ring[k], ring[k + 1]);
    return;
  }
  // Geen ronde hoeken → exact het oude (boog-only) pad
  const n = points.length / 2;
  ctx.moveTo(points[0], points[1]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const j = (i + 1) % n;
    const x1 = points[i * 2], y1 = points[i * 2 + 1];
    const x2 = points[j * 2], y2 = points[j * 2 + 1];
    for (const [mx, my] of arcSamples(x1, y1, x2, y2, bulges[i] || 0, 40)) ctx.lineTo(mx, my);
    ctx.lineTo(x2, y2);
  }
}

/**
 * Reken een gesleepte apex-positie terug naar de signed bulge voor dat segment.
 */
export function bulgeFromDraggedApex(
  x1: number, y1: number, x2: number, y2: number, mx: number, my: number
): number {
  const dx = x2 - x1, dy = y2 - y1, chord = Math.sqrt(dx * dx + dy * dy);
  if (chord < 1e-6) return 0;
  const plx = -dy / chord, ply = dx / chord;
  const sag = (mx - (x1 + x2) / 2) * plx + (my - (y1 + y2) / 2) * ply;
  return Math.max(-MAX_BULGE, Math.min(MAX_BULGE, (2 * sag) / chord));
}

/**
 * Reken een gesleepte hoek-handle terug naar een straal (editor-units).
 * `restOffset` is de kleine rust-offset (editor-units) vanwaar de straal 0 is.
 */
export function radiusFromDraggedHandle(
  px: number, py: number, vx: number, vy: number, nx: number, ny: number,
  mx: number, my: number, restOffset = 0
): { value: number; max: number } {
  const g = cornerGeom(px, py, vx, vy, nx, ny); if (!g) return { value: 0, max: 0 };
  const s = (mx - vx) * g.bx + (my - vy) * g.by - restOffset;
  if (s <= 0) return { value: 0, max: g.maxR };
  const denom = 1 / g.sinHalf - 1;
  let r = denom > EPS ? (s * g.sinHalf) / (1 - g.sinHalf) : g.maxR;
  r = Math.max(0, Math.min(r, g.maxR));
  return { value: r, max: g.maxR };
}

// ── Snapping (bogen) ──────────────────────────────────────────────────────────
export interface SnapResult { value: number; name: string | null; snapped: boolean; }

const SNAPS: Array<{ value: number; name: string; tol: number }> = [
  { value: 0,        name: "Recht",        tol: 0.05 },
  { value: 0.4142,   name: "Kwartcirkel",  tol: 0.045 },
  { value: -0.4142,  name: "Kwartcirkel",  tol: 0.045 },
  { value: 1.0,      name: "Halve cirkel", tol: 0.06 },
  { value: -1.0,     name: "Halve cirkel", tol: 0.06 },
];

export function snapBulge(b: number): SnapResult {
  for (const s of SNAPS) {
    if (Math.abs(b - s.value) <= s.tol) return { value: s.value, name: s.name, snapped: true };
  }
  return { value: b, name: null, snapped: false };
}

// ── Snapping (hoekstraal) ─────────────────────────────────────────────────────
// Waarden in editor-units. Pas RADIUS_SNAPS aan op jouw schaal.
const RADIUS_SNAPS = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150];

export function snapRadius(r: number, maxR: number): SnapResult {
  if (r <= 1.2) return { value: 0, name: "Recht", snapped: r > 0 };
  if (maxR > 0 && maxR - r <= Math.max(3, maxR * 0.05)) return { value: maxR, name: "Vol rond", snapped: true };
  for (const v of RADIUS_SNAPS) {
    if (v < maxR - 0.5 && Math.abs(r - v) <= 2.5) return { value: v, name: null, snapped: true };
  }
  return { value: r, name: null, snapped: false };
}

// ── Array helpers ─────────────────────────────────────────────────────────────

/**
 * Normaliseert een bulges-array zodat de lengte exact gelijk is aan het aantal
 * vertices (points.length / 2). Ontbrekende slots → 0, overtollige → afgekapt.
 */
export function normalizeBulges(points: number[], bulges?: number[]): number[] {
  const n = Math.floor(points.length / 2);
  if (!bulges || bulges.length === 0) return new Array(n).fill(0);
  if (bulges.length === n) return bulges;
  const out = new Array(n).fill(0);
  for (let i = 0; i < Math.min(n, bulges.length); i++) out[i] = bulges[i];
  return out;
}
