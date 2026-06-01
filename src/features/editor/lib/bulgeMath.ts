// bulgeMath.ts
// ─────────────────────────────────────────────────────────────────────────────
// Geometrie voor het BOGEN / BULGE-systeem op de beplantingstekening-editor.
//
// Voorgesteld pad in jouw project:  src/features/editor/lib/bulgeMath.ts
//
// KERNIDEE
//   Elke zijde (segment) tussen twee opeenvolgende hoekpunten van een polygoon
//   krijgt één extra getal: de `bulge`. Dit is een SIGNED scalar:
//
//       bulge = 2 · sagitta / koorde
//
//   waarbij `sagitta` de loodrechte afstand is van het boog-hoogtepunt (apex)
//   tot de koorde, gemeten langs de LINKER-normaal van de richting p1→p2.
//
//   • bulge = 0            → rechte lijn
//   • |bulge| = 0.4142…    → kwartcirkel        (tan(45°/2))
//   • |bulge| = 1.0        → halve cirkel
//   • teken (+/−)          → aan welke kant van de koorde de boog bolt
//
//   ALLES (de getekende vorm, de handle-positie, de oppervlakte en de omtrek)
//   wordt afgeleid uit hetzelfde apex-punt. Daardoor ligt de handle altijd
//   exact op de getekende boog en volgt de boog altijd de muis — er is geen
//   dubbelzinnige clockwise/counter-clockwise vlag nodig.
//
//   bulge is DIMENSIELOOS en dus schaal-onafhankelijk: dezelfde waarde werkt in
//   editor-units én in schermpixels. Je hoeft hem nooit om te rekenen bij zoom.
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
  const dApex = normAngle(aA - a0);             // richting naar de apex
  const dir = dApex >= 0 ? 1 : -1;
  let total = normAngle(a2 - a0);
  if (dir > 0 && total <= 0) total += TAU;       // sweep dezelfde kant op als de apex
  if (dir < 0 && total >= 0) total -= TAU;
  const n = Math.max(6, Math.min(64, seg));
  const out: Point[] = [];
  for (let k = 1; k < n; k++) {
    const ang = a0 + total * (k / n);
    out.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
  }
  return out;
}

/**
 * Volledige rand als dichte puntenlijst (flat [x,y,x,y,...]).
 * Gebruik dit voor: oppervlakte, omtrek, hit-testing en boolean (clipper) ops.
 */
export function densifyBulgedRing(
  points: number[], bulges: number[], seg = 48
): number[] {
  const n = points.length / 2;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const x1 = points[i * 2], y1 = points[i * 2 + 1];
    const x2 = points[j * 2], y2 = points[j * 2 + 1];
    out.push(x1, y1);
    for (const [mx, my] of arcSamples(x1, y1, x2, y2, bulges[i] || 0, seg)) {
      out.push(mx, my);
    }
  }
  return out;
}

/** Shoelace-oppervlakte (absoluut) van een gebogen polygoon, in editor-units². */
export function bulgedPolygonArea(points: number[], bulges: number[]): number {
  const b = densifyBulgedRing(points, bulges, 48);
  let area = 0;
  const m = b.length / 2;
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m;
    area += b[i * 2] * b[j * 2 + 1] - b[j * 2] * b[i * 2 + 1];
  }
  return Math.abs(area) / 2;
}

/** Omtrek (booglengte) van een gebogen polygoon, in editor-units. */
export function bulgedPolygonPerimeter(points: number[], bulges: number[]): number {
  const b = densifyBulgedRing(points, bulges, 48);
  let p = 0;
  const m = b.length / 2;
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m;
    p += dist(b[i * 2], b[i * 2 + 1], b[j * 2], b[j * 2 + 1]);
  }
  return p;
}

/**
 * Teken een gesloten (mogelijk gebogen) pad op een Canvas2D ctx OF een Path2D.
 * Gebruik dit in de Konva `sceneFunc` i.p.v. de huidige rechte `lineTo`-lus.
 */
export function traceBulgedPath(
  ctx: { moveTo(x: number, y: number): void; lineTo(x: number, y: number): void },
  points: number[], bulges: number[], closed = true
): void {
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
 * (mx,my) = huidige muispositie in WERELD-coördinaten (editor-units).
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

// ── Snapping ────────────────────────────────────────────────────────────────
// |bulge| = tan(θ/4). Magnetiseer naar "mooie" bogen tijdens het slepen.
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
