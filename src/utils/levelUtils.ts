import JSZip from 'jszip';
import lamejsSrc from 'lamejs/lame.min.js?raw';
import type { ParsedMidiData } from '../types';


// --- Polyfill for lamejs bug in Vite ---
// lamejs 1.2.x has circular dependencies and implicit globals (MPEGMode, Lame, BitStream)
// which throw ReferenceErrors when bundled by Vite. We inject the pre-bundled minified 
// script directly into the global scope to bypass these module issues entirely.
interface Mp3EncoderClass {
  new(channels: number, sampleRate: number, bitrate: number): {
    encodeBuffer(left: Int16Array, right?: Int16Array): Int8Array;
    flush(): Int8Array;
  };
}

let Mp3Encoder: Mp3EncoderClass;

if (typeof window !== 'undefined') {
  if (!(window as { lamejs?: { Mp3Encoder: Mp3EncoderClass } }).lamejs) {
    const script = document.createElement('script');
    script.textContent = lamejsSrc;
    document.head.appendChild(script);
  }
  Mp3Encoder = (window as { lamejs?: { Mp3Encoder: Mp3EncoderClass } }).lamejs!.Mp3Encoder;
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
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
  title?: string;
  author?: string;
  description?: string;
  midiCredit?: string;
  musicCredit?: string;
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
    trackId?: number;
    trackName?: string;
    trackInstrument?: string;
    targetId?: string;
    targetType?: 'block' | 'groupRect';
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
  title?: string;
  author?: string;
  description?: string;
  midiCredit?: string;
  musicCredit?: string;
  audioBuffer: AudioBuffer | null;
  audioFile: Blob | File | null;
  compressAudio: boolean;
  midiData: ParsedMidiData | null;
  gameBlocks: { id: string; x: number; y: number; pitch: string; instrument: string; volume?: number }[];
  gameEvents: { time: number; pitch: string; instrument: string; blockId: string }[];
}

export async function exportLevel(params: ExportParams): Promise<Blob> {
  const { bpm, offset, trimStart, trimEnd, title, author, description, midiCredit, musicCredit, audioBuffer, audioFile, compressAudio, midiData, gameBlocks, gameEvents } = params;

  let levelText = `VERSION:1\n`;
  levelText += `BPM:${bpm}\n`;
  levelText += `OFFSET:${offset}\n`;
  levelText += `TRIM_START:${trimStart}\n`;
  levelText += `TRIM_END:${trimEnd}\n`;
  if (title) levelText += `TITLE:${title}\n`;
  if (author) levelText += `AUTHOR:${author}\n`;
  if (description) levelText += `DESCRIPTION:${description.replace(/\n/g, '\\n')}\n`;
  if (midiCredit) levelText += `MIDI_CREDIT:${midiCredit}\n`;
  if (musicCredit) levelText += `MUSIC_CREDIT:${musicCredit}\n`;
  levelText += `\n`;
  levelText += `[JSON]\n`;

  const jsonData = {
    blocks: gameBlocks.map(b => ({ ...b, volume: b.volume ?? 1 })),
    events: gameEvents,
    midiNotes: midiData ? midiData.tracks.flatMap(t => t.notes.map(n => ({
      ...n,
      trackId: t.id,
      trackName: t.name,
      trackInstrument: t.instrument
    }))) : []
  };

  levelText += JSON.stringify(jsonData);

  const zip = new JSZip();
  zip.file('level.txt', levelText);

  if (compressAudio && audioBuffer) {
    const ctx = new AudioContext();
    const actualEnd = trimEnd > 0 ? trimEnd : audioBuffer.duration;
    const sliced = sliceAudioBuffer(ctx, audioBuffer, trimStart, actualEnd);
    const mp3Blob = encodeToMp3(sliced, 128);
    zip.file('audio.mp3', mp3Blob);
    ctx.close();
  } else if (audioFile) {
    zip.file('audio.mp3', audioFile);
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

  const txtFile = zip.file('level.txt');
  if (!txtFile) {
    throw new Error('Invalid .yblevel file: missing level.txt');
  }
  const txtStr = await txtFile.async('string');
  
  const levelData: LevelJson = {
    version: 1,
    bpm: 120,
    offset: 0,
    trimStart: 0,
    trimEnd: 0,
    blocks: [],
    events: [],
    midiNotes: [],
  };

  const lines = txtStr.split('\n');
  let jsonStartIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '[JSON]') {
      jsonStartIdx = i + 1;
      break;
    }
    
    if (!line || line.startsWith('#')) continue;

    const firstColon = line.indexOf(':');
    if (firstColon === -1) continue;
    const key = line.substring(0, firstColon);
    const val = line.substring(firstColon + 1);

    if (key === 'VERSION') levelData.version = parseFloat(val);
    if (key === 'BPM') levelData.bpm = parseFloat(val);
    if (key === 'OFFSET') levelData.offset = parseFloat(val);
    if (key === 'TRIM_START') levelData.trimStart = parseFloat(val);
    if (key === 'TRIM_END') levelData.trimEnd = parseFloat(val);
    if (key === 'TITLE') levelData.title = val;
    if (key === 'AUTHOR') levelData.author = val;
    if (key === 'DESCRIPTION') levelData.description = val.replace(/\\n/g, '\n');
    if (key === 'MIDI_CREDIT') levelData.midiCredit = val;
    if (key === 'MUSIC_CREDIT') levelData.musicCredit = val;
  }

  if (jsonStartIdx !== -1) {
    const jsonStr = lines.slice(jsonStartIdx).join('\n');
    if (jsonStr.trim()) {
      const parsed = JSON.parse(jsonStr);
      if (parsed.blocks) levelData.blocks = parsed.blocks;
      if (parsed.events) levelData.events = parsed.events;
      if (parsed.midiNotes) levelData.midiNotes = parsed.midiNotes;
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
