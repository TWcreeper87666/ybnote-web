# ybnote — Project Architecture Reference

> **Project structure documentation.**
> **Update this file whenever the architecture changes.**
> **This file is provided to agents at the start of every session.**

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Directory Structure](#3-directory-structure)
4. [Core Data Types](#4-core-data-types)
5. [State Management](#5-state-management)
6. [Canvas & Rendering Architecture](#6-canvas--rendering-architecture) *(SharedCanvas, tools, layers)*
7. [Event Flows](#7-event-flows)
8. [Key Hooks](#8-key-hooks)
9. [Audio System](#9-audio-system)
10. [MIDI & Charting Workflow](#10-midi--charting-workflow)
11. [Key Utilities](#11-key-utilities)
12. [Mode & Phase System](#12-mode--phase-system)
13. [Group System](#13-group-system)
14. [Routing & Pages](#14-routing--pages)
15. [UI Components](#15-ui-components)
16. [Editor Components](#16-editor-components)

---

## 1. Project Overview

**ybnote** is a browser-based music note placement, charting, and rhythm game editor. It has three operational modes:

| Mode | Page | Purpose |
|------|------|---------|
| **Playground** | `/playground` | Free-form canvas: place blocks, draw tracks, play notes |
| **Level Editor** | `/level-editor` | Import MIDI, edit notes in pianoroll, assign notes to blocks (charting), export `.yblevel` |
| **Game** | `/game` | Rhythm game: upload a level, arrange blocks, play and score |

The core concept: **note blocks** sit on a 2D canvas. The user draws a right-click "slash trail" through them to trigger their sound. In game mode, the trail must intersect blocks at precisely the right time for a score.

---

## 2. Technology Stack

| Library | Purpose |
|---------|---------|
| React 18 + Vite | UI framework and build tool |
| `@pixi/react` + `pixi.js` v8 | 2D canvas rendering, federated pointer events |
| Zustand | State management for all three canvas contexts |
| `zundo` | Temporal (undo/redo) middleware, used only in the Playground store |
| Tone.js | Audio synthesis (PolySynth, FMSynth, MonoSynth, MembraneSynth, NoiseSynth) |
| React Router v6 | Client-side routing (HashRouter) |
| TypeScript | Full type coverage |

---

## 3. Directory Structure

```
src/
├── App.tsx                     # Router (HashRouter, 4 routes)
├── main.tsx                    # React root, extends @pixi/react reconciler
├── types/
│   └── game.ts                 # Core data interfaces (Block, GroupRect, Track, …)
├── store/
│   ├── useStore.ts             # Playground Zustand store (zundo + persist)
│   ├── useLevelEditorStore.ts  # Editor Zustand store (manual history + persist)
│   ├── useGameStore.ts         # Game Zustand store (no history)
│   ├── useSettingsStore.ts     # User settings (persist)
│   ├── useUIStore.ts           # Auxiliary UI state (legacy/minor)
│   ├── createCanvasSlice.ts    # Shared state + actions factory for all three stores
│   ├── canvasAdapter.ts        # Adapter pattern: unified API over three stores
│   └── CanvasProvider.tsx      # React context providing CanvasContextType + adapter
├── components/
│   ├── canvas/
│   │   ├── SharedCanvas.tsx    # Unified Pixi canvas for playground + editor (parametrized by context)
│   │   ├── GameCanvas.tsx      # Game Pixi canvas (approach circles, touch)
│   │   ├── PocketCanvas.tsx    # Miniature block grid (pocket view)
│   │   ├── CanvasContext.ts    # CanvasContextType React context
│   │   ├── shared/
│   │   │   ├── GridBackground.tsx
│   │   │   ├── SelectionBoxRenderer.tsx
│   │   │   └── TrailRenderer.tsx       # Right-click trail + idle particles
│   │   ├── tools/              # Interaction tool hooks — each returns { onPointerDown?, onPointerMove?, onPointerUp? }
│   │   │   ├── useTrailTool.ts
│   │   │   ├── useSelectTool.ts
│   │   │   ├── useSpawnTool.ts
│   │   │   ├── useDrawGroupTool.ts
│   │   │   ├── useDrawTrackTool.ts
│   │   │   ├── usePlayTool.ts          # Extracts 3 play-mode useEffects (pointer lock, RAF mouse, trail intersection)
│   │   │   └── useCameraTool.ts
│   │   └── layers/             # Self-contained Pixi/HTML layer components (own their store subscriptions)
│   │       ├── BlockLayer.tsx
│   │       ├── GridLayer.tsx
│   │       ├── SelectionLayer.tsx
│   │       ├── TrailLayer.tsx
│   │       ├── TrackLayer.tsx
│   │       └── OverlayLayer.tsx        # HTML overlays: vignette, perform-hit flash, crosshair
│   ├── blocks/
│   │   ├── BaseBlock.tsx       # Rectangular note block (Pixi Graphics)
│   │   ├── DrumBlock.tsx       # Circular percussion block
│   │   ├── NoteBlock.tsx       # Wrapper: chooses BaseBlock or DrumBlock; triggers audio
│   │   └── PocketNoteBlock.tsx # Compact block for pocket canvas
│   ├── containers/
│   │   ├── GroupRectRenderer.tsx  # Renders all GroupRects with 8-handle resize
│   │   ├── BaseGroupRect.tsx      # Pixi rendering for a single GroupRect
│   │   ├── TrackRenderer.tsx      # Renders bezier track paths + draggable nodes
│   │   └── BaseTrack.tsx
│   ├── editor/
│   │   ├── PianoRoll.tsx          # Canvas-based MIDI note editor
│   │   ├── PianoRollKeyboard.tsx  # Piano key sidebar
│   │   ├── TrackPanel.tsx         # MIDI track list
│   │   ├── VelocityTab.tsx        # MIDI velocity editor
│   │   ├── ChartingTab.tsx        # Step-by-step MIDI→block assignment UI
│   │   └── LevelEditorToolbar.tsx
│   ├── instruments/
│   │   ├── PianoKeyboard.tsx   # Virtual piano (click/drag to place blocks)
│   │   └── DrumKeyboard.tsx    # Virtual drum pads
│   └── ui/
│       ├── ContextMenu.tsx         # Right-click context menus
│       ├── OutlinerPanel.tsx       # Hierarchical object tree view
│       ├── SelectionPropertiesHud.tsx
│       ├── SettingsPanel.tsx
│       ├── CanvasPlayerBar.tsx     # Editor playback bar
│       └── PocketDragOverlay.tsx   # Drag ghost when dragging from pocket
├── hooks/
│   ├── useCanvasInteractions.ts    # Trail / selection / pan state machine
│   ├── useBlockDrag.ts             # Block drag pointer mechanics (selection, delta calc, double-click)
│   ├── useBlockDragHandlers.ts     # Block drag coordination (which blocks/tracks/groupRects move, history)
│   ├── useActiveCanvas.ts          # Context-aware reactive + snapshot accessors
│   ├── useCanvasCamera.ts          # Scroll-wheel zoom + play-mode pointer-lock
│   ├── useDoubleClick.ts           # 300ms double-click detector
│   ├── useShortcuts.ts             # Global keyboard shortcuts
│   └── useIsMobile.ts              # Mobile detection
├── utils/
│   ├── canvasUtils.ts    # snapValue, clampZoom, getTouchDistance, pointer capture, rect helpers
│   ├── dragUtils.ts      # createDragHistoryGuard
│   ├── geometry.ts       # lineIntersectsRect
│   ├── audio.ts          # playNote, setMasterVolume (Tone.js)
│   ├── chartUtils.ts     # buildGameEventsFromMidi, autoChart, matchRecordedHits
│   ├── pitchUtils.ts     # shiftPitch, NOTES, PERCUSSION_PITCHES
│   ├── colors.ts         # getPitchColorNumber / getPitchColorHex
│   ├── midiImport.ts     # Parse MIDI → ParsedMidiData
│   ├── midiExport.ts     # Export ParsedMidiData → MIDI file
│   └── levelUtils.ts     # Save/load .yblevel (JSON + embedded audio)
└── pages/
    ├── PlaygroundPage.tsx
    ├── LevelEditorPage.tsx
    └── GamePage.tsx
```

---

## 4. Core Data Types

Defined in `src/types/game.ts`:

```typescript
interface Block {
  id: string;
  x: number;
  y: number;
  pitch: string;           // 'C4', 'D#5', 'kick', 'snare', …
  instrument?: string;     // 'piano' | 'synth' | 'bass' | 'percussion'
  volume?: number;         // 0.0–1.0
  keyBinding?: string;     // keyboard key to trigger this block
  groupId?: string;        // group membership
  playedAt?: number;       // timestamp; changing this value plays the sound
  playedVolumeMultiplier?: number;
  // Pocket layout fields:
  xOffset?: number;
  yOffset?: number;
  originalTime?: number;
  midiNumber?: number;
}

interface GroupRect {
  id: string;
  x: number; y: number; w: number; h: number;
  name?: string;
  volume?: number;
  enabled?: boolean;
  playedAt?: number;       // triggers visual ripple + fires all blocks inside
  groupId?: string;
  keyBinding?: string;
}

interface Track {
  id: string;
  nodes: TrackNode[];
  bpm: number;
  loop: boolean;
  name?: string;
  groupId?: string;
  enabled?: boolean;
}

interface TrackNode { id: string; x: number; y: number; }

interface CameraState { x: number; y: number; zoom: number; }

interface GameEvent {
  time: number;            // seconds from audio start
  pitch: string;
  instrument: string;
  blockId: string;         // which block this event targets
}

// Trail rendering
type TrailStroke = {
  id: number;
  points: { x: number; y: number; time: number }[];
};
```

---

## 5. State Management

### 5a. Three-Store Architecture

```
useStore              → Playground canvas  (zundo temporal + persist)
useLevelEditorStore   → Level Editor canvas (manual history + persist)
useGameStore          → Game canvas         (no history)
useSettingsStore      → Global settings     (persist only)
```

All three canvas stores share a common base via `createCanvasSlice.ts`.

**Shared canvas state** (`INITIAL_CANVAS_STATE`):
- `blocks[]`, `groupRects[]`, `tracks[]`
- `selectedBlockIds[]`, `selectedGroupRectIds[]`, `selectedTrackIds[]`
- `lastSelectedId`, `lastSelectedType`
- `camera: CameraState`
- `contextMenu`, `hoveredBlockId`, `hoveredGroupRectId`
- `activeNodeDrag`
- Pocket canvas: `pocketBlocks[]`, `pocketCamera`, `pocketSortMode`, `selectedPocketBlockIds[]`, `activePocketDrag`, `interactionContext ('main'|'pocket')`
- Clipboard: `clipboardBlocks[]`, `clipboardTracks[]`, `clipboardGroupRects[]`

**Shared canvas actions** (`buildCanvasActions()`):
- `addBlock / updateBlock / updateBlocks / removeBlock / mutateBlocks`
- `addGroupRect / updateGroupRect / removeGroupRect`
- `addTrack / updateTrack / deleteTrack / addTrackNode / updateTrackNode / removeTrackNode`
- `selectBlock / selectGroupRect / selectTrack / clearSelection / selectAll / deleteSelected`
- `groupSelected / ungroupSelected`
- `copySelected / pasteClipboard / duplicateSelected`
- `openContextMenu / closeContextMenu`
- `setHoveredBlockId / setHoveredGroupRectId`
- `addBlocksToContext`

**useStore extras** (playground-only):
- `mode`: `'select' | 'draw_track' | 'piano' | 'drum' | 'draw_group' | 'play'`
- `isPlaying`, `runners[]`, `trackPlaybackStatus`
- `isPianoOpen`, `isSettingsOpen`, `isOutlinerOpen`, `isTutorialOpen`, `isPocketCanvasOpen`
- Macro recording: `isRecording`, `recordedEvents[]`
- `latestPerformHit` (for play mode visual flash)
- Persist key: `'ybnote-storage'`

**useLevelEditorStore extras** (editor-only):
- `audioFile`, `audioBuffer`, `audioUrl`, `trimStart`, `trimEnd`, `audioVolume`, `audioPlaybackRate`
- `midiData: ParsedMidiData`, `selectedMidiTrackId`
- `isPlaying`, `playbackPosition`, `playbackAnchor`, `chartEndPosition`
- `activeTab: 'pianoroll' | 'blocks' | 'charting'`
- `selectedNoteIds: Set<string>`, MIDI note clipboard
- `history[]` (HistorySnapshot[]), `historyIndex`, `historyLimit: 50`
- Charting: `chartingNoteIndex`, `chartingAwaitingPick`, `chartingHighlightIds[]`, `isRecordingChart`
- `gameEvents[]` (computed: MIDI + charting assignments)
- Level metadata: `levelTitle`, `levelAuthor`, `levelDescription`, etc.
- Persist key: `'level-editor'`

**useGameStore extras** (game-only):
- `gamePhase: 'upload' | 'arrange' | 'play' | 'paused' | 'result'`
- `gameEvents[]`
- `gameScore`, `gameCombo`, `perfectCount`, `goodCount`, `badCount`, `missCount`, `wrongCount`, `maxCombo`
- `gameSpeed` (0.25–2.0×), `gameAudioUrl`, `gameAudioVolume`
- `latestHit: HitEvent | null`
- `history: GameHistorySnapshot[]`, `historyIndex`, `historyLimit: 50` — snapshots `{ blocks, groupRects, tracks }`
- `pushUndoSnapshot()`, `commitHistory()`, `undo()`, `redo()` — same pattern as editor; history clears when phase resets to `'upload'`

**useSettingsStore**:
- `theme: 'light' | 'dark'`
- `showGrid`, `snapToGrid`
- `masterVolume`, `mouseSensitivity`, `blockOpacity`
- `showGroupName`, `showBlockPitch`, `showBlockVolume`, `showBlockInstrument`, `showSelectionHud`
- `pianoKeysCount`, `mobileControlMode: 'touch' | 'crosshair'`
- Persist key: `'ybnote-settings'`

---

### 5b. Canvas Adapter Pattern (`src/store/canvasAdapter.ts`)

**Problem:** Canvas components and hooks need to work across all three stores without knowing which one they're talking to.

**Solution:** `CanvasStoreAdapter` interface, with three implementations:

```typescript
interface CanvasStoreAdapter {
  // Reactive hooks — call at component top level, trigger re-renders
  useBlocks(): Block[];
  useCamera(): CameraState;
  useGroupRects(): GroupRect[];
  useTracks(): Track[];
  useSelectedBlockIds(): string[];
  useSelectedGroupRectIds(): string[];
  useSelectedTrackIds(): string[];

  // Non-reactive getters — use inside event handlers / effects
  getBlocks(): Block[];
  getCamera(): CameraState;
  getGroupRects(): GroupRect[];
  getContextMenu(): ContextMenuState | null;
  getSelectedBlockIds(): string[];
  // …etc.

  // Actions
  updateBlock(id, updates): void;
  updateBlocks(updates): void;
  selectBlock(id, multi?): void;
  updateCamera(partial): void;
  clearSelection(): void;
  openContextMenu(state): void;
  // …etc.

  // History
  pushUndoSnapshot(): void;   // playground: push to temporal pastStates
  pauseHistory(): void;       // playground: temporal.pause()
  resumeHistory(): void;      // playground: temporal.resume()
  commitHistory(): void;      // editor: commitHistory(); playground: no-op (temporal handles it)
}
```

**Factory:** `getCanvasAdapter(context: CanvasContextType): CanvasStoreAdapter`
- `'playground'` → `playgroundCanvasAdapter` (wraps `useStore`)
- `'editor'`     → `editorCanvasAdapter` (wraps `useLevelEditorStore`)
- `'game'`       → `gameCanvasAdapter` (wraps `useGameStore`, no history)

**Snapshot utility:** `getCanvasState(context: 'playground' | 'editor'): CanvasSliceAPI`
- Non-reactive getter for event handlers and tool hooks that need a one-shot state read
- Returns raw store state cast to `CanvasSliceAPI = CanvasSliceState & CanvasSliceActions` (exported from `createCanvasSlice.ts`)
- Replaces the repeated `(context === 'editor' ? useLevelEditorStore : useStore).getState() as unknown as CanvasSliceAPI` pattern

---

### 5c. CanvasContext (`src/components/canvas/CanvasContext.ts` + `src/store/CanvasProvider.tsx`)

```typescript
type CanvasContextType = 'playground' | 'editor' | 'game';
```

`CanvasProvider` wraps a canvas with both `CanvasContext` (the string type) and `CanvasAdapterCtx` (the adapter instance).

```tsx
<CanvasProvider type="editor">
  <EditorCanvas />   {/* inside: useCanvasContext() === 'editor' */}
</CanvasProvider>
```

Components call `useCanvasContext()` to read the type and `getCanvasAdapter(ctx)` or `useActiveCanvas*()` helpers to access state.

---

### 5d. Undo / Redo

**Playground — Zundo temporal:**
```
useStore.temporal.getState().undo()
useStore.temporal.getState().redo()
useStore.temporal.getState().pause() / .resume()

// Continuous drag: debounced grouping
mutateBlocks(ids, fn, { continuous: true })
  → if first call: manual pushUndoSnapshot + temporal.pause()
  → debounce 500ms → temporal.resume()
  Result: entire drag gesture = single undo entry
```

**Editor — manual history array:**
```
commitHistory()  → history.push(snapshot), historyIndex++, cap at 50
undo()           → historyIndex--, restore snapshot
redo()           → historyIndex++, restore snapshot
Snapshot includes: midiTracks, selectedNoteIds, blocks[], gameEvents[]
```

**Game — manual history array (arrange phase only):**
```
commitHistory()  → history.push(snapshot), historyIndex++, cap at 50
undo()           → historyIndex--, restore snapshot
redo()           → historyIndex++, restore snapshot
Snapshot includes: blocks[], groupRects[], tracks[]
history cleared when gamePhase transitions back to 'upload'
```
Drag uses the same `createDragHistoryGuard` pattern as the editor (pushUndoSnapshot + commitHistory).
Ctrl+G / Ctrl+Shift+G call commitHistory before and after to bracket the state change.

**Drag History Guard** (`src/utils/dragUtils.ts`):
```typescript
const guard = createDragHistoryGuard(adapter);
// on first move:
guard.onMove();  // → adapter.pushUndoSnapshot() + adapter.pauseHistory()
// on pointer up:
guard.onUp();    // → adapter.resumeHistory() + adapter.commitHistory()
```
Used by: `useBlockDrag`, `GroupRectRenderer`, `TrackRenderer`.

---

## 6. Canvas & Rendering Architecture

### 6a. Pixi.js Setup

```tsx
<Application backgroundAlpha={0} resizeTo={window} antialias>
  <pixiContainer
    x={camera.x}
    y={camera.y}
    scale={camera.zoom}
    eventMode="static"
    sortableChildren={true}
    onPointerDown={handlePointerDown}
    onPointerMove={handlePointerMove}
    onPointerUp={handlePointerUp}
    onPointerUpOutside={handlePointerUp}
  >
    {/* children rendered in world space */}
  </pixiContainer>
</Application>
```

**Camera math — world ↔ screen:**
```
worldX = (screenX - canvasRect.left - camera.x) / camera.zoom
worldY = (screenY - canvasRect.top  - camera.y) / camera.zoom

screenX = camera.x + worldX * camera.zoom + canvasRect.left
screenY = camera.y + worldY * camera.zoom + canvasRect.top
```

**Pixi federated events:** Events dispatch from the deepest hit-tested child upward. `e.stopPropagation()` prevents bubbling. `e.target` is the element that received the event; `e.currentTarget` is the element whose handler is running.

Block `pixiContainer` has `hitArea={new PIXI.Rectangle(0, 0, 60, 60)}` and `eventMode="static"`.

---

### 6b. Canvas Components

| File | Store | Extra behaviors |
|------|-------|----------------|
| `SharedCanvas.tsx` | `useStore` / `useLevelEditorStore` | Unified canvas for `context: 'playground' \| 'editor'`; composes 7 tool hooks + 6 layers; wrapped in `<CanvasProvider type="editor">` for editor context |
| `GameCanvas.tsx` | `useGameStore` | Approach circles (shrinking square, 800ms before event); mobile touch pinch-zoom; long-press right-click; score hit detection (±50ms window) |
| `PocketCanvas.tsx` | `useStore` (pocketBlocks) | Separate pocket camera; grid auto-layout; `PocketNoteBlock`; trail-to-play only |

---

### 6c. Shared Canvas Renderers (`src/components/canvas/shared/`)

- **`GridBackground.tsx`** — Draws configurable grid lines (30px spacing default).
- **`SelectionBoxRenderer.tsx`** — Marquee selection box; `GroupDrawBoxRenderer` for draw_group mode.
- **`TrailRenderer.tsx`** — Renders right-click trail strokes + idle particles:
  - Stroke fade: 500ms (`FADE_TIME`); cubic ease-out
  - Purple glow layer (25px × easeLife, alpha 0.3) + white core (8px × easeLife, alpha 1.0)
  - Idle particles spawn at trail tip when mouse is held still (3/tick, max 250, 600ms life)
  - Particle physics: velocity × 0.96 damping each tick

---

### 6d. Container Components

**`GroupRectRenderer.tsx`** — Renders `GroupRect` objects from the active canvas store.
- 8-direction resize handles (invisible `pixiGraphics` with `alpha: 0.001`)
- Handle types: `'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se'`
- Drag moves all selected blocks + tracks + group rects together
- Snap-to-grid: `snapValue(edge)` on each affected edge during resize

**`TrackRenderer.tsx`** — Renders bezier track paths + nodes.
- Right-click on track segment → inserts new node at closest point
- Double-click node → activates runner
- `draw_track` mode: click on background creates track + first node, drag places node

---

### 6e. Tool Hooks (`src/components/canvas/tools/`)

Each tool hook is called at the top of `SharedCanvas` and plugged into the pointer-event pipeline via short-circuit `||` or explicit early return:

```typescript
// SharedCanvas pointer pipeline:
handlePointerDown: cameraTool → trail → drawTrack → drawGroup → spawn → select
handlePointerMove: cameraTool || drawGroup || select || trail
handlePointerUp:   cameraTool + trail + drawGroup + select (all called unconditionally)
```

| Hook | Returns | Owns |
|------|---------|------|
| `useCameraTool(context, { startPan, updatePan, endPan })` | `{ onPointerDown, onPointerMove, onPointerUp }` | Middle-click pan |
| `useTrailTool(context, { startTrail, updateTrail, endTrail, intersectedBlocksRef })` | `{ onPointerDown, onPointerMove, onPointerUp, checkIntersection }` | Right-click trail |
| `useSelectTool(context, { isSelectingRef, startSelection, updateSelection, endSelection })` | `{ onPointerDown, onPointerMove, onPointerUp }` | Marquee selection |
| `useSpawnTool(context)` | `{ onPointerDown }` | Double-click block/track/groupRect spawn |
| `useDrawGroupTool(context)` | `{ onPointerDown, onPointerMove, onPointerUp, groupDrawBox }` | `draw_group` bbox drag |
| `useDrawTrackTool(context)` | `{ onPointerDown }` | `draw_track` node placement |
| `usePlayTool(context, { checkIntersection, intersectedBlocksRef })` | *(void — pure side effects)* | Play-mode pointer lock, RAF mouse movement, trail intersection |

---

### 6f. Layer Components (`src/components/canvas/layers/`)

Self-contained Pixi or HTML components rendered inside the `pixiContainer`. Each owns its own store subscriptions where possible.

| Layer | Purpose |
|-------|---------|
| `GridLayer` | Subscribes to camera zoom + settings; renders `GridBackground` |
| `SelectionLayer` | Wraps `SelectionBoxRenderer` + `GroupDrawBoxRenderer` |
| `BlockLayer` | Subscribes to blocks from active store; renders `NoteBlock` map |
| `TrailLayer` | Thin wrapper for `TrailRenderer` |
| `TrackLayer` | Thin wrapper for `TrackRenderer` |
| `OverlayLayer` | HTML overlays: play-mode vignette, perform-hit flash, crosshair |

---

## 7. Event Flows

### 7a. Right-Click Trail → Trigger Blocks (THE most important interaction)

```
[pointerdown, button=2] on pixiContainer (bubbles up from child if not stopped)
 ├─ closeContextMenu()
 ├─ if e.target.label === 'background': clearSelection()
 ├─ const pos = e.currentTarget.toLocal(e.global)   // world space
 ├─ detect startedOnBlock:
 │    let current = e.target; while (current) {
 │      if (current.label === 'note-block') { startedOnBlock = true; break; }
 │      current = current.parent;
 │    }
 ├─ intersectedBlocksRef.current.clear()
 ├─ startTrail(pos.x, pos.y)              // begins new TrailStroke
 └─ checkTrailIntersection(pos.x, pos.y, pos.x, pos.y, isFirstPoint=true, startedOnBlock)
      ├─ Blocks: lineIntersectsRect(x1,y1,x2,y2, b.x, b.y, 60, 60)
      │    if hit AND block not in intersectedBlocksRef:
      │      → updateBlock(id, { playedAt: Date.now() })
      │         → NoteBlock.useEffect([playedAt]) → playNote(pitch, volume, instrument)
      └─ GroupRects: lineIntersectsRect(…, g.x, g.y, g.w, g.h)
           if hit AND not already intersected AND !(isFirstPoint && startedOnBlock):
             → updateGroupRect(id, { playedAt: Date.now() })
             → updateBlocks(blocksInside, { playedAt, playedVolumeMultiplier: g.volume })

[pointermove, e.buttons===2, !activeNodeDrag]
 ├─ const pos = e.currentTarget.toLocal(e.global)
 └─ updateTrail(pos.x, pos.y, (p1, p2) => checkTrailIntersection(p1.x, p1.y, p2.x, p2.y))
      └─ if distance(prev, cur) > 2px:
           push new point, call onIntersect callback
           → checkTrailIntersection(p1.x, p1.y, p2.x, p2.y)
              → (same block/groupRect logic as above)

[pointerup]
 └─ endTrail(), intersectedBlocksRef.current.clear()
```

**Key:** `intersectedBlocksRef` (a `Set<string>`) is replaced each frame with the current frame's intersected IDs. This means a block is re-triggerable as soon as the trail exits and re-enters it.

**Right-click on a NoteBlock:** The block's `handlePointerDown` (button===2) does NOT call `e.stopPropagation()`, so the event bubbles to the canvas container and triggers the trail start + immediate intersection check.

---

### 7b. Left-Click Block Drag

Drag is split across two hooks: `useBlockDrag` owns pointer mechanics; `useBlockDragHandlers` owns canvas coordination.

```
NoteBlock:
  const { onDragStart } = useBlockDragHandlers(id, canvasContext)
  const { handlePointerDown, handlePointerUp } = useBlockDrag(id, x, y, isSelected, {
    canvasContext, onDragStart,
    onContextMenu: (pos) => openContextMenuInContext(ctx, { ...pos, blockId: id })
  })

useBlockDrag — pointer mechanics:
[pointerdown, button=0]
 ├─ e.stopPropagation()
 ├─ if Ctrl/Shift: selectBlock(id, multi=true), shouldDrag = !wasSelected
 ├─ else: if !isSelected: selectBlock(id, false); shouldDrag = true
 ├─ initialPosRef.current = { x, y }   ← captures position at drag start
 ├─ setIsDragging(true)
 └─ setDragOffset({ x: parentLocal.x - block.x, y: parentLocal.y - block.y })

[useEffect, isDragging=true]
 ├─ handlers = onDragStart()   ← calls useBlockDragHandlers factory (snapshots initial positions)
 │
 ├─ [pointermove]
 │   ├─ worldX = (clientX - rect.left - cam.x) / cam.zoom
 │   ├─ newX = worldX - dragOffset.x
 │   ├─ if snapToGrid: newX = snapValue(newX, 30)
 │   └─ handlers.onMove(newX - initialPosRef.x, newY - initialPosRef.y)
 │
 └─ [pointerup | pointercancel | contextmenu]
      ├─ setIsDragging(false)
      └─ handlers.onUp()

useBlockDragHandlers.onDragStart() — canvas coordination (called once at drag start):
 ├─ sourceBlocks = selectedBlocks + this block (if not already selected)
 ├─ selectedTracks, selectedGroupRects
 ├─ initialPositions = Map<id, {x,y}>  ← snapshot
 ├─ historyGuard = createDragHistoryGuard(adapter)
 ├─ returns onMove(deltaX, deltaY):
 │     historyGuard.onMove()  ← first call: pushUndoSnapshot + pauseHistory
 │     adapter.updateBlocks(allSelected, { x: init.x + deltaX, y: init.y + deltaY })
 │     + updateTrackInContext / updateGroupRectInContext for co-selected items
 └─ returns onUp():
       historyGuard.onUp()  ← resumeHistory + commitHistory
       (mobile: clearSelection)
```

---

### 7c. Double-Click to Spawn Block

```
[pointerdown, button=0] on background (e.target.label === 'background')
 ├─ timeDiff = Date.now() - lastClickTime
 ├─ if (50 < timeDiff < 350) AND dist(pos, lastPos) < 20:
 │    Determine spawnType from: mode, lastSelectedType, lastBlock.instrument
 │    → addBlock / addGroupRect / addTrack at pos (inheriting last selected's properties)
 │    lastClickTime = 0  (reset to prevent triple-click)
 └─ else: lastClickTime = Date.now(), lastClickPos = pos
          startSelection(pos) for marquee
```

**Double-click on a Block** → opens context menu (detected in `useBlockDrag.handlePointerUp` via `useDoubleClick` hook):
```
[pointerup, button=0, isClick=true]
 └─ if isDoubleClick():   ← second click within 300ms threshold
      openContextMenuInContext(ctx, { x, y, blockId: id })
```

---

### 7d. Camera Pan & Zoom

**Middle-click pan:**
```
[pointerdown, button=1] → startPan(e.global.x, e.global.y, cam.x, cam.y)
[pointermove]           → updatePan(x, y, updateCamera)  (returns true = handled)
[pointerup]             → endPan()
```

**Scroll wheel zoom** (`useCanvasCamera` hook, registered on `document`):
```
[wheel, hover over block, !ctrlKey]
 ├─ if shiftKey: adjust volume ±0.1
 └─ else: shiftPitch(block.pitch, ±1 semitone)
    → updateBlock({ pitch/volume, playedAt: Date.now() })

[wheel, no block / ctrlKey]
 ├─ direction = deltaY > 0 ? 1/1.1 : 1.1
 ├─ newZoom = clampZoom(oldZoom * direction)
 ├─ pivot = cursor position (or screen center in crosshair mode)
 ├─ newCamX = pivotX - (pivotX - cam.x) / oldZoom * newZoom
 └─ updateCamera({ zoom: newZoom, x: newCamX, y: newCamY })
```

**Play mode (pointer lock):**
```
mode === 'play' → document.body.requestPointerLock()
[mousemove]
 ├─ accumulate movementX/Y
 └─ requestAnimationFrame:
      newCam = { x: cam.x - ΣmovementX * sensitivity, y: cam.y - ΣmovementY * sensitivity }
      if buttons > 0:
        checkTrailIntersection(centerLocal_old, centerLocal_new)  ← world position of screen center
      updateCamera(newCam)
```

**Mobile pinch zoom** (GameCanvas, arrange phase):
```
[touchstart, 2 fingers]
 ├─ initialPinchDist = getTouchDistance(t1, t2)
 ├─ initialZoom = cam.zoom
 └─ initialLocalXY = world point at pinch center

[touchmove, 2+ fingers]
 ├─ dist = getTouchDistance(t1, t2)
 ├─ newZoom = clampZoom(initialZoom * dist / initialPinchDist)
 └─ pin world point at pinch center:
      newCamX = pinchCenterScreen.x - initialLocalX * newZoom
      updateCamera({ zoom, x, y })
```

---

### 7e. Audio Trigger Chain

```
updateBlock(id, { playedAt: Date.now() })    ← set by checkTrailIntersection or keyBinding
  → NoteBlock.useEffect([playedAt])
      if playedAt !== lastPlayedRef.current:
        import('utils/audio').then(({ playNote }) =>
          playNote(pitch, volume * playedVolumeMultiplier, instrument)
        )
```

Same chain for GroupRect: `updateGroupRect({ playedAt })` triggers the GroupRect's visual ripple AND fires `updateBlocks(blocksInside, { playedAt, playedVolumeMultiplier: g.volume })`.

---

## 8. Key Hooks

### `useCanvasInteractions` (`src/hooks/useCanvasInteractions.ts`)

The core state machine for all pointer interactions on canvases. Returns:

```typescript
{
  // Trail
  activeStrokesRef: MutableRefObject<TrailStroke[]>
  currentStrokeId: MutableRefObject<number | null>
  startTrail(localX, localY): void
  updateTrail(localX, localY, onIntersect?): boolean
  endTrail(): void

  // Marquee selection
  selectionBox: { x,y,w,h } | null
  isSelectingRef: MutableRefObject<boolean>
  startSelection(x, y): void
  updateSelection(x, y): { x,y,w,h } | null
  endSelection(): void

  // Camera pan
  startPan(x, y, camX, camY): void
  updatePan(x, y, updateCamera): boolean   // returns true if panning
  endPan(): void

  // Hit tracking
  intersectedBlocksRef: MutableRefObject<Set<string>>
}
```

`updateTrail` only adds a new point (and calls `onIntersect`) if the distance from the last point exceeds **2px**. This prevents duplicate intersection checks for micro-movements.

---

### `useBlockDrag` (`src/hooks/useBlockDrag.ts`)

```typescript
useBlockDrag(
  id: string,
  x: number,
  y: number,
  isSelected: boolean,
  {
    canvasContext?: CanvasContextType;
    onDragStart?: () => { onMove(deltaX, deltaY): void; onUp(): void } | void;
    onContextMenu?: (pos: { x: number; y: number }) => void;
  }
) => { handlePointerDown, handlePointerUp, isDragging }
```

- Owns **pointer mechanics only**: selection on click, drag offset tracking, delta calculation, double-click detection
- Calls `onDragStart()` once when drag begins; uses the returned `{ onMove, onUp }` for the duration of the gesture
- `onContextMenu` is called on double-click pointer-up (replaces inline `openContextMenuInContext`)
- No direct store imports for move/history — those are injected via `onDragStart`
- Multi-pointer safety: tracks `pointerId` to ignore other pointers
- Mobile: aborts drag on `__activeTouches > 1`

---

### `useBlockDragHandlers` (`src/hooks/useBlockDragHandlers.ts`)

```typescript
useBlockDragHandlers(
  id: string,
  canvasContextOverride?: CanvasContextType
) => { onDragStart: () => { onMove(deltaX, deltaY): void; onUp(): void } }
```

- Owns **canvas coordination**: which blocks/tracks/groupRects to move together, history management
- `onDragStart` is a stable `useCallback` — safe to pass as a dep to `useBlockDrag`'s effect
- Called by `NoteBlock`; result injected into `useBlockDrag` as `onDragStart`

---

### `useActiveCanvas` (`src/hooks/useActiveCanvas.ts`)

Two categories:

**Reactive hooks** (call at component top level, trigger re-renders on change):
```typescript
useActiveCanvasCamera()            // CameraState
useActiveCanvasGroupRects()        // GroupRect[]
useActiveCanvasTracks()            // Track[]
useActiveCanvasSelectedBlockIds()  // string[]
useActiveCanvasSelectedGroupRectIds()
```

**Snapshot getters** (use inside event handlers/effects, no re-renders):
```typescript
getBlocksForContext(ctx)
getCameraForContext(ctx)
getGroupRectsForContext(ctx)
getSelectedBlockIdsForContext(ctx)
getContextMenuForContext(ctx)
```

**Write helpers:**
```typescript
updateBlockInContext(ctx, id, updates)
updateBlocksInContext(ctx, updates[])
updateGroupRectInContext(ctx, id, updates)
updateTrackInContext(ctx, id, updates)
selectBlockInContext(ctx, id, multi?)
selectGroupRectInContext(ctx, id, multi?)
clearSelectionInContext(ctx)
openContextMenuInContext(ctx, state)
closeContextMenuInContext(ctx)
addBlocksToContext(ctx, blocks[])  // returns new block IDs
```

---

### `useCanvasCamera` (`src/hooks/useCanvasCamera.ts`)

Registers a `wheel` listener on `document`. Props:
```typescript
{
  isPlayMode: boolean
  isActive: boolean
  isGameCanvas?: boolean
  isEditorCanvas?: boolean
  onWheelIntercept?: (e: WheelEvent) => boolean  // return true to consume event
}
```
The `onWheelIntercept` is used by Canvas.tsx to handle pitch/volume adjustment on hover before falling through to zoom.

---

### `useDoubleClick` (`src/hooks/useDoubleClick.ts`)

```typescript
const { isDoubleClick } = useDoubleClick(threshold = 300);
// Call isDoubleClick() on pointer up:
// Returns true on the 2nd call within threshold ms, resets on true
```

---

### `useShortcuts` (`src/hooks/useShortcuts.ts`)

Keyboard bindings active in `context: 'playground' | 'editor' | 'game'`:

| Key | Action |
|-----|--------|
| Ctrl+C / Ctrl+V / Ctrl+D | Copy / Paste / Duplicate |
| Ctrl+A | Select all |
| Ctrl+Z / Ctrl+Y | Undo / Redo |
| Ctrl+F | Toggle outliner + focus search |
| Delete / Backspace | Delete selected |
| 1–6 | Switch mode (`select`, `draw_track`, `piano`, `drum`, `draw_group`, `play`) |
| User-defined key bindings | Trigger matching block/groupRect playback |

Disabled during: game play phase, input fields, pianoroll tab.

---

## 9. Audio System (`src/utils/audio.ts`)

```typescript
playNote(pitch: string, volume: number, instrument: string): void
setMasterVolume(v: number): void   // v: 0.0–1.0
```

**Instruments:**
| Instrument | Synth Type | Notes |
|-----------|------------|-------|
| `piano` | `PolySynth(Synth)` | triangle osc, attack 10ms, decay 500ms, sustain 0.2, release 1.2s |
| `synth` | `FMSynth` | harmonicity 3, modulation index 10 |
| `bass` | `MonoSynth` | sawtooth, lowpass filter, 2 octaves down |
| `percussion` | `DrumPool` | 4-voice round-robin NoiseSynth + MembraneSynth |

**Percussion pitches:**
| Pitch | Sound | Synth |
|-------|-------|-------|
| `kick` | C1 | MembraneSynth |
| `snare` | — | NoiseSynth (white, 5ms/100ms env) |
| `hihat` | — | NoiseSynth (pink, 1ms/100ms env) |
| `tom` | G2 | MembraneSynth |
| `cymbal` | — | NoiseSynth (white, 5ms/1.5s env) |

**Signal chain:** Synth → Compressor → Limiter → MasterGain (Tone.Destination)

`setMasterVolume(0–1)` maps linearly to log-scaled dB: `Tone.getDestination().volume.value = 20 * Math.log10(v)` (clamped to −60 dB at 0).

---

## 10. MIDI & Charting Workflow

```
Import MIDI file
  → midiImport.parseMidiFile(buffer)
  → ParsedMidiData { tracks: EditorTrack[], bpm, duration }

Level Editor — Pianoroll Tab
  → Visual note editing, velocity, track management

Level Editor — Charting Tab (ChartingTab.tsx)
  → Step through chartingNoteIndex (MIDI note by note)
  → Highlight candidate blocks (matching pitch/instrument)
  → User clicks a block → assignNoteTarget(noteId, trackId, blockId, 'block')
  → OR auto-chart: chartUtils.autoChart(midiData, { strategy, cdRadius, cdDuration })

buildGameEventsFromMidi(midiData)
  → GameEvent[] { time, pitch, instrument, blockId }
  → Stored in useLevelEditorStore.gameEvents & useGameStore.gameEvents

Export as .yblevel
  → levelUtils.saveLevelFile({ gameEvents, blocks, groupRects, … , audioBlob })
```

**`autoChart` strategies:**
- `nearest`: Assign to spatially nearest unoccupied block
- `roundRobin`: Cycle through blocks in order
- `random`: Random assignment
- Cooldown: A block can't be reused within `cdDuration` (0.15s default) seconds

**`matchRecordedHits(hits, events, tolerance=200ms)`**: Used after charting-record mode to auto-assign player-timed hits to MIDI notes.

---

## 11. Key Utilities

### `src/utils/canvasUtils.ts`
```typescript
snapValue(v: number, size = 30): number          // Round to nearest grid cell (30px)
clampZoom(z: number, min=0.1, max=5): number      // Clamp zoom range
getTouchDistance(t1: Touch, t2: Touch): number    // Euclidean distance
trySetPointerCapture(target, pointerId)           // Safe setPointerCapture (optional chaining)
tryReleasePointerCapture(target, pointerId)       // Safe releasePointerCapture (try/catch)
getCanvasContainerRect(ctx: CanvasContextType): DOMRect  // Bounding rect of canvas area
getCanvasCenter(ctx): { x, y }                    // Screen center of canvas
getCanvasCenterLocal(ctx): { x, y }               // Canvas-element-relative center (for camera math)
```

### `src/utils/dragUtils.ts`
```typescript
createDragHistoryGuard(adapter: HistoryAdapter): { onMove(): void, onUp(): void }
// onMove: pushUndoSnapshot + pauseHistory (once only)
// onUp: resumeHistory + commitHistory (always)
```

### `src/utils/geometry.ts`
```typescript
lineIntersectsRect(x1,y1, x2,y2, rx,ry, rw,rh): boolean
// Used by checkTrailIntersection to detect trail-block contact
```

### `src/utils/pitchUtils.ts`
```typescript
const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const PERCUSSION_PITCHES = ['kick','snare','hihat','tom','cymbal'];
shiftPitch(pitch: string, delta: number): string   // Shift by semitones, clamp C0–B8, wrap percussion
```

### `src/utils/colors.ts`
```typescript
getPitchColorNumber(pitch: string, pianoKeysCount: number): number  // 0xRRGGBB for Pixi
getPitchColorHex(pitch: string, pianoKeysCount: number): string     // '#rrggbb' for CSS
// Melodic: HSL hue gradient across pitch range (C3 onward), sat=80%, light=60%
// Percussion: fixed colors (kick=red, snare=blue, hihat=amber, tom=purple, cymbal=emerald)
```

### `src/utils/chartUtils.ts`
```typescript
buildGameEventsFromMidi(midiData, editorBlocks): GameEvent[]
autoChart(midiData, options): void                 // mutates note.targetBlockId
generateMissingBlocks(midiData, existingBlocks): Block[]  // 8-column grid layout
matchRecordedHits(hits, events, tolerance): Assignment[]
getAssignmentCounts(midiData): Map<blockId, count>
```

---

## 12. Mode & Phase System

**Mode** (in `useStore`, shared by playground canvas):
```
'select'      → Default; left-click selects/drags, right-click trails
'draw_track'  → Left-click background creates track nodes
'draw_group'  → Left-click drag draws GroupRect bounding box; double-click duplicates
'piano'       → Virtual piano keyboard panel is open
'drum'        → Virtual drum pad panel is open
'play'        → Pointer lock FPS-style navigation; trail fires at screen center
```

**Game Phase** (in `useGameStore`):
```
'upload'   → File selection screen
'arrange'  → Free block positioning (same canvas interactions as playground)
'play'     → Active gameplay; hit detection; score accumulation
'paused'   → Paused; 3-2-1 countdown on resume
'result'   → Score breakdown screen
```

**Editor Tab** (in `useLevelEditorStore`):
```
'pianoroll'  → Canvas-based MIDI note editor
'blocks'     → EditorCanvas for block placement + MIDI assignment
'charting'   → Step-by-step note→block assignment workflow
```

---

## 13. Group System

Groups allow multiple objects to move and be selected together.

```
groupSelected()
  → creates Group { id, name } in groups[]
  → sets groupId = group.id on all selectedBlockIds, selectedTrackIds, selectedGroupRectIds

ungroupSelected()
  → clears groupId from selected items
  → removes Group if it has no remaining members

Selection propagation:
  selectBlock(id) where block.groupId exists
    → auto-selects ALL blocks/tracks/groupRects with the same groupId
```

GroupRect is a separate concept: a visual rectangle that can trigger all blocks inside it. It can optionally have a `groupId` for group-level selection, but its trigger behavior is independent of the Group system.

---

## 14. Routing & Pages

**`src/App.tsx`** — HashRouter:
```
/           → HomePage
/playground → PlaygroundPage
/game       → GamePage
/level-editor → LevelEditorPage
*           → redirect to /
```

**`PlaygroundPage.tsx`** — Mounts `<SharedCanvas context="playground">`, toolbar, outliner, pocket view, keyboard instruments, settings panel.

**`LevelEditorPage.tsx`** — Mounts `<SharedCanvas context="editor">` wrapped in `<CanvasProvider type="editor">`, pianoroll, track panel, charting tab, audio waveform, playback bar. Handles drag-drop of MIDI and audio files.

**`GamePage.tsx`** — Mounts `<GameCanvas>` wrapped in `<CanvasProvider type="game">`. Manages game phase transitions: upload → arrange → play → result. Audio via `HTMLAudioElement` (not Tone.js). Supports fullscreen on mobile.

---

## 15. UI Components

| Component | Purpose |
|-----------|---------|
| `ContextMenu.tsx` | Context-aware popup for blocks (pitch, volume, instrument, alignment), groupRects (name, volume, keybinding), tracks (play/BPM/loop) |
| `OutlinerPanel.tsx` | Hierarchical tree of all blocks/groups/tracks; search; range select; camera-animate-to |
| `SelectionPropertiesHud.tsx` | Read-only HUD showing selected object properties |
| `SettingsPanel.tsx` | Theme, grid, volume, display settings; JSON save/load |
| `CanvasPlayerBar.tsx` | Editor playback controls (play/pause, seek, volume) |
| `PocketDragOverlay.tsx` | Semi-transparent ghost block following cursor when dragging from pocket canvas |

---

## 16. Editor Components

| Component | Purpose |
|-----------|---------|
| `PianoRoll.tsx` | Dual-canvas MIDI editor; ROW_HEIGHT=16px; left-click drag moves notes, edge-drag resizes, double-click adds |
| `PianoRollKeyboard.tsx` | Piano key sidebar (click to preview note) |
| `TrackPanel.tsx` | MIDI track list; add/duplicate/delete/rename/mute/ghost |
| `VelocityTab.tsx` | MIDI note velocity bar editor |
| `ChartingTab.tsx` | Note-by-note MIDI→block assignment; auto-skip; record mode |
| `LevelEditorToolbar.tsx` | Save/export/import/undo/redo toolbar |
