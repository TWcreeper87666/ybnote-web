import React, { useState, useRef, useEffect, useContext } from 'react';
import { useStore } from '../../store/useStore';
import { useCanvasStore } from '../../store/useCanvasStore';
import { CanvasStoreContext } from '../../store/CanvasStoreContext';
import { Search, Music, LayoutList, GitBranch, Square, ChevronRight, ChevronDown, Keyboard, Check, CheckSquare, Play, Pause } from 'lucide-react';
import { FloatingWindow } from './FloatingWindow';

// Smooth camera animation helper — animates the camera via a provided updateCamera fn
const animateCameraTo = (
  targetX: number,
  targetY: number,
  startCamera: { x: number; y: number },
  updateCamera: (c: { x: number; y: number }) => void,
  duration = 300,
) => {
  const startX = startCamera.x;
  const startY = startCamera.y;
  const startTime = performance.now();

  const tick = (now: number) => {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    updateCamera({
      x: startX + (targetX - startX) * ease,
      y: startY + (targetY - startY) * ease,
    });
    if (t < 1) requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
};

type FilterState = { notes: boolean; groups: boolean; tracks: boolean; enable: boolean };

export const OutlinerPanel: React.FC = () => {
  const canvasStoreCtx = useContext(CanvasStoreContext);

  // Canvas-specific state from context store (playground/editor) or global store fallback
  const canvasBlocks = useCanvasStore((s) => s.blocks);
  const canvasGroupRects = useCanvasStore((s) => s.groupRects);
  const canvasTracks = useCanvasStore((s) => s.tracks);
  const canvasCamera = useCanvasStore((s) => s.camera);
  const selectedBlockIds = useCanvasStore((s) => s.selectedBlockIds);
  const selectedGroupRectIds = useCanvasStore((s) => s.selectedGroupRectIds);
  const selectedTrackIds = useCanvasStore((s) => s.selectedTrackIds);
  const selectBlock = useCanvasStore((s) => s.selectBlock);
  const updateBlock = useCanvasStore((s) => s.updateBlock);
  const updateGroupRect = useCanvasStore((s) => s.updateGroupRect);
  const selectGroupRect = useCanvasStore((s) => s.selectGroupRect);
  const selectTrack = useCanvasStore((s) => s.selectTrack);

  // Game/UI state from global store
  const {
    isOutlinerOpen,
    searchQuery, setSearchQuery,
    gameState, gameBlocks, updateGameBlock, gameCamera
  } = useStore();

  const defaultBlocks = canvasBlocks;
  const groupRects = canvasGroupRects;
  const tracks = canvasTracks;
  const defaultCamera = canvasCamera;


  const blocks = gameState === 'arrange' ? gameBlocks : defaultBlocks;
  const activeUpdateBlock = gameState === 'arrange' ? updateGameBlock : updateBlock;
  const camera = gameState === 'arrange' || gameState === 'play' ? gameCamera : defaultCamera;

  const [filters, setFilters] = useState<FilterState>({ notes: true, groups: true, tracks: true, enable: false });

  useEffect(() => {
    const searchInput = document.getElementById('outliner-search-input') as HTMLInputElement;
    if (searchInput) searchInput.focus();
  }, []);

  useEffect(() => {
    const handleFind = (e: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
      const id = e.detail;

      // Force open outliner panel if closed
      useStore.setState({ isOutlinerOpen: true });

      const cs = canvasStoreCtx ? (canvasStoreCtx.getState() as any) : useStore.getState();
      let needsNotes = false;
      let needsGroups = false;
      let needsTracks = false;
      let isDisabled = false;

      if (id.startsWith('groupRect:')) {
         needsGroups = true;
         const gr = cs.groupRects?.find((g: any) => g.id === id.split(':')[1]);
         if (gr && gr.enabled === false) isDisabled = true;
      } else if (id.startsWith('track:')) {
         needsTracks = true;
         const tr = cs.tracks?.find((t: any) => t.id === id.split(':')[1]);
         if (tr && tr.enabled === false) isDisabled = true;
      } else {
         needsNotes = true;
         const block = cs.blocks?.find((b: any) => b.id === id);
         if (block) {
           if ((block as any /* eslint-disable-line @typescript-eslint/no-explicit-any */).enabled === false) isDisabled = true;
           for (const gr of (cs.groupRects ?? [])) {
             const bCenterX = block.x + 30;
             const bCenterY = block.y + 30;
             if (bCenterX >= gr.x && bCenterX <= gr.x + gr.w && bCenterY >= gr.y && bCenterY <= gr.y + gr.h) {
               needsGroups = true;
               if (gr.enabled === false) isDisabled = true;
               window.dispatchEvent(new CustomEvent('expand-group', { detail: gr.id }));
               break;
             }
           }
         }
      }

      useStore.setState({ searchQuery: '' });
      setFilters(prev => {
        const next = { ...prev };
        if (isDisabled) next.enable = false;
        if (needsNotes) next.notes = true;
        if (needsGroups) next.groups = true;
        if (needsTracks) next.tracks = true;
        return next;
      });

      setTimeout(() => {
        let elId;
        if (id.startsWith('groupRect:')) elId = `outliner-item-groupRect-${id.split(':')[1]}`;
        else if (id.startsWith('track:')) elId = `outliner-item-track-${id.split(':')[1]}`;
        else elId = `outliner-item-${id}`;
        const el = document.getElementById(elId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.backgroundColor = 'rgba(99, 102, 241, 0.4)';
          setTimeout(() => { el.style.backgroundColor = ''; }, 1000);
        }
      }, 100);
    };
    window.addEventListener('find-in-outliner', handleFind);
    return () => window.removeEventListener('find-in-outliner', handleFind);
  }, []);

  const handleShiftClick = (clickedId: string, clickedType: 'block' | 'groupRect' | 'track') => {
    const cs = canvasStoreCtx ? (canvasStoreCtx.getState() as any) : useStore.getState();
    const lastId = cs.lastSelectedId;
    const lastType = cs.lastSelectedType;

    if (!lastId || !lastType) {
      if (clickedType === 'block') selectBlock(clickedId, false);
      else if (clickedType === 'groupRect') selectGroupRect(clickedId, false);
      else if (clickedType === 'track') selectTrack(clickedId, false);
      return;
    }

    const itemEls = Array.from(document.querySelectorAll('.outliner-item'));
    const getElId = (id: string, type: string) =>
      type === 'groupRect' ? `outliner-item-groupRect-${id}` :
      type === 'track' ? `outliner-item-track-${id}` :
      `outliner-item-${id}`;

    const clickedElId = getElId(clickedId, clickedType);
    const lastElId = getElId(lastId, lastType);

    const clickedIdx = itemEls.findIndex(el => el.id === clickedElId);
    const lastIdx = itemEls.findIndex(el => el.id === lastElId);

    if (clickedIdx === -1 || lastIdx === -1) {
      if (clickedType === 'block') selectBlock(clickedId, true);
      else if (clickedType === 'groupRect') selectGroupRect(clickedId, true);
      else if (clickedType === 'track') selectTrack(clickedId, true);
      return;
    }

    const startIdx = Math.min(clickedIdx, lastIdx);
    const endIdx = Math.max(clickedIdx, lastIdx);
    const rangeEls = itemEls.slice(startIdx, endIdx + 1);

    const newSelectedBlocks = new Set(cs.selectedBlockIds as string[]);
    const newSelectedGroups = new Set(cs.selectedGroupRectIds as string[]);
    const newSelectedTracks = new Set(cs.selectedTrackIds as string[]);

    rangeEls.forEach(el => {
      const id = el.id;
      if (id.startsWith('outliner-item-groupRect-')) {
        newSelectedGroups.add(id.replace('outliner-item-groupRect-', ''));
      } else if (id.startsWith('outliner-item-track-')) {
        newSelectedTracks.add(id.replace('outliner-item-track-', ''));
      } else if (id.startsWith('outliner-item-')) {
        newSelectedBlocks.add(id.replace('outliner-item-', ''));
      }
    });

    canvasStoreCtx?.setState({
      selectedBlockIds: Array.from(newSelectedBlocks),
      selectedGroupRectIds: Array.from(newSelectedGroups),
      selectedTrackIds: Array.from(newSelectedTracks),
      lastSelectedId: clickedId,
      lastSelectedType: clickedType,
    });
  };

  if (!isOutlinerOpen) {
    return (
      <FloatingWindow
        title={<><LayoutList size={18} /> Outliner</>}
        isOpen={false}
        onClose={() => {}}
        initialSize={{ width: '310px', height: '400px' }}
        minSize={{ width: '250px', height: '400px' }}
        headerStyle={{ marginBottom: '8px' }}
        anchorSelector='button[title="Toggle Outliner"], button[title="Outliner"]'
      >
        {null}
      </FloatingWindow>
    );
  }

  const query = searchQuery.toLowerCase();

  // Filter blocks by search and enabled
  const filteredBlocks = blocks.filter(b =>
    (b.pitch.toLowerCase().includes(query) ||
    (b.keyBinding && b.keyBinding.toLowerCase().includes(query))) &&
    (!filters.enable || (b as any /* eslint-disable-line @typescript-eslint/no-explicit-any */).enabled !== false)
  );

  // Filter groupRects by search and enabled
  const filteredGroupRects = groupRects.filter(g =>
    ((g.name || '').toLowerCase().includes(query) || !query) &&
    (!filters.enable || g.enabled !== false)
  );

  // Filter tracks by search (match by index-based label) and enabled
  const filteredTracks = tracks.filter((t, i) =>
    (`Track ${i + 1}`.toLowerCase().includes(query) || !query) &&
    (!filters.enable || t.enabled !== false)
  );

  // Determine which notes are spatially inside which group rects
  const noteToGroupRect = new Map<string, string>(); // blockId -> groupRectId
  const groupRectChildren = new Map<string, { blocks: typeof blocks; tracks: typeof tracks }>();

  // Initialize children map
  filteredGroupRects.forEach(gr => {
    groupRectChildren.set(gr.id, { blocks: [], tracks: [] });
  });

  // Assign blocks to group rects (first containing rect wins)
  filteredBlocks.forEach(block => {
    for (const gr of groupRects) {
      const bCenterX = block.x + 30;
      const bCenterY = block.y + 30;
      if (bCenterX >= gr.x && bCenterX <= gr.x + gr.w && bCenterY >= gr.y && bCenterY <= gr.y + gr.h) {
        noteToGroupRect.set(block.id, gr.id);
        const children = groupRectChildren.get(gr.id);
        if (children) children.blocks.push(block);
        break;
      }
    }
  });

  // Assign tracks to group rects (majority of nodes inside)
  const trackToGroupRect = new Map<string, string>();
  filteredTracks.forEach(track => {
    if (track.nodes.length === 0) return;
    for (const gr of groupRects) {
      const insideCount = track.nodes.filter(n =>
        n.x >= gr.x && n.x <= gr.x + gr.w && n.y >= gr.y && n.y <= gr.y + gr.h
      ).length;
      if (insideCount > track.nodes.length / 2) {
        trackToGroupRect.set(track.id, gr.id);
        const children = groupRectChildren.get(gr.id);
        if (children) children.tracks.push(track);
        break;
      }
    }
  });

  // Ungrouped
  const ungroupedBlocks = filteredBlocks.filter(b => !noteToGroupRect.has(b.id));
  const ungroupedTracks = filteredTracks.filter(t => !trackToGroupRect.has(t.id));

  const toggleFilter = (key: keyof FilterState) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <FloatingWindow
      title={<><LayoutList size={18} /> Outliner</>}
      isOpen={isOutlinerOpen}
      onClose={() => useStore.setState({ isOutlinerOpen: false })}

      anchorSelector='button[title="Toggle Outliner"], button[title="Outliner"]'
      initialSize={{ width: '310px', height: '400px' }}
      minSize={{ width: '250px', height: '400px' }}
      headerStyle={{ marginBottom: '8px' }}
    >
      {/* Filter Toggles */}
      <div 
        className="outliner-filter-bar"
        onWheel={(e) => {
          if (e.deltaY !== 0) {
            e.stopPropagation();
            e.currentTarget.scrollLeft += e.deltaY;
          }
        }}
      >
        <button
          className={`outliner-filter-btn ${filters.notes ? 'active' : ''}`}
          onClick={() => toggleFilter('notes')}
          title="Toggle Notes"
        >
          <Music size={14} /> Notes
        </button>
        <button
          className={`outliner-filter-btn ${filters.groups ? 'active' : ''}`}
          onClick={() => toggleFilter('groups')}
          title="Toggle Groups"
        >
          <Square size={14} fill="currentColor" /> Groups
        </button>
        <button
          className={`outliner-filter-btn ${filters.tracks ? 'active' : ''}`}
          onClick={() => toggleFilter('tracks')}
          title="Toggle Tracks"
        >
          <GitBranch size={14} /> Tracks
        </button>
        <button
          className={`outliner-filter-btn ${filters.enable ? 'active' : ''}`}
          onClick={() => toggleFilter('enable')}
          title="Toggle Enabled Only"
        >
          <Check size={14} /> Enabled
        </button>
      </div>
      
      <div className="outliner-search">
        <Search size={16} className="search-icon" />
        <input 
          id="outliner-search-input"
          type="text" 
          placeholder="Search (Ctrl+F)" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="outliner-content">
        {/* GroupRects with their children */}
        {filters.groups && filteredGroupRects.map((gr, grIdx) => {
          const children = groupRectChildren.get(gr.id) || { blocks: [], tracks: [] };
          return (
            <GroupRectItem
              key={gr.id}
              groupRect={gr}
              index={grIdx}
              childBlocks={filters.notes ? children.blocks : []}
              childTracks={filters.tracks ? children.tracks : []}
              selectedBlockIds={selectedBlockIds}
              selectedGroupRectIds={selectedGroupRectIds}
              selectedTrackIds={selectedTrackIds}
              selectBlock={selectBlock}
              selectGroupRect={selectGroupRect}
              selectTrack={selectTrack}
              updateBlock={activeUpdateBlock}
              updateGroupRect={updateGroupRect}
              camera={camera}
              tracks={tracks}
              handleShiftClick={handleShiftClick}
            />
          );
        })}

        {/* Ungrouped blocks */}
        {filters.notes && ungroupedBlocks.map(block => (
          <BlockItem 
            key={block.id} 
            block={block} 
            selected={selectedBlockIds.includes(block.id)} 
            selectBlock={selectBlock} 
            updateBlock={activeUpdateBlock} 
            camera={camera}
            handleShiftClick={handleShiftClick}
          />
        ))}

        {/* Ungrouped tracks */}
        {filters.tracks && ungroupedTracks.map((track) => (
          <TrackItem
            key={track.id}
            track={track}
            label={`Track ${tracks.indexOf(track) + 1}`}
            selected={selectedTrackIds.includes(track.id)}
            selectTrack={selectTrack}
            camera={camera}
            handleShiftClick={handleShiftClick}
          />
        ))}
      </div>
    </FloatingWindow>
  );
};

