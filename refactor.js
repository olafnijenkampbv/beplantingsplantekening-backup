const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/state/projectStore.ts');
let content = fs.readFileSync(filePath, 'utf-8');

console.log("Starting fence coupling removal refactor...");

// 1. Large regex patterns to remove functions entirely
const functionsToRemove = [
  // Remove fence constants and comment
  /\/\/ .*?✅ Polyline render masking.*?\nconst FENCE_EDGE_SNAP_EPS = 1e-6;\n\n/s,
  
  // Remove forEachPolylineSegment
  /function forEachPolylineSegment\([\s\S]*?\n\}\n\n/,
  
  // Remove sameCoord
  /function sameCoord\(a: number, b: number, eps = FENCE_EDGE_SNAP_EPS\) \{[\s\S]*?\n\}\n\n/,
  
  // Remove isSharedPolygonEdge - this is huge, so be careful
  /function isSharedPolygonEdge\([\s\S]*?\n    return false;\n\}\n\n/,
  
  // Remove cleanupPointsKeepCollinear
  /function cleanupPointsKeepCollinear\([\s\S]*?\n    return tmp;\n\}\n\n/,
  
  // Remove isAxisAlignedPolygonPoints
  /function isAxisAlignedPolygonPoints\([\s\S]*?\n    return true;\n\}\n\n/,
  
  // Remove orthogonalizePolygonTransitions
  /function orthogonalizePolygonTransitions\([\s\S]*?\n    return cleanupPointsKeepCollinear\(out, eps\);\n\}\n\n/s,
  
  // Remove pushUniqueBreakpoint + collectInteriorBreakpointsForEdge
  /function pushUniqueBreakpoint\([\s\S]*?\n    return breaks;\n\}\n\n/s,
  
  // Remove splitPolygonEdgesForBoundarySnapping
  /function splitPolygonEdgesForBoundarySnapping\([\s\S]*?\n    return cleanupPointsKeepCollinear\(out\);\n\}\n\n/s,
  
  // Remove snapPolygonEdgesToLineBoundaries (HUGE function)
  /function snapPolygonEdgesToLineBoundaries\([\s\S]*?\n    \};\n\}\n\n/s,
  
  // Remove reconcilePolygonsAgainstLineObjects
  /function reconcilePolygonsAgainstLineObjects\([\s\S]*?\n    return objects\.map[\s\S]*?\);\n\}\n\n/s,
  
  // Remove polylineToStrokePolygons (MASSIVE)
  /function polylineToStrokePolygons\([\s\S]*?\n    return polys;\n\}\n\n/s,
  
  // Remove diffPolygons
  /function diffPolygons\([\s\S]*?\n    return out;\n\}\n\n/s,
  
  // Remove computeLineRenderPieces
  /function computeLineRenderPieces\([\s\S]*?\n    return out;\n\}\n\n/s,
  
  // Remove withLinePieces
  /function withLinePieces\([\s\S]*?\n    return next;\n\}\n\n/s,
  
  // Remove recalcLinePiecesForWorld
  /function recalcLinePiecesForWorld\([\s\S]*?\n\}\n\n/s,
];

let removed = 0;
for (const regex of functionsToRemove) {
  if (regex.test(content)) {
    content = content.replace(regex, '');
    removed++;
    console.log(`✓ Removed fence function (${removed}/16)`);
  }
}

// 2. Replace call sites
const callSiteReplacements = [
  [/return computeLineRenderPieces\(draftObj, world\);/g, 'return [];'],
  [/const nextObjects = recalcLinePiecesForWorld\(nextObjectsRaw\);/g, 'const nextObjects = nextObjectsRaw;'],
  [/const reconciledExisting = reconcilePolygonsAgainstLineObjects\(\s*state\.objects as PolyObject\[\],\s*\[baseObj\]\s*\);/g, 'const reconciledExisting = state.objects as PolyObject[];'],
  [/const reconciled = reconcilePolygonsAgainstLineObjects\(normalized, lineObjects\);/g, 'const reconciled = normalized;'],
  [/return withLinePieces\(\{ \.\.\.o, geometry: "polyline" \}, world\);/g, 'return o;'],
  [/const objWithPieces = withLinePieces\(baseObj, worldWithNew\);/g, 'const objWithPieces = baseObj;'],
  [/return withLinePieces\(nextObj, worldWith\)/g, 'return nextObj'],
  [/const movedWithPieces = withLinePieces\(baseObj, worldWithNew\);/g, 'const movedWithPieces = baseObj;'],
  [/const reconciledWorldWithout = reconcilePolygonsAgainstLineObjects\(worldWithout, \[baseObj\]\);/g, 'const reconciledWorldWithout = worldWithout;'],
];

let replaced = 0;
for (const [pattern, replacement] of callSiteReplacements) {
  const matches = (content.match(pattern) || []).length;
  if (matches > 0) {
    content = content.replace(pattern, replacement);
    replaced += matches;
    console.log(`✓ Replaced call site: ${matches} occurrences`);
  }
}

// 3. Write back
fs.writeFileSync(filePath, content, 'utf-8');

console.log(`\n✅ Refactoring complete!`);
console.log(`   - Removed ${removed} fence functions`);
console.log(`   - Replaced ${replaced} call sites`);
console.log("\nNext: Update HelloEditor.tsx fence snapping logic");
