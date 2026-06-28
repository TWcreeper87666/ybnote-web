# bug
audio delay when no interaction
holding key makes camera movement lag

# muti tab
warning

# midi
整理樂器script, 方便新增
midi note extract algorithm, only main melody(or unlimited noteblock and group rect?)

# group rect
- add pitch modifier

# pocket canavs
- instrument filter, tracks filter?

# level-editor:
- help panel update
- remove velocity modify completely
- history fix
- tab memory


# game
- do wrong notes play sound?
- key binding in game?
- level selector
- offset lol
- arrangement player drag music sync
- crosshair mode, any key treats as hit key

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