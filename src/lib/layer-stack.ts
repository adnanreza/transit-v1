/**
 * Pure predicate behind the Map's dev-mode z-order tripwire: given the full
 * ordered list of style-layer ids and a required sub-stack (bottom → top),
 * confirm every id in `stack` is present in `styleLayerIds` AND appears in
 * ascending positional order. Other layers may interleave — they're not part
 * of the contract — but the listed ones must paint in the declared order.
 */
export function isTransitLayerOrderValid(
  styleLayerIds: readonly string[],
  stack: readonly string[],
): boolean {
  const indices = stack.map((id) => styleLayerIds.indexOf(id))
  return indices.every(
    (idx, i) => idx >= 0 && (i === 0 || idx > indices[i - 1]),
  )
}
