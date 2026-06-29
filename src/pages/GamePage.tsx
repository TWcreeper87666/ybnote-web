import { useEffect, useState, useRef } from "react";
import { GameCanvas } from "../components/canvas/GameCanvas";
import { CanvasProvider } from "../store/CanvasProvider";
import {
  parseMidiForGame, getMidiTrackInfos, monophonizeTrack,
  type MidiTrackInfo, type MonophonicMethod, type MidiTrackNote,
} from "../utils/midiUtils";
import { importLevel } from "../utils/levelUtils";
import { TrackSelectionModal, ModifyPanel } from "../components/game";
import {
  Upload,
  SkipForward,
  Plus,
  Undo2,
  Redo2,
  Settings,
  Play,
  Pause,
  Volume2,
  Maximize,
  HelpCircle,
  Home,
  LayoutList,
  Info,
  SlidersHorizontal,
} from "lucide-react";
import { SettingsPanel } from "../components/ui/SettingsPanel";
import { ModalPanel } from "../components/ui/ModalPanel";
import { OutlinerPanel } from "../components/ui/OutlinerPanel";
import { SelectionPropertiesHud } from "../components/ui/SelectionPropertiesHud";
import { FloatingWindow } from "../components/ui/FloatingWindow";
import { playNote } from "../utils/audio";
import { useStore } from "../store/useStore";
import { useGameStore } from "../store/useGameStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { useIsMobile } from "../hooks/useIsMobile";
import { useShortcuts } from "../hooks/useShortcuts";
import { useUIStore } from "../store/useUIStore";

let savedMetaPanelPos: { x: number; y: number } | undefined = undefined;

const ProgressBar: React.FC = () => {
  const barRef = useRef<HTMLDivElement>(null);
  const events = useGameStore.getState().gameEvents;
  const totalTime = events.length > 0 ? events[events.length - 1].time : 1;

  useEffect(() => {
    let rafId: number;
    const tick = () => {
      if (barRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const current = (window as any).__currentGameTime || 0;
        const progress = Math.max(0, Math.min(1, current / totalTime));
        barRef.current.style.width = `${progress * 100}%`;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [totalTime]);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 6,
        background: "rgba(255,255,255,0.1)",
        zIndex: 50,
        pointerEvents: "none",
      }}
    >
      <div
        ref={barRef}
        style={{
          height: "100%",
          background: "rgba(99, 102, 241, 0.8)",
          width: "0%",
          transition: "width 0.1s linear",
          boxShadow: "0 0 10px rgba(99, 102, 241, 0.5)",
        }}
      />
    </div>
  );
};

