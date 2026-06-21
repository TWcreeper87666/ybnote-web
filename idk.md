# bug
audio delay when no interaction

## level-editor:
- ctrl+A no response
- group not working

- export loading icon

# making
record mode
midi import/export
export/ import icon??
level-editor
game

# new
new object: trigger
use same template for arrangement and level-editor
proper readme

# optimize

my ToolbarDivider is kinda useless


## components:
虛擬樂器面板的拖曳邏輯 (Piano / Drum Keyboard)
相關檔案：instruments/PianoKeyboard.tsx 與 instruments/DrumKeyboard.tsx
重複的地方： 這兩個檔案有大量完全相同的滑鼠事件處理程式碼。包含了：
面板本身的拖曳：用來讓視窗在螢幕上浮動移動的 isDraggingPiano / isDraggingDrum 邏輯。
拖曳新增方塊到畫布：處理從按鍵/打擊板拖曳出一個「半透明方塊」，並在滑鼠放開時計算對應的 PIXI Canvas 座標與「格線對齊 (Snap to Grid)」，最後新增到 Store 中。
重構方向：可以抽出 useDraggablePanel 與 useDragToCanvas 這兩個 Hooks，甚至將面板外框寫成一個共用的 <FloatingInstrumentPanel> 元件，未來若要新增吉他或貝斯面板，只要專心寫按鈕就好。








VERSION:2
BPM:120
OFFSET:0
TRIM_START:0
TRIM_END:0

# [BLOCKS] 段落
# 格式: id, x, y, pitch, instrument, volume
[BLOCKS]
b1,100,200,C4,piano,1
b2,150,200,E4,piano,1

# [EVENTS] 段落
# 格式: time, pitch, instrument, blockId
[EVENTS]
0.5,C4,piano,b1
1.0,E4,piano,b2

# [MIDI] 段落
# 格式: id, pitch, name, timeStart, duration, velocity
[MIDI]
m1,60,C4,0,0.5,100
