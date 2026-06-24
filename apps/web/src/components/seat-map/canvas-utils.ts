export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize
}

export function snapRotation(degrees: number, snap: number): number {
  return ((Math.round(degrees / snap) * snap) % 360 + 360) % 360
}

// Rotate point (px, py) around center (cx, cy) by angleDeg degrees
export function rotatePoint(
  px: number,
  py: number,
  cx: number,
  cy: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = px - cx
  const dy = py - cy
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  }
}

/**
 * Returns positions for N chairs evenly spaced around a table's rect perimeter.
 * Chairs are placed just outside the table edges (30px offset), rotation faces outward.
 */
export function chairPositionsAroundTable(
  table: {
    position_x: number
    position_y: number
    width: number
    height: number
    rotation: number
  },
  count: number,
): Array<{ x: number; y: number; rotation: number }> {
  if (count === 0) return []

  const cx = table.position_x
  const cy = table.position_y
  const halfW = table.width / 2
  const halfH = table.height / 2
  const CHAIR_OFFSET = 30 // px outside the edge

  // Rect perimeter: walk around the 4 edges proportionally by arc-length
  // Total perimeter
  const perim = 2 * (table.width + table.height)

  const positions: Array<{ x: number; y: number; rotation: number }> = []

  for (let i = 0; i < count; i++) {
    // Distribute evenly along perimeter, starting from top-left corner going clockwise
    const t = (i / count) * perim

    let localX: number
    let localY: number
    let outwardAngleDeg: number

    // Top edge: 0 <= t < width
    if (t < table.width) {
      localX = -halfW + t
      localY = -halfH - CHAIR_OFFSET
      outwardAngleDeg = 0 // faces up (north)
    }
    // Right edge: width <= t < width + height
    else if (t < table.width + table.height) {
      localX = halfW + CHAIR_OFFSET
      localY = -halfH + (t - table.width)
      outwardAngleDeg = 90 // faces right (east)
    }
    // Bottom edge: width+height <= t < 2*width+height
    else if (t < 2 * table.width + table.height) {
      localX = halfW - (t - table.width - table.height)
      localY = halfH + CHAIR_OFFSET
      outwardAngleDeg = 180 // faces down (south)
    }
    // Left edge: 2*width+height <= t < perimeter
    else {
      localX = -halfW - CHAIR_OFFSET
      localY = halfH - (t - 2 * table.width - table.height)
      outwardAngleDeg = 270 // faces left (west)
    }

    // Apply table rotation
    const rotated = rotatePoint(cx + localX, cy + localY, cx, cy, table.rotation)
    const chairRotation = snapRotation(outwardAngleDeg + table.rotation, 1)

    positions.push({ x: rotated.x, y: rotated.y, rotation: chairRotation })
  }

  return positions
}

/**
 * Distributes elements evenly horizontally with given gap.
 * Returns new x values in ORIGINAL array order.
 */
export function distributeHorizontally(
  elements: Array<{ x: number; width: number }>,
  gap: number,
): number[] {
  if (elements.length <= 1) return elements.map((e) => e.x)

  // Record original indices before sorting
  const indexed = elements.map((e, i) => ({ e, origIdx: i }))
  const sorted = [...indexed].sort((a, b) => a.e.x - b.e.x)

  // Compute new positions in sorted order
  const sortedPositions: number[] = [sorted[0].e.x]
  for (let i = 1; i < sorted.length; i++) {
    sortedPositions.push(sortedPositions[i - 1] + sorted[i - 1].e.width + gap)
  }

  // Map back to original order
  const result = new Array<number>(elements.length)
  for (let i = 0; i < sorted.length; i++) {
    result[sorted[i].origIdx] = sortedPositions[i]
  }
  return result
}

/**
 * Distributes elements evenly vertically with given gap.
 * Returns new y values in ORIGINAL array order.
 */
export function distributeVertically(
  elements: Array<{ y: number; height: number }>,
  gap: number,
): number[] {
  if (elements.length <= 1) return elements.map((e) => e.y)

  const indexed = elements.map((e, i) => ({ e, origIdx: i }))
  const sorted = [...indexed].sort((a, b) => a.e.y - b.e.y)

  const sortedPositions: number[] = [sorted[0].e.y]
  for (let i = 1; i < sorted.length; i++) {
    sortedPositions.push(sortedPositions[i - 1] + sorted[i - 1].e.height + gap)
  }

  const result = new Array<number>(elements.length)
  for (let i = 0; i < sorted.length; i++) {
    result[sorted[i].origIdx] = sortedPositions[i]
  }
  return result
}
