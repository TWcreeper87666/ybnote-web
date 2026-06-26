import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { useGameStore } from '../../store/useGameStore';
import { useLevelEditorStore } from '../../store/useLevelEditorStore';
import { useCanvasContext } from '../canvas/CanvasContext';
import type { CanvasContextType } from '../canvas/CanvasContext';
import {
  useActiveCanvasGroupRects, useActiveCanvasSelectedGroupRectIds,
  useActiveCanvasSelectedBlockIds, useActiveCanvasTracks, useActiveCanvasSelectedTrackIds,
  useActiveCanvasCamera,
  getBlocksForContext, getGroupRectsForContext, getTracksForContext, getCameraForContext,
  getLastSelectedForContext, setSelectionBatchInContext, setGroupSelectionBatchInContext,
  selectBlockInContext, selectGroupRectInContext, selectTrackInContext,
  updateBlockInContext, updateGroupRectInContext, updateTrackInContext,
  openContextMenuInContext,
} from '../../hooks/useActiveCanvas';
import { Search, Music, LayoutList, GitBranch, Square, ChevronRight, ChevronDown, Keyboard, Check, CheckSquare, Play, Pause } from 'lucide-react';
import { FloatingWindow } from './FloatingWindow';
import { getCanvasCenter } from '../../utils/canvasUtils';

