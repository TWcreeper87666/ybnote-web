export * from './game';
export * from './editor';

export type Theme = 'light' | 'dark';
export type Mode = 'select' | 'draw_track' | 'piano' | 'drum' | 'draw_group' | 'play';

export type Point = { x: number; y: number }