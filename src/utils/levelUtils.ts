import JSZip from 'jszip';
import lamejsSrc from 'lamejs/lame.min.js?raw';
import type { EditorNote, ParsedMidiData } from '../store/useLevelEditorStore';
import { generateMidiBlob } from './midiExport';

// --- Polyfill for lamejs bug in Vite ---
// lamejs 1.2.x has circular dependencies and implicit globals (MPEGMode, Lame, BitStream)
// which throw ReferenceErrors when bundled by Vite. We inject the pre-bundled minified 
// script directly into the global scope to bypass these module issues entirely.
let Mp3Encoder: any;

if (typeof window !== 'undefined') {
  if (!(window as any).lamejs) {
    const script = document.createElement('script');
    script.textContent = lamejsSrc;
    document.head.appendChild(script);
  }
  Mp3Encoder = (window as any).lamejs.Mp3Encoder;
} else {
  // Fallback for SSR / Node context if needed, though mostly client-side
  Mp3Encoder = require('lamejs').Mp3Encoder;
}
// ---------------------------------------

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

export interface LevelJson {
  version: number;
  bpm: number;
  offset: number;
  trimStart: number;
  trimEnd: number;
  blocks: {
    id: string;
    x: number;
    y: number;
    pitch: string;
    instrument: string;
    volume: number;
  }[];
  events: {
    time: number;
    pitch: string;
    instrument: string;
    blockId: string;
  }[];
  midiNotes: {
    id: string;
    pitch: number;
    name: string;
    timeStart: number;
    duration: number;
    velocity: number;
  }[];
}

// -------------------------------------------------------------------
// AudioBuffer slicing
// -------------------------------------------------------------------

export function sliceAudioBuffer(
  ctx: AudioContext,
  buffer: AudioBuffer,
  startSec: number,
  endSec: number,
): AudioBuffer {
  const sampleRate = buffer.sampleRate;
  const startSample = Math.max(0, Math.floor(startSec * sampleRate));
  const endSample = Math.min(buffer.length, Math.floor(endSec * sampleRate));
  const length = endSample - startSample;

  if (length <= 0) {
    return ctx.createBuffer(buffer.numberOfChannels, 1, sampleRate);
  }

  const newBuffer = ctx.createBuffer(buffer.numberOfChannels, length, sampleRate);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const srcData = buffer.getChannelData(ch);
    const destData = newBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      destData[i] = srcData[startSample + i];
    }
  }
  return newBuffer;
}

// -------------------------------------------------------------------
// Encode AudioBuffer → MP3 using lamejs
// -------------------------------------------------------------------

