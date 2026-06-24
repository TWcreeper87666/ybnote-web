import type { ReactNode } from "react";
import { CanvasStoreContext } from "./CanvasStoreContext";
import type { CanvasStore } from "./shared/canvasTypes";

interface CanvasStoreProviderProps {
  store: CanvasStore;
  children: ReactNode;
}

export function CanvasStoreProvider({
  store,
  children,
}: CanvasStoreProviderProps) {
  return (
    <CanvasStoreContext.Provider value={store}>
      {children}
    </CanvasStoreContext.Provider>
  );
}