import { useContext } from "react";
import { useStore as useZustandStore } from "zustand";
import { CanvasStoreContext } from "./CanvasStoreContext";
import type { CanvasFeature } from "./shared/canvasTypes";

export function useCanvasStore<T>(
  selector: (state: CanvasFeature) => T,
) {
  const store = useContext(CanvasStoreContext);

  if (!store) {
    throw new Error(
      "useCanvasStore must be used within CanvasStoreProvider",
    );
  }

  return useZustandStore(store, selector);
}