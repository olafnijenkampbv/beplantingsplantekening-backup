// arcBooleanGeometry.ts
// ─────────────────────────────────────────────────────────────────────────────
// Provenance-based arc recovery after Clipper boolean operations.
//
// PROBLEEM MET collapseArcRuns():
//   Die functie is heuristisch: hij checkt of Clipper-outputpunten binnen
//   ARC_MATCH_TOLERANCE (1.5 units) van een bekende boogcirkel vallen.
//   Valse positieven (punten die toevallig dichtbij een cirkel liggen) zijn
//   mogelijk, en de tolerantie is nodig omdat MERGE_EPS=0.5 inflatie gebruikt.
//
// OPLOSSING (deze module):
//   1. extractArcCircles()          – bouw expliciete arc-cirkels uit een bron-polygoon
//   2. extractArcCirclesFromSources() – doe dit voor meerdere bronnen (met unieke keys)
//   3. recoverArcsFromOutput()      – herstel bulge-segmenten in Clipper-output
//      door punten terug te koppelen aan hun bron-cirkel (tolerance 0.6 units).
//
// TOLERANTIE:
//   MERGE_EPS=0.5 inflatie + Clipper integer-afrond ≈ 0.1 → totaal 0.6 units.
//   Dat is ruim genoeg voor alle verwachte verplaatsingen zonder valse positieven.
// ─────────────────────────────────────────────────────────────────────────────

import {
    STRAIGHT_THRESHOLD,
    cornerFillet,
    normalizeCorners,
    arcCenterRadius,
    bulgeFromDraggedApex,
    normalizeBulges,
} from "./bulgeMath";

/** Straal-tolerantie voor het matchen van Clipper-outputpunten aan boogcirkels. */
export const ARC_RECOVERY_TOLERANCE = 0.6;

/** Minimaal aantal aaneengesloten boog-getagde punten voor een geldige run. */
const ARC_RUN_MIN = 4;

/** Een arc-cirkel met een unieke sleutel die terugkoppelt naar de bronpolygoon. */
export interface ArcCircle {
    key: string;  // bijv. "s0-b2" = source 0, bulge segment 2; "s1-c0" = source 1, corner 0
    cx: number;
    cy: number;
    r: number;
}

/**
 * Bouw alle arc-cirkels (bulge-segmenten + corner-fillets) uit één polygoon.
 * Keys zijn "b{i}" voor bulge-segment i, "c{i}" voor corner-fillet bij vertex i.
 */
export function extractArcCircles(
    points: number[],
    bulges?: number[],
    corners?: number[]
): ArcCircle[] {
    const n = Math.floor(points.length / 2);
    if (n < 3) return [];

    const normBulges = normalizeBulges(points, bulges);
    const normCorners = normalizeCorners(points, corners);
    const result: ArcCircle[] = [];

    // Bouw corner-fillets (ook nodig als start/eind-correctie voor bulge-arcs)
    const fillets: Array<ReturnType<typeof cornerFillet>> = new Array(n).fill(null);
    for (let i = 0; i < n; i++) {
        const r = normCorners[i] ?? 0;
        if (r <= STRAIGHT_THRESHOLD) continue;
        const p = (i - 1 + n) % n;
        const q = (i + 1) % n;
        const f = cornerFillet(
            points[p * 2], points[p * 2 + 1],
            points[i * 2], points[i * 2 + 1],
            points[q * 2], points[q * 2 + 1],
            r
        );
        if (f) {
            fillets[i] = f;
            result.push({ key: `c${i}`, cx: f.center[0], cy: f.center[1], r: f.r });
        }
    }

    // Bulge-arcs (start/eindpunt gecorrigeerd voor aangrenzende corner-fillets)
    for (let i = 0; i < n; i++) {
        const b = normBulges[i] ?? 0;
        if (Math.abs(b) <= STRAIGHT_THRESHOLD) continue;
        const j = (i + 1) % n;
        const fi = fillets[i];
        const fj = fillets[j];
        const sx = fi ? fi.Tout[0] : points[i * 2];
        const sy = fi ? fi.Tout[1] : points[i * 2 + 1];
        const ex = fj ? fj.Tin[0] : points[j * 2];
        const ey = fj ? fj.Tin[1] : points[j * 2 + 1];
        const arc = arcCenterRadius(sx, sy, ex, ey, b);
        if (arc) result.push({ key: `b${i}`, cx: arc.cx, cy: arc.cy, r: arc.r });
    }

    return result;
}

/**
 * Bouw arc-cirkels uit meerdere bronpolygonen.
 * Keys krijgen prefix "s{srcIdx}-" zodat cirkels van verschillende bronnen nooit
 * per ongeluk samenvoegen, zelfs als hun geometrie toevallig samenvalt.
 */
export function extractArcCirclesFromSources(
    sources: ReadonlyArray<{ points: number[]; bulges?: number[]; corners?: number[] }>
): ArcCircle[] {
    const result: ArcCircle[] = [];
    sources.forEach((src, srcIdx) => {
        for (const circle of extractArcCircles(src.points, src.bulges, src.corners)) {
            result.push({ ...circle, key: `s${srcIdx}-${circle.key}` });
        }
    });
    return result;
}

/**
 * Herstel bulge-segmenten in Clipper-output door densified boogpunten terug te
 * koppelen aan hun bron-arc (via afstand tot boogcirkel).
 *
 * Algoritme:
 *   1. Tag elk outputpunt met de eerste boogcirkel waarvan |dist - r| ≤ tolerance.
 *   2. Roteer de ring zodat hij begint op een niet-boog-punt (voorkomt wrap-around splits).
 *   3. Vind aaneengesloten runs van punten met dezelfde key.
 *   4. Runs met ≥ ARC_RUN_MIN punten én monotone hoekopvolging → één bulge-segment.
 *      Kortere of niet-monotone runs → rechte segmenten.
 *
 * @param outerFlat   Clipper-outputring als platte [x,y,x,y,...] array
 * @param arcCircles  Alle arc-cirkels van de bronojecten (zie extractArcCirclesFromSources)
 * @param tolerance   Max afwijking van boogstraal om een punt als "op de boog" te beschouwen
 */
export function recoverArcsFromOutput(
    outerFlat: number[],
    arcCircles: ArcCircle[],
    tolerance: number = ARC_RECOVERY_TOLERANCE
): { points: number[]; bulges: number[] } {
    const m = Math.floor(outerFlat.length / 2);

    if (arcCircles.length === 0 || m < 3) {
        return { points: outerFlat, bulges: new Array(m).fill(0) };
    }

    // Koppel elk outputpunt aan een arc-key (eerste match binnen tolerantie)
    const pointKey: Array<string | null> = new Array(m).fill(null);
    for (let i = 0; i < m; i++) {
        const px = outerFlat[i * 2];
        const py = outerFlat[i * 2 + 1];
        for (const { key, cx, cy, r } of arcCircles) {
            const d = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
            if (Math.abs(d - r) <= tolerance) {
                pointKey[i] = key;
                break;
            }
        }
    }

    // Roteer ring naar eerste niet-boog-punt (voorkomt wrap-around splits)
    let workFlat = outerFlat;
    let workKey = pointKey;
    const nonArcStart = pointKey.indexOf(null);
    if (nonArcStart > 0) {
        const rf: number[] = new Array(m * 2);
        const rk: Array<string | null> = new Array(m);
        for (let k = 0; k < m; k++) {
            const src = (k + nonArcStart) % m;
            rf[k * 2]     = outerFlat[src * 2];
            rf[k * 2 + 1] = outerFlat[src * 2 + 1];
            rk[k]         = pointKey[src];
        }
        workFlat = rf;
        workKey  = rk;
    }

    // Collaps aaneengesloten same-key runs naar één bulge-segment
    const result: number[]      = [];
    const resultBulges: number[] = [];

    let i = 0;
    while (i < m) {
        const key = workKey[i];

        if (key === null) {
            result.push(workFlat[i * 2], workFlat[i * 2 + 1]);
            resultBulges.push(0);
            i++;
            continue;
        }

        // Zoek einde van de run (zelfde key)
        let runEnd = i + 1;
        while (runEnd < m && workKey[runEnd] === key) runEnd++;
        const runLen = runEnd - i;

        if (runLen < ARC_RUN_MIN) {
            // Te weinig punten → als rechte behandelen
            result.push(workFlat[i * 2], workFlat[i * 2 + 1]);
            resultBulges.push(0);
            i++;
            continue;
        }

        // Monotoniteitscheck: geldige boog → hoeken nemen monotoon toe of af
        const arc = arcCircles.find((a) => a.key === key)!;
        const angles: number[] = [];
        for (let k = i; k < runEnd; k++) {
            angles.push(Math.atan2(workFlat[k * 2 + 1] - arc.cy, workFlat[k * 2] - arc.cx));
        }
        const diffs: number[] = [];
        for (let k = 1; k < angles.length; k++) {
            let d = angles[k] - angles[k - 1];
            while (d >  Math.PI) d -= 2 * Math.PI;
            while (d < -Math.PI) d += 2 * Math.PI;
            diffs.push(d);
        }
        const isMonotone = diffs.every((d) => d > 0) || diffs.every((d) => d < 0);
        if (!isMonotone) {
            result.push(workFlat[i * 2], workFlat[i * 2 + 1]);
            resultBulges.push(0);
            i++;
            continue;
        }

        // Bereken bulge via het middelpunt van de run als apex-schatting
        const x1 = workFlat[i * 2],          y1 = workFlat[i * 2 + 1];
        const x2 = workFlat[(runEnd - 1) * 2], y2 = workFlat[(runEnd - 1) * 2 + 1];
        const midIdx = i + Math.floor(runLen / 2);
        const ax = workFlat[midIdx * 2], ay = workFlat[midIdx * 2 + 1];
        const b = bulgeFromDraggedApex(x1, y1, x2, y2, ax, ay);

        result.push(x1, y1);
        resultBulges.push(Math.abs(b) > STRAIGHT_THRESHOLD ? b : 0);
        i = runEnd - 1; // eindpunt wordt startpunt van volgend segment
    }

    return { points: result, bulges: resultBulges };
}
