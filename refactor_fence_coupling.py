#!/usr/bin/env python3
"""
Refactor projectStore.ts: Remove all fence-polygon coupling logic
"""
import re

# Read the file
with open('src/state/projectStore.ts', 'r', encoding='utf-8') as f:
    content = f.read()

print("Starting fence coupling removal refactor...")

# 1. Remove fence-specific constants and comment block (lines 1018-1024)
patterns_to_replace = [
    # Remove the entire "Polyline render masking" comment and its constants
    (r'\/\/ -+\s*\n\/\/ ✅ Polyline render masking \(fence\/gate\).*?const FENCE_EDGE_SNAP_EPS = 1e-6;\n\n',
     '', re.DOTALL),
    
    # Remove forEachPolylineSegment function
    (r'function forEachPolylineSegment\([\s\S]*?\n\}\n\n',
     '', 0),
    
    # Remove sameCoord function  
    (r'function sameCoord\(a: number, b: number, eps = FENCE_EDGE_SNAP_EPS\) \{[\s\S]*?\n\}\n\n',
     '', 0),
    
    # Remove isSharedPolygonEdge function (large block)
    (r'function isSharedPolygonEdge\([\s\S]*?\n    return false;\n\}\n\n',
     '', 0),
    
    # Remove cleanupPointsKeepCollinear function
    (r'function cleanupPointsKeepCollinear\([\s\S]*?\n    return tmp;\n\}\n\n',
     '', 0),
    
    # Remove isAxisAlignedPolygonPoints function
    (r'function isAxisAlignedPolygonPoints\([\s\S]*?\n    return true;\n\}\n\n',
     '', 0),
    
    # Remove orthogonalizePolygonTransitions function (huge block)
    (r'function orthogonalizePolygonTransitions\([\s\S]*?\n    return cleanupPointsKeepCollinear\(out, eps\);\n\}\n\n',
     '', 0),
    
    # Remove pushUniqueBreakpoint + collectInteriorBreakpointsForEdge
    (r'function pushUniqueBreakpoint\([\s\S]*?\n    return breaks;\n\}\n\n',
     '', 0),
    
    # Remove splitPolygonEdgesForBoundarySnapping function
    (r'function splitPolygonEdgesForBoundarySnapping\([\s\S]*?\n    return cleanupPointsKeepCollinear\(out\);\n\}\n\n',
     '', 0),
    
    # Remove snapPolygonEdgesToLineBoundaries function (large block)
    (r'function snapPolygonEdgesToLineBoundaries\([\s\S]*?\n    \};\n\}\n\n',
     '', 0),
    
    # Remove reconcilePolygonsAgainstLineObjects function
    (r'function reconcilePolygonsAgainstLineObjects\([\s\S]*?\n\}\n\n',
     '', 0),
    
    # Remove polylineToStrokePolygons function (very large)
    (r'function polylineToStrokePolygons\([\s\S]*?\n    return polys;\n\}\n\n',
     '', 0),
    
    # Remove diffPolygons function
    (r'function diffPolygons\([\s\S]*?\n    return out;\n\}\n\n',
     '', 0),
    
    # Remove computeLineRenderPieces function
    (r'function computeLineRenderPieces\([\s\S]*?\n    return out;\n\}\n\n',
     '', 0),
    
    # Remove withLinePieces function
    (r'function withLinePieces\([\s\S]*?\n    return next;\n\}\n\n',
     '', 0),
    
    # Remove recalcLinePiecesForWorld function
    (r'function recalcLinePiecesForWorld\([\s\S]*?\n\}\n\n',
     '', 0),
]

# 2. Replace all call sites
call_site_replacements = [
    # Line 2209: draftLineRenderPieces getter - return [] instead of computeLineRenderPieces
    (r'return computeLineRenderPieces\(draftObj, world\);',
     'return [];'),
    
    # recalcLinePiecesForWorld calls - passthrough
    (r'const nextObjects = recalcLinePiecesForWorld\(nextObjectsRaw\);',
     'const nextObjects = nextObjectsRaw;'),
    
    # reconcilePolygonsAgainstLineObjects - return unchanged
    (r'const reconciled = reconcilePolygonsAgainstLineObjects\(normalized, lineObjects\);',
     'const reconciled = normalized;'),
    
    # withLinePieces in setObjectsWithHistory
    (r'return withLinePieces\(\{ ...o, geometry: "polyline" \}, world\);',
     'return o;'),
    
    # reconcilePolygonsAgainstLineObjects in addObject
    (r'const reconciledExisting = reconcilePolygonsAgainstLineObjects\(\s*state\.objects as PolyObject\[\],\s*\[baseObj\]\s*\);',
     'const reconciledExisting = state.objects as PolyObject[];'),
    
    # withLinePieces in addObject
    (r'const objWithPieces = withLinePieces\(baseObj, worldWithNew\);',
     'const objWithPieces = baseObj;'),
    
    # withLinePieces in changeObjectType
    (r'return withLinePieces\(nextObj, worldWith\)',
     'return nextObj'),
]

for pattern, replacement, *flags in patterns_to_replace:
    flag = flags[0] if flags else 0
    content = re.sub(pattern, replacement, content, flags=flag)
    print(f"✓ Removed pattern: {pattern[:50]}...")

for pattern, replacement in call_site_replacements:
    old_count = content.count(pattern)
    content = re.sub(pattern, replacement, content)
    print(f"✓ Replaced call site ({old_count} occurrences): {pattern[:50]}...")

# Write back
with open('src/state/projectStore.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("\n✅ Refactoring complete!")
print("Next: Update HelloEditor.tsx fence snapping logic")
