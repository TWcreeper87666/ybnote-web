# bug
audio delay when no interaction
holding key makes camera movement lag

# canvas
- pocket canavs drum

# muti tab
warning

# game page import .mid
midi note extract algorithm, only main melody(or unlimited noteblock and group rect?)
track select

# pocket canavs
- instrument filter, tracks filter?
- wrong drum display (level-editor's problem?)

# level-editor:
- help panel update
- remove velocity modify completely
- history fix
- charting weird as fuck
- midi scale: allow snap to grid(shift)
- pianoroll percussion fix 


# game
- do wrong notes play sound?
- key binding in game?
- level selector
- offset lol
- arrangement player drag music sync

# making
record mode
midi import/export
export/ import icon??

# to do
new object: trigger
yblevel: bg img(move a little with cursor)


# should I
mobile landspace
mobile editor/level-editor page

# optimize

charting render should not in noteblock
css seperate
template check
dup code check
types organize
mobile interact blue rect remove?
remove useless module
remove useless script

虛擬樂器面板的拖曳邏輯 (Piano / Drum Keyboard)
相關檔案：instruments/PianoKeyboard.tsx 與 instruments/DrumKeyboard.tsx
重複的地方： 這兩個檔案有大量完全相同的滑鼠事件處理程式碼。包含了：
面板本身的拖曳：用來讓視窗在螢幕上浮動移動的 isDraggingPiano / isDraggingDrum 邏輯。
拖曳新增方塊到畫布：處理從按鍵/打擊板拖曳出一個「半透明方塊」，並在滑鼠放開時計算對應的 PIXI Canvas 座標與「格線對齊 (Snap to Grid)」，最後新增到 Store 中。
重構方向：可以抽出 useDraggablePanel 與 useDragToCanvas 這兩個 Hooks，甚至將面板外框寫成一個共用的 <FloatingInstrumentPanel> 元件，未來若要新增吉他或貝斯面板，只要專心寫按鈕就好。







# lol

我也會這樣設計。

如果你已經有 `CanvasContextProvider` + `canvasAdapter` 的概念，那 **Provider 就應該把「目前 Canvas 的能力」全部提供出去**，而不是讓每個組件自己判斷：

```ts
canvasContext === 'editor'
  ? useLevelEditorStore.getState()
  : canvasContext === 'game'
  ? useGameStore.getState()
  : useStore.getState()
```

這其實代表 **DrumKeyboard 知道三個 Store 的存在**，耦合度很高。

---

## 現在的問題

你的組件現在知道：

* editor 用 `useLevelEditorStore`
* game 用 `useGameStore`
* preview 用 `useStore`

之後如果再新增

```
readonly
replay
spectator
...
```

每個地方都要改：

```ts
canvasContext === ...
```

這違反了 Open/Closed Principle。

---

## 比較好的做法

例如 Provider 提供

```ts
const {
    adapter,
    store,
} = useCanvas();
```

其中

```ts
store.addBlock(...)
store.deleteBlock(...)
store.moveBlocks(...)
store.getBlocks()
```

都是統一介面。

DrumKeyboard 就變成

```ts
const { adapter, store } = useCanvas();

...

const newBlockId = store.addBlock({
    pitch,
    x: newX,
    y: newY,
    instrument: "percussion",
});

adapter.selectBlock(newBlockId, false);
```

完全不知道底下是哪個 store。

---

## 或甚至更進一步

其實你現在都有

```ts
getCanvasAdapter(canvasContext)
```

代表 Adapter 已經在做抽象了。

那我甚至會把

```ts
addBlock
selectBlock
deleteBlock
moveBlock
```

全部都放進 Adapter。

例如

```ts
const canvas = useCanvas();

const id = canvas.addBlock(...);

canvas.selectBlock(id);
```

DrumKeyboard 就根本不知道：

* editor
* game
* preview

是哪一個。

---

## 為什麼現在會變成 `getState()`

因為你的 `handlePointerUp` 是：

```ts
document.addEventListener(...)
```

它不是 React render 期間。

所以不能

```ts
const addBlock = useLevelEditorStore(state => state.addBlock);
```

因為 callback 可能拿到舊 closure。

所以作者才直接

```ts
useLevelEditorStore.getState()
```

取得最新 state。

**但是取得最新 state 跟「知道是哪個 store」是兩件事。**

Provider 一樣可以提供

```ts
const store = useCanvasStore();
```

而 Provider 內部

```ts
switch(canvasContext){
    case 'editor':
        return useLevelEditorStore;
    case 'game':
        return useGameStore;
    default:
        return useStore;
}
```

最後組件只需要

```ts
const canvasStore = useCanvasStore();

...

canvasStore.getState().addBlock(...);
```

這樣仍然能取得最新 state，但不用知道到底是哪個 store。

---

我看了你目前的架構（`CanvasContext`、`canvasAdapter`、三個 Zustand Store），我會建議**再抽一層 `CanvasStoreAdapter` 或直接把 Store 能力整合進 `CanvasAdapter`**。這樣整個專案就不會再出現任何

```ts
canvasContext === 'editor'
    ? ...
    : ...
```

的判斷，所有元件都只面對一個統一的 Canvas API，後續新增新的 Canvas 類型時也只需要修改 Adapter/Provider，而不用修改所有 UI 元件。
