interface Point { x: number; y: number; }

export function getControlPoints(prev: Point, curr: Point, next: Point) {
  const smoothFactor = 0.35;
  const d1 = Math.hypot(curr.x - prev.x, curr.y - prev.y);
  const d2 = Math.hypot(next.x - curr.x, next.y - curr.y);
  
  let vx = 0;
  let vy = 0;
  if (d1 + d2 > 0) {
    vx = (next.x - prev.x) / (d1 + d2);
    vy = (next.y - prev.y) / (d1 + d2);
  }

  return {
    controlIn: { x: curr.x - vx * d1 * smoothFactor, y: curr.y - vy * d1 * smoothFactor },
    controlOut: { x: curr.x + vx * d2 * smoothFactor, y: curr.y + vy * d2 * smoothFactor }
  };
}

export function computeTrackControlPoints(nodes: Point[], loop: boolean) {
  const n = nodes.length;
  const cps = nodes.map(() => ({ controlIn: {x:0, y:0}, controlOut: {x:0, y:0} }));

  if (n < 2) return cps;

  for (let i = 0; i < n; i++) {
    const curr = nodes[i];
    let prev, next;

    if (loop) {
      prev = nodes[(i - 1 + n) % n];
      next = nodes[(i + 1) % n];
    } else {
      prev = i > 0 ? nodes[i - 1] : curr;
      next = i < n - 1 ? nodes[i + 1] : curr;
    }

    const { controlIn, controlOut } = getControlPoints(prev, curr, next);
    cps[i].controlIn = controlIn;
    cps[i].controlOut = controlOut;
  }

  return cps;
}
