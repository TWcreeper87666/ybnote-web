import { useEffect, useRef, useState, useCallback } from "react";
import { useGameStore } from "../store/useGameStore";
import { getPitchColorNumber } from "../utils/colors";
import { playNote } from "../utils/audio";
import { lineIntersectsRect } from "../utils/geometry";
import { shiftPitch } from "../utils/pitchUtils";

const APPROACH_TIME = 800;
const HIT_WINDOW = 200;

interface ApproachCircleData {
  id: string;
  eventTime: number;
  x: number;
  y: number;
  color: number;
  progress: number;
  blockId: string;
  pitch: string;
  instrument: string;
}

export const useApproachCircles = (
  intersectedBlocksRef: React.MutableRefObject<Set<string>>,
) => {
  const { gameEvents, gamePhase, setGameStats, gameResetCount } = useGameStore();

  const gameTimeRef = useRef(-APPROACH_TIME);
  
  // 修正 [react-hooks/purity]：不在 Render 階段呼叫 Date.now()，改在 Tick 初始化
  const lastTickTimeRef = useRef<number>(0);
  
  const pendingCirclesRef = useRef(gameEvents.filter((e) => e.blockId !== "background").sort((a, b) => a.time - b.time));
  const pendingBgAudioRef = useRef(gameEvents.filter((e) => e.blockId === "background").sort((a, b) => a.time - b.time));
  const activeCirclesRef = useRef<ApproachCircleData[]>([]);
  
  const [activeCirclesState, setActiveCirclesState] = useState<ApproachCircleData[]>([]);
  const tickCounter = useRef(0);

  // 監聽遊戲重置，重新初始化陣列
  useEffect(() => {
    gameTimeRef.current = -APPROACH_TIME;
    pendingCirclesRef.current = gameEvents.filter((e) => e.blockId !== "background").sort((a, b) => a.time - b.time);
    pendingBgAudioRef.current = gameEvents.filter((e) => e.blockId === "background").sort((a, b) => a.time - b.time);
    activeCirclesRef.current = [];
    intersectedBlocksRef.current.clear();
    lastTickTimeRef.current = 0; // 重置 Tick 時間

    // 修正 [react-hooks/set-state-in-effect]：
    // 使用 requestAnimationFrame 延遲狀態更新，避免在 useEffect 同步觸發級聯渲染
    requestAnimationFrame(() => {
      setActiveCirclesState([]);
    });
  }, [gameResetCount, gameEvents, intersectedBlocksRef]);

  // 打擊判定核心邏輯
  const attemptHit = useCallback((blockId: string) => {
    const gs = useGameStore.getState();
    const b = gs.blocks.find((blk) => blk.id === blockId);
    
    if (b) {
      const containingRect = gs.groupRects.find(g =>
        g.enabled !== false &&
        b.x < g.x + g.w && b.x + 60 > g.x && b.y < g.y + g.h && b.y + 60 > g.y
      );
      const effectivePitch = containingRect?.pitchOffset ? shiftPitch(b.pitch, containingRect.pitchOffset) : b.pitch;
      playNote(effectivePitch, b.volume, b.instrument);
      gs.updateBlock(b.id, { playedAt: Date.now() });
    }

    if (gs.gamePhase !== "play") return;
    const elapsedTime = gameTimeRef.current;
    
    let bestHitIndex = -1;
    let minTimeDiff = Infinity;

    for (let i = 0; i < activeCirclesRef.current.length; i++) {
      const circle = activeCirclesRef.current[i];
      if (circle.blockId === blockId) {
        const timeDiff = Math.abs(elapsedTime - circle.eventTime);
        if (timeDiff < HIT_WINDOW && timeDiff < minTimeDiff) {
          minTimeDiff = timeDiff;
          bestHitIndex = i;
        }
      }
    }

    const hitCircle = bestHitIndex !== -1 ? activeCirclesRef.current[bestHitIndex] : null;

    if (hitCircle) {
      const offset = elapsedTime - hitCircle.eventTime;
      activeCirclesRef.current.splice(bestHitIndex, 1);

      let points = 50, type: "Perfect" | "Good" | "Bad" = "Bad";
      if (minTimeDiff < 50) {
        points = 300;
        type = "Perfect";
      } else if (minTimeDiff < 100) {
        points = 100;
        type = "Good";
      }

      const newCombo = gs.gameCombo + 1;
      
      // 修正 [@typescript-eslint/no-explicit-any]：提取 Zustand Store 方法的正確參數型別
      type GameStatsUpdate = Parameters<typeof gs.setGameStats>[0];
      
      const newStats: GameStatsUpdate = {
        gameScore: gs.gameScore + points,
        gameCombo: newCombo,
        maxCombo: Math.max(gs.maxCombo, newCombo),
        latestHit: { type, offset, time: Date.now(), color: hitCircle.color },
      };
      
      if (type === "Perfect") newStats.perfectCount = gs.perfectCount + 1;
      else if (type === "Good") newStats.goodCount = gs.goodCount + 1;
      else if (type === "Bad") newStats.badCount = gs.badCount + 1;

      setGameStats(newStats);
      setActiveCirclesState([...activeCirclesRef.current]);
    } else {
      setGameStats({
        gameScore: Math.max(0, gs.gameScore - 50),
        gameCombo: 0,
        wrongCount: gs.wrongCount + 1,
        latestHit: {
          type: "Wrong",
          offset: 0,
          time: Date.now(),
          color: b?.pitch ? getPitchColorNumber(b.pitch, 36) : 0xffffff,
        },
      });
    }
  }, [setGameStats]);

  const checkTrailIntersection = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    const currentFrameIntersected = new Set<string>();
    useGameStore.getState().blocks.forEach((b) => {
      if (lineIntersectsRect(x1, y1, x2, y2, b.x, b.y, 60, 60)) {
        currentFrameIntersected.add(b.id);
        if (!intersectedBlocksRef.current.has(b.id)) attemptHit(b.id);
      }
    });
    intersectedBlocksRef.current = currentFrameIntersected;
  }, [attemptHit, intersectedBlocksRef]);

  // Pixi Ticker 遊戲迴圈
  const handleTick = useCallback(() => {
    const now = Date.now();
    // 首次 Tick 初始化時間
    if (lastTickTimeRef.current === 0) lastTickTimeRef.current = now;
    
    const delta = now - lastTickTimeRef.current;
    lastTickTimeRef.current = now;
    
    if (gamePhase !== "play") return;

    const gs = useGameStore.getState();
    const speed = gs.gameSpeed;
    gameTimeRef.current += delta * speed;
    const elapsedTime = gameTimeRef.current;
    window.__currentGameTime = elapsedTime;

    while (pendingCirclesRef.current.length > 0) {
      const nextEvent = pendingCirclesRef.current[0];
      if (elapsedTime >= nextEvent.time - APPROACH_TIME) {
        pendingCirclesRef.current.shift();
        const b = gs.blocks.find((blk) => blk.id === nextEvent.blockId);
        if (b) {
          activeCirclesRef.current.push({
            id: Math.random().toString(),
            eventTime: nextEvent.time,
            x: b.x,
            y: b.y,
            color: getPitchColorNumber(b.pitch, 36),
            progress: 0,
            blockId: b.id,
            pitch: b.pitch,
            instrument: b.instrument ?? "piano",
          });
        }
      } else break;
    }

    while (pendingBgAudioRef.current.length > 0) {
      const nextEvent = pendingBgAudioRef.current[0];
      if (elapsedTime >= nextEvent.time) {
        pendingBgAudioRef.current.shift();
        playNote(nextEvent.pitch, 1, nextEvent.instrument);
      } else break;
    }

    let stateChanged = false;
    for (let i = activeCirclesRef.current.length - 1; i >= 0; i--) {
      const circle = activeCirclesRef.current[i];
      circle.progress = (elapsedTime - (circle.eventTime - APPROACH_TIME)) / APPROACH_TIME;

      if (elapsedTime > circle.eventTime + HIT_WINDOW) {
        activeCirclesRef.current.splice(i, 1);
        setGameStats({
          gameCombo: 0,
          missCount: useGameStore.getState().missCount + 1,
          latestHit: {
            type: "Miss",
            offset: HIT_WINDOW,
            time: Date.now(),
            color: circle.color,
          },
        });
        stateChanged = true;
      }
    }

    if (pendingCirclesRef.current.length === 0 && activeCirclesRef.current.length === 0) {
      const lastEventTime = gameEvents.length > 0 ? gameEvents[gameEvents.length - 1].time : 0;
      if (elapsedTime > lastEventTime + HIT_WINDOW + 1500) {
        useGameStore.getState().setGamePhase("result");
        return;
      }
    }

    tickCounter.current++;
    if (tickCounter.current % 2 === 0 || stateChanged) {
      setActiveCirclesState([...activeCirclesRef.current]);
    }
  }, [gamePhase, gameEvents, setGameStats]);

  return {
    activeCirclesState,
    handleTick,
    checkTrailIntersection,
  };
};