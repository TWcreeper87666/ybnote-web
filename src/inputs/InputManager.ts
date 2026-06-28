export type InputCallback = (code: string, e: KeyboardEvent) => void;
export type PointerCallback = (e: PointerEvent) => void;
export type WheelCallback = (e: WheelEvent) => void;

// 1. 建立一個事件對照表 (EventMap) 來管理所有的事件與對應的回呼型別
export interface EventMap {
  keydown: InputCallback;
  keyup: InputCallback;
  pointerdown: PointerCallback;
  pointermove: PointerCallback;
  pointerup: PointerCallback;
  wheel: WheelCallback;
}

class InputManager {
  // --- 狀態儲存 ---
  private down = new Set<string>();

  // 追蹤所有游標/觸控點的狀態 (PointerID -> 座標)
  public pointers = new Map<number, { x: number; y: number }>();

  // 2. 透過泛型讓 listeners 自動綁定 EventMap 裡的型別，避免使用 any
  private listeners: { [K in keyof EventMap]: Set<EventMap[K]> } = {
    keydown: new Set(),
    keyup: new Set(),
    pointerdown: new Set(),
    pointermove: new Set(),
    pointerup: new Set(),
    wheel: new Set(),
  };

  constructor() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);

    window.addEventListener("pointerdown", this.onPointerDown, { passive: false });
    window.addEventListener("pointermove", this.onPointerMove, { passive: false });
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp); 
    
    window.addEventListener("wheel", this.onWheel, { passive: false });
  }

  // ===== 鍵盤處理 =====
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return; 
    if (!this.down.has(e.code)) {
      this.down.add(e.code);
      this.listeners.keydown.forEach((callback) => callback(e.code, e));
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.down.delete(e.code);
    this.listeners.keyup.forEach((callback) => callback(e.code, e));
  };

  // ===== 游標 / 觸控處理 =====
  private onPointerDown = (e: PointerEvent) => {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.listeners.pointerdown.forEach((callback) => callback(e));
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.pointers.has(e.pointerId)) {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    this.listeners.pointermove.forEach((callback) => callback(e));
  };

  private onPointerUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    this.listeners.pointerup.forEach((callback) => callback(e));
  };

  private onWheel = (e: WheelEvent) => {
    this.listeners.wheel.forEach((callback) => callback(e));
  };

  // ===== 訂閱 API (使用泛型取代多載，完美解決 TS2769 與 any 問題) =====
  
  public on<K extends keyof EventMap>(event: K, callback: EventMap[K]): () => void {
    // 透過強制轉型讓 TS 確信取出的 Set 對應正確的回呼型別 (消除泛型展開的不確定性)
    const set = this.listeners[event] as Set<EventMap[K]>;
    set.add(callback);
    return () => this.off(event, callback); 
  }

  public off<K extends keyof EventMap>(event: K, callback: EventMap[K]): void {
    const set = this.listeners[event] as Set<EventMap[K]>;
    set.delete(callback);
  }

  // ===== 狀態查詢 API =====

  /** 檢查某個按鍵是否正被按下 */
  public isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** 取得目前的觸控點數量 */
  public get pointerCount(): number {
    return this.pointers.size;
  }
  
  /** 取得所有活躍中游標/觸控點的陣列 */
  public getPointers(): { x: number; y: number }[] {
    return Array.from(this.pointers.values());
  }

  /** 取得特定觸控點的座標 */
  public getPointer(pointerId: number): { x: number; y: number } | undefined {
    return this.pointers.get(pointerId);
  }
}

// 匯出 Singleton 實例
export const inputManager = new InputManager();