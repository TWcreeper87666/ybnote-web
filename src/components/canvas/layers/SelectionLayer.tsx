import React from 'react';
import { SelectionBoxRenderer, GroupDrawBoxRenderer } from '../shared/SelectionBoxRenderer';

type Box = { x: number; y: number; w: number; h: number };

interface SelectionLayerProps {
  selectionBox: Box | null;
  groupDrawBox: Box | null;
  zoom: number;
}

export const SelectionLayer: React.FC<SelectionLayerProps> = ({ selectionBox, groupDrawBox, zoom }) => (
  <>
    <SelectionBoxRenderer selectionBox={selectionBox} zoom={zoom} />
    <GroupDrawBoxRenderer groupDrawBox={groupDrawBox} zoom={zoom} />
  </>
);
