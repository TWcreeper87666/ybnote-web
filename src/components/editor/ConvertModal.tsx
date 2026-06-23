import React, { useState } from 'react';
import { X, RefreshCw, Wand2 } from 'lucide-react';
import { useLevelEditorStore } from '../../store/useLevelEditorStore';
import {
  autoChart,
  generateMissingBlocks,
  syncGameEventsFromMidi,
  type AutoChartStrategy,
} from '../../utils/chartUtils';

interface ConvertModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConvertModal: React.FC<ConvertModalProps> = ({ isOpen, onClose }) => {
  const store = useLevelEditorStore();
  const [cdRadius, setCdRadius] = useState(2);
  const [strategy, setStrategy] = useState<AutoChartStrategy>('nearest');
  const [onlyUnassigned, setOnlyUnassigned] = useState(true);
  const [status, setStatus] = useState('');

  if (!isOpen) return null;

  const handleGenerateBlocks = () => {
    if (!store.midiData) return;
    const result = generateMissingBlocks(store.midiData);
    setStatus(`已補齊 ${result.addedBlocks} 個方塊、${result.addedGroupRects} 個 GroupRect`);
    store.commitHistory();
  };

  const handleAutoChart = () => {
    if (!store.midiData) return;
    const updated = autoChart(store.midiData, { cdRadius, strategy, onlyUnassigned });
    useLevelEditorStore.setState({ midiData: updated });
    syncGameEventsFromMidi(updated);
    store.commitHistory();
    const assigned = updated.tracks
      .filter((t) => !t.isBackground)
      .flatMap((t) => t.notes)
      .filter((n) => n.targetId).length;
    setStatus(`Auto-Chart 完成：${assigned} 個音符已分配`);
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={onClose} />
      <div
        className="glass-panel"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 101,
          width: 380,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(30,30,35,0.95)',
          color: 'white',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Convert</h3>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>

        <section>
          <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8, fontWeight: 600 }}>
            補齊方塊
          </div>
          <p style={{ margin: '0 0 10px', fontSize: 13, opacity: 0.8 }}>
            掃描 MIDI 音調，補齊缺少的方塊或 GroupRect（group_rect 軌道）。
          </p>
          <button
            className="le-cm-item"
            onClick={handleGenerateBlocks}
            disabled={!store.midiData}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              cursor: store.midiData ? 'pointer' : 'not-allowed',
              opacity: store.midiData ? 1 : 0.5,
            }}
          >
            <RefreshCw size={16} /> Generate Missing Blocks
          </button>
        </section>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.1)' }} />

        <section>
          <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8, fontWeight: 600 }}>
            Auto-Chart
          </div>

          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: 13 }}>
            <span>CD 半徑（×60px）</span>
            <input
              type="number"
              min={0}
              max={10}
              step={0.5}
              value={cdRadius}
              onChange={(e) => setCdRadius(Number(e.target.value))}
              style={{ width: 60, padding: '4px 8px', background: 'rgba(0,0,0,0.4)', border: '1px solid #444', borderRadius: 4, color: '#fff' }}
            />
          </label>

          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: 13 }}>
            <span>策略</span>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as AutoChartStrategy)}
              style={{ padding: '4px 8px', background: 'rgba(0,0,0,0.4)', border: '1px solid #444', borderRadius: 4, color: '#fff' }}
            >
              <option value="nearest">最近距離</option>
              <option value="roundRobin">輪替</option>
              <option value="random">隨機</option>
            </select>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={onlyUnassigned}
              onChange={(e) => setOnlyUnassigned(e.target.checked)}
            />
            僅處理未分配的音符
          </label>

          <button
            className="le-cm-item"
            onClick={handleAutoChart}
            disabled={!store.midiData}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              cursor: store.midiData ? 'pointer' : 'not-allowed',
              opacity: store.midiData ? 1 : 0.5,
            }}
          >
            <Wand2 size={16} /> Run Auto-Chart
          </button>
        </section>

        {status && (
          <div style={{ fontSize: 13, color: '#a5b4fc', padding: '8px 12px', background: 'rgba(99,102,241,0.15)', borderRadius: 6 }}>
            {status}
          </div>
        )}
      </div>
    </>
  );
};
