import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameCanvas } from '../components/canvas/GameCanvas';
import { parseMidiForGame } from '../utils/midiUtils';
import { importLevel } from '../utils/levelUtils';
import { Upload, SkipForward, Plus, Undo2, Redo2, Settings, Play, Pause, Volume2, Maximize, HelpCircle } from 'lucide-react';
import { SettingsPanel } from '../components/ui/SettingsPanel';
import { ModalPanel } from '../components/ui/ModalPanel';
import { playNote } from '../utils/audio';
import { useStore, undoAction, redoAction } from '../store/useStore';
import { useIsMobile } from '../hooks/useIsMobile';
export const GamePage: React.FC = () => {
  const { theme, gameState, setGameState, setGameBlocks, setGameEvents, gameScore, gameCombo, perfectCount, goodCount, badCount, missCount, maxCombo, setGameStats, resetGamePlay, gameEvents, gameFileName, setGameFileName, gameSpeed, setGameSpeed, toggleSettings, isTutorialOpen, toggleTutorial, latestHit } = useStore();
  const isMobile = useIsMobile();
  const [countdownTime, setCountdownTime] = useState(3);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewVolume, setPreviewVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const previewStartTimeRef = useRef(Date.now());
  const previewTimeOffsetRef = useRef(0);
  const lastPlayedEventIndexRef = useRef(0);

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
        if (state === 'play' || state === 'countdown') {
           useStore.getState().setGameState('paused');
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

  // Countdown timer logic
  useEffect(() => {
    if (gameState === 'countdown') {
      setCountdownTime(3);
      const timer = setInterval(() => {
        setCountdownTime(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setGameState('play');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [gameState, setGameState]);

  // Preview Player Logic
  useEffect(() => {
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
             const b = useStore.getState().gameBlocks.find(blk => blk.id === ev.blockId);
             if (b) {
                playNote(b.pitch, (b.volume ?? 1) * previewVolume, b.instrument);
                useStore.getState().updateGameBlock(b.id, { playedAt: Date.now() });
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

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (file.name.endsWith('.yblevel')) {
        // Import .yblevel package
        const { levelData } = await importLevel(file);
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
        setGameState('arrange');
        useStore.getState().updateCamera({ x: window.innerWidth / 2, y: window.innerHeight / 2, zoom: 1 });
      } else {
        // Import .mid/.midi
        const { gameBlocks, gameEvents } = await parseMidiForGame(file);
        setGameFileName(file.name);
        setGameBlocks(gameBlocks);
        setGameEvents(gameEvents);
        setGameState('arrange');
        useStore.getState().updateCamera({ x: window.innerWidth / 2, y: window.innerHeight / 2, zoom: 1 });
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
      
      const { gameBlocks, gameEvents } = await parseMidiForGame(file);
      setGameFileName('default.mid');
      setGameBlocks(gameBlocks);
      setGameEvents(gameEvents);
      setGameState('arrange');
      useStore.getState().updateCamera({ x: window.innerWidth / 2, y: window.innerHeight / 2, zoom: 1 });
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
      <div className="main-wrapper">
        
        {/* Render Canvas */}
        {['arrange', 'countdown', 'play', 'paused'].includes(gameState) && (
           <GameCanvas />
        )}

        {/* Upload Overlay */}
        {gameState === 'upload' && (
           <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', zIndex: 20 }}>
              <h1 style={{ color: 'var(--text-primary)', marginBottom: 20 }}>Rhythm Game Mode</h1>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 40, textAlign: 'center', maxWidth: 400 }}>
                 Upload a MIDI file to generate a beatmap. Arrange the blocks freely before starting the game.
              </p>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: '#6366f1', color: 'white', borderRadius: 8, cursor: 'pointer', fontSize: 18, fontWeight: 'bold' }}>
                   <Upload size={24} />
                   Select MIDI File
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
           </div>
        )}
        
        {/* Arrangement Overlay */}
        {gameState === 'arrange' && (
            <>
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

                <button 
                  onClick={() => {
                     resetGamePlay();
                     useStore.getState().clearSelection();
                     setPreviewPlaying(false);
                     setGameState('countdown');
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
                <button className="toolbar-btn glass-panel" onClick={toggleTutorial} title="Tutorial"><HelpCircle size={24} /></button>
                <button className="toolbar-btn glass-panel" onClick={() => undoAction()} title="Undo"><Undo2 size={24} /></button>
                <button className="toolbar-btn glass-panel" onClick={() => redoAction()} title="Redo"><Redo2 size={24} /></button>
                <button className="toolbar-btn glass-panel" onClick={toggleSettings} title="Settings"><Settings size={24} /></button>
              </div>

              {/* Bottom Mini Player */}
              <div 
                 style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 24px', background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 12, pointerEvents: 'none' }}
              >
                 <div style={{ color: 'white', fontSize: 14, opacity: 0.8, pointerEvents: 'auto', width: 'fit-content' }}>{gameFileName || 'Unknown MIDI'}</div>
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
                         value={previewVolume}
                         onChange={(e) => setPreviewVolume(parseFloat(e.target.value))}
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
             <div style={{ position: 'absolute', top: isMobile ? 80 : 160, left: '50%', transform: 'translateX(-50%)', textAlign: 'center', pointerEvents: 'none', zIndex: 10 }}>
                {latestHit && Date.now() - latestHit.time < 1000 && (
                   <div 
                      key={latestHit.time} 
                      style={{ 
                         fontSize: 48, 
                         fontWeight: 'bold', 
                         color: latestHit.type === 'Miss' ? '#ef4444' : 
                                latestHit.type === 'Perfect' ? '#60a5fa' : 
                                latestHit.type === 'Good' ? '#4ade80' : '#facc15',
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
                {latestHit && Date.now() - latestHit.time < 2000 && (
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

        {/* Countdown Overlay */}
        {gameState === 'countdown' && (
           <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', zIndex: 30, pointerEvents: 'none' }}>
              <div style={{ fontSize: 120, fontWeight: 'bold', color: 'white', textShadow: '0 4px 20px rgba(0,0,0,0.8)' }}>
                 {countdownTime}
              </div>
           </div>
        )}

        {/* Pause Overlay */}
        {gameState === 'paused' && (
           <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', zIndex: 40 }}>
              <h2 style={{ color: 'white', fontSize: 48, marginBottom: 40 }}>Paused</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                 <button 
                    onClick={() => setGameState('play')}
                    style={{ padding: '12px 32px', fontSize: 20, cursor: 'pointer', borderRadius: 8, background: '#6366f1', color: 'white', border: 'none' }}
                 >
                    Resume
                 </button>
                 <button 
                    onClick={() => {
                       resetGamePlay();
                       setGameState('countdown');
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
           </div>
        )}

        {/* Result Overlay */}
        {gameState === 'result' && (
           <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.9)', zIndex: 40, animation: 'fadeIn 0.5s forwards' }}>
              <h2 style={{ color: 'white', fontSize: isMobile ? 36 : 56, marginBottom: isMobile ? 8 : 10, textShadow: '0 4px 20px rgba(99,102,241,0.5)', animation: 'slideInUp 0.5s forwards' }}>Level Cleared</h2>
              <div style={{ color: '#a5b4fc', fontSize: isMobile ? 18 : 24, marginBottom: isMobile ? 20 : 40, animation: 'slideInUp 0.5s forwards', animationDelay: '0.1s', opacity: 0, animationFillMode: 'forwards' }}>
                 Score: <span style={{ color: 'white', fontWeight: 'bold' }}>{gameScore}</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 12, width: isMobile ? '240px' : '300px', marginBottom: isMobile ? 24 : 40 }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isMobile ? 16 : 20, animation: 'slideInUp 0.5s forwards', animationDelay: '0.2s', opacity: 0, animationFillMode: 'forwards' }}>
                    <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>Perfect</span>
                    <span style={{ color: 'white' }}>{perfectCount}</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isMobile ? 16 : 20, animation: 'slideInUp 0.5s forwards', animationDelay: '0.3s', opacity: 0, animationFillMode: 'forwards' }}>
                    <span style={{ color: '#4ade80', fontWeight: 'bold' }}>Good</span>
                    <span style={{ color: 'white' }}>{goodCount}</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isMobile ? 16 : 20, animation: 'slideInUp 0.5s forwards', animationDelay: '0.4s', opacity: 0, animationFillMode: 'forwards' }}>
                    <span style={{ color: '#facc15', fontWeight: 'bold' }}>Bad</span>
                    <span style={{ color: 'white' }}>{badCount}</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isMobile ? 16 : 20, animation: 'slideInUp 0.5s forwards', animationDelay: '0.5s', opacity: 0, animationFillMode: 'forwards' }}>
                    <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Miss</span>
                    <span style={{ color: 'white' }}>{missCount}</span>
                 </div>
                 <div style={{ height: 1, background: 'rgba(255,255,255,0.2)', margin: isMobile ? '4px 0' : '8px 0', animation: 'slideInUp 0.5s forwards', animationDelay: '0.6s', opacity: 0, animationFillMode: 'forwards' }} />
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isMobile ? 16 : 20, animation: 'slideInUp 0.5s forwards', animationDelay: '0.7s', opacity: 0, animationFillMode: 'forwards' }}>
                    <span style={{ color: '#c084fc', fontWeight: 'bold' }}>Max Combo</span>
                    <span style={{ color: 'white' }}>{maxCombo}</span>
                 </div>
              </div>

              <div style={{ display: 'flex', gap: isMobile ? 12 : 16, animation: 'slideInUp 0.5s forwards', animationDelay: '0.9s', opacity: 0, animationFillMode: 'forwards' }}>
                 <button 
                    onClick={() => {
                       resetGamePlay();
                       setGameState('countdown');
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
               <li><b>Arrange Phase:</b> Drag blocks to map out the song. You can zoom and pan the canvas.</li>
               <li style={{ marginTop: 8 }}><b>Continuous Drawing:</b> Long press on a block (or right click) to start drawing a continuous trail of blocks.</li>
               <li style={{ marginTop: 8 }}><b>Play Phase:</b> You control the camera! On PC, move your mouse to look around and click to hit. On Mobile, drag on the right half of the screen to look around, and tap the left half to hit blocks when they align with the crosshair.</li>
               <li style={{ marginTop: 8 }}><b>Scoring:</b> Accuracy determines your hit result (Perfect, Good, Bad, Miss) and your combo multiplier.</li>
           </ul>
        </ModalPanel>

        {/* Mobile Fullscreen Button */}
        {isMobile && !isFullscreen && gameState !== 'play' && gameState !== 'countdown' && (
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