export const GamePage: React.FC = () => {
  const {
    gamePhase,
    setGamePhase,
    setBlocks: setGameBlocks,
    setGameEvents,
    gameScore,
    gameCombo,
    perfectCount,
    goodCount,
    badCount,
    missCount,
    wrongCount,
    maxCombo,
    setGameStats,
    resetGamePlay,
    gameEvents,
    gameFileName,
    setGameFileName,
    gameSpeed,
    setGameSpeed,
    latestHit,
    levelMetadata,
    setLevelMetadata,
    gameAudioUrl,
    setGameAudioUrl,
    gameAudioVolume,
    setGameAudioVolume,
  } = useGameStore();
  const { theme, mobileControlMode, setMobileControlMode } = useSettingsStore();
  const {
    toggleSettings,
    isTutorialOpen,
    toggleTutorial,
    isOutlinerOpen,
    toggleOutliner,
  } = useUIStore();
  const isMobile = useIsMobile();
  useShortcuts("game");
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [arrangeBy, setArrangeBy] = useState<"sequence" | "pitch">("sequence");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  // eslint-disable-next-line react-hooks/purity
  const previewStartTimeRef = useRef(Date.now());
  const previewTimeOffsetRef = useRef(0);
  const lastPlayedEventIndexRef = useRef(0);

  const [isMetaPanelOpen, setIsMetaPanelOpen] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [resumeCount, setResumeCount] = useState(3);
  const isResumingRef = useRef(false);

  const [pendingMidiFile, setPendingMidiFile] = useState<File | null>(null);
  const [currentMidiFile, setCurrentMidiFile] = useState<File | null>(null);
  const [midiTrackInfos, setMidiTrackInfos] = useState<MidiTrackInfo[]>([]);
  const [trackMode, setTrackMode] = useState<Map<number, "interactive" | "background" | "off">>(new Map());
  const [isModifyOpen, setIsModifyOpen] = useState(false);
  const [gridCols, setGridCols] = useState(8);

  useEffect(() => {
    isResumingRef.current = isResuming;
  }, [isResuming]);

  useEffect(() => {
    if (isResuming) {
      if (resumeCount > 0) {
        const timer = setTimeout(() => setResumeCount(resumeCount - 1), 500);
        return () => clearTimeout(timer);
      } else {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsResuming(false);
        setGamePhase("play");
      }
    }
  }, [isResuming, resumeCount, setGamePhase]);

  const requestFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
          console.warn(`Error attempting to enable fullscreen: ${err.message}`);
        });
      }
    } catch {
      console.warn("Fullscreen API not supported");
    }
  };

  // Keyboard and Pointer Lock listener for ESC to pause
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const phase = useGameStore.getState().gamePhase;
        if (phase === "play" || isResumingRef.current) {
          useGameStore.getState().setGamePhase("paused");
          if (isResumingRef.current) setIsResuming(false);
          if (document.pointerLockElement) {
            document.exitPointerLock();
          }
        }
      } else if (e.code === "Space") {
        const phase = useGameStore.getState().gamePhase;
        if (phase === "arrange") {
          e.preventDefault();
          setPreviewPlaying((prev) => {
            if (!prev) {
              previewStartTimeRef.current = Date.now();
              return true;
            }
            return false;
          });
        }
      }
    };

    const handlePointerLockChange = () => {
      if (!isMobile && !document.pointerLockElement) {
        const phase = useGameStore.getState().gamePhase;
        if (phase === "play") {
          useGameStore.getState().setGamePhase("paused");
        }
      }
    };

    const handleResize = () => {
      // Logic for resizing if needed
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "pointerlockchange",
        handlePointerLockChange,
      );
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [gamePhase, isMobile]);

  // Force-buffer audio as soon as the URL is available so first play has no delay
  useEffect(() => {
    if (audioRef.current && gameAudioUrl) {
      audioRef.current.load();
    }
  }, [gameAudioUrl]);

  // Audio playback for Play mode
  useEffect(() => {
    if (gamePhase !== "play") return;
    // Reset audio to start; game MIDI always starts from time 0
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    let rafId: number;
    let started = false;
    let syncCheckCounter = 0;
    const tick = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentSyncTime = (window as any).__currentGameTime ?? -800;

      if (audioRef.current && currentSyncTime >= 0) {
        if (!started) {
          audioRef.current.currentTime = currentSyncTime / 1000;
          audioRef.current.playbackRate = useGameStore.getState().gameSpeed;
          audioRef.current.play().catch((e) => console.warn(e));
          started = true;
          syncCheckCounter = 0;
        } else {
          // Periodic drift correction: every ~60 frames check audio vs MIDI clock
          syncCheckCounter++;
          if (syncCheckCounter % 60 === 0) {
            const audioPosMs = audioRef.current.currentTime * 1000;
            if (Math.abs(audioPosMs - currentSyncTime) > 200) {
              audioRef.current.currentTime = currentSyncTime / 1000;
            }
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    const audio = audioRef.current;
    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      if (audio) audio.pause();
    };
  }, [gamePhase]);

  // Preview Player Logic for Arrange mode
  useEffect(() => {
    if (audioRef.current) {
      if (gamePhase === "arrange" && previewPlaying) {
        const syncTime = previewTime;
        if (syncTime >= 0) {
          audioRef.current.currentTime = syncTime / 1000;
          audioRef.current.playbackRate = useGameStore.getState().gameSpeed;
          audioRef.current.play().catch((e) => console.warn(e));
        } else {
          audioRef.current.pause();
        }
      } else if (gamePhase === "arrange") {
        audioRef.current.pause();
      }
    }

    if (gamePhase !== "arrange" || !previewPlaying) return;

    let rafId: number;
    const maxTime =
      gameEvents.length > 0 ? gameEvents[gameEvents.length - 1].time + 1000 : 0;
    let lastTickTime = Date.now();

    const tick = () => {
      const now = Date.now();
      const delta = now - lastTickTime;
      lastTickTime = now;

      previewTimeOffsetRef.current += delta * useGameStore.getState().gameSpeed;
      const elapsed = previewTimeOffsetRef.current;

      if (elapsed >= maxTime) {
        setPreviewPlaying(false);
        setPreviewTime(0);
        previewTimeOffsetRef.current = 0;
        lastPlayedEventIndexRef.current = 0;
        return;
      }

      setPreviewTime(elapsed);

      const events = useGameStore.getState().gameEvents;
      while (
        lastPlayedEventIndexRef.current < events.length &&
        events[lastPlayedEventIndexRef.current].time <= elapsed
      ) {
        const ev = events[lastPlayedEventIndexRef.current];
        if (ev.blockId === "background") {
          playNote(ev.pitch, gameAudioVolume, ev.instrument);
        } else {
          const b = useGameStore
            .getState()
            .blocks.find((blk) => blk.id === ev.blockId);
          if (b) {
            playNote(b.pitch, (b.volume ?? 1) * gameAudioVolume, b.instrument);
            useGameStore.getState().updateBlock(b.id, { playedAt: Date.now() });
          }
        }
        lastPlayedEventIndexRef.current++;
      }

      rafId = requestAnimationFrame(tick);
    };

    lastTickTime = Date.now();
    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamePhase, previewPlaying, gameEvents]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setPreviewTime(time);
    previewTimeOffsetRef.current = time;
    previewStartTimeRef.current = Date.now();
    if (audioRef.current) {
      audioRef.current.currentTime = time / 1000;
    }
    const idx = gameEvents.findIndex((ev) => ev.time > time);
    lastPlayedEventIndexRef.current = idx !== -1 ? idx : gameEvents.length;
  };

  useEffect(() => {
    setGamePhase("upload");
    setGameStats({ gameScore: 0, gameCombo: 0 });
    return () => setGamePhase("upload");
  }, [setGamePhase, setGameStats]);

  useEffect(() => {
    if (gamePhase === "play") {
      useStore.setState({
        isTutorialOpen: false,
        isSettingsOpen: false,
        isHelpOpen: false,
      } as never);
    }
  }, [gamePhase]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (file.name.endsWith(".yblevel")) {
        const { levelData, audioBlob } = await importLevel(file);
        if (audioBlob) {
          const url = URL.createObjectURL(audioBlob);
          setGameAudioUrl(url);
        } else {
          setGameAudioUrl(null);
        }
        setGameFileName(file.name);
        setGameBlocks(
          levelData.blocks.map((b) => ({
            id: b.id,
            x: b.x,
            y: b.y,
            pitch: b.pitch,
            instrument: b.instrument,
            volume: b.volume,
          })),
        );
        setGameEvents(levelData.events);
        setLevelMetadata({
          title: levelData.title,
          author: levelData.author,
          description: levelData.description,
          midiCredit: levelData.midiCredit,
          musicCredit: levelData.musicCredit,
        });
        setGamePhase("arrange");
        setIsMetaPanelOpen(true);
        let avgX = 0,
          avgY = 0;
        if (levelData.blocks.length > 0) {
          avgX =
            levelData.blocks.reduce((sum, b) => sum + b.x, 0) /
            levelData.blocks.length;
          avgY =
            levelData.blocks.reduce((sum, b) => sum + b.y, 0) /
            levelData.blocks.length;
        }
        const cam = {
          x: window.innerWidth / 2 - avgX,
          y: window.innerHeight / 2 - avgY,
          zoom: 1,
        };
        useStore.getState().updateCamera(cam);
        useGameStore.getState().updateCamera(cam);
      } else {
        const trackInfos = await getMidiTrackInfos(file);
        const initialMode = new Map<number, "interactive" | "background" | "off">();
        trackInfos.forEach((info) =>
          initialMode.set(info.index, info.suggestInteractive ? "interactive" : "background"),
        );
        setMidiTrackInfos(trackInfos);
        setTrackMode(initialMode);
        setPendingMidiFile(file);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to import file");
    }
  };

  const handleDefaultImport = async () => {
    try {
      const url = `${import.meta.env.BASE_URL}default.mid`;
      const response = await fetch(url);
      if (!response.ok)
        throw new Error("Default MIDI not found in public folder");
      const blob = await response.blob();
      const file = new File([blob], "default.mid", { type: "audio/midi" });

      const trackInfos = await getMidiTrackInfos(file);
      const initialMode = new Map<number, "interactive" | "background" | "off">();
      trackInfos.forEach((info) =>
        initialMode.set(info.index, info.suggestInteractive ? "interactive" : "background"),
      );
      setMidiTrackInfos(trackInfos);
      setTrackMode(initialMode);
      setPendingMidiFile(file);
    } catch (err) {
      console.error(err);
      alert(
        "Failed to load default MIDI. Make sure default.mid is in the public/ folder.",
      );
    }
  };

  const applyReimport = async (
    activeTrackMode: Map<number, "interactive" | "background" | "off">,
    activeInfos: MidiTrackInfo[],
    toastMsg = "Re-imported",
  ) => {
    if (!currentMidiFile) return;
    const interactive = new Set<number>();
    const background = new Set<number>();
    activeTrackMode.forEach((mode, idx) => {
      if (mode === "interactive") interactive.add(idx);
      else if (mode === "background") background.add(idx);
    });
    const noteOverrides = new Map<number, MidiTrackNote[]>();
    activeInfos.forEach((info) => noteOverrides.set(info.index, info.notes));
    const { gameBlocks, gameEvents } = await parseMidiForGame(
      currentMidiFile, arrangeBy, interactive, background, noteOverrides,
    );
    setGameBlocks(gameBlocks);
    setGameEvents(gameEvents);
    useGameStore.getState().commitHistory();
    let avgX = 0, avgY = 0;
    if (gameBlocks.length > 0) {
      avgX = gameBlocks.reduce((sum, b) => sum + b.x, 0) / gameBlocks.length;
      avgY = gameBlocks.reduce((sum, b) => sum + b.y, 0) / gameBlocks.length;
    }
    const cam = { x: window.innerWidth / 2 - avgX, y: window.innerHeight / 2 - avgY, zoom: 1 };
    useStore.getState().updateCamera(cam);
    useGameStore.getState().updateCamera(cam);
    useStore.getState().showToast(toastMsg);
  };

  const handleReimport = async () => {
    try {
      await applyReimport(trackMode, midiTrackInfos);
    } catch (err) {
      console.error(err);
      alert("Failed to re-import");
    }
  };

  const handleTrackModeChange = (
    trackIndex: number,
    mode: "interactive" | "background" | "off",
  ) => {
    setTrackMode((prev) => {
      const next = new Map(prev);
      next.set(trackIndex, mode);
      return next;
    });
  };

  const handleMonophonize = async (trackIndex: number, method: MonophonicMethod) => {
    const newInfos = midiTrackInfos.map((info) =>
      info.index === trackIndex
        ? { ...info, notes: monophonizeTrack(info.notes, method) }
        : info,
    );
    setMidiTrackInfos(newInfos);
    try {
      await applyReimport(trackMode, newInfos, `Monophonized: ${method}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTrackModalConfirm = async () => {
    if (!pendingMidiFile) return;
    const interactive = new Set<number>();
    const background = new Set<number>();
    trackMode.forEach((mode, idx) => {
      if (mode === "interactive") interactive.add(idx);
      else if (mode === "background") background.add(idx);
    });
    try {
      const { gameBlocks, gameEvents } = await parseMidiForGame(
        pendingMidiFile,
        arrangeBy,
        interactive,
        background,
      );
      setGameFileName(pendingMidiFile.name);
      setGameBlocks(gameBlocks);
      setGameEvents(gameEvents);
      setLevelMetadata(null);
      setCurrentMidiFile(pendingMidiFile);
      setPendingMidiFile(null);
      setGamePhase("arrange");
      setIsMetaPanelOpen(true);
      let avgX = 0, avgY = 0;
      if (gameBlocks.length > 0) {
        avgX = gameBlocks.reduce((sum, b) => sum + b.x, 0) / gameBlocks.length;
        avgY = gameBlocks.reduce((sum, b) => sum + b.y, 0) / gameBlocks.length;
      }
      const cam = {
        x: window.innerWidth / 2 - avgX,
        y: window.innerHeight / 2 - avgY,
        zoom: 1,
      };
      useStore.getState().updateCamera(cam);
      useGameStore.getState().updateCamera(cam);
    } catch (err) {
      console.error(err);
      alert("Failed to import file");
    }
  };

  return (
    <div
      className={`app-container ${theme}`}
      onContextMenu={(e) => e.preventDefault()}
      style={{ overflow: "hidden", touchAction: "none", userSelect: "none" }}
    >
      <audio
        ref={audioRef}
        src={gameAudioUrl || undefined}
        preload="auto"
        style={{ display: "none" }}
      />
      <div className="main-wrapper">
        {/* Render Canvas */}
        {["arrange", "play", "paused"].includes(gamePhase) && <GameCanvas />}

        {/* Upload Overlay */}
        {gamePhase === "upload" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--bg-primary)",
              zIndex: 20,
            }}
          >
            <h1 style={{ color: "var(--text-primary)", marginBottom: 20 }}>
              Rhythm Game Mode
            </h1>
            <p
              style={{
                color: "var(--text-secondary)",
                marginBottom: 40,
                textAlign: "center",
                maxWidth: 400,
              }}
            >
              Upload a MIDI file or .yblevel to generate a beatmap. Arrange the
              blocks freely before starting the game.
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "24px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "12px 24px",
                    background: "#6366f1",
                    color: "white",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 18,
                    fontWeight: "bold",
                  }}
                >
                  <Upload size={24} />
                  Select MIDI or .yblevel
                  <input
                    type="file"
                    accept=".mid,.midi,.yblevel"
                    style={{ display: "none" }}
                    onChange={handleImport}
                  />
                </label>
                <button
                  onClick={handleDefaultImport}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "12px 24px",
                    background: "rgba(99, 102, 241, 0.2)",
                    color: "var(--text-primary)",
                    border: "2px solid #6366f1",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 18,
                    fontWeight: "bold",
                  }}
                >
                  <Play size={24} />
                  Play Default MIDI
                </button>
              </div>

              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <span style={{ color: "white", fontWeight: "bold" }}>
                  Sort By:
                </span>
                <select
                  value={arrangeBy}
                  onChange={(e) =>
                    setArrangeBy(e.target.value as "sequence" | "pitch")
                  }
                  style={{
                    padding: "8px 12px",
                    background: "rgba(0,0,0,0.5)",
                    color: "white",
                    border: "1px solid rgba(255,255,255,0.4)",
                    borderRadius: 8,
                    fontSize: 16,
                    cursor: "pointer",
                    outline: "none",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  <option value="sequence">Sequence</option>
                  <option value="pitch">Pitch</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {pendingMidiFile !== null && (
          <TrackSelectionModal
            trackInfos={midiTrackInfos}
            trackMode={trackMode}
            setTrackMode={setTrackMode}
            onConfirm={handleTrackModalConfirm}
            onClose={() => setPendingMidiFile(null)}
          />
        )}

        {/* Arrangement Overlay */}
        {gamePhase === "arrange" && (
          <>
            {/* Back to Home Button */}
            <button
              onClick={() => {
                setGamePhase("upload");
                setGameFileName(null);
              }}
              style={{
                position: "absolute",
                top: 20,
                left: 20,
                zIndex: 30,
                padding: "12px",
                background: "rgba(0,0,0,0.5)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backdropFilter: "blur(4px)",
                cursor: "pointer",
              }}
              title="Back to Main"
            >
              <Home size={24} />
            </button>

            {/* Top Controls */}
            <div
              style={{
                position: "absolute",
                top: 20,
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                alignItems: "center",
                gap: 12,
                zIndex: 10,
                pointerEvents: "auto",
              }}
            >
              <select
                value={gameSpeed}
                onChange={(e) => setGameSpeed(parseFloat(e.target.value))}
                style={{
                  padding: "8px 12px",
                  background: "rgba(0,0,0,0.5)",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.4)",
                  borderRadius: 8,
                  fontSize: 16,
                  cursor: "pointer",
                  outline: "none",
                  backdropFilter: "blur(4px)",
                }}
              >
                <option value="0.25">0.25x</option>
                <option value="0.5">0.5x</option>
                <option value="0.75">0.75x</option>
                <option value="1">1.0x</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2.0x</option>
              </select>

              <select
                value={mobileControlMode}
                onChange={(e) =>
                  setMobileControlMode(e.target.value as "crosshair" | "touch")
                }
                style={{
                  padding: "8px 12px",
                  background: "rgba(0,0,0,0.5)",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.4)",
                  borderRadius: 8,
                  fontSize: 16,
                  cursor: "pointer",
                  outline: "none",
                  backdropFilter: "blur(4px)",
                }}
              >
                <option value="touch">Normal Mode</option>
                <option value="crosshair">Crosshair Mode</option>
              </select>

              <button
                onClick={() => {
                  resetGamePlay();
                  useStore.getState().clearSelection();
                  setPreviewPlaying(false);
                  setGamePhase("play");
                  if (isMobile) requestFullscreen();
                }}
                className="primary-btn"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 24px",
                  borderRadius: 20,
                  cursor: "pointer",
                  fontSize: 16,
                  fontWeight: "bold",
                  border: "none",
                }}
              >
                <SkipForward size={20} />
                Start
              </button>
            </div>

            {/* Toolbar Actions */}
            <div
              className="toolbar glass-panel"
              style={{ zIndex: 10 }}
              onWheel={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                className="toolbar-btn glass-panel"
                onClick={() => {
                  const gs = useGameStore.getState();
                  if (gs.historyIndex <= 0) {
                    useStore.getState().showToast("Nothing to undo");
                  } else {
                    gs.undo();
                    useStore.getState().showToast("Undo");
                  }
                }}
                title="Undo"
              >
                <Undo2 size={24} />
              </button>
              <button
                className="toolbar-btn glass-panel"
                onClick={() => {
                  const gs = useGameStore.getState();
                  if (gs.historyIndex >= gs.history.length - 1) {
                    useStore.getState().showToast("Nothing to redo");
                  } else {
                    gs.redo();
                    useStore.getState().showToast("Redo");
                  }
                }}
                title="Redo"
              >
                <Redo2 size={24} />
              </button>
              <button
                className={`toolbar-btn glass-panel ${isModifyOpen ? "active-panel-btn" : ""}`}
                onClick={() => setIsModifyOpen((v) => !v)}
                title="Modify"
              >
                <SlidersHorizontal size={24} />
              </button>

              <button
                className={`toolbar-btn glass-panel ${isOutlinerOpen ? "active-panel-btn" : ""}`.trim()}
                onClick={() => toggleOutliner()}
                title="Outliner"
              >
                <LayoutList size={24} />
              </button>
              <button
                className={`toolbar-btn glass-panel ${isMetaPanelOpen ? "active-panel-btn" : ""}`.trim()}
                onClick={() => setIsMetaPanelOpen((v) => !v)}
                title="Level Info"
              >
                <Info size={24} />
              </button>
              <button
                className="toolbar-btn glass-panel"
                onClick={toggleSettings}
                title="Settings"
              >
                <Settings size={24} />
              </button>
              <button
                className="toolbar-btn glass-panel"
                onClick={toggleTutorial}
                title="Tutorial"
              >
                <HelpCircle size={24} />
              </button>
            </div>

            {/* Outliner Panel Render */}
            <CanvasProvider type="game">
              <OutlinerPanel />
              <SelectionPropertiesHud bottomOffset={100} />
            </CanvasProvider>

            {/* Level Info Panel */}
            <FloatingWindow
              title="Level Info"
              isOpen={isMetaPanelOpen}
              onClose={() => setIsMetaPanelOpen(false)}
              initialPosition={
                savedMetaPanelPos ?? {
                  x: Math.round(window.innerWidth / 2 - 160),
                  y: Math.round(window.innerHeight / 2 - 140),
                }
              }
              initialSize={{ width: 320, height: 280 }}
              onPositionChange={(pos) => { savedMetaPanelPos = pos; }}
            >
              <div
                className="outliner-content"
                style={{
                  gap: 10,
                  flex: 1,
                  fontSize: 13,
                  color: "var(--text-primary)",
                }}
              >
                {[
                  { label: "Title", value: levelMetadata?.title || gameFileName || "—" },
                  { label: "Chart Author", value: levelMetadata?.author },
                  { label: "Description", value: levelMetadata?.description },
                  { label: "Music Credit", value: levelMetadata?.musicCredit },
                  { label: "MIDI Credit", value: levelMetadata?.midiCredit },
                ]
                  .filter((row) => row.value)
                  .map((row) => (
                    <div key={row.label}>
                      <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 2 }}>
                        {row.label}
                      </div>
                      <div style={{ wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                        {row.value}
                      </div>
                    </div>
                  ))}
              </div>
            </FloatingWindow>

            <ModifyPanel
              isOpen={isModifyOpen}
              onClose={() => setIsModifyOpen(false)}
              midiTrackInfos={midiTrackInfos}
              trackMode={trackMode}
              onTrackModeChange={handleTrackModeChange}
              onMonophonize={handleMonophonize}
              currentMidiFile={currentMidiFile}
              onReimport={handleReimport}
              gridCols={gridCols}
              setGridCols={setGridCols}
            />

            {/* Bottom Mini Player */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                padding: "16px 24px",
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.9), transparent)",
                zIndex: 10,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  color: "white",
                  pointerEvents: "auto",
                  width: "fit-content",
                }}
              >
                <div style={{ fontSize: 18, fontWeight: "bold" }}>
                  {levelMetadata?.title || gameFileName || "Unknown MIDI"}
                </div>
                {levelMetadata?.author && (
                  <div style={{ fontSize: 14, opacity: 0.8 }}>
                    by {levelMetadata.author}
                  </div>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  pointerEvents: "auto",
                }}
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    if (previewPlaying) {
                      setPreviewPlaying(false);
                    } else {
                      setPreviewPlaying(true);
                      previewStartTimeRef.current = Date.now();
                    }
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  {previewPlaying ? <Pause size={28} /> : <Play size={28} />}
                </button>

                <input
                  type="range"
                  min="0"
                  max={
                    gameEvents.length > 0
                      ? gameEvents[gameEvents.length - 1].time + 1000
                      : 0
                  }
                  value={previewTime}
                  onChange={handleSeek}
                  style={{ flex: 1, accentColor: "#6366f1", cursor: "pointer" }}
                />

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Volume2 size={20} color="white" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={gameAudioVolume}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setGameAudioVolume(v);
                      if (audioRef.current) audioRef.current.volume = v;
                    }}
                    style={{
                      width: 80,
                      accentColor: "#6366f1",
                      cursor: "pointer",
                    }}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Play Overlay */}
        {gamePhase === "play" && (
          <>
            <ProgressBar />
            {latestHit && latestHit.type !== "Miss" && (
              <div
                key={`bg-${latestHit.time}`}
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  background: `radial-gradient(circle, transparent 0%, rgba(${(latestHit.color >> 16) & 255}, ${(latestHit.color >> 8) & 255}, ${latestHit.color & 255}, 0.2) 100%)`,
                  animation: "flashBg 0.5s ease-out forwards",
                  zIndex: 4,
                }}
              />
            )}
            {/* Vignette */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background:
                  "radial-gradient(circle, transparent 20%, rgba(0,0,0,0.85) 100%)",
                zIndex: 5,
              }}
            />

            {/* Crosshair */}
            {mobileControlMode === "crosshair" && (
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "none",
                  opacity: 0.5,
                  color: "white",
                  zIndex: 11,
                }}
              >
                <Plus size={32} strokeWidth={1.5} />
              </div>
            )}

            {/* Score and Combo */}
            <div
              style={{
                position: "absolute",
                top: 20,
                right: 40,
                color: "white",
                textAlign: "right",
                pointerEvents: "none",
                zIndex: 10,
              }}
            >
              <div
                style={{
                  fontSize: 48,
                  fontWeight: "bold",
                  fontFamily: "monospace",
                  textShadow: "0 2px 10px rgba(0,0,0,0.5)",
                }}
              >
                {gameScore.toString().padStart(6, "0")}
              </div>
              {gameCombo > 2 && (
                <div
                  style={{
                    fontSize: 32,
                    color: "#6366f1",
                    fontWeight: "bold",
                    textShadow: "0 2px 10px rgba(0,0,0,0.5)",
                  }}
                >
                  {gameCombo}x Combo
                </div>
              )}
            </div>

            {/* Hit Result Popup */}
            <div
              style={{
                position: "absolute",
                top: isMobile ? 20 : 160,
                left: "50%",
                transform: "translateX(-50%)",
                textAlign: "center",
                pointerEvents: "none",
                zIndex: 10,
              }}
            >
              {latestHit && (
                <div
                  key={latestHit.time}
                  style={{
                    fontSize: 48,
                    fontWeight: "bold",
                    color:
                      latestHit.type === "Miss"
                        ? "#ef4444"
                        : latestHit.type === "Perfect"
                          ? "#60a5fa"
                          : latestHit.type === "Good"
                            ? "#4ade80"
                            : latestHit.type === "Wrong"
                              ? "#c084fc"
                              : "#facc15",
                    textShadow: "0 0 10px rgba(0,0,0,0.8)",
                    animation: "popAndFade 1s forwards",
                  }}
                >
                  {latestHit.type}
                </div>
              )}
            </div>

            {/* Hit Error Bar */}
            <div
              style={{
                position: "absolute",
                bottom: isMobile ? 10 : 60,
                left: "50%",
                transform: "translateX(-50%)",
                width: isMobile ? 300 : 400,
                height: 8,
                background: "rgba(0,0,0,0.6)",
                borderRadius: 4,
                pointerEvents: "none",
                zIndex: 10,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: "rgba(255,255,255,0.8)",
                  transform: "translateX(-50%)",
                }}
              />
              {latestHit && (
                <div
                  key={`hit-${latestHit.time}`}
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    width: 4,
                    background:
                      latestHit.type === "Miss" ? "#ef4444" : "#60a5fa",
                    left: `calc(50% + ${(latestHit.offset / 200) * 50}%)`,
                    transform: "translateX(-50%)",
                    opacity: 1,
                    animation: "fadeOut 2s forwards",
                    boxShadow: "0 0 4px rgba(255,255,255,0.5)",
                  }}
                />
              )}
            </div>

            {/* Mobile Pause Button */}
            {isMobile && (
              <button
                onClick={() => setGamePhase("paused")}
                style={{
                  position: "absolute",
                  top: 20,
                  left: 20,
                  zIndex: 30,
                  padding: "12px",
                  background: "rgba(0,0,0,0.5)",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backdropFilter: "blur(4px)",
                  cursor: "pointer",
                }}
              >
                <Pause size={24} />
              </button>
            )}
          </>
        )}

        {/* Pause Overlay */}
        {gamePhase === "paused" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.8)",
              zIndex: 40,
            }}
          >
            {isResuming ? (
              <div
                key={resumeCount}
                style={{
                  color: "white",
                  fontSize: 120,
                  fontWeight: "bold",
                  animation: "zoomIn 0.5s ease-out forwards",
                  textShadow: "0 0 20px rgba(99, 102, 241, 0.8)",
                }}
              >
                {resumeCount}
              </div>
            ) : (
              <>
                <h2 style={{ color: "white", fontSize: 48, marginBottom: 40 }}>
                  Paused
                </h2>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 16 }}
                >
                  <button
                    onClick={() => {
                      setIsResuming(true);
                      setResumeCount(3);
                    }}
                    style={{
                      padding: "12px 32px",
                      fontSize: 20,
                      cursor: "pointer",
                      borderRadius: 8,
                      background: "#6366f1",
                      color: "white",
                      border: "none",
                    }}
                  >
                    Resume
                  </button>
                  <button
                    onClick={() => {
                      resetGamePlay();
                      setIsResuming(true);
                      setResumeCount(3);
                    }}
                    style={{
                      padding: "12px 32px",
                      fontSize: 20,
                      cursor: "pointer",
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.1)",
                      color: "white",
                      border: "1px solid rgba(255,255,255,0.3)",
                    }}
                  >
                    Restart
                  </button>
                  <button
                    onClick={() => {
                      resetGamePlay();
                      setPreviewPlaying(false);
                      setGamePhase("arrange");
                    }}
                    style={{
                      padding: "12px 32px",
                      fontSize: 20,
                      cursor: "pointer",
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.1)",
                      color: "white",
                      border: "1px solid rgba(255,255,255,0.3)",
                    }}
                  >
                    Back to Arrange
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Result Overlay */}
        {gamePhase === "result" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.9)",
              zIndex: 40,
              animation: "fadeIn 0.5s forwards",
            }}
          >
            {/* Left info panel */}
            {!isMobile && (
              <div
                style={{
                  position: "absolute",
                  left: 32,
                  top: 32,
                  maxWidth: 240,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  padding: "20px 22px",
                  backdropFilter: "blur(8px)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  animation: "slideInUp 0.5s forwards",
                  animationDelay: "0.15s",
                  opacity: 0,
                  animationFillMode: "forwards",
                }}
              >
                {[
                  { label: "Title", value: levelMetadata?.title || gameFileName || "—" },
                  { label: "Chart Author", value: levelMetadata?.author },
                  { label: "Description", value: levelMetadata?.description },
                  { label: "Music Credit", value: levelMetadata?.musicCredit },
                  { label: "MIDI Credit", value: levelMetadata?.midiCredit },
                ]
                  .filter((row) => row.value)
                  .map((row) => (
                    <div key={row.label}>
                      <div style={{ fontSize: 10, opacity: 0.45, marginBottom: 3, letterSpacing: "0.05em", textTransform: "uppercase", color: "white" }}>
                        {row.label}
                      </div>
                      <div style={{ fontSize: 14, color: "white", wordBreak: "break-word", whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
                        {row.value}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            <h2
              style={{
                color: "white",
                fontSize: isMobile ? 28 : 56,
                marginBottom: isMobile ? 4 : 10,
                textShadow: "0 4px 20px rgba(99,102,241,0.5)",
                animation: "slideInUp 0.5s forwards",
              }}
            >
              Level Cleared
            </h2>
            <div
              style={{
                color: "rgba(255,255,255,0.7)",
                fontSize: isMobile ? 12 : 18,
                marginBottom: isMobile ? 8 : 24,
                animation: "slideInUp 0.5s forwards",
                animationDelay: "0.05s",
                opacity: 0,
                animationFillMode: "forwards",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  color: "white",
                  fontWeight: "bold",
                  fontSize: "1.2em",
                }}
              >
                {levelMetadata?.title || gameFileName || "Unknown Level"}
              </div>
              <div>Speed: {gameSpeed}x</div>
              <div>
                Mode:{" "}
                {mobileControlMode === "crosshair" ? "Crosshair" : "Normal"}
              </div>
            </div>
            <div
              style={{
                color: "#a5b4fc",
                fontSize: isMobile ? 16 : 24,
                marginBottom: isMobile ? 8 : 40,
                animation: "slideInUp 0.5s forwards",
                animationDelay: "0.1s",
                opacity: 0,
                animationFillMode: "forwards",
              }}
            >
              Score:{" "}
              <span style={{ color: "white", fontWeight: "bold" }}>
                {gameScore}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: isMobile ? 4 : 12,
                width: isMobile ? "220px" : "300px",
                marginBottom: isMobile ? 16 : 40,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: isMobile ? 14 : 20,
                  animation: "slideInUp 0.5s forwards",
                  animationDelay: "0.2s",
                  opacity: 0,
                  animationFillMode: "forwards",
                }}
              >
                <span style={{ color: "#60a5fa", fontWeight: "bold" }}>
                  Perfect
                </span>
                <span style={{ color: "white" }}>{perfectCount}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: isMobile ? 14 : 20,
                  animation: "slideInUp 0.5s forwards",
                  animationDelay: "0.3s",
                  opacity: 0,
                  animationFillMode: "forwards",
                }}
              >
                <span style={{ color: "#4ade80", fontWeight: "bold" }}>
                  Good
                </span>
                <span style={{ color: "white" }}>{goodCount}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: isMobile ? 14 : 20,
                  animation: "slideInUp 0.5s forwards",
                  animationDelay: "0.4s",
                  opacity: 0,
                  animationFillMode: "forwards",
                }}
              >
                <span style={{ color: "#facc15", fontWeight: "bold" }}>
                  Bad
                </span>
                <span style={{ color: "white" }}>{badCount}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: isMobile ? 14 : 20,
                  animation: "slideInUp 0.5s forwards",
                  animationDelay: "0.5s",
                  opacity: 0,
                  animationFillMode: "forwards",
                }}
              >
                <span style={{ color: "#ef4444", fontWeight: "bold" }}>
                  Miss
                </span>
                <span style={{ color: "white" }}>{missCount}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: isMobile ? 14 : 20,
                  animation: "slideInUp 0.5s forwards",
                  animationDelay: "0.55s",
                  opacity: 0,
                  animationFillMode: "forwards",
                }}
              >
                <span style={{ color: "#c084fc", fontWeight: "bold" }}>
                  Wrong
                </span>
                <span style={{ color: "white" }}>{wrongCount}</span>
              </div>
              <div
                style={{
                  height: 1,
                  background: "rgba(255,255,255,0.2)",
                  margin: isMobile ? "2px 0" : "8px 0",
                  animation: "slideInUp 0.5s forwards",
                  animationDelay: "0.6s",
                  opacity: 0,
                  animationFillMode: "forwards",
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: isMobile ? 14 : 20,
                  animation: "slideInUp 0.5s forwards",
                  animationDelay: "0.7s",
                  opacity: 0,
                  animationFillMode: "forwards",
                }}
              >
                <span style={{ color: "#c084fc", fontWeight: "bold" }}>
                  Max Combo
                </span>
                <span style={{ color: "white" }}>{maxCombo}</span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: isMobile ? 8 : 16,
                animation: "slideInUp 0.5s forwards",
                animationDelay: "0.9s",
                opacity: 0,
                animationFillMode: "forwards",
              }}
            >
              <button
                onClick={() => {
                  resetGamePlay();
                  setGamePhase("paused");
                  setTimeout(() => {
                    setIsResuming(true);
                    setResumeCount(3);
                  }, 0);
                }}
                style={{
                  padding: isMobile ? "10px 24px" : "12px 32px",
                  fontSize: isMobile ? 16 : 20,
                  cursor: "pointer",
                  borderRadius: 8,
                  background: "#6366f1",
                  color: "white",
                  border: "none",
                  fontWeight: "bold",
                }}
              >
                Play Again
              </button>
              <button
                onClick={() => {
                  resetGamePlay();
                  setPreviewPlaying(false);
                  setGamePhase("arrange");
                }}
                style={{
                  padding: isMobile ? "10px 24px" : "12px 32px",
                  fontSize: isMobile ? 16 : 20,
                  cursor: "pointer",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.1)",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.3)",
                  fontWeight: "bold",
                }}
              >
                Back to Arrange
              </button>
            </div>
          </div>
        )}

        {/* Settings Panel Render */}
        <div style={{ zIndex: 50 }}>
          <SettingsPanel hideProjectActions />
        </div>

        {/* Tutorial Overlay */}
        <ModalPanel
          title="How to Play"
          isOpen={isTutorialOpen}
          onClose={toggleTutorial}
          className="tutorial-overlay"
        >
          <ul
            style={{
              color: "var(--settings-text-muted)",
              lineHeight: 1.6,
              paddingLeft: 20,
            }}
          >
            <li>
              <b>Arrange Phase:</b> Drag blocks to map out the song. You can
              zoom (scroll/pinch) and pan (middle-click/drag).
            </li>
            <li style={{ marginTop: 8 }}>
              <b>Preview:</b> Right-click and drag (or long press and drag on
              mobile) to draw a particle trail to preview notes.
            </li>
            <li style={{ marginTop: 8 }}>
              <b>Play Phase (Normal Mode):</b> Click/Tap and drag to slash
              through the notes as they appear. You can freely zoom using the
              scroll wheel or pinch gesture.
            </li>
            <li style={{ marginTop: 8 }}>
              <b>Play Phase (Crosshair Mode):</b> On PC, your mouse aims the
              center crosshair (like an FPS). On Mobile, drag on the right side
              of the screen to aim, and tap the left side to hit.
            </li>
            <li style={{ marginTop: 8 }}>
              <b>Scoring:</b> Hit the blocks exactly when the shrinking square
              aligns with them! Better accuracy gives higher points and combo
              multipliers.
            </li>
          </ul>
        </ModalPanel>

        {/* Mobile Fullscreen Button */}
        {isMobile && !isFullscreen && gamePhase !== "play" && (
          <button
            onClick={requestFullscreen}
            style={{
              position: "absolute",
              top: 20,
              left: 20,
              zIndex: 100,
              padding: "12px",
              background: "rgba(0,0,0,0.5)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(4px)",
            }}
          >
            <Maximize size={24} />
          </button>
        )}
      </div>
    </div>
  );
};
