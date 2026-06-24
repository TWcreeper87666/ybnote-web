export const isLevelEditor = (): boolean => {
  return window.location.hash.includes('level-editor');
};

export const isGame = (): boolean => {
  return window.location.hash.includes('game');
};
