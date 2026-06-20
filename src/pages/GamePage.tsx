import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameCanvas } from '../components/canvas/GameCanvas';
import { parseMidiForGame } from '../utils/midiUtils';
import { importLevel } from '../utils/levelUtils';
import { Upload, SkipForward, Plus, Undo2, Redo2, Settings, Play, Pause, Volume2 } from 'lucide-react';
import { SettingsPanel } from '../components/ui/SettingsPanel';
import { playNote } from '../utils/audio';
import { useStore, undoAction, redoAction } from '../store/useStore';

export const GamePage: React.FC = () => {
  const navigate = useNavigate();
  const { theme, gameState, setGameState, setGameBlocks, setGameEvents, gameScore, gameCombo, setGameStats, resetGamePlay, gameEvents, gameFileName, setGameFileName, gameSpeed, setGameSpeed, toggleSettings, latestHit } = useStore();
  const [countdownTime, setCountdownTime] = useState(3);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewVolume, setPreviewVolume] = useState(1);
  const previewStartTimeRef = useRef(Date.now());
  const previewTimeOffsetRef = useRef(0);
  const lastPlayedEventIndexRef = useRef(0);

  // Keyboard and Pointer Lock listener for ESC to pause
  useEffect(() => {
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
      if (!document.pointerLockElement) {
        const state = useStore.getState().gameState;
        if (state === 'play') {
          useStore.getState().setGameState('paused');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    return () => {
       window.removeEventListener('keydown', handleKeyDown);
       document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  }, []);

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

     const tick = () => {
         const now = Date.now();
         const elapsed = previewTimeOffsetRef.current + (now - previewStartTimeRef.current) * useStore.getState().gameSpeed;
         
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

     previewStartTimeRef.current = Date.now();
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
      } else {
        // Import .mid/.midi
        const { gameBlocks, gameEvents } = await parseMidiForGame(file);
        setGameFileName(file.name);
        setGameBlocks(gameBlocks);
        setGameEvents(gameEvents);
        setGameState('arrange');
      }
    } catch (err) {
      console.error(err);
      alert("Failed to import file");
    }
  };


  return (
    <div 
      className={`app-container ${theme}`}
      onContextMenu={(e) => e.preventDefault()}
      style={{ overflow: 'hidden' }}
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
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: '#6366f1', color: 'white', borderRadius: 8, cursor: 'pointer', fontSize: 18, fontWeight: 'bold' }}>
                 <Upload size={24} />
                 Select MIDI File
                 <input type="file" accept=".mid,.midi,.yblevel" style={{ display: 'none' }} onChange={handleImport} />
              </label>
           </div>
        )}
        
        {/* Arrangement Overlay */}
        {gameState === 'arrange' && (
            <>
              <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10, pointerEvents: 'none' }}>
                  <h2 style={{ color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.8)', fontSize: 32, margin: 0 }}>
                      Arrangement Phase
                  </h2>
                  <p style={{ color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.8)', marginTop: 8 }}>
                      Drag the blocks to layout your beatmap.
                  </p>
                  
                  <div style={{ pointerEvents: 'auto', marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <select 
                      value={gameSpeed} 
                      onChange={(e) => setGameSpeed(parseFloat(e.target.value))}
                      style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 8, fontSize: 16, cursor: 'pointer', outline: 'none' }}
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
                         setGameState('countdown');
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 24px', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 20, cursor: 'pointer', fontSize: 16, fontWeight: 'bold' }}
                    >
                       <SkipForward size={20} />
                       Start Game
                    </button>
                  </div>
              </div>

              {/* Toolbar Actions */}
              <div style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 12, zIndex: 10 }}>
                <button className="toolbar-btn glass-panel" onClick={() => undoAction()} title="Undo"><Undo2 size={24} /></button>
                <button className="toolbar-btn glass-panel" onClick={() => redoAction()} title="Redo"><Redo2 size={24} /></button>
                <button className="toolbar-btn glass-panel" onClick={toggleSettings} title="Settings"><Settings size={24} /></button>
              </div>

              {/* Bottom Mini Player */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 24px', background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
                 <div style={{ color: 'white', fontSize: 14, opacity: 0.8 }}>{gameFileName || 'Unknown MIDI'}</div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
             <div style={{ position: 'absolute', top: 160, left: '50%', transform: 'translateX(-50%)', textAlign: 'center', pointerEvents: 'none', zIndex: 10 }}>
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
             <div style={{ position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)', width: 400, height: 8, background: 'rgba(0,0,0,0.6)', borderRadius: 4, pointerEvents: 'none', zIndex: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)' }}>
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
                       setGameState('arrange');
                    }}
                    style={{ padding: '12px 32px', fontSize: 20, cursor: 'pointer', borderRadius: 8, background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
                 >
                    Back to Arrange
                 </button>
              </div>
           </div>
        )}
        
        {/* Settings Panel Render */}
        <div style={{ position: 'absolute', right: 80, top: 20, zIndex: 50 }}>
          <SettingsPanel />
        </div>

        {/* Escape Button */}
        <button 
          onClick={() => navigate('/editor')}
          style={{ position: 'absolute', top: 20, left: 20, zIndex: 30, padding: '8px 16px', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          Exit to Editor
        </button>
      </div>
    </div>
  );
}
