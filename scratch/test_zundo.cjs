const zustand = require('zustand/vanilla');
const { temporal } = require('zundo');

const store = zustand.createStore(
  temporal(
    (set) => ({
      blocks: [{ id: 1, x: 0 }],
      updateBlock: (x) => set(state => ({ blocks: [{ ...state.blocks[0], x }] })),
      select: () => set(state => ({ ...state, selected: true }))
    }),
    {
      partialize: (state) => ({ blocks: state.blocks }),
      equality: (past, current) => past.blocks === current.blocks
    }
  )
);

console.log('Initial pastStates length:', store.temporal.getState().pastStates.length);

store.getState().select();
console.log('After select (should not push):', store.temporal.getState().pastStates.length);

store.getState().updateBlock(1);
console.log('After move 1:', store.temporal.getState().pastStates.map(s => s.blocks[0].x));

store.temporal.getState().pause();

store.getState().updateBlock(2);
store.getState().updateBlock(100);

store.temporal.getState().resume();

console.log('After drop, pastStates:', store.temporal.getState().pastStates.map(s => s.blocks[0].x));

store.getState().select();

store.getState().updateBlock(101);
store.temporal.getState().pause();
store.getState().updateBlock(200);
store.temporal.getState().resume();

console.log('After second drop, pastStates:', store.temporal.getState().pastStates.map(s => s.blocks[0].x));

store.temporal.getState().undo();
console.log('After 1 undo, state is:', store.getState().blocks[0].x);

store.temporal.getState().undo();
console.log('After 2 undos, state is:', store.getState().blocks[0].x);