export function encodeToMp3(buffer: AudioBuffer, bitrate: number = 128): Blob {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const encoder = new Mp3Encoder(channels, sampleRate, bitrate);

  const blockSize = 1152;
  const mp3Chunks: Int8Array[] = [];

  // Get channel data as Float32 and convert to Int16
  const leftF32 = buffer.getChannelData(0);
  const rightF32 = channels > 1 ? buffer.getChannelData(1) : leftF32;

  const toInt16 = (f32: Float32Array): Int16Array => {
    const int16 = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      const s = Math.max(-1, Math.min(1, f32[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16;
  };

  const leftI16 = toInt16(leftF32);
  const rightI16 = toInt16(rightF32);

  for (let i = 0; i < leftI16.length; i += blockSize) {
    const leftChunk = leftI16.subarray(i, i + blockSize);
    const rightChunk = rightI16.subarray(i, i + blockSize);
    const mp3buf = channels > 1
      ? encoder.encodeBuffer(leftChunk, rightChunk)
      : encoder.encodeBuffer(leftChunk);
    if (mp3buf.length > 0) mp3Chunks.push(mp3buf);
  }

  const end = encoder.flush();
  if (end.length > 0) mp3Chunks.push(end);

  return new Blob(mp3Chunks.map(c => new Uint8Array(c.buffer, c.byteOffset, c.byteLength)) as unknown as BlobPart[], { type: 'audio/mp3' });
}

// -------------------------------------------------------------------
// Export .yblevel (zip)
// -------------------------------------------------------------------

interface ExportParams {
  bpm: number;
  offset: number;
  trimStart: number;
  trimEnd: number;
  audioBuffer: AudioBuffer | null;
  midiData: ParsedMidiData | null;
  gameBlocks: { id: string; x: number; y: number; pitch: string; instrument: string; volume?: number }[];
  gameEvents: { time: number; pitch: string; instrument: string; blockId: string }[];
}

export async function exportLevel(params: ExportParams): Promise<Blob> {
  const { bpm, offset, trimStart, trimEnd, audioBuffer, midiData, gameBlocks, gameEvents } = params;

  // Collect all notes from all tracks
  const allNotes: EditorNote[] = [];
  if (midiData) {
    for (const track of midiData.tracks) {
      allNotes.push(...track.notes);
    }
  }

  let levelText = `VERSION:2\n`;
  levelText += `BPM:${bpm}\n`;
  levelText += `OFFSET:${offset}\n`;
  levelText += `TRIM_START:${trimStart}\n`;
  levelText += `TRIM_END:${trimEnd}\n\n`;

  levelText += `[BLOCKS]\n`;
  for (const b of gameBlocks) {
    levelText += `${b.id},${b.x},${b.y},${b.pitch},${b.instrument},${b.volume ?? 1}\n`;
  }
  levelText += `\n`;

  levelText += `[EVENTS]\n`;
  for (const e of gameEvents) {
    levelText += `${e.time},${e.pitch},${e.instrument},${e.blockId}\n`;
  }
  levelText += `\n`;

  levelText += `[MIDI]\n`;
  for (const n of allNotes) {
    levelText += `${n.id},${n.pitch},${n.name},${n.timeStart},${n.duration},${n.velocity}\n`;
  }

  const zip = new JSZip();
  zip.file('level.txt', levelText);

  // Encode audio if available
  if (audioBuffer) {
    const ctx = new AudioContext();
    const actualEnd = trimEnd > 0 ? trimEnd : audioBuffer.duration;
    const sliced = sliceAudioBuffer(ctx, audioBuffer, trimStart, actualEnd);
    const mp3Blob = encodeToMp3(sliced, 128);
    zip.file('audio.mp3', mp3Blob);
    ctx.close();
  }

  // Include midi if available
  if (midiData && midiData.tracks.length > 0) {
    const midiBlob = generateMidiBlob(midiData);
    zip.file('data.mid', midiBlob);
  }

  return await zip.generateAsync({ 
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });
}

// -------------------------------------------------------------------
// Import .yblevel (zip)
// -------------------------------------------------------------------

export interface ImportedLevel {
  audioBlob: Blob | null;
  audioBuffer: AudioBuffer | null;
  levelData: LevelJson;
}

export async function importLevel(file: File): Promise<ImportedLevel> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  // Parse level.txt
  const txtFile = zip.file('level.txt');
  if (!txtFile) {
    throw new Error('Invalid .yblevel file: missing level.txt');
  }
  const txtStr = await txtFile.async('string');
  
  const levelData: LevelJson = {
    version: 2,
    bpm: 120,
    offset: 0,
    trimStart: 0,
    trimEnd: 0,
    blocks: [],
    events: [],
    midiNotes: [],
  };

  const lines = txtStr.split('\n').map(l => l.trim());
  let currentSection = '';

  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('[')) {
      currentSection = line;
      continue;
    }

    if (currentSection === '') {
      // Header metadata
      const [key, ...valParts] = line.split(':');
      const val = valParts.join(':');
      if (key === 'VERSION') levelData.version = parseFloat(val);
      if (key === 'BPM') levelData.bpm = parseFloat(val);
      if (key === 'OFFSET') levelData.offset = parseFloat(val);
      if (key === 'TRIM_START') levelData.trimStart = parseFloat(val);
      if (key === 'TRIM_END') levelData.trimEnd = parseFloat(val);
    } else if (currentSection === '[BLOCKS]') {
      const parts = line.split(',');
      if (parts.length >= 6) {
        levelData.blocks.push({
          id: parts[0],
          x: parseFloat(parts[1]),
          y: parseFloat(parts[2]),
          pitch: parts[3],
          instrument: parts[4],
          volume: parseFloat(parts[5]),
        });
      }
    } else if (currentSection === '[EVENTS]') {
      const parts = line.split(',');
      if (parts.length >= 4) {
        levelData.events.push({
          time: parseFloat(parts[0]),
          pitch: parts[1],
          instrument: parts[2],
          blockId: parts[3],
        });
      }
    } else if (currentSection === '[MIDI]') {
      const parts = line.split(',');
      if (parts.length >= 6) {
        levelData.midiNotes.push({
          id: parts[0],
          pitch: parseFloat(parts[1]),
          name: parts[2],
          timeStart: parseFloat(parts[3]),
          duration: parseFloat(parts[4]),
          velocity: parseFloat(parts[5]),
        });
      }
    }
  }

  // Parse audio.mp3 if present
  let audioBlob: Blob | null = null;
  let audioBuffer: AudioBuffer | null = null;
  const audioFile = zip.file('audio.mp3');
  if (audioFile) {
    const audioBuf = await audioFile.async('arraybuffer');
    audioBlob = new Blob([audioBuf], { type: 'audio/mp3' });
    const ctx = new AudioContext();
    audioBuffer = await ctx.decodeAudioData(audioBuf.slice(0)); // slice to avoid detach
    ctx.close();
  }

  return { audioBlob, audioBuffer, levelData };
}
