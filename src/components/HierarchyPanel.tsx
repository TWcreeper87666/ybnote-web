import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Search, Folder, Music, LayoutList, Keyboard } from 'lucide-react';

export const HierarchyPanel: React.FC = () => {
  const { 
    blocks, groups, selectedBlockIds, isHierarchyOpen, 
    selectBlock, updateBlock, updateGroup, 
    searchQuery, setSearchQuery,
    camera, updateCamera
  } = useStore();

  useEffect(() => {
    const searchInput = document.getElementById('outliner-search-input') as HTMLInputElement;
    if (searchInput) searchInput.focus();
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

  const filteredBlocks = blocks.filter(b => 
    (b.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    b.pitch.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div 
      className="hierarchy-panel glass-panel"
      style={{ left: position.x, top: position.y, margin: 0, position: 'absolute', resize: 'both', overflow: 'hidden', minWidth: '250px', minHeight: '400px', height: '400px' }}
    >
      <div 
        className="hierarchy-header select-none flex items-center justify-between"
        style={{ cursor: 'move' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <h2 className="flex items-center gap-2 pointer-events-none"><LayoutList size={18} /> Outliner</h2>
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
        {groups.map(group => {
          const groupBlocks = filteredBlocks.filter(b => b.groupId === group.id);
          if (groupBlocks.length === 0 && searchQuery) return null; // hide empty groups when searching

          return <GroupItem 
            key={group.id} 
            group={group} 
            updateGroup={updateGroup}
            groupBlocks={groupBlocks}
            selectedBlockIds={selectedBlockIds}
            selectBlock={selectBlock}
            updateBlock={updateBlock}
            updateCamera={updateCamera}
            camera={camera}
          />;
        })}

        {/* Ungrouped blocks */}
        {filteredBlocks.filter(b => !b.groupId).map(block => (
          <BlockItem key={block.id} block={block} selected={selectedBlockIds.includes(block.id)} selectBlock={selectBlock} updateBlock={updateBlock} updateCamera={updateCamera} camera={camera} />
        ))}
      </div>
    </div>
  );
};

const GroupItem = ({ group, updateGroup, groupBlocks, selectedBlockIds, selectBlock, updateBlock, updateCamera, camera }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  return (
    <div className="hierarchy-group">
      <div 
        className="hierarchy-item group-item"
        onDoubleClick={() => setIsEditing(true)}
      >
        <Folder size={18} className="flex-shrink-0" />
        {isEditing ? (
          <input 
            value={group.name} 
            onChange={(e) => updateGroup(group.id, e.target.value)}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setIsEditing(false);
            }}
            className="hierarchy-input font-semibold"
            autoFocus
          />
        ) : (
          <span className="font-semibold flex-1 truncate select-none" style={{ fontSize: '14px' }}>
            {group.name}
          </span>
        )}
      </div>
      <div className="hierarchy-group-children">
        {groupBlocks.map((block: any) => (
          <BlockItem key={block.id} block={block} selected={selectedBlockIds.includes(block.id)} selectBlock={selectBlock} updateBlock={updateBlock} updateCamera={updateCamera} camera={camera} />
        ))}
      </div>
    </div>
  );
};

const BlockItem = ({ block, selected, selectBlock, updateBlock, updateCamera, camera }: any) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingBinding, setIsEditingBinding] = useState(false);
  
  return (
    <div 
      className={`hierarchy-item block-item ${selected ? 'selected' : ''} flex w-full items-center gap-2`}
      onClick={(e) => {
        selectBlock(block.id, e.ctrlKey || e.shiftKey);
        updateCamera({ x: -block.x * camera.zoom + window.innerWidth / 2, y: -block.y * camera.zoom + window.innerHeight / 2 });
      }}
    >
      <div 
        className="flex flex-col items-center justify-center min-w-0 overflow-hidden gap-1" 
        style={{ flex: '0 0 calc(50% - 0.25rem)' }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setIsEditingName(true);
        }}
        title="Double click to edit name"
      >
        <Music size={18} className="text-gray-400 flex-shrink-0" />
        
        <div className="flex items-center justify-center min-w-0 overflow-hidden w-full">
          {isEditingName ? (
            <input 
              value={block.name || `Note ${block.pitch}`} 
              onChange={(e) => updateBlock(block.id, { name: e.target.value })}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setIsEditingName(false);
              }}
              className="hierarchy-input w-full min-w-0 text-center"
              onClick={(e) => e.stopPropagation()} // prevent row select when editing
              autoFocus
            />
          ) : (
            <span className="truncate w-full select-none cursor-pointer text-center" style={{ fontSize: '14px' }}>
              {block.name || `Note ${block.pitch}`}
            </span>
          )}
        </div>
      </div>
      
      <div 
        className="flex flex-col items-center justify-center min-w-0 overflow-hidden gap-1" 
        style={{ flex: '0 0 calc(50% - 0.25rem)' }} 
        title="Double click to edit binding"
        onDoubleClick={(e) => { 
          e.stopPropagation(); 
          setIsEditingBinding(true); 
        }}
      >
        <Keyboard size={18} className="text-gray-500 flex-shrink-0" />
        <div className="flex items-center justify-center min-w-0 overflow-hidden w-full">
          {isEditingBinding ? (
            <input 
              value={block.keyBinding || ''}
              onChange={(e) => updateBlock(block.id, { keyBinding: e.target.value.slice(-1) })} // Only 1 character
              onBlur={() => setIsEditingBinding(false)}
              onKeyDown={(e) => { 
                if (e.key === 'Enter') setIsEditingBinding(false);
              }}
              placeholder="Key"
              className="hierarchy-input w-full text-center text-xs uppercase min-w-0"
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <span className="truncate w-full select-none cursor-pointer text-center" style={{ fontSize: '14px' }}>
              {block.keyBinding || '-'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
