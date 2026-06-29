import { Midi } from "@tonejs/midi";
import { useStore } from "../store/useStore";
import type { Block } from "../types";
import {
  getInstrumentByMidiProgram,
  getDrumPitchByMidiNote,
} from "../config/instruments";

export interface MidiTrackNote {
  time: number;
  duration: number;
  midi: number;
  pitch: string;
}

export interface MidiTrackInfo {
  index: number;
  name: string;
  instrument: string;
  noteCount: number;
  isPercussion: boolean;
  suggestInteractive: boolean;
  notes: MidiTrackNote[];
  duration: number;
}

export const getMidiTrackInfos = async (
  file: File,
): Promise<MidiTrackInfo[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const midi = new Midi(arrayBuffer);

  const infos: MidiTrackInfo[] = [];

  // 所有非打擊樂的 note
  const allNotes: {
    trackIndex: number;
    start: number;
    end: number;
    pitch: number;
  }[] = [];

  midi.tracks.forEach((track, trackIndex) => {
    if (track.notes.length === 0) return;

    if (!track.instrument.percussion) {
      for (const note of track.notes) {
        allNotes.push({
          trackIndex,
          start: note.time,
          end: note.time + note.duration,
          pitch: note.midi,
        });
      }
    }
  });

  // 統計每軌成為「最高音」的次數
  const melodyCounts = new Map<number, number>();

  for (const note of allNotes) {
    let highest = true;

    for (const other of allNotes) {
      if (other === note) continue;

      const overlap = other.start < note.end && other.end > note.start;

      if (!overlap) continue;

      if (other.pitch > note.pitch) {
        highest = false;
        break;
      }
    }

    if (highest) {
      melodyCounts.set(
        note.trackIndex,
        (melodyCounts.get(note.trackIndex) ?? 0) + 1,
      );
    }
  }

  let bestScore = -Infinity;
  let bestInfo: MidiTrackInfo | undefined;

  midi.tracks.forEach((track, index) => {
    if (track.notes.length === 0) return;

    const isPercussion = track.instrument.percussion;

    const instrument = isPercussion
      ? "percussion"
      : getInstrumentByMidiProgram(track.instrument.number);

    const avgPitch =
      track.notes.reduce((s, n) => s + n.midi, 0) / track.notes.length;

    const density = track.notes.length / Math.max(track.duration, 1);

    // 同時發聲數
    const groups = new Map<number, number>();

    for (const note of track.notes) {
      const key = Math.round(note.time * 100);
      groups.set(key, (groups.get(key) ?? 0) + 1);
    }

    const maxPolyphony = groups.size === 0 ? 1 : Math.max(...groups.values());

    const melodyCount = melodyCounts.get(index) ?? 0;

    let instrumentBonus = 0;

    const p = track.instrument.number;

    if (!isPercussion) {
      if (p >= 32 && p <= 39)
        instrumentBonus -= 30; // Bass
      else if (p >= 88 && p <= 95)
        instrumentBonus -= 15; // Pad
      else if (p >= 80 && p <= 87)
        instrumentBonus += 20; // Lead
      else if (p >= 72 && p <= 79)
        instrumentBonus += 12; // Pipe
      else if (p <= 7)
        instrumentBonus += 8; // Piano
      else if (p >= 40 && p <= 55) instrumentBonus += 5; // Strings
    }

    const score =
      melodyCount * 100 +
      avgPitch * 2 +
      instrumentBonus -
      maxPolyphony * 20 -
      density;

    const info: MidiTrackInfo = {
      index,
      name: track.name || `Track ${index + 1}`,
      instrument,
      noteCount: track.notes.length,
      isPercussion,
      suggestInteractive: false,
      notes: track.notes.map((n) => ({
        time: n.time,
        duration: n.duration,
        midi: n.midi,
        pitch: isPercussion ? getDrumPitchByMidiNote(n.midi) : n.name,
      })),
      duration: Math.max(0.1, track.duration),
    };

    infos.push(info);

    if (!isPercussion && score > bestScore) {
      bestScore = score;
      bestInfo = info;
    }
  });

  if (!bestInfo && infos.length > 0) {
    bestInfo = infos.find((i) => !i.isPercussion) ?? infos[0];
  }

  if (bestInfo) {
    bestInfo.suggestInteractive = true;
  }

  return infos;
};

