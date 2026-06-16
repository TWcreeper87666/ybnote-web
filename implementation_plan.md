# YBNote-inspired Music Game: Phase 5 實作計畫 (動態軌道系統)

這個階段將實作遊戲的「動態軌道 (Tracks) 與播放系統」。玩家將能夠在畫面上繪製軌道，並讓觸發球 (Runner Ball) 沿著軌道移動，當碰到音符方塊時就會發出聲音。

## 決定的設計方向

感謝您的確認，以下是 Phase 5 的最終設計方向：

1. **軌道建立 UI:**
   - 在右下角工具列新增「✏️ 繪製軌道」按鈕。
   - 支援**貝茲曲線 (Bezier Curves)**：畫出的軌道節點會有控制點 (Control Points)，讓玩家可以拖曳控制點來調整曲線弧度。
2. **播放與暫停控制:**
   - 畫面上方正中央增加一組全域的「▶️ 播放 / ⏸️ 暫停 / ⏹️ 停止」按鈕。
3. **軌道屬性面板:**
   - **滑鼠雙擊 (Double Click)** 軌道線條後，會在旁邊彈出一個浮動設定視窗 (Popup)。
   - 軌道的速度設定將採用 **BPM (Beats Per Minute)** 作為單位。
4. **碰撞發聲規則:**
   - 球體在軌道上移動時，只要碰到方塊的範圍 (Rect) 就會觸發。
   - **不需要冷卻時間 (Cooldown)**。

## Proposed Changes

### 1. Store (狀態管理)

#### [MODIFY] src/store/useStore.ts
- **新增 Track 與 Runner 資料結構:**
  ```typescript
  interface BezierHandle { x: number; y: number; } // Absolute coordinates
  interface TrackNode {
    id: string;
    x: number;
    y: number;
    controlIn?: BezierHandle;
    controlOut?: BezierHandle;
  }
  interface Track {
    id: string;
    nodes: TrackNode[];
    bpm: number; // 速度單位 (例如預設 120)
    loop: boolean;
  }
  interface Runner {
    id: string;
    trackId: string;
    progress: number; // 0 到軌道總長度，或 0~1
  }
  ```
- **新增全域播放與編輯狀態:**
  - `isPlaying: boolean`
  - `mode: 'select' | 'draw_track'`
  - `editingTrackId: string | null` (雙擊時開啟屬性視窗用)
- **新增 Actions:** `addTrack`, `updateTrack`, `deleteTrack`, `addTrackNode`, `updateTrackNode`, `togglePlay`, `stopPlay` 等。

### 2. Components (元件與 UI)

#### [NEW] src/components/TrackRenderer.tsx
- 繪製軌道的主元件。
- 使用 `@pixi/react` 的 `Graphics` 繪製三次貝茲曲線 (Cubic Bezier Curve) `bezierCurveTo`。
- 如果目前在 `select` 或 `draw_track` 模式下選取了軌道，則顯示 Node 與 Control Points 的操作點 (圓圈)，讓玩家可以拖曳。
- 監聽雙擊事件 (`pointerdown` 判斷點擊次數或間隔) 來觸發開啟浮動屬性視窗。

#### [NEW] src/components/RunnerRenderer.tsx
- 繪製正在軌道上移動的觸發球。

#### [MODIFY] src/components/Canvas.tsx
- 切換模式邏輯：如果是 `draw_track`，點擊畫布背景會新增 Track Node。
- 處理滑鼠拖曳 Node 或 Control Point 的邏輯。

#### [NEW] src/components/PlaybackControls.tsx
- 置頂置中的 HTML Overlay，包含 Play, Pause, Stop 按鈕。

#### [NEW] src/components/TrackPropertiesPopup.tsx
- HTML 浮動視窗，當 `editingTrackId` 有值時顯示。
- 包含 BPM 數字輸入框 (或 Slider) 與 Loop 開關。

### 3. Logic (遊戲迴圈與物理邏輯)

#### [NEW] src/hooks/useGameLoop.ts
- 統整 Pixi 的 `useTick`。
- 當 `isPlaying` 為 true，根據 BPM 計算每幀 Runner 應該前進的距離。
- 使用貝茲曲線數學公式 (Bezier Interpolation) 計算 Runner 確切的 X/Y 座標。
- **碰撞偵測 (AABB):** 檢查 Runner (圓形或點) 與 NoteBlock (矩形) 是否相交。如果是新進入交集區域，觸發 Tone.js 音效。

## 執行計畫

我們將進入執行階段，並透過 `task.md` 追蹤以下進度：
1. 更新 `useStore.ts`。
2. 實作 Playback 控制列 UI 與全域狀態。
3. 實作 `TrackRenderer` 與軌道繪製/編輯邏輯 (包含貝茲曲線拖曳)。
4. 實作雙擊開啟 `TrackPropertiesPopup`。
5. 實作 `useGameLoop`：Runner 沿著曲線移動以及碰撞判定發聲。
