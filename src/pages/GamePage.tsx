import { useEffect, useState, useRef } from 'react';
import { GameCanvas } from '../components/canvas/GameCanvas';
import { parseMidiForGame } from '../utils/midiUtils';
import { importLevel } from '../utils/levelUtils';
import { Upload, SkipForward, Plus, Undo2, Redo2, Settings, Play, Pause, Volume2, Maximize, HelpCircle, Home, LayoutList } from 'lucide-react';
import { SettingsPanel } from '../components/ui/SettingsPanel';
import { ModalPanel } from '../components/ui/ModalPanel';
import { OutlinerPanel } from '../components/ui/OutlinerPanel';
import { playNote } from '../utils/audio';
import { useStore, undoAction, redoAction } from '../store/useStore';
import { useLevelEditorStore } from '../store/useLevelEditorStore';
import { useIsMobile } from '../hooks/useIsMobile';
import { useShortcuts } from '../hooks/useShortcuts';
const ProgressBar: React.FC = () => {
  const barRef = useRef<HTMLDivElement>(null);
  const events = useStore.getState().gameEvents;
  const totalTime = events.length > 0 ? events[events.length - 1].time : 1;

  useEffect(() => {
    let rafId: number;
    const tick = () => {
      if (barRef.current) {
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
     <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: 'rgba(255,255,255,0.1)', zIndex: 50, pointerEvents: 'none' }}>
        <div ref={barRef} style={{ height: '100%', background: 'rgba(99, 102, 241, 0.8)', width: '0%', transition: 'width 0.1s linear', boxShadow: '0 0 10px rgba(99, 102, 241, 0.5)' }} />
     </div>
  );
};

export const GamePage: React.FC = () => {
  const { theme, gameState, setGameState, setGameBlocks, setGameEvents, gameScore, gameCombo, perfectCount, goodCount, badCount, missCount, wrongCount, maxCombo, setGameStats, resetGamePlay, gameEvents, gameFileName, setGameFileName, gameSpeed, setGameSpeed, toggleSettings, isTutorialOpen, toggleTutorial, latestHit, mobileControlMode, setMobileControlMode, levelMetadata, setLevelMetadata, gameAudioUrl, setGameAudioUrl, gameAudioVolume, setGameAudioVolume } = useStore();
  const isMobile = useIsMobile();
  useShortcuts();
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [arrangeBy, setArrangeBy] = useState<'sequence' | 'pitch'>('sequence');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const previewStartTimeRef = useRef(Date.now());
  const previewTimeOffsetRef = useRef(0);
  const lastPlayedEventIndexRef = useRef(0);
  
  const [isResuming, setIsResuming] = useState(false);
  const [resumeCount, setResumeCount] = useState(3);
  const isResumingRef = useRef(false);

  useEffect(() => {
     isResumingRef.current = isResuming;
  }, [isResuming]);

  useEffect(() => {
    if (isResuming) {
      if (resumeCount > 0) {
        const timer = setTimeout(() => setResumeCount(resumeCount - 1), 500);
        return () => clearTimeout(timer);
      } else {
        setIsResuming(false);
        setGameState('play');
      }
    }
  }, [isResuming, resumeCount, setGameState]);

  const requestFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.warn(`Error attempting to enable fullscreen: ${err.message}`);
        });
      }
    } catch (e) {
      console.warn("Fullscreen API not supported");
    }
  };

  // Keyboard and Pointer Lock listener for ESC to pause
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const state = useStore.getState().gameState;
        if (state === 'play' || isResumingRef.current) {
           useStore.getState().setGameState('paused');
           if (isResumingRef.current) setIsResuming(false);
           if (document.pointerLockElement) {
             document.exitPointerLock();
           }
        }
      } else if (e.code === 'Space') {
        const state = useStore.getState().gameState;
        if (state === 'arrange') {
           e.preventDefault(); // Prevent scrolling
           setPreviewPlaying(prev => {
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
        const state = useStore.getState().gameState;
        if (state === 'play') {
          useStore.getState().setGameState('paused');
        }
      }
    };

    const handleResize = () => {
      // Logic for resizing if needed
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [gameState, isMobile]);


  // Audio playback for Play mode
  useEffect(() => {
    if (gameState !== 'play') return;
    let rafId: number;
    let started = false;
    const tick = () => {
      const currentSyncTime = (window as any).__currentGameTime;
      const offset = useLevelEditorStore.getState().offset;

      if (audioRef.current && (currentSyncTime + offset) >= 0) {
        if (!started) {
          audioRef.current.currentTime = (currentSyncTime + offset) / 1000;
          audioRef.current.playbackRate = useStore.getState().gameSpeed;
          audioRef.current.play().catch(e => console.warn(e));
          started = true;
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      if (audioRef.current) audioRef.current.pause();
    };
  }, [gameState]);

  // Preview Player Logic for Arrange mode
  useEffect(() => {
      if (audioRef.current) {
         if (gameState === 'arrange' && previewPlaying) {
            const offset = useLevelEditorStore.getState().offset;
            const syncTime = previewTime + offset;
           if (syncTime >= 0) {
              audioRef.current.currentTime = syncTime / 1000;
              audioRef.current.playbackRate = useStore.getState().gameSpeed;
              audioRef.current.play().catch(e => console.warn(e));
           } else {
              audioRef.current.pause();
           }
        } else if (gameState === 'arrange') {
           audioRef.current.pause();
        }
     }

     if (gameState !== 'arrange' || !previewPlaying) return;

     let rafId: number;
     const maxTime = gameEvents.length > 0 ? gameEvents[gameEvents.length - 1].time + 1000 : 0;
     let lastTickTime = Date.now();

     const tick = () => {
         const now = Date.now();
         const delta = now - lastTickTime;
         lastTickTime = now;
         
         previewTimeOffsetRef.current += delta * useStore.getState().gameSpeed;
         const elapsed = previewTimeOffsetRef.current;
         
         if (elapsed >= maxTime) {
             setPreviewPlaying(false);
             setPreviewTime(0);
             previewTimeOffsetRef.current = 0;
             lastPlayedEventIndexRef.current = 0;
             return;
         }

         setPreviewTime(elapsed);

         const events = useStore.getState().gameEvents;
          while (lastPlayedEventIndexRef.current < events.length && events[lastPlayedEventIndexRef.current].time <= elapsed) {
             const ev = events[lastPlayedEventIndexRef.current];
             if (ev.blockId === 'background') {
                playNote(ev.pitch, gameAudioVolume, ev.instrument);
             } else {
                const b = useStore.getState().gameBlocks.find(blk => blk.id === ev.blockId);
                if (b) {
                   playNote(b.pitch, (b.volume ?? 1) * gameAudioVolume, b.instrument);
                   useStore.getState().updateGameBlock(b.id, { playedAt: Date.now() });
                }
             }
             lastPlayedEventIndexRef.current++;
         }

         rafId = requestAnimationFrame(tick);
     };

     lastTickTime = Date.now();
     rafId = requestAnimationFrame(tick);
     
     return () => cancelAnimationFrame(rafId);
  }, [gameState, previewPlaying, gameEvents]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value);
      setPreviewTime(time);
      previewTimeOffsetRef.current = time;
      previewStartTimeRef.current = Date.now();
      
      const idx = gameEvents.findIndex(ev => ev.time > time);
      lastPlayedEventIndexRef.current = idx !== -1 ? idx : gameEvents.length;
  };

  useEffect(() => {
     // Reset game state on mount/unmount
     setGameState('upload');
     setGameStats({ gameScore: 0, gameCombo: 0 });
     return () => setGameState('upload');
  }, [setGameState, setGameStats]);

  useEffect(() => {
    if (gameState === 'play') {
       useStore.setState({ isTutorialOpen: false, isSettingsOpen: false, isHelpOpen: false } as any);
    }
  }, [gameState]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (file.name.endsWith('.yblevel')) {
        // Import .yblevel package
        const { levelData, audioBlob } = await importLevel(file);
        if (audioBlob) {
            const url = URL.createObjectURL(audioBlob);
            setGameAudioUrl(url);
        } else {
            setGameAudioUrl(null);
        }
        setGameFileName(file.name);
        setGameBlocks(levelData.blocks.map(b => ({
          id: b.id,
          x: b.x,
          y: b.y,
          pitch: b.pitch,
          instrument: b.instrument,
          volume: b.volume,
        })));
        setGameEvents(levelData.events);
        setLevelMetadata({
          title: levelData.title,
          author: levelData.author,
          description: levelData.description,
          midiCredit: levelData.midiCredit
        });
        setGameState('arrange');
        let avgX = 0, avgY = 0;
        if (levelData.blocks.length > 0) {
           avgX = levelData.blocks.reduce((sum, b) => sum + b.x, 0) / levelData.blocks.length;
           avgY = levelData.blocks.reduce((sum, b) => sum + b.y, 0) / levelData.blocks.length;
        }
        const cam = { x: window.innerWidth / 2 - avgX, y: window.innerHeight / 2 - avgY, zoom: 1 };
        useStore.getState().updateCamera(cam);
        useStore.getState().updateGameCamera(cam);
      } else {
        // Import .mid/.midi
        const { gameBlocks, gameEvents } = await parseMidiForGame(file, arrangeBy);
        setGameFileName(file.name);
        setGameBlocks(gameBlocks);
        setGameEvents(gameEvents);
        setLevelMetadata(null);
        setGameState('arrange');
        let avgX = 0, avgY = 0;
        if (gameBlocks.length > 0) {
           avgX = gameBlocks.reduce((sum, b) => sum + b.x, 0) / gameBlocks.length;
           avgY = gameBlocks.reduce((sum, b) => sum + b.y, 0) / gameBlocks.length;
        }
        const cam = { x: window.innerWidth / 2 - avgX, y: window.innerHeight / 2 - avgY, zoom: 1 };
        useStore.getState().updateCamera(cam);
        useStore.getState().updateGameCamera(cam);
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
      if (!response.ok) throw new Error('Default MIDI not found in public folder');
      const blob = await response.blob();
      const file = new File([blob], 'default.mid', { type: 'audio/midi' });
      
      const { gameBlocks, gameEvents } = await parseMidiForGame(file, arrangeBy);
      setGameFileName('default.mid');
      setGameBlocks(gameBlocks);
      setGameEvents(gameEvents);
      setLevelMetadata(null);
      setGameState('arrange');
      let avgX = 0, avgY = 0;
      if (gameBlocks.length > 0) {
         avgX = gameBlocks.reduce((sum, b) => sum + b.x, 0) / gameBlocks.length;
         avgY = gameBlocks.reduce((sum, b) => sum + b.y, 0) / gameBlocks.length;
      }
      const cam = { x: window.innerWidth / 2 - avgX, y: window.innerHeight / 2 - avgY, zoom: 1 };
      useStore.getState().updateCamera(cam);
      useStore.getState().updateGameCamera(cam);
    } catch (err) {
      console.error(err);
      alert("Failed to load default MIDI. Make sure default.mid is in the public/ folder.");
    }
  };


  return (
    <div 
      className={`app-container ${theme}`}
      onContextMenu={(e) => e.preventDefault()}
      style={{ overflow: 'hidden', touchAction: 'none', userSelect: 'none' }}
    >
      <audio ref={audioRef} src={gameAudioUrl || undefined} style={{ display: 'none' }} />
      <div className="main-wrapper">
        
        {/* Render Canvas */}
        {['arrange', 'play', 'paused'].includes(gameState) && (
           <GameCanvas />
        )}

        {/* Upload Overlay */}
        {gameState === 'upload' && (
           <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', zIndex: 20 }}>
              <h1 style={{ color: 'var(--text-primary)', marginBottom: 20 }}>Rhythm Game Mode</h1>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 40, textAlign: 'center', maxWidth: 400 }}>
                 Upload a MIDI file or .yblevel to generate a beatmap. Arrange the blocks freely before starting the game.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: '#6366f1', color: 'white', borderRadius: 8, cursor: 'pointer', fontSize: 18, fontWeight: 'bold' }}>
                     <Upload size={24} />
                     Select MIDI or .yblevel
                     <input type="file" accept=".mid,.midi,.yblevel" style={{ display: 'none' }} onChange={handleImport} />
                  </label>
                  <button 
                    onClick={handleDefaultImport}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: 'rgba(99, 102, 241, 0.2)', color: 'var(--text-primary)', border: '2px solid #6366f1', borderRadius: 8, cursor: 'pointer', fontSize: 18, fontWeight: 'bold' }}
                  >
                    <Play size={24} />
                    Play Default MIDI
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'white', fontWeight: 'bold' }}>Sort By:</span>
                  <select 
                    value={arrangeBy} 
                    onChange={(e) => setArrangeBy(e.target.value as 'sequence' | 'pitch')}
                    style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 8, fontSize: 16, cursor: 'pointer', outline: 'none', backdropFilter: 'blur(4px)' }}
                  >
                    <option value="sequence">Sequence</option>
                    <option value="pitch">Pitch</option>
                  </select>
                </div>
              </div>
           </div>
        )}
        
        {/* Arrangement Overlay */}
        {gameState === 'arrange' && (
            <>
              {/* Back to Home Button */}
              <button
                 onClick={() => {
                   setGameState('upload');
                   setGameFileName(null);
                 }}
                 style={{
                   position: 'absolute',
                   top: 20,
                   left: 20,
                   zIndex: 30,
                   padding: '12px',
                   background: 'rgba(0,0,0,0.5)',
                   color: 'white',
                   border: '1px solid rgba(255,255,255,0.3)',
                   borderRadius: '8px',
                   display: 'flex',
                   alignItems: 'center',
                   justifyContent: 'center',
                   backdropFilter: 'blur(4px)',
                   cursor: 'pointer'
                 }}
                 title="Back to Main"
              >
                 <Home size={24} />
              </button>

              {/* Top Controls */}
              <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 12, zIndex: 10, pointerEvents: 'auto' }}>
                <select 
                  value={gameSpeed} 
                  onChange={(e) => setGameSpeed(parseFloat(e.target.value))}
                  style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 8, fontSize: 16, cursor: 'pointer', outline: 'none', backdropFilter: 'blur(4px)' }}
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
                     onChange={(e) => setMobileControlMode(e.target.value as 'crosshair' | 'touch')}
                     style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 8, fontSize: 16, cursor: 'pointer', outline: 'none', backdropFilter: 'blur(4px)' }}
                   >
                     <option value="touch">Normal Mode</option>
                     <option value="crosshair">Crosshair Mode</option>
                   </select>

                <button 
                  onClick={() => {
                     resetGamePlay();
                     useStore.getState().clearSelection();
                     setPreviewPlaying(false);
                     setGameState('play');
                     if (isMobile) requestFullscreen();
                  }}
                  className="primary-btn"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 24px', borderRadius: 20, cursor: 'pointer', fontSize: 16, fontWeight: 'bold', border: 'none' }}
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
                <button className="toolbar-btn glass-panel" onClick={() => undoAction()} title="Undo"><Undo2 size={24} /></button>
                <button className="toolbar-btn glass-panel" onClick={() => redoAction()} title="Redo"><Redo2 size={24} /></button>
                <button className="toolbar-btn glass-panel" onClick={() => useStore.getState().toggleOutliner()} title="Outliner"><LayoutList size={24} /></button>
                <button className="toolbar-btn glass-panel" onClick={toggleSettings} title="Settings"><Settings size={24} /></button>
                <button className="toolbar-btn glass-panel" onClick={toggleTutorial} title="Tutorial"><HelpCircle size={24} /></button>
              </div>

              {/* Outliner Panel Render */}
              <OutlinerPanel />

              {/* Bottom Mini Player */}
              <div 
                 style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 24px', background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 12, pointerEvents: 'none' }}
              >
                 <div style={{ color: 'white', pointerEvents: 'auto', width: 'fit-content' }}>
                    <div style={{ fontSize: 18, fontWeight: 'bold' }}>{levelMetadata?.title || gameFileName || 'Unknown MIDI'}</div>
                    {levelMetadata?.author && <div style={{ fontSize: 14, opacity: 0.8 }}>by {levelMetadata.author}</div>}
                 </div>
                 <div 
                    style={{ display: 'flex', alignItems: 'center', gap: 16, pointerEvents: 'auto' }}
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
                      style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}
                    >
                      {previewPlaying ? <Pause size={28} /> : <Play size={28} />}
                    </button>
                    
                    <input 
                      type="range"
                      min="0"
                      max={gameEvents.length > 0 ? gameEvents[gameEvents.length - 1].time + 1000 : 0}
                      value={previewTime}
                      onChange={handleSeek}
                      style={{ flex: 1, accentColor: '#6366f1', cursor: 'pointer' }}
                    />

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                         style={{ width: 80, accentColor: '#6366f1', cursor: 'pointer' }}
                       />
                    </div>
                 </div>
              </div>
            </>
        )}

        {/* Play Overlay */}
        {gameState === 'play' && (
           <>
             <ProgressBar />
             {latestHit && latestHit.type !== 'Miss' && (
                 <div 
                   key={`bg-${latestHit.time}`}
                   style={{
                     position: 'absolute',
                     inset: 0,
                     pointerEvents: 'none',
                     background: `radial-gradient(circle, transparent 0%, rgba(${(latestHit.color >> 16) & 255}, ${(latestHit.color >> 8) & 255}, ${latestHit.color & 255}, 0.2) 100%)`,
                     animation: 'flashBg 0.5s ease-out forwards',
                     zIndex: 4
                   }}
                 />
             )}
             {/* Vignette */}
             <div 
               style={{
                 position: 'absolute',
                 inset: 0,
                 pointerEvents: 'none',
                 background: 'radial-gradient(circle, transparent 20%, rgba(0,0,0,0.85) 100%)',
                 zIndex: 5
               }}
             />
             
             {/* Crosshair */}
             {mobileControlMode === 'crosshair' && (
               <div
                 style={{
                   position: 'absolute',
                   top: '50%',
                   left: '50%',
                   transform: 'translate(-50%, -50%)',
                   pointerEvents: 'none',
                   opacity: 0.5,
                   color: 'white',
                   zIndex: 11
                 }}
               >
                 <Plus size={32} strokeWidth={1.5} />
               </div>
             )}

              {/* Score and Combo */}
             <div style={{ position: 'absolute', top: 20, right: 40, color: 'white', textAlign: 'right', pointerEvents: 'none', zIndex: 10 }}>
               <div style={{ fontSize: 48, fontWeight: 'bold', fontFamily: 'monospace', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                  {gameScore.toString().padStart(6, '0')}
               </div>
               {gameCombo > 2 && (
                   <div style={{ fontSize: 32, color: '#6366f1', fontWeight: 'bold', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                      {gameCombo}x Combo
                   </div>
               )}
             </div>

             {/* Hit Result Popup */}
             <div style={{ position: 'absolute', top: isMobile ? 20 : 160, left: '50%', transform: 'translateX(-50%)', textAlign: 'center', pointerEvents: 'none', zIndex: 10 }}>
                {latestHit && (
                   <div 
                      key={latestHit.time} 
                      style={{ 
                         fontSize: 48, 
                         fontWeight: 'bold', 
                         color: latestHit.type === 'Miss' ? '#ef4444' : 
                                latestHit.type === 'Perfect' ? '#60a5fa' : 
                                latestHit.type === 'Good' ? '#4ade80' : 
                                latestHit.type === 'Wrong' ? '#c084fc' : '#facc15',
                         textShadow: '0 0 10px rgba(0,0,0,0.8)',
                         animation: 'popAndFade 1s forwards'
                      }}
                   >
                      {latestHit.type}
                   </div>
                )}
             </div>

             {/* Hit Error Bar */}
             <div style={{ position: 'absolute', bottom: isMobile ? 10 : 60, left: '50%', transform: 'translateX(-50%)', width: isMobile ? 300 : 400, height: 8, background: 'rgba(0,0,0,0.6)', borderRadius: 4, pointerEvents: 'none', zIndex: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)' }}>
                <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, background: 'rgba(255,255,255,0.8)', transform: 'translateX(-50%)' }} />
                {latestHit && (
                   <div 
                      key={`hit-${latestHit.time}`}
                      style={{
                         position: 'absolute',
                         top: 0,
                         bottom: 0,
                         width: 4,
                         background: latestHit.type === 'Miss' ? '#ef4444' : '#60a5fa',
                         left: `calc(50% + ${(latestHit.offset / 200) * 50}%)`,
                         transform: 'translateX(-50%)',
                         opacity: 1,
                         animation: 'fadeOut 2s forwards',
                         boxShadow: '0 0 4px rgba(255,255,255,0.5)'
                      }}
                   />
                )}
             </div>
             
             {/* Mobile Pause Button */}
             {isMobile && (
               <button
                 onClick={() => setGameState('paused')}
                 style={{
                   position: 'absolute',
                   top: 20,
                   left: 20,
                   zIndex: 30,
                   padding: '12px',
                   background: 'rgba(0,0,0,0.5)',
                   color: 'white',
                   border: '1px solid rgba(255,255,255,0.3)',
                   borderRadius: '8px',
                   display: 'flex',
                   alignItems: 'center',
                   justifyContent: 'center',
                   backdropFilter: 'blur(4px)',
                   cursor: 'pointer'
                 }}
               >
                 <Pause size={24} />
               </button>
             )}
           </>
        )}


        {/* Pause Overlay */}
        {gameState === 'paused' && (
           <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', zIndex: 40 }}>
              {isResuming ? (
                 <div key={resumeCount} style={{ color: 'white', fontSize: 120, fontWeight: 'bold', animation: 'zoomIn 0.5s ease-out forwards', textShadow: '0 0 20px rgba(99, 102, 241, 0.8)' }}>
                    {resumeCount}
                 </div>
              ) : (
                 <>
                    <h2 style={{ color: 'white', fontSize: 48, marginBottom: 40 }}>Paused</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                       <button 
                          onClick={() => {
                             setIsResuming(true);
                             setResumeCount(3);
                          }}
                          style={{ padding: '12px 32px', fontSize: 20, cursor: 'pointer', borderRadius: 8, background: '#6366f1', color: 'white', border: 'none' }}
                       >
                          Resume
                       </button>
                       <button 
                          onClick={() => {
                             resetGamePlay();
                             setIsResuming(true);
                             setResumeCount(3);
                          }}
                          style={{ padding: '12px 32px', fontSize: 20, cursor: 'pointer', borderRadius: 8, background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
                       >
                          Restart
                       </button>
                       <button 
                          onClick={() => {
                             resetGamePlay();
                             setPreviewPlaying(false);
                             setGameState('arrange');
                          }}
                          style={{ padding: '12px 32px', fontSize: 20, cursor: 'pointer', borderRadius: 8, background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
                       >
                          Back to Arrange
                       </button>
                    </div>
                 </>
              )}
           </div>
        )}

        {/* Result Overlay */}
        {gameState === 'result' && (
           <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.9)', zIndex: 40, animation: 'fadeIn 0.5s forwards' }}>
              <h2 style={{ color: 'white', fontSize: isMobile ? 28 : 56, marginBottom: isMobile ? 4 : 10, textShadow: '0 4px 20px rgba(99,102,241,0.5)', animation: 'slideInUp 0.5s forwards' }}>Level Cleared</h2>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: isMobile ? 12 : 18, marginBottom: isMobile ? 8 : 24, animation: 'slideInUp 0.5s forwards', animationDelay: '0.05s', opacity: 0, animationFillMode: 'forwards', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                 <div style={{ color: 'white', fontWeight: 'bold', fontSize: '1.2em' }}>{levelMetadata?.title || gameFileName || 'Unknown Level'}</div>
                 {levelMetadata?.author && <div style={{ marginBottom: 4 }}>Author: {levelMetadata.author}</div>}
                 <div>Speed: {gameSpeed}x</div>
                 <div>Mode: {mobileControlMode === 'crosshair' ? 'Crosshair' : 'Normal'}</div>
              </div>
              <div style={{ color: '#a5b4fc', fontSize: isMobile ? 16 : 24, marginBottom: isMobile ? 8 : 40, animation: 'slideInUp 0.5s forwards', animationDelay: '0.1s', opacity: 0, animationFillMode: 'forwards' }}>
                 Score: <span style={{ color: 'white', fontWeight: 'bold' }}>{gameScore}</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 4 : 12, width: isMobile ? '220px' : '300px', marginBottom: isMobile ? 16 : 40 }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isMobile ? 14 : 20, animation: 'slideInUp 0.5s forwards', animationDelay: '0.2s', opacity: 0, animationFillMode: 'forwards' }}>
                    <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>Perfect</span>
                    <span style={{ color: 'white' }}>{perfectCount}</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isMobile ? 14 : 20, animation: 'slideInUp 0.5s forwards', animationDelay: '0.3s', opacity: 0, animationFillMode: 'forwards' }}>
                    <span style={{ color: '#4ade80', fontWeight: 'bold' }}>Good</span>
                    <span style={{ color: 'white' }}>{goodCount}</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isMobile ? 14 : 20, animation: 'slideInUp 0.5s forwards', animationDelay: '0.4s', opacity: 0, animationFillMode: 'forwards' }}>
                    <span style={{ color: '#facc15', fontWeight: 'bold' }}>Bad</span>
                    <span style={{ color: 'white' }}>{badCount}</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isMobile ? 14 : 20, animation: 'slideInUp 0.5s forwards', animationDelay: '0.5s', opacity: 0, animationFillMode: 'forwards' }}>
                    <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Miss</span>
                    <span style={{ color: 'white' }}>{missCount}</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isMobile ? 14 : 20, animation: 'slideInUp 0.5s forwards', animationDelay: '0.55s', opacity: 0, animationFillMode: 'forwards' }}>
                    <span style={{ color: '#c084fc', fontWeight: 'bold' }}>Wrong</span>
                    <span style={{ color: 'white' }}>{wrongCount}</span>
                 </div>
                 <div style={{ height: 1, background: 'rgba(255,255,255,0.2)', margin: isMobile ? '2px 0' : '8px 0', animation: 'slideInUp 0.5s forwards', animationDelay: '0.6s', opacity: 0, animationFillMode: 'forwards' }} />
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isMobile ? 14 : 20, animation: 'slideInUp 0.5s forwards', animationDelay: '0.7s', opacity: 0, animationFillMode: 'forwards' }}>
                    <span style={{ color: '#c084fc', fontWeight: 'bold' }}>Max Combo</span>
                    <span style={{ color: 'white' }}>{maxCombo}</span>
                 </div>
              </div>

              <div style={{ display: 'flex', gap: isMobile ? 8 : 16, animation: 'slideInUp 0.5s forwards', animationDelay: '0.9s', opacity: 0, animationFillMode: 'forwards' }}>
                 <button 
                    onClick={() => {
                       resetGamePlay();
                       setGameState('paused');
                       setTimeout(() => {
                         setIsResuming(true);
                         setResumeCount(3);
                       }, 0);
                    }}
                    style={{ padding: isMobile ? '10px 24px' : '12px 32px', fontSize: isMobile ? 16 : 20, cursor: 'pointer', borderRadius: 8, background: '#6366f1', color: 'white', border: 'none', fontWeight: 'bold' }}
                 >
                    Play Again
                 </button>
                 <button 
                    onClick={() => {
                       resetGamePlay();
                       setPreviewPlaying(false);
                       setGameState('arrange');
                    }}
                    style={{ padding: isMobile ? '10px 24px' : '12px 32px', fontSize: isMobile ? 16 : 20, cursor: 'pointer', borderRadius: 8, background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', fontWeight: 'bold' }}
                 >
                    Back to Arrange
                 </button>
              </div>
           </div>
        )}
        
        {/* Settings Panel Render */}
        <div style={{ zIndex: 50 }}>
          <SettingsPanel />
        </div>

        {/* Tutorial Overlay */}
        <ModalPanel title="How to Play" isOpen={isTutorialOpen} onClose={toggleTutorial} className="tutorial-overlay">
           <ul style={{ color: 'var(--settings-text-muted)', lineHeight: 1.6, paddingLeft: 20 }}>
               <li><b>Arrange Phase:</b> Drag blocks to map out the song. You can zoom (scroll/pinch) and pan (middle-click/drag).</li>
               <li style={{ marginTop: 8 }}><b>Preview:</b> Right-click and drag (or long press and drag on mobile) to draw a particle trail to preview notes.</li>
               <li style={{ marginTop: 8 }}><b>Play Phase (Normal Mode):</b> Click/Tap and drag to slash through the notes as they appear. You can freely zoom using the scroll wheel or pinch gesture.</li>
               <li style={{ marginTop: 8 }}><b>Play Phase (Crosshair Mode):</b> On PC, your mouse aims the center crosshair (like an FPS). On Mobile, drag on the right side of the screen to aim, and tap the left side to hit.</li>
               <li style={{ marginTop: 8 }}><b>Scoring:</b> Hit the blocks exactly when the shrinking square aligns with them! Better accuracy gives higher points and combo multipliers.</li>
           </ul>
        </ModalPanel>

        {/* Mobile Fullscreen Button */}
        {isMobile && !isFullscreen && gameState !== 'play' && (
          <button 
            onClick={requestFullscreen}
            style={{ position: 'absolute', top: 20, left: 20, zIndex: 100, padding: '12px', background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
          >
            <Maximize size={24} />
          </button>
        )}
      </div>
    </div>
  );
}
