import type { Block } from "../types";
import type { GameEvent } from "../store/useGameStore";

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

function pitchToMidi(pitch: string, midiNumber?: number): number {
  if (midiNumber !== undefined) return midiNumber;
  const m = pitch.match(/^([A-G]#?)(\d)$/);
  if (m) {
    const noteIdx = NOTE_NAMES.indexOf(m[1]);
    if (noteIdx !== -1) return noteIdx + parseInt(m[2]) * 12;
  }
  return 60;
}

function gridLayout(blocks: Block[], cols = 8): Block[] {
  const n = blocks.length;
  if (n === 0) return [];
  const spacing = 80;
  const numRows = Math.ceil(n / cols);
  const startX = -(Math.min(cols, n) * spacing) / 2 + 10;
  const startY = -(numRows * spacing) / 2 + 10;
  return blocks.map((b, i) => ({
    ...b,
    x: startX + (i % cols) * spacing,
    y: startY + Math.floor(i / cols) * spacing,
  }));
}

export function autoArrangeBlocks(
  blocks: Block[],
  events: GameEvent[],
  mode: "grid" | "pitch" | "smart",
  cols = 8,
): Block[] {
  if (blocks.length === 0) return blocks;

  if (mode === "grid") {
    return gridLayout([...blocks], cols);
  }

  if (mode === "pitch") {
    // 假設外部有提供 pitchToMidi 函數
    const sorted = [...blocks].sort(
      (a, b) =>
        pitchToMidi(a.pitch, a.midiNumber) - pitchToMidi(b.pitch, b.midiNumber),
    );
    return gridLayout(sorted, cols);
  }

  // ==========================================
  // Smart v2: 綜合權重分析與 2-opt hill climbing
  // ==========================================
  const N = blocks.length;
  const blockIndexById = new Map(blocks.map((b, i) => [b.id, i]));

  // 快取每個 Block 的 MIDI 值，方便後續比對音高與音程
  const blockMidi = blocks.map((b) => pitchToMidi(b.pitch, b.midiNumber));

  // 過濾並轉換有效事件，確保每個事件都能對應到 Block Index 與時間
  const validEvents = events
    .filter((e) => e.blockId !== "background" && blockIndexById.has(e.blockId))
    .map((e) => ({
      idx: blockIndexById.get(e.blockId)!,
      midi: blockMidi[blockIndexById.get(e.blockId)!],
      time: e.time,
    }));

  const E = validEvents.length;
  const weight: number[][] = Array.from({ length: N }, () =>
    new Array(N).fill(0),
  );

  // --------------------------------------------------
  // 1. Transition & Jump Penalty (考慮連續觸發次數)
  // --------------------------------------------------
  const transitionStats = new Map<
    string,
    { count: number; minTimeDiff: number }
  >();

  for (let i = 0; i < E - 1; i++) {
    const a = validEvents[i].idx;
    const b = validEvents[i + 1].idx;
    if (a === b) continue;

    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    const timeDiff = Math.max(1, validEvents[i + 1].time - validEvents[i].time);

    const stat = transitionStats.get(key) || {
      count: 0,
      minTimeDiff: Infinity,
    };
    stat.count += 1;
    stat.minTimeDiff = Math.min(stat.minTimeDiff, timeDiff);
    transitionStats.set(key, stat);
  }

  // 套用 w = frequency² / timediff
  for (const [key, stat] of transitionStats.entries()) {
    const [a, b] = key.split("-").map(Number);
    const w = (Math.pow(stat.count, 2) * 500) / stat.minTimeDiff;
    weight[a][b] += w * 0.35; // Transition 權重佔比
    weight[b][a] += w * 0.35;
  }

  // --------------------------------------------------
  // 2. Pitch Similarity (相鄰音與同音加權)
  // --------------------------------------------------
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const diff = Math.abs(blockMidi[i] - blockMidi[j]);
      let w = 0;
      if (diff === 0)
        w = 15; // 同 Pitch
      else if (diff <= 2) w = 5; // 相鄰音

      weight[i][j] += w * 0.05;
      weight[j][i] += w * 0.05;
    }
  }

  // --------------------------------------------------
  // 3. N-gram 分析 (Repeated Phrase, Interval, Rhythm)
  // --------------------------------------------------
  const PHRASE_LEN = 4;
  if (E >= PHRASE_LEN) {
    const phraseMap = new Map<string, number[][]>();
    const intervalMap = new Map<string, number[][]>();
    const rhythmMap = new Map<string, number[][]>();

    // 收集所有 N-gram
    for (let i = 0; i <= E - PHRASE_LEN; i++) {
      const chunk = validEvents.slice(i, i + PHRASE_LEN);
      const indices = chunk.map((e) => e.idx);

      // Phrase Hash (Block ID 組成)
      const phraseHash = indices.join(",");
      if (!phraseMap.has(phraseHash)) phraseMap.set(phraseHash, []);
      phraseMap.get(phraseHash)!.push(indices);

      // Interval Hash (音高差組成)
      const intervals = [];
      for (let j = 0; j < PHRASE_LEN - 1; j++)
        intervals.push(chunk[j + 1].midi - chunk[j].midi);
      const intervalHash = intervals.join(",");
      if (!intervalMap.has(intervalHash)) intervalMap.set(intervalHash, []);
      intervalMap.get(intervalHash)!.push(indices);

      // Rhythm Hash (時間差組成，為了容錯可將時間差四捨五入到最近的 10ms)
      const rhythms = [];
      for (let j = 0; j < PHRASE_LEN - 1; j++) {
        rhythms.push(Math.round((chunk[j + 1].time - chunk[j].time) / 10) * 10);
      }
      const rhythmHash = rhythms.join(",");
      if (!rhythmMap.has(rhythmHash)) rhythmMap.set(rhythmHash, []);
      rhythmMap.get(rhythmHash)!.push(indices);
    }

    // 輔助函數：增加兩個 Block Array 之間的綜合連線權重
    const addNgramWeight = (groups: number[][][], weightMultiplier: number) => {
      for (const group of groups) {
        if (group.length < 2) continue; // 沒有重複出現
        // 兩兩比對重複出現的 pattern，將對應位置的 Block 互相拉近
        for (let g1 = 0; g1 < group.length; g1++) {
          for (let g2 = g1 + 1; g2 < group.length; g2++) {
            const seq1 = group[g1];
            const seq2 = group[g2];
            for (let k = 0; k < PHRASE_LEN; k++) {
              const a = seq1[k];
              const b = seq2[k];
              if (a !== b) {
                // 長樂句的權重紅利：重複次數越多，加權越重
                const w = 20 * weightMultiplier * group.length;
                weight[a][b] += w;
                weight[b][a] += w;
              }
            }
          }
        }
      }
    };

    addNgramWeight(Array.from(phraseMap.values()), 0.3); // 重複 Phrase (30%)
    addNgramWeight(Array.from(intervalMap.values()), 0.15); // 音程相似 (15%)
    addNgramWeight(Array.from(rhythmMap.values()), 0.1); // 節奏相似 (10%)
  }

  // --------------------------------------------------
  // 4. Initial positions & 2-opt Hill Climbing
  // --------------------------------------------------
  const initial = gridLayout([...blocks], cols);
  const pos = initial.map((b) => ({ x: b.x, y: b.y }));

  const iters = N * N * 4; // 稍微增加迭代次數讓收斂更完整
  for (let iter = 0; iter < iters; iter++) {
    const p = Math.floor(Math.random() * N);
    let q = Math.floor(Math.random() * N);
    if (p === q) continue;
    if (q === p) q = (p + 1) % N;

    let improvement = 0;
    for (let k = 0; k < N; k++) {
      if (k === p || k === q) continue;
      const wp = weight[p][k];
      const wq = weight[q][k];
      if (wp === 0 && wq === 0) continue;

      const dxp = pos[p].x - pos[k].x;
      const dyp = pos[p].y - pos[k].y;
      const dxq = pos[q].x - pos[k].x;
      const dyq = pos[q].y - pos[k].y;

      // 使用距離平方可以減少 Math.sqrt 開銷，並讓遠距離的懲罰更顯著
      const distP = dxp * dxp + dyp * dyp;
      const distQ = dxq * dxq + dyq * dyq;

      improvement += (wp - wq) * (distP - distQ);
    }

    if (improvement > 0) {
      const tmp = pos[p];
      pos[p] = pos[q];
      pos[q] = tmp;
    }
  }

  return blocks.map((b, i) => ({ ...b, x: pos[i].x, y: pos[i].y }));
}
