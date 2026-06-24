import { useContext } from "react";
import { useStore as useZustandStore } from "zustand";
import type { StoreApi } from "zustand";
import { CanvasStoreContext } from "./CanvasStoreContext";
import type { CanvasFeature } from "./shared/canvasTypes";
import { useStore } from "./useStore";

export function useCanvasStore<T>(
  selector: (state: CanvasFeature) => T,
): T {
  const store = useContext(CanvasStoreContext);

  // When no CanvasStoreProvider is present (e.g. GamePage), fall back to global store.
  // useZustandStore is always called with a stable store reference — this is valid React.
  return useZustandStore(
    (store ?? useStore) as unknown as StoreApi<CanvasFeature>,
    selector,
  );
}