// ─── GroupRect Item ───────────────────────────────────────────────────────────

const GroupRectItem = ({ groupRect, index, childBlocks, childTracks, selectedBlockIds, selectedGroupRectIds, selectedTrackIds, selectBlock, selectGroupRect, selectTrack, updateBlock, updateGroupRect, camera, tracks, handleShiftClick }: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
  const canvasCtx = useContext(CanvasStoreContext);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isSelected = selectedGroupRectIds.includes(groupRect.id);
  const hasChildren = childBlocks.length > 0 || childTracks.length > 0;
  const wasSelectedRef = useRef(false);

  const blockIdsToSelect = childBlocks.map((b: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => b.id);
  const trackIdsToSelect = childTracks.map((t: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => t.id);
  const isAllSelected = 
    isSelected &&
    blockIdsToSelect.every((id: string) => selectedBlockIds.includes(id)) &&
    trackIdsToSelect.every((id: string) => selectedTrackIds.includes(id));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' && isSelected && !isEditing) {
        const state = useStore.getState();
        const totalSelectedCount = state.selectedBlockIds.length + state.selectedGroupRectIds.length + state.selectedTrackIds.length;
        if (totalSelectedCount === 1) {
          setEditName(groupRect.name || `Group ${index + 1}`);
          setIsEditing(true);
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelected, isEditing, groupRect.name, index]);

  useEffect(() => {
    const handleExpand = (e: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
      if (e.detail === groupRect.id) {
        setIsCollapsed(false);
      }
    };
    window.addEventListener('expand-group', handleExpand);
    return () => window.removeEventListener('expand-group', handleExpand);
  }, [groupRect.id]);

  const handleGoTo = () => {
    const targetX = -(groupRect.x + groupRect.w / 2) * camera.zoom + window.innerWidth / 2;
    const targetY = -(groupRect.y + groupRect.h / 2) * camera.zoom + window.innerHeight / 2;
    const cs = canvasCtx?.getState() as any ?? useStore.getState();
    animateCameraTo(targetX, targetY, cs.camera, (c) => cs.updateCamera(c));
  };

  return (
    <div className="outliner-group">
      <div 
        id={`outliner-item-groupRect-${groupRect.id}`}
        className={`outliner-item group-rect-item ${isSelected ? 'selected' : ''}`}
        style={{ opacity: groupRect.enabled === false && !isSelected ? 0.4 : 1 }}
        onPointerDown={() => wasSelectedRef.current = isSelected}
        onClick={(e) => {
          if (e.shiftKey) {
            handleShiftClick(groupRect.id, 'groupRect');
          } else {
            selectGroupRect(groupRect.id, e.ctrlKey);
          }
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          useStore.getState().openContextMenu({ x: e.clientX, y: e.clientY, blockId: `groupRect:${groupRect.id}` });
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          selectGroupRect(groupRect.id, e.ctrlKey || e.shiftKey);
          handleGoTo();
        }}
      >
        <button
          className="outliner-collapse-btn"
          onClick={(e) => {
            e.stopPropagation();
            setIsCollapsed(!isCollapsed);
          }}
          style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <Square size={16} className="flex-shrink-0" style={{ opacity: 0.7 }} fill="currentColor" />
        {isEditing ? (
          <input 
            value={editName} 
            onChange={(e) => setEditName(e.target.value)}
            onBlur={() => {
              updateGroupRect(groupRect.id, { name: editName });
              setIsEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                updateGroupRect(groupRect.id, { name: editName });
                setIsEditing(false);
              } else if (e.key === 'Escape') {
                setIsEditing(false);
                e.stopPropagation();
              }
            }}
            className="outliner-input font-semibold"
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
        ) : (
          <span className="font-semibold flex-1 truncate select-none" style={{ fontSize: '14px' }}>
            {groupRect.name || `Group ${index + 1}`}
          </span>
        )}
        {childBlocks.length > 0 && (
          <span style={{ fontSize: '10px', background: 'var(--panel-border)', padding: '2px 6px', borderRadius: '10px', opacity: 0.8, fontWeight: 600 }}>
            {childBlocks.length}
          </span>
        )}
        <button
          className="icon-btn"
          onClick={(e) => {
             e.stopPropagation();
             const cs = canvasCtx?.getState() as any ?? useStore.getState();
             if (isAllSelected) {
               canvasCtx?.setState({
                 selectedGroupRectIds: cs.selectedGroupRectIds.filter((id: string) => id !== groupRect.id),
                 selectedBlockIds: cs.selectedBlockIds.filter((id: string) => !blockIdsToSelect.includes(id)),
                 selectedTrackIds: cs.selectedTrackIds.filter((id: string) => !trackIdsToSelect.includes(id)),
               });
             } else {
               canvasCtx?.setState({
                 selectedGroupRectIds: [...new Set([...cs.selectedGroupRectIds, groupRect.id])],
                 selectedBlockIds: [...new Set([...cs.selectedBlockIds, ...blockIdsToSelect])],
                 selectedTrackIds: [...new Set([...cs.selectedTrackIds, ...trackIdsToSelect])],
                 lastSelectedId: groupRect.id,
                 lastSelectedType: 'groupRect',
               });
             }
          }}
          title={isAllSelected ? "Deselect Group and Children" : "Select Group and Children"}
          style={{ width: '20px', height: '20px', padding: 0, marginRight: '4px', opacity: 0.7 }}
        >
          {isAllSelected ? <CheckSquare size={14} /> : <Square size={14} />}
        </button>
        <div 
          className="outliner-key-badge"
          title={groupRect.keyBinding ? `Key bound: ${groupRect.keyBinding}` : "No key bound"}
        >
          <Keyboard size={12} />
          <span className="select-none" style={{ fontSize: '12px', minWidth: '12px', textAlign: 'center' }}>
            {groupRect.keyBinding || '-'}
          </span>
        </div>
      </div>
      {!isCollapsed && hasChildren && (
        <div className="outliner-group-children">
          {childBlocks.map((block: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => (
            <BlockItem 
              key={block.id} 
              block={block} 
              selected={selectedBlockIds.includes(block.id)} 
              selectBlock={selectBlock} 
              updateBlock={updateBlock} 
              camera={camera}
              handleShiftClick={handleShiftClick}
            />
          ))}
          {childTracks.map((track: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => (
            <TrackItem
              key={track.id}
              track={track}
              label={`Track ${tracks.indexOf(track) + 1}`}
              selected={selectedTrackIds.includes(track.id)}
              selectTrack={selectTrack}
              camera={camera}
              handleShiftClick={handleShiftClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Block Item ──────────────────────────────────────────────────────────────

const BlockItem = ({ block, selected, selectBlock, camera, handleShiftClick }: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
  const canvasCtx = useContext(CanvasStoreContext);
  const wasSelectedRef = useRef(false);

  const handleGoTo = () => {
    const targetX = -(block.x + 30) * camera.zoom + window.innerWidth / 2;
    const targetY = -(block.y + 30) * camera.zoom + window.innerHeight / 2;
    const cs = canvasCtx?.getState() as any ?? useStore.getState();
    animateCameraTo(targetX, targetY, cs.camera, (c) => cs.updateCamera(c));
  };

  return (
    <div 
      id={`outliner-item-${block.id}`}
      className={`outliner-item block-item ${selected ? 'selected' : ''}`}
      style={{ opacity: block.enabled === false && !selected ? 0.4 : 1 }}
      onPointerDown={() => wasSelectedRef.current = selected}
      onClick={(e) => {
        if (e.shiftKey) {
          handleShiftClick(block.id, 'block');
        } else {
          selectBlock(block.id, e.ctrlKey);
        }
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        useStore.getState().openContextMenu({ x: e.clientX, y: e.clientY, blockId: block.id });
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        selectBlock(block.id, e.ctrlKey || e.shiftKey);
        handleGoTo();
      }}
    >
      <Music size={16} className="text-gray-400 flex-shrink-0" />
      
      <span className="flex-1 truncate select-none" style={{ fontSize: '14px' }}>
        {block.pitch}
      </span>

      <div 
        className="outliner-key-badge"
        title={block.keyBinding ? `Key bound: ${block.keyBinding}` : "No key bound"}
      >
        <Keyboard size={12} />
        <span className="select-none" style={{ fontSize: '12px', minWidth: '12px', textAlign: 'center' }}>
          {block.keyBinding || '-'}
        </span>
      </div>
    </div>
  );
};

// ─── Track Item ──────────────────────────────────────────────────────────────

const TrackItem = ({ track, label, selected, selectTrack, camera, handleShiftClick }: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
  const canvasCtx = useContext(CanvasStoreContext);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const wasSelectedRef = useRef(false);

  const isPlaying = useStore(state => state.isPlaying);
  const playbackStatus = useStore(state => state.trackPlaybackStatus[track.id]);
  const isTrackPlaying = playbackStatus === 'playing' || (isPlaying && track.enabled !== false);
  const isTrackPaused = playbackStatus === 'paused' && !isPlaying;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' && selected && !isEditing) {
        const state = useStore.getState();
        const totalSelectedCount = state.selectedBlockIds.length + state.selectedGroupRectIds.length + state.selectedTrackIds.length;
        if (totalSelectedCount === 1) {
          setEditName(track.name || label);
          setIsEditing(true);
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected, isEditing, track.name, label]);

  const handleGoTo = () => {
    if (track.nodes.length === 0) return;
    const targetX = -track.nodes[0].x * camera.zoom + window.innerWidth / 2;
    const targetY = -track.nodes[0].y * camera.zoom + window.innerHeight / 2;
    const cs = canvasCtx?.getState() as any ?? useStore.getState();
    animateCameraTo(targetX, targetY, cs.camera, (c) => cs.updateCamera(c));
  };

  return (
    <div 
      id={`outliner-item-track-${track.id}`}
      className={`outliner-item track-item ${selected ? 'selected' : ''}`}
      style={{ opacity: track.enabled === false && !selected ? 0.4 : 1 }}
      onPointerDown={() => wasSelectedRef.current = selected}
      onClick={(e) => {
        if (e.shiftKey) {
          handleShiftClick(track.id, 'track');
        } else {
          selectTrack(track.id, e.ctrlKey);
        }
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        useStore.getState().openContextMenu({ x: e.clientX, y: e.clientY, blockId: `track:${track.id}` });
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        selectTrack(track.id, e.ctrlKey || e.shiftKey);
        handleGoTo();
      }}
    >
      <GitBranch size={16} className="flex-shrink-0" style={{ opacity: 0.7 }} />
      {isEditing ? (
        <input 
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={() => {
            const cs = canvasCtx?.getState() as any ?? useStore.getState();
            cs.updateTrack?.(track.id, { name: editName });
            setIsEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const cs = canvasCtx?.getState() as any ?? useStore.getState();
              cs.updateTrack?.(track.id, { name: editName });
              setIsEditing(false);
            } else if (e.key === 'Escape') {
              setIsEditing(false);
              e.stopPropagation();
            }
          }}
          className="outliner-input font-semibold"
          onClick={(e) => e.stopPropagation()}
          autoFocus
        />
      ) : (
        <div className="flex-1 truncate select-none" style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="truncate">{track.name || label}</span>
          {isTrackPlaying && <Play size={12} fill="currentColor" style={{ color: '#22c55e' }} />}
          {isTrackPaused && <Pause size={12} fill="currentColor" style={{ color: '#eab308' }} />}
        </div>
      )}
      <span style={{ fontSize: '11px', opacity: 0.5 }}>
        {track.nodes.length} nodes
      </span>
    </div>
  );
};

