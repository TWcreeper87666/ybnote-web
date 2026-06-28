import React, { useEffect } from "react";
import { inputManager } from "../../inputs/InputManager";

export interface EditorContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  children: React.ReactNode;
}

export const EditorContextMenu: React.FC<EditorContextMenuProps> = ({
  x,
  y,
  onClose,
  children,
}) => {
  useEffect(() => {
    const handleClickOutside = () => onClose();
    const handleKeyDown = (key: string) => {
      if (key === "Escape") onClose();
    };
    window.addEventListener("click", handleClickOutside);
    inputManager.on("keydown", handleKeyDown);
    return () => {
      window.addEventListener("click", handleClickOutside);
      inputManager.off("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="le-context-menu"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {children}
    </div>
  );
};

export const EditorContextMenuItem: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}> = ({ onClick, children, danger }) => (
  <button className={`le-cm-item ${danger ? "danger" : ""}`} onClick={onClick}>
    {children}
  </button>
);

export const EditorContextMenuDivider: React.FC = () => (
  <div className="le-cm-divider" />
);
