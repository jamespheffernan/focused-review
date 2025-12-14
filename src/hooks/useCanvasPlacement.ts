export function getInitialPosition(
  existingNodes: Array<{ position: { x: number; y: number } }>,
): { x: number; y: number } {
  const padding = 0.05
  const minDistance = 0.12
  
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = {
      x: padding + Math.random() * (1 - 2 * padding),
      y: padding + Math.random() * (1 - 2 * padding)
    }
    
    const hasCollision = existingNodes.some(node => {
      const dx = node.position.x - candidate.x
      const dy = node.position.y - candidate.y
      return Math.sqrt(dx * dx + dy * dy) < minDistance
    })
    
    if (!hasCollision) {
      return candidate
    }
  }
  
  // Fallback grid position
  const index = existingNodes.length
  const cols = 4
  const row = Math.floor(index / cols)
  const col = index % cols
  return {
    x: 0.15 + (col * 0.22),
    y: 0.12 + (row * 0.20)
  }
}
