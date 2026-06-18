import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { Search, Folder, Music, LayoutList, Keyboard, GitBranch, Square, ChevronRight, ChevronDown, X } from 'lucide-react';

// Smooth camera animation helper
const animateCameraTo = (targetX: number, targetY: number, duration = 300) => {
  const state = useStore.getState();
  const startX = state.camera.x;
  const startY = state.camera.y;
  const startTime = performance.now();

  const tick = (now: number) => {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    // ease-out cubic
    const ease = 1 - Math.pow(1 - t, 3);

    useStore.getState().updateCamera({
      x: startX + (targetX - startX) * ease,
      y: startY + (targetY - startY) * ease,
    });

    if (t < 1) requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
};

type FilterState = { notes: boolean; groups: boolean; tracks: boolean };

export const HierarchyPanel: React.FC = () => {
  const { 
    blocks, groups, groupRects, tracks, selectedBlockIds, selectedGroupRectIds, selectedTrackIds,
    isHierarchyOpen, 
    selectBlock, updateBlock, updateGroupRect, selectGroupRect, selectTrack,
    searchQuery, setSearchQuery,
    camera
  } = useStore();

  const [filters, setFilters] = useState<FilterState>({ notes: true, groups: true, tracks: true });

  useEffect(() => {
    const searchInput = document.getElementById('outliner-search-input') as HTMLInputElement;
    if (searchInput) searchInput.focus();
  }, []);

  useEffect(() => {
    const handleFind = (e: any) => {
      const id = e.detail;
      
      // Force open hierarchy panel if closed
      useStore.setState({ isHierarchyOpen: true });
      
      // Determine if we need to expand a group
      const state = useStore.getState();
      if (!id.startsWith('groupRect:') && !id.startsWith('track:')) {
         const block = state.blocks.find(b => b.id === id);
         if (block) {
           for (const gr of state.groupRects) {
             const bCenterX = block.x + 30;
             const bCenterY = block.y + 30;
             if (bCenterX >= gr.x && bCenterX <= gr.x + gr.w && bCenterY >= gr.y && bCenterY <= gr.y + gr.h) {
               window.dispatchEvent(new CustomEvent('expand-group', { detail: gr.id }));
               break;
             }
           }
         }
      }

      setTimeout(() => {
        const elId = id.startsWith('groupRect:') ? `outliner-item-groupRect-${id.split(':')[1]}` : `outliner-item-${id}`;
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

  const [position, setPosition] = useState({ x: 24, y: 24 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  if (!isHierarchyOpen) return null;

  const query = searchQuery.toLowerCase();

  // Filter blocks by search
  const filteredBlocks = blocks.filter(b =>
    b.pitch.toLowerCase().includes(query) ||
    (b.keyBinding && b.keyBinding.toLowerCase().includes(query))
  );

  // Filter groupRects by search
  const filteredGroupRects = groupRects.filter(g =>
    (g.name || '').toLowerCase().includes(query) || !query
  );

  // Filter tracks by search (match by index-based label)
  const filteredTracks = tracks.filter((_, i) =>
    `Track ${i + 1}`.toLowerCase().includes(query) || !query
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
    <div 
      className="hierarchy-panel glass-panel"
      style={{ left: position.x, top: position.y, margin: 0, position: 'absolute', resize: 'both', overflow: 'hidden', minWidth: '250px', minHeight: '400px', height: '400px' }}
      onWheel={(e) => e.stopPropagation()}
    >
      <div 
        className="hierarchy-header select-none"
        style={{ cursor: 'move', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <h2 className="pointer-events-none" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}><LayoutList size={18} /> Outliner</h2>
        <button 
          className="icon-btn icon-btn-round" 
          onClick={() => useStore.setState({ isHierarchyOpen: false })}
          onPointerDown={(e) => e.stopPropagation()} 
        >
          <X size={18} />
        </button>
      </div>

      {/* Filter Toggles */}
      <div className="hierarchy-filter-bar">
        <button
          className={`hierarchy-filter-btn ${filters.notes ? 'active' : ''}`}
          onClick={() => toggleFilter('notes')}
          title="Toggle Notes"
        >
          <Music size={14} /> Notes
        </button>
        <button
          className={`hierarchy-filter-btn ${filters.groups ? 'active' : ''}`}
          onClick={() => toggleFilter('groups')}
          title="Toggle Groups"
        >
          <Square size={14} /> Groups
        </button>
        <button
          className={`hierarchy-filter-btn ${filters.tracks ? 'active' : ''}`}
          onClick={() => toggleFilter('tracks')}
          title="Toggle Tracks"
        >
          <GitBranch size={14} /> Tracks
        </button>
      </div>
      
      <div className="hierarchy-search">
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

      <div className="hierarchy-content">
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
              updateBlock={updateBlock}
              updateGroupRect={updateGroupRect}
              camera={camera}
              tracks={tracks}
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
            updateBlock={updateBlock} 
            camera={camera}
          />
        ))}

        {/* Ungrouped tracks */}
        {filters.tracks && ungroupedTracks.map((track, i) => (
          <TrackItem
            key={track.id}
            track={track}
            label={`Track ${tracks.indexOf(track) + 1}`}
            selected={selectedTrackIds.includes(track.id)}
            selectTrack={selectTrack}
            camera={camera}
          />
        ))}
      </div>
    </div>
  );
};

// ─── GroupRect Item ───────────────────────────────────────────────────────────

const GroupRectItem = ({ groupRect, index, childBlocks, childTracks, selectedBlockIds, selectedGroupRectIds, selectedTrackIds, selectBlock, selectGroupRect, selectTrack, updateBlock, updateGroupRect, camera, tracks }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isSelected = selectedGroupRectIds.includes(groupRect.id);
  const hasChildren = childBlocks.length > 0 || childTracks.length > 0;
  const wasSelectedRef = useRef(false);

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
    const handleExpand = (e: any) => {
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
    animateCameraTo(targetX, targetY);
  };

  return (
    <div className="hierarchy-group">
      <div 
        id={`outliner-item-groupRect-${groupRect.id}`}
        className={`hierarchy-item group-rect-item ${isSelected ? 'selected' : ''}`}
        onPointerDown={() => wasSelectedRef.current = isSelected}
        onClick={(e) => {
          if (wasSelectedRef.current && !e.ctrlKey && !e.shiftKey) {
            useStore.getState().toggleContextMenu({ x: e.clientX, y: e.clientY, blockId: `groupRect:${groupRect.id}` });
          } else {
            selectGroupRect(groupRect.id, e.ctrlKey || e.shiftKey);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          selectGroupRect(groupRect.id, e.ctrlKey || e.shiftKey);
          handleGoTo();
        }}
      >
        <button
          className="hierarchy-collapse-btn"
          onClick={(e) => {
            e.stopPropagation();
            setIsCollapsed(!isCollapsed);
          }}
          style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <Square size={16} className="flex-shrink-0" style={{ opacity: 0.7 }} />
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
            className="hierarchy-input font-semibold"
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
        <div 
          className="hierarchy-key-badge"
          title={groupRect.keyBinding ? `Key bound: ${groupRect.keyBinding}` : "No key bound"}
        >
          <Keyboard size={12} />
          <span className="select-none" style={{ fontSize: '12px', minWidth: '12px', textAlign: 'center' }}>
            {groupRect.keyBinding || '-'}
          </span>
        </div>
      </div>
      {!isCollapsed && hasChildren && (
        <div className="hierarchy-group-children">
          {childBlocks.map((block: any) => (
            <BlockItem 
              key={block.id} 
              block={block} 
              selected={selectedBlockIds.includes(block.id)} 
              selectBlock={selectBlock} 
              updateBlock={updateBlock} 
              camera={camera}
            />
          ))}
          {childTracks.map((track: any) => (
            <TrackItem
              key={track.id}
              track={track}
              label={`Track ${tracks.indexOf(track) + 1}`}
              selected={selectedTrackIds.includes(track.id)}
              selectTrack={selectTrack}
              camera={camera}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Block Item ──────────────────────────────────────────────────────────────

const BlockItem = ({ block, selected, selectBlock, updateBlock, camera }: any) => {
  const wasSelectedRef = useRef(false);

  const handleGoTo = () => {
    const targetX = -(block.x + 30) * camera.zoom + window.innerWidth / 2;
    const targetY = -(block.y + 30) * camera.zoom + window.innerHeight / 2;
    animateCameraTo(targetX, targetY);
  };

  return (
    <div 
      id={`outliner-item-${block.id}`}
      className={`hierarchy-item block-item ${selected ? 'selected' : ''}`}
      onPointerDown={() => wasSelectedRef.current = selected}
      onClick={(e) => {
        if (wasSelectedRef.current && !e.ctrlKey && !e.shiftKey) {
          useStore.getState().toggleContextMenu({ x: e.clientX, y: e.clientY, blockId: block.id });
        } else {
          selectBlock(block.id, e.ctrlKey || e.shiftKey);
        }
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
        className="hierarchy-key-badge"
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

const TrackItem = ({ track, label, selected, selectTrack, camera }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const wasSelectedRef = useRef(false);

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
    // Center on the first node
    const targetX = -track.nodes[0].x * camera.zoom + window.innerWidth / 2;
    const targetY = -track.nodes[0].y * camera.zoom + window.innerHeight / 2;
    animateCameraTo(targetX, targetY);
  };

  return (
    <div 
      id={`outliner-item-track-${track.id}`}
      className={`hierarchy-item track-item ${selected ? 'selected' : ''}`}
      onPointerDown={() => wasSelectedRef.current = selected}
      onClick={(e) => {
        if (wasSelectedRef.current && !e.ctrlKey && !e.shiftKey) {
          useStore.getState().toggleContextMenu({ x: e.clientX, y: e.clientY, blockId: `track:${track.id}` });
        } else {
          selectTrack(track.id, e.ctrlKey || e.shiftKey);
        }
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
            useStore.getState().updateTrack(track.id, { name: editName });
            setIsEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              useStore.getState().updateTrack(track.id, { name: editName });
              setIsEditing(false);
            } else if (e.key === 'Escape') {
              setIsEditing(false);
              e.stopPropagation();
            }
          }}
          className="hierarchy-input font-semibold"
          onClick={(e) => e.stopPropagation()}
          autoFocus
        />
      ) : (
        <span className="flex-1 truncate select-none" style={{ fontSize: '14px' }}>
          {track.name || label}
        </span>
      )}
      <span style={{ fontSize: '11px', opacity: 0.5 }}>
        {track.nodes.length} nodes
      </span>
    </div>
  );
};