export type MonophonicMethod =
  | "timeSlice"
  | "chordCollapse"
  | "voiceSeparation";

export function monophonizeTrack(
  track: MidiTrackNote[],
  method: MonophonicMethod,
  options?: { step?: number; chordTolerance?: number },
): MidiTrackNote[] {
  if (!track || track.length === 0) return [];

  // 確保音符照時間排序（這是所有演算法的基礎）
  const sortedTrack = [...track].sort((a, b) => a.time - b.time);

  switch (method) {
    case "timeSlice": {
      // 方法 1：時間切片取最高音
      const step = options?.step ?? 0.05; // 預設 50ms
      const buckets = new Map<number, MidiTrackNote[]>();

      for (const n of sortedTrack) {
        const t = Math.floor(n.time / step);
        if (!buckets.has(t)) buckets.set(t, []);
        buckets.get(t)!.push(n);
      }

      const result: MidiTrackNote[] = [];
      for (const group of buckets.values()) {
        if (group.length === 0) continue;
        const best = group.reduce((a, b) => (b.midi > a.midi ? b : a));
        result.push(best);
      }
      return result;
    }

    case "chordCollapse": {
      // 方法 2：去和弦 (Chord Collapse)
      const tolerance = options?.chordTolerance ?? 0.03; // 預設 30ms
      const result: MidiTrackNote[] = [];
      let cluster: MidiTrackNote[] = [];

      const pickMelodyNote = (notes: MidiTrackNote[]) => {
        return notes.reduce((a, b) => {
          const scoreA = a.midi * 2 + (a.duration < 0.3 ? 5 : 0);
          const scoreB = b.midi * 2 + (b.duration < 0.3 ? 5 : 0);
          return scoreB > scoreA ? b : a;
        });
      };

      for (const n of sortedTrack) {
        if (
          cluster.length === 0 ||
          Math.abs(n.time - cluster[0].time) < tolerance
        ) {
          cluster.push(n);
        } else {
          result.push(pickMelodyNote(cluster));
          cluster = [n];
        }
      }
      if (cluster.length > 0) {
        result.push(pickMelodyNote(cluster));
      }
      return result;
    }

    case "voiceSeparation": {
      // 方法 3：聲部連續性 (Voice Separation)
      const tolerance = options?.chordTolerance ?? 0.03;
      const result: MidiTrackNote[] = [];
      let cluster: MidiTrackNote[] = [];
      let prevNote: MidiTrackNote | null = null;

      const pickVoiceNote = (
        notes: MidiTrackNote[],
        previous: MidiTrackNote | null,
      ) => {
        return notes.reduce((a, b) => {
          // 基礎分數：偏好高音與短音
          let scoreA = a.midi * 2 + (a.duration < 0.3 ? 5 : 0);
          let scoreB = b.midi * 2 + (b.duration < 0.3 ? 5 : 0);

          // 核心差異：加入 Continuity Weight (懲罰大跳躍)
          if (previous) {
            const jumpA = Math.abs(a.midi - previous.midi);
            const jumpB = Math.abs(b.midi - previous.midi);

            // 距離越遠，扣分越重 (係數 1.5 可依據你的譜面特性微調)
            scoreA -= jumpA * 1.5;
            scoreB -= jumpB * 1.5;
          }

          return scoreB > scoreA ? b : a;
        });
      };

      for (const n of sortedTrack) {
        if (
          cluster.length === 0 ||
          Math.abs(n.time - cluster[0].time) < tolerance
        ) {
          cluster.push(n);
        } else {
          const best = pickVoiceNote(cluster, prevNote);
          result.push(best);
          prevNote = best; // 更新上一顆音符
          cluster = [n];
        }
      }
      if (cluster.length > 0) {
        result.push(pickVoiceNote(cluster, prevNote));
      }
      return result;
    }

    default:
      return sortedTrack;
  }
}