const animateCameraTo = (targetX: number, targetY: number, context: CanvasContextType = 'playground', duration = 300) => {
  const startCam = getCameraForContext(context);
  const startX = startCam.x;
  const startY = startCam.y;
  const startTime = performance.now();

  const tick = (now: number) => {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    const next = { x: startX + (targetX - startX) * ease, y: startY + (targetY - startY) * ease };
    if (context === 'game') useGameStore.getState().updateCamera(next);
    else if (context === 'editor') useLevelEditorStore.getState().updateCamera(next);
    else useStore.getState().updateCamera(next);
    if (t < 1) requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
};

type FilterState = { notes: boolean; groups: boolean; tracks: boolean; enable: boolean };

export const OutlinerPanel: React.FC = () => {
  const canvasContext = useCanvasContext();

  // Reactive canvas data from the correct store
  const groupRects = useActiveCanvasGroupRects();
  const tracks = useActiveCanvasTracks();
  const selectedBlockIds = useActiveCanvasSelectedBlockIds();
  const selectedGroupRectIds = useActiveCanvasSelectedGroupRectIds();
  const selectedTrackIds = useActiveCanvasSelectedTrackIds();
  const camera = useActiveCanvasCamera();

  // UI state stays in useStore for now (UIStore migration deferred)
  const { isOutlinerOpen, searchQuery, setSearchQuery } = useStore();

  const [filters, setFilters] = useState<FilterState>({ notes: true, groups: true, tracks: true, enable: false });

  useEffect(() => {
    const searchInput = document.getElementById('outliner-search-input') as HTMLInputElement;
    if (searchInput) searchInput.focus();
  }, []);

  useEffect(() => {
    const handleFind = (e: CustomEvent<string>) => {
      const id = e.detail;

      useStore.setState({ isOutlinerOpen: true });

      const ctxGroupRects = getGroupRectsForContext(canvasContext);
      const ctxTracks = getTracksForContext(canvasContext);
      let needsNotes = false;
      let needsGroups = false;
      let needsTracks = false;
      let isDisabled = false;

      if (id.startsWith('groupRect:')) {
        needsGroups = true;
        const gr = ctxGroupRects.find(g => g.id === id.split(':')[1]);
        if (gr && gr.enabled === false) isDisabled = true;
      } else if (id.startsWith('track:')) {
        needsTracks = true;
        const tr = ctxTracks.find(t => t.id === id.split(':')[1]);
        if (tr && (tr as { enabled?: boolean }).enabled === false) isDisabled = true;
      } else {
        needsNotes = true;
        const contextBlocks = getBlocksForContext(canvasContext);
        const block = contextBlocks.find(b => b.id === id);
        if (block) {
          if ((block as { enabled?: boolean }).enabled === false) isDisabled = true;
          for (const gr of ctxGroupRects) {
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
    window.addEventListener('find-in-outliner', handleFind as EventListener);
    return () => window.removeEventListener('find-in-outliner', handleFind as EventListener);
  }, [canvasContext]);

  const handleShiftClick = (clickedId: string, clickedType: 'block' | 'groupRect' | 'track') => {
    const { lastSelectedId, lastSelectedType } = getLastSelectedForContext(canvasContext);
    const state = {
      selectedBlockIds: selectedBlockIds,
      selectedGroupRectIds: selectedGroupRectIds,
      selectedTrackIds: selectedTrackIds,
    };

    if (!lastSelectedId || !lastSelectedType) {
      if (clickedType === 'block') selectBlockInContext(canvasContext, clickedId, false);
      else if (clickedType === 'groupRect') selectGroupRectInContext(canvasContext, clickedId, false);
      else if (clickedType === 'track') selectTrackInContext(canvasContext, clickedId, false);
      return;
    }

    const itemEls = Array.from(document.querySelectorAll('.outliner-item'));
    const getElId = (id: string, type: string) =>
      type === 'groupRect' ? `outliner-item-groupRect-${id}` :
      type === 'track' ? `outliner-item-track-${id}` :
      `outliner-item-${id}`;

    const clickedElId = getElId(clickedId, clickedType);
    const lastElId = getElId(lastSelectedId, lastSelectedType);

    const clickedIdx = itemEls.findIndex(el => el.id === clickedElId);
    const lastIdx = itemEls.findIndex(el => el.id === lastElId);

    if (clickedIdx === -1 || lastIdx === -1) {
      if (clickedType === 'block') selectBlockInContext(canvasContext, clickedId, true);
      else if (clickedType === 'groupRect') selectGroupRectInContext(canvasContext, clickedId, true);
      else if (clickedType === 'track') selectTrackInContext(canvasContext, clickedId, true);
      return;
    }

    const startIdx = Math.min(clickedIdx, lastIdx);
    const endIdx = Math.max(clickedIdx, lastIdx);
    const rangeEls = itemEls.slice(startIdx, endIdx + 1);

    const newSelectedBlocks = new Set(state.selectedBlockIds);
    const newSelectedGroups = new Set(state.selectedGroupRectIds);
    const newSelectedTracks = new Set(state.selectedTrackIds);

    rangeEls.forEach(el => {
      const elId = el.id;
      if (elId.startsWith('outliner-item-groupRect-')) newSelectedGroups.add(elId.replace('outliner-item-groupRect-', ''));
      else if (elId.startsWith('outliner-item-track-')) newSelectedTracks.add(elId.replace('outliner-item-track-', ''));
      else if (elId.startsWith('outliner-item-')) newSelectedBlocks.add(elId.replace('outliner-item-', ''));
    });

    setSelectionBatchInContext(canvasContext, {
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

  const filteredBlocks = getBlocksForContext(canvasContext).filter(b =>
    (b.pitch.toLowerCase().includes(query) ||
    (b.keyBinding && b.keyBinding.toLowerCase().includes(query))) &&
    (!filters.enable || (b as { enabled?: boolean }).enabled !== false)
  );

  const filteredGroupRects = groupRects.filter(g =>
    ((g.name || '').toLowerCase().includes(query) || !query) &&
    (!filters.enable || g.enabled !== false)
  );

  const filteredTracks = tracks.filter((t, i) =>
    (`Track ${i + 1}`.toLowerCase().includes(query) || !query) &&
    (!filters.enable || (t as { enabled?: boolean }).enabled !== false)
  );

  const noteToGroupRect = new Map<string, string>();
  const groupRectChildren = new Map<string, { blocks: typeof filteredBlocks; tracks: typeof filteredTracks }>();

  filteredGroupRects.forEach(gr => groupRectChildren.set(gr.id, { blocks: [], tracks: [] }));

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

  const ungroupedBlocks = filteredBlocks.filter(b => !noteToGroupRect.has(b.id));
  const ungroupedTracks = filteredTracks.filter(t => !trackToGroupRect.has(t.id));

  const toggleFilter = (key: keyof FilterState) => setFilters(prev => ({ ...prev, [key]: !prev[key] }));

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
      <div
        className="outliner-filter-bar"
        onWheel={(e) => {
          if (e.deltaY !== 0) { e.stopPropagation(); e.currentTarget.scrollLeft += e.deltaY; }
        }}
      >
        <button className={`outliner-filter-btn ${filters.notes ? 'active' : ''}`} onClick={() => toggleFilter('notes')} title="Toggle Notes">
          <Music size={14} /> Notes
        </button>
        <button className={`outliner-filter-btn ${filters.groups ? 'active' : ''}`} onClick={() => toggleFilter('groups')} title="Toggle Groups">
          <Square size={14} fill="currentColor" /> Groups
        </button>
        <button className={`outliner-filter-btn ${filters.tracks ? 'active' : ''}`} onClick={() => toggleFilter('tracks')} title="Toggle Tracks">
          <GitBranch size={14} /> Tracks
        </button>
        <button className={`outliner-filter-btn ${filters.enable ? 'active' : ''}`} onClick={() => toggleFilter('enable')} title="Toggle Enabled Only">
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
              camera={camera}
              tracks={tracks}
              handleShiftClick={handleShiftClick}
              canvasContext={canvasContext}
            />
          );
        })}

        {filters.notes && ungroupedBlocks.map(block => (
          <BlockItem
            key={block.id}
            block={block}
            selected={selectedBlockIds.includes(block.id)}
            camera={camera}
            handleShiftClick={handleShiftClick}
            canvasContext={canvasContext}
          />
        ))}

        {filters.tracks && ungroupedTracks.map((track) => (
          <TrackItem
            key={track.id}
            track={track}
            label={`Track ${tracks.indexOf(track) + 1}`}
            selected={selectedTrackIds.includes(track.id)}
            camera={camera}
            handleShiftClick={handleShiftClick}
            canvasContext={canvasContext}
          />
        ))}
      </div>
    </FloatingWindow>
  );
};

// ─── GroupRect Item ───────────────────────────────────────────────────────────

const GroupRectItem = ({ groupRect, index, childBlocks, childTracks, selectedBlockIds, selectedGroupRectIds, selectedTrackIds, camera, tracks, handleShiftClick, canvasContext }: {
  groupRect: import('../../types').GroupRect;
  index: number;
  childBlocks: import('../../types').Block[];
  childTracks: import('../../types').Track[];
  selectedBlockIds: string[];
  selectedGroupRectIds: string[];
  selectedTrackIds: string[];
  camera: import('../../types').CameraState;
  tracks: import('../../types').Track[];
  handleShiftClick: (id: string, type: 'block' | 'groupRect' | 'track') => void;
  canvasContext: CanvasContextType;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isSelected = selectedGroupRectIds.includes(groupRect.id);
  const hasChildren = childBlocks.length > 0 || childTracks.length > 0;
  const wasSelectedRef = useRef(false);

  const blockIdsToSelect = childBlocks.map(b => b.id);
  const trackIdsToSelect = childTracks.map(t => t.id);
  const isAllSelected =
    isSelected &&
    blockIdsToSelect.every(id => selectedBlockIds.includes(id)) &&
    trackIdsToSelect.every(id => selectedTrackIds.includes(id));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' && isSelected && !isEditing) {
        const { lastSelectedId } = getLastSelectedForContext(canvasContext);
        const ctxState = canvasContext === 'editor'
          ? useLevelEditorStore.getState()
          : canvasContext === 'game'
            ? useGameStore.getState()
            : useStore.getState();
        const totalSelectedCount = ctxState.selectedBlockIds.length + ctxState.selectedGroupRectIds.length + ctxState.selectedTrackIds.length;
        void lastSelectedId;
        if (totalSelectedCount === 1) {
          setEditName(groupRect.name || `Group ${index + 1}`);
          setIsEditing(true);
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelected, isEditing, groupRect.name, index, canvasContext]);

  useEffect(() => {
    const handleExpand = (e: CustomEvent<string>) => {
      if (e.detail === groupRect.id) setIsCollapsed(false);
    };
    window.addEventListener('expand-group', handleExpand as EventListener);
    return () => window.removeEventListener('expand-group', handleExpand as EventListener);
  }, [groupRect.id]);

  const handleGoTo = () => {
    const center = getCanvasCenter(canvasContext);
    const targetX = -(groupRect.x + groupRect.w / 2) * camera.zoom + center.x;
    const targetY = -(groupRect.y + groupRect.h / 2) * camera.zoom + center.y;
    animateCameraTo(targetX, targetY, canvasContext);
  };

  return (
    <div className="outliner-group">
      <div
        id={`outliner-item-groupRect-${groupRect.id}`}
        className={`outliner-item group-rect-item ${isSelected ? 'selected' : ''}`}
        style={{ opacity: groupRect.enabled === false && !isSelected ? 0.4 : 1 }}
        onPointerDown={() => wasSelectedRef.current = isSelected}
        onClick={(e) => {
          if (e.shiftKey) handleShiftClick(groupRect.id, 'groupRect');
          else selectGroupRectInContext(canvasContext, groupRect.id, e.ctrlKey);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          openContextMenuInContext(canvasContext, { x: e.clientX, y: e.clientY, blockId: `groupRect:${groupRect.id}` });
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          selectGroupRectInContext(canvasContext, groupRect.id, e.ctrlKey || e.shiftKey);
          handleGoTo();
        }}
      >
        <button
          className="outliner-collapse-btn"
          onClick={(e) => { e.stopPropagation(); setIsCollapsed(!isCollapsed); }}
          style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <Square size={16} className="flex-shrink-0" style={{ opacity: 0.7 }} fill="currentColor" />
        {isEditing ? (
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={() => { updateGroupRectInContext(canvasContext, groupRect.id, { name: editName }); setIsEditing(false); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { updateGroupRectInContext(canvasContext, groupRect.id, { name: editName }); setIsEditing(false); }
              else if (e.key === 'Escape') { setIsEditing(false); e.stopPropagation(); }
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
            if (isAllSelected) {
              setGroupSelectionBatchInContext(canvasContext, {
                selectedGroupRectIds: selectedGroupRectIds.filter(id => id !== groupRect.id),
                selectedBlockIds: selectedBlockIds.filter(id => !blockIdsToSelect.includes(id)),
                selectedTrackIds: selectedTrackIds.filter(id => !trackIdsToSelect.includes(id)),
              });
            } else {
              setGroupSelectionBatchInContext(canvasContext, {
                selectedGroupRectIds: [...new Set([...selectedGroupRectIds, groupRect.id])],
                selectedBlockIds: [...new Set([...selectedBlockIds, ...blockIdsToSelect])],
                selectedTrackIds: [...new Set([...selectedTrackIds, ...trackIdsToSelect])],
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
        <div className="outliner-key-badge" title={groupRect.keyBinding ? `Key bound: ${groupRect.keyBinding}` : "No key bound"}>
          <Keyboard size={12} />
          <span className="select-none" style={{ fontSize: '12px', minWidth: '12px', textAlign: 'center' }}>
            {groupRect.keyBinding || '-'}
          </span>
        </div>
      </div>
      {!isCollapsed && hasChildren && (
        <div className="outliner-group-children">
          {childBlocks.map(block => (
            <BlockItem
              key={block.id}
              block={block}
              selected={selectedBlockIds.includes(block.id)}
              camera={camera}
              handleShiftClick={handleShiftClick}
              canvasContext={canvasContext}
            />
          ))}
          {childTracks.map(track => (
            <TrackItem
              key={track.id}
              track={track}
              label={`Track ${tracks.indexOf(track) + 1}`}
              selected={selectedTrackIds.includes(track.id)}
              camera={camera}
              handleShiftClick={handleShiftClick}
              canvasContext={canvasContext}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Block Item ───────────────────────────────────────────────────────────────

const BlockItem = ({ block, selected, camera, handleShiftClick, canvasContext }: {
  block: import('../../types').Block;
  selected: boolean;
  camera: import('../../types').CameraState;
  handleShiftClick: (id: string, type: 'block' | 'groupRect' | 'track') => void;
  canvasContext: CanvasContextType;
}) => {
  const wasSelectedRef = useRef(false);

  const handleGoTo = () => {
    const center = getCanvasCenter(canvasContext);
    const targetX = -(block.x + 30) * camera.zoom + center.x;
    const targetY = -(block.y + 30) * camera.zoom + center.y;
    animateCameraTo(targetX, targetY, canvasContext);
  };

  return (
    <div
      id={`outliner-item-${block.id}`}
      className={`outliner-item block-item ${selected ? 'selected' : ''}`}
      style={{ opacity: (block as { enabled?: boolean }).enabled === false && !selected ? 0.4 : 1 }}
      onPointerDown={() => wasSelectedRef.current = selected}
      onClick={(e) => {
        if (e.shiftKey) handleShiftClick(block.id, 'block');
        else selectBlockInContext(canvasContext, block.id, e.ctrlKey);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        openContextMenuInContext(canvasContext, { x: e.clientX, y: e.clientY, blockId: block.id });
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        selectBlockInContext(canvasContext, block.id, e.ctrlKey || e.shiftKey);
        handleGoTo();
      }}
    >
      <Music size={16} className="text-gray-400 flex-shrink-0" />
      <span className="flex-1 truncate select-none" style={{ fontSize: '14px' }}>{block.pitch}</span>
      <div className="outliner-key-badge" title={block.keyBinding ? `Key bound: ${block.keyBinding}` : "No key bound"}>
        <Keyboard size={12} />
        <span className="select-none" style={{ fontSize: '12px', minWidth: '12px', textAlign: 'center' }}>
          {block.keyBinding || '-'}
        </span>
      </div>
    </div>
  );
};

// ─── Track Item ───────────────────────────────────────────────────────────────

const TrackItem = ({ track, label, selected, camera, handleShiftClick, canvasContext }: {
  track: import('../../types').Track;
  label: string;
  selected: boolean;
  camera: import('../../types').CameraState;
  handleShiftClick: (id: string, type: 'block' | 'groupRect' | 'track') => void;
  canvasContext: CanvasContextType;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const wasSelectedRef = useRef(false);

  const isPlaying = useStore(state => state.isPlaying);
  const playbackStatus = useStore(state => state.trackPlaybackStatus[track.id]);
  const isTrackPlaying = playbackStatus === 'playing' || (isPlaying && (track as { enabled?: boolean }).enabled !== false);
  const isTrackPaused = playbackStatus === 'paused' && !isPlaying;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' && selected && !isEditing) {
        const ctxState = canvasContext === 'editor'
          ? useLevelEditorStore.getState()
          : canvasContext === 'game'
            ? useGameStore.getState()
            : useStore.getState();
        const totalSelectedCount = ctxState.selectedBlockIds.length + ctxState.selectedGroupRectIds.length + ctxState.selectedTrackIds.length;
        if (totalSelectedCount === 1) {
          setEditName(track.name || label);
          setIsEditing(true);
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected, isEditing, track.name, label, canvasContext]);

  const handleGoTo = () => {
    if (track.nodes.length === 0) return;
    const center = getCanvasCenter(canvasContext);
    const targetX = -track.nodes[0].x * camera.zoom + center.x;
    const targetY = -track.nodes[0].y * camera.zoom + center.y;
    animateCameraTo(targetX, targetY, canvasContext);
  };

  return (
    <div
      id={`outliner-item-track-${track.id}`}
      className={`outliner-item track-item ${selected ? 'selected' : ''}`}
      style={{ opacity: (track as { enabled?: boolean }).enabled === false && !selected ? 0.4 : 1 }}
      onPointerDown={() => wasSelectedRef.current = selected}
      onClick={(e) => {
        if (e.shiftKey) handleShiftClick(track.id, 'track');
        else selectTrackInContext(canvasContext, track.id, e.ctrlKey);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        openContextMenuInContext(canvasContext, { x: e.clientX, y: e.clientY, blockId: `track:${track.id}` });
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        selectTrackInContext(canvasContext, track.id, e.ctrlKey || e.shiftKey);
        handleGoTo();
      }}
    >
      <GitBranch size={16} className="flex-shrink-0" style={{ opacity: 0.7 }} />
      {isEditing ? (
        <input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={() => { updateTrackInContext(canvasContext, track.id, { name: editName }); setIsEditing(false); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { updateTrackInContext(canvasContext, track.id, { name: editName }); setIsEditing(false); }
            else if (e.key === 'Escape') { setIsEditing(false); e.stopPropagation(); }
          }}
          className="outliner-input font-semibold"
          onClick={(e) => e.stopPropagation()}
          autoFocus
        />
      ) : (
        <div className="flex-1 truncate select-none" style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="truncate">{track.name || label}</span>
          {canvasContext === 'playground' && isTrackPlaying && <Play size={12} fill="currentColor" style={{ color: '#22c55e' }} />}
          {canvasContext === 'playground' && isTrackPaused && <Pause size={12} fill="currentColor" style={{ color: '#eab308' }} />}
        </div>
      )}
      <span style={{ fontSize: '11px', opacity: 0.5 }}>{track.nodes.length} nodes</span>
    </div>
  );
};
