export const lineIntersectsRect = (x1: number, y1: number, x2: number, y2: number, rx: number, ry: number, rw: number, rh: number) => {
  if (x1 >= rx && x1 <= rx + rw && y1 >= ry && y1 <= ry + rh) return true;
  if (x2 >= rx && x2 <= rx + rw && y2 >= ry && y2 <= ry + rh) return true;

  const intersects = (x3: number, y3: number, x4: number, y4: number) => {
    const denom = (y4-y3)*(x2-x1) - (x4-x3)*(y2-y1);
    if (denom === 0) return false;
    const uA = ((x4-x3)*(y1-y3) - (y4-y3)*(x1-x3)) / denom;
    const uB = ((x2-x1)*(y1-y3) - (y2-y1)*(x1-x3)) / denom;
    return uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1;
  };

  if (intersects(rx, ry, rx+rw, ry)) return true; 
  if (intersects(rx, ry+rh, rx+rw, ry+rh)) return true; 
  if (intersects(rx, ry, rx, ry+rh)) return true; 
  if (intersects(rx+rw, ry, rx+rw, ry+rh)) return true; 

  return false;
};
