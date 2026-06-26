interface HistoryAdapter {
  pushUndoSnapshot(): void;
  pauseHistory(): void;
  resumeHistory(): void;
  commitHistory(): void;
}

export const createDragHistoryGuard = (adapter: HistoryAdapter) => {
  let hasPaused = false;
  return {
    onMove() {
      if (!hasPaused) {
        adapter.pushUndoSnapshot();
        adapter.pauseHistory();
        hasPaused = true;
      }
    },
    onUp() {
      if (hasPaused) {
        adapter.resumeHistory();
        adapter.commitHistory();
      }
    },
  };
};