export const exportRecordedEventsToMidi = () => {
  const state = useStore.getState();
  const { recordedEvents, blocks, groupRects } = state;

  if (recordedEvents.length === 0) {
    alert("No events recorded!");
    return;
  }

  const midi = new Midi();

  // Create tracks for different instruments
  const tracksByInstrument = new Map<
    string,
    ReturnType<typeof midi.addTrack>
  >();

  const getTrack = (instrument: string) => {
    if (!tracksByInstrument.has(instrument)) {
      const track = midi.addTrack();
      track.name = instrument;
      // Set simple instrument defaults
      if (instrument === "piano")
        track.instrument.number = 0; // Acoustic Grand Piano
      else if (instrument === "bass")
        track.instrument.number = 33; // Electric Bass (finger)
      else if (instrument === "synth")
        track.instrument.number = 81; // Lead 2 (sawtooth)
      else if (instrument === "percussion") {
        track.channel = 9; // Channel 9 (10 in 1-based) is percussion
      }
      tracksByInstrument.set(instrument, track);
    }
    return tracksByInstrument.get(instrument)!;
  };

  const getMidiNoteString = (pitch: string, instrument: string) => {
    if (instrument === "percussion") {
      if (pitch === "kick") return "C1";
      if (pitch === "snare") return "D1";
      if (pitch === "hihat") return "F#1";
      if (pitch === "tom1") return "C2";
      if (pitch === "tom2") return "A1";
      if (pitch === "tom3") return "F1";
      if (pitch === "clap") return "D#1";
      if (pitch === "crash") return "C#2";
      return "C1";
    }
    return pitch;
  };

  recordedEvents.forEach((event) => {
    const timeInSeconds = event.time / 1000;

    if (event.type === "block") {
      const block = blocks.find((b) => b.id === event.targetId);
      if (block) {
        const track = getTrack(block.instrument || "piano");
        track.addNote({
          name: getMidiNoteString(block.pitch, block.instrument || "piano"),
          time: timeInSeconds,
          duration: 0.5, // Default duration since we only trigger onsets
          velocity: block.volume ?? 1,
        });
      }
    } else if (event.type === "groupRect") {
      const groupRect = groupRects.find((g) => g.id === event.targetId);
      if (groupRect) {
        // Find blocks inside the groupRect
        const isInside = (bx: number, by: number, bw: number, bh: number) => {
          return (
            bx < groupRect.x + groupRect.w &&
            bx + bw > groupRect.x &&
            by < groupRect.y + groupRect.h &&
            by + bh > groupRect.y
          );
        };
        const blocksInside = blocks.filter((b) => isInside(b.x, b.y, 60, 60));

        blocksInside.forEach((block) => {
          const track = getTrack(block.instrument || "piano");
          track.addNote({
            name: getMidiNoteString(block.pitch, block.instrument || "piano"),
            time: timeInSeconds,
            duration: 0.5,
            velocity: (block.volume ?? 1) * (groupRect.volume ?? 1),
          });
        });
      }
    }
  });

  const arrayBuffer = midi.toArray();
  const blob = new Blob([arrayBuffer as unknown as ArrayBuffer], {
    type: "audio/midi",
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `ybnote_recording_${new Date().getTime()}.mid`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const parseMidiForGame = async (
  file: File,
  arrangeBy: "sequence" | "pitch" = "sequence",
  interactiveTrackIndices?: Set<number>,
  backgroundTrackIndices?: Set<number>,
  noteOverrides?: Map<number, MidiTrackNote[]>,
) => {
  const arrayBuffer = await file.arrayBuffer();
  const midi = new Midi(arrayBuffer);

  const gameBlocks: Block[] = [];
  const gameEvents: {
    time: number;
    pitch: string;
    instrument: string;
    blockId: string;
  }[] = [];
  const generateId = () => Math.random().toString(36).substring(2, 9);

  // 1. Extract unique pitch/instrument combinations from interactive tracks only
  const uniqueNotes = new Map<
    string,
    { pitch: string; instrument: string; midiNumber: number }
  >();

  midi.tracks.forEach((track, trackIndex) => {
    if (
      interactiveTrackIndices !== undefined &&
      !interactiveTrackIndices.has(trackIndex)
    )
      return;

    const instrument = track.instrument.percussion
      ? "percussion"
      : getInstrumentByMidiProgram(track.instrument.number);

    const overridden = noteOverrides?.get(trackIndex);
    if (overridden) {
      for (const note of overridden) {
        const key = `${note.pitch}-${instrument}`;
        if (!uniqueNotes.has(key))
          uniqueNotes.set(key, { pitch: note.pitch, instrument, midiNumber: note.midi });
      }
    } else {
      track.notes.forEach((note) => {
        const pitch = track.instrument.percussion
          ? getDrumPitchByMidiNote(note.midi)
          : note.name;
        const key = `${pitch}-${instrument}`;
        if (!uniqueNotes.has(key))
          uniqueNotes.set(key, { pitch, instrument, midiNumber: note.midi });
      });
    }
  });

  // 2. Generate blocks for unique notes in a simple grid
  let i = 0;
  const cols = 8;

  const numRows = Math.ceil(uniqueNotes.size / cols);
  const startX = -(Math.min(cols, uniqueNotes.size) * 80) / 2 + 10;
  const startY = -(numRows * 80) / 2 + 10;

  const blockIdMap = new Map<string, string>();

  const notesArray = Array.from(uniqueNotes.entries());
  if (arrangeBy === "pitch") {
    notesArray.sort((a, b) => a[1].midiNumber - b[1].midiNumber);
  }

  for (const [key, noteInfo] of notesArray) {
    const id = generateId();
    blockIdMap.set(key, id);
    gameBlocks.push({
      id,
      x: startX + (i % cols) * 80,
      y: startY + Math.floor(i / cols) * 80,
      pitch: noteInfo.pitch,
      instrument: noteInfo.instrument,
      volume: 1,
    });
    i++;
  }

  // 3. Generate events
  midi.tracks.forEach((track, trackIndex) => {
    const isBackground = backgroundTrackIndices?.has(trackIndex);
    const isInteractive =
      interactiveTrackIndices === undefined ||
      interactiveTrackIndices.has(trackIndex);

    if (!isBackground && !isInteractive) return;

    const instrument = track.instrument.percussion
      ? "percussion"
      : getInstrumentByMidiProgram(track.instrument.number);

    const overridden = noteOverrides?.get(trackIndex);
    if (overridden) {
      for (const note of overridden) {
        if (isBackground) {
          gameEvents.push({ time: note.time * 1000, pitch: note.pitch, instrument, blockId: "background" });
        } else {
          const blockId = blockIdMap.get(`${note.pitch}-${instrument}`);
          if (blockId) gameEvents.push({ time: note.time * 1000, pitch: note.pitch, instrument, blockId });
        }
      }
    } else {
      track.notes.forEach((note) => {
        const pitch = track.instrument.percussion
          ? getDrumPitchByMidiNote(note.midi)
          : note.name;

        if (isBackground) {
          gameEvents.push({ time: note.time * 1000, pitch, instrument, blockId: "background" });
        } else {
          const blockId = blockIdMap.get(`${pitch}-${instrument}`);
          if (blockId) gameEvents.push({ time: note.time * 1000, pitch, instrument, blockId });
        }
      });
    }
  });

  gameEvents.sort((a, b) => a.time - b.time);

  return { gameBlocks, gameEvents };
};

export const parseMidiToPocketBlocks = async (file: File) => {
  const arrayBuffer = await file.arrayBuffer();
  const midi = new Midi(arrayBuffer);

  const uniqueNotes = new Map<
    string,
    { pitch: string; instrument: string; midiNumber: number; firstTime: number }
  >();

  midi.tracks.forEach((track) => {
    // 1. 透過封裝好的 Helper 來決定樂器種類
    let instrument = "piano";
    if (track.instrument.percussion) {
      instrument = "percussion";
    } else {
      instrument = getInstrumentByMidiProgram(track.instrument.number);
    }

    track.notes.forEach((note) => {
      // 2. 如果是打擊樂器，把 MIDI 音高轉成 'kick', 'snare' 等。否則保持原來的音名 (C4, D#4)
      const pitch = track.instrument.percussion
        ? getDrumPitchByMidiNote(note.midi)
        : note.name;

      const key = `${pitch}-${instrument}`;

      if (!uniqueNotes.has(key)) {
        uniqueNotes.set(key, {
          pitch,
          instrument,
          midiNumber: note.midi,
          firstTime: note.time,
        });
      } else {
        const existing = uniqueNotes.get(key)!;
        if (note.time < existing.firstTime) {
          existing.firstTime = note.time;
        }
      }
    });
  });

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const notesArray = Array.from(uniqueNotes.values());

  // Initial sort can just be pitch
  notesArray.sort((a, b) => a.midiNumber - b.midiNumber);

  const pocketBlocks: Block[] = notesArray.map((noteInfo) => ({
    id: generateId(),
    x: 0,
    y: 0,
    pitch: noteInfo.pitch,
    instrument: noteInfo.instrument,
    volume: 1,
    originalTime: noteInfo.firstTime,
    midiNumber: noteInfo.midiNumber,
  }));

  useStore.getState().setPocketBlocks(pocketBlocks);
};

export const parseParsedMidiDataToPocketBlocks = (
  midiData: import("../types").ParsedMidiData,
) => {
  const uniqueNotes = new Map<
    string,
    { pitch: string; instrument: string; midiNumber: number; firstTime: number }
  >();

  midiData.tracks.forEach((track) => {
    const instrument = track.instrument; // 這裡假設已經是 'piano', 'percussion' 等字串了

    track.notes.forEach((note) => {
      const midiNumber = note.pitch as number;

      // 👇 核心修正：如果是打擊樂器，用 midiNumber 去查表轉成 'kick', 'snare' 等
      const pitch =
        instrument === "percussion"
          ? getDrumPitchByMidiNote(midiNumber)
          : note.name;

      const key = `${pitch}-${instrument}`;

      if (!uniqueNotes.has(key)) {
        uniqueNotes.set(key, {
          pitch,
          instrument,
          midiNumber,
          firstTime: note.timeStart,
        });
      } else {
        const existing = uniqueNotes.get(key)!;
        if (note.timeStart < existing.firstTime) {
          existing.firstTime = note.timeStart;
        }
      }
    });
  });

  const generateId = () => Math.random().toString(36).substring(2, 9);
  const notesArray = Array.from(uniqueNotes.values());

  notesArray.sort((a, b) => a.midiNumber - b.midiNumber);

  // 用 map 寫會稍微簡潔一點
  const pocketBlocks: import("../types").Block[] = notesArray.map(
    (noteInfo) => ({
      id: generateId(),
      x: 0,
      y: 0,
      pitch: noteInfo.pitch,
      instrument: noteInfo.instrument,
      volume: 1,
      originalTime: noteInfo.firstTime,
      midiNumber: noteInfo.midiNumber,
    }),
  );

  useStore.getState().setPocketBlocks(pocketBlocks);
};
