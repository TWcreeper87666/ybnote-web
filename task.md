# YBNote-Inspired Game Task List

## Phase 1: 專案初始化與基礎建設 (Project Setup)
- [x] 決定並初始化開發環境 (例如: Vite + React + PixiJS/Phaser)
- [x] 整合 Tone.js 作為音訊引擎
- [x] 實作基本的狀態管理架構 (Zustand/Redux)

## Phase 2: 核心畫布與互動 (Core Canvas & Interaction)
- [ ] 實作無邊際 2D 畫布
- [ ] 實作畫布平移 (`滑鼠中鍵按住拖曳`)
- [ ] 實作畫布縮放 (`Ctrl + 滑鼠滾輪`)
- [ ] 建立「音符方塊」元件 (包含高低音彩色漸層視覺設計)
- [ ] 實作方塊發聲：`左鍵點擊` 觸發 Tone.js 鋼琴音效
- [ ] 實作方塊移動：`滑鼠中鍵按住方塊` 拖曳
- [ ] 實作滑音發聲：`左鍵拖曳 (Hover)` 經過方塊即時發聲

## Phase 3: 工具列與編輯功能 (Toolbar & Editor UI)
- [ ] 實作右下角垂直工具列 UI
- [ ] 實作虛擬鋼琴鍵盤 UI (點擊發聲、顯示音名)
- [ ] 實作「從琴鍵拖曳至畫布產生音符方塊」的邏輯
- [ ] 實作刪除選取方塊功能
- [ ] 實作 Undo / Redo 歷史紀錄系統
- [ ] 實作設定面板 (切換主題亮/暗、網格開關、對齊開關)
- [ ] 實作定期自動存檔 (LocalStorage) 與 JSON 匯出/匯入功能

## Phase 4: 進階編輯與 UI 系統 (Advanced Features)
- [ ] 實作鍵盤綁定系統 (為方塊設定特定的按鍵觸發)
- [ ] 實作 `Ctrl + F` 搜尋功能 (尋找方塊並居中視角)
- [ ] 實作 Hierarchy 階層面板 UI (顯示清單)
- [ ] 實作群組功能 (Group / Ungroup)
- [ ] 實作常用快捷鍵 (複製/貼上/全選/多選/快速複製)

## Phase 5: 動態軌道系統 (Tracks & Sequencing)
- [ ] 實作軌道繪製功能 (直線/貝茲曲線)
- [ ] 實作觸發球 (Runner Ball) 沿軌道移動邏輯
- [ ] 實作觸發球碰撞/經過音符方塊發聲判定
- [ ] 實作軌道參數調整 (速度、循環、左右擺動 Sine wave)

## Phase 6: MIDI 匯入與遊戲模式 (Integration & Gameplay)
- [ ] 實作 MIDI 檔案解析與匯入功能
- [ ] 實作 MIDI 自動生成畫布方塊排列邏輯
- [ ] 實作 Osu! 節奏遊玩模式 (時間軸判定、分數計算、UI回饋)
- [ ] 遊戲整體拋光、音效優化與效能調校
