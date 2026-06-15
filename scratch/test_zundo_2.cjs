const zustand = require('zustand/vanilla');
const { temporal } = require('zundo');

const store = zustand.createStore(
  temporal(
    (set) => ({
      blocks: [{ id: 1, x: 0 }],
      updateBlock: (x) => set(state => ({ blocks: [{ ...state.blocks[0], x }] }))
    }),
    {
      partialize: (state) => ({ blocks: state.blocks }),
      equality: (past, current) => past.blocks === current.blocks
    }
  )
);

store.temporal.setState(s => ({
  pastStates: [...s.pastStates, { blocks: store.getState().blocks }],
  futureStates: []
}));
store.temporal.getState().pause();

console.log('Is tracking:', store.temporal.getState().isTracking);

store.getState().updateBlock(1);
store.getState().updateBlock(2);
store.getState().updateBlock(3);

console.log('After updates during pause:', store.temporal.getState().pastStates.map(s => s.blocks[0].x));

store.temporal.getState().resume();
console.log('Is tracking:', store.temporal.getState().isTracking);
store.getState().updateBlock(100);
console.log('After resume and update:', store.temporal.getState().pastStates.map(s => s.blocks[0].x));

