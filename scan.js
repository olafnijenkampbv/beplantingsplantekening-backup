const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/state/projectStore.ts');
const lines = fs.readFileSync(filePath, 'utf-8').split('\n');

// Find line ranges of key functions to identify them
const keyStrings = [
  'Polyline render masking (fence/gate)',
  'function forEachPolylineSegment(',
  'function sameCoord(',
  'function isSharedPolygonEdge(',
  'function cleanupPointsKeepCollinear(',
  'function isAxisAlignedPolygonPoints(',
  'function orthogonalizePolygonTransitions(',
  'function pushUniqueBreakpoint(',
  'function collectInteriorBreakpointsForEdge(',
  'function splitPolygonEdgesForBoundarySnapping(',
  'function snapPolygonEdgesToLineBoundaries(',
  'function reconcilePolygonsAgainstLineObjects(',
  'function polylineToStrokePolygons(',
  'function diffPolygons(',
  'function computeLineRenderPieces(',
  'function withLinePieces(',
  'function recalcLinePiecesForWorld(',
];

console.log("Scanning for functions to remove...\n");

keyStrings.forEach(str => {
  const idx = lines.findIndex(line => line.includes(str));
  if (idx >= 0) {
    console.log(`✓ Found "${str.substring(0, 40)}..." at line ${idx + 1}`);
  } else {
    console.log(`✗ NOT FOUND: "${str.substring(0, 40)}..."`);
  }
});

// Show first few lines where constants are defined
console.log("\nLooking for FENCE constants...");
lines.forEach((line, i) => {
  if (line.includes('FENCE_STROKE_WIDTH') || line.includes('FENCE_BOUNDARY_OFFSET') || line.includes('FENCE_EDGE_SNAP_EPS')) {
    console.log(`  Line ${i + 1}: ${line.trim()}`);
  }
});

// Check call sites
console.log("\nScanning for call sites to update...\n");
const callPats = [
  'computeLineRenderPieces(',
  'recalcLinePiecesForWorld(',
  'reconcilePolygonsAgainstLineObjects(',
  'withLinePieces(',
  'snapPolygonEdgesToLineBoundaries(',
];

callPats.forEach(pat => {
  const count = lines.filter(l => l.includes(pat) && !l.trim().startsWith('//')).length;
  console.log(`  "${pat}": ${count} calls`);
});
