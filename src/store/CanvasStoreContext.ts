import { createContext } from "react";
import type { CanvasStore } from "./shared/canvasTypes";

export const CanvasStoreContext =
  createContext<CanvasStore | null>(null);

  