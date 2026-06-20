import JSZip from 'jszip';
import { Mp3Encoder } from 'lamejs';
import type { EditorNote, ParsedMidiData } from '../store/useLevelEditorStore';

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

  const levelJson: LevelJson = {
    version: 1,
    bpm,
    offset,
    trimStart,
    trimEnd,
    blocks: gameBlocks.map(b => ({
      id: b.id,
      x: b.x,
      y: b.y,
      pitch: b.pitch,
      instrument: b.instrument,
      volume: b.volume ?? 1,
    })),
    events: gameEvents.map(e => ({
      time: e.time,
      pitch: e.pitch,
      instrument: e.instrument,
      blockId: e.blockId,
    })),
    midiNotes: allNotes.map(n => ({
      id: n.id,
      pitch: n.pitch,
      name: n.name,
      timeStart: n.timeStart,
      duration: n.duration,
      velocity: n.velocity,
    })),
  };

  const zip = new JSZip();
  zip.file('level.json', JSON.stringify(levelJson, null, 2));

  // Encode audio if available
  if (audioBuffer) {
    const ctx = new AudioContext();
    const actualEnd = trimEnd > 0 ? trimEnd : audioBuffer.duration;
    const sliced = sliceAudioBuffer(ctx, audioBuffer, trimStart, actualEnd);
    const mp3Blob = encodeToMp3(sliced, 128);
    zip.file('audio.mp3', mp3Blob);
    ctx.close();
  }

  return await zip.generateAsync({ type: 'blob' });
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

  // Parse level.json
  const jsonFile = zip.file('level.json');
  if (!jsonFile) throw new Error('Invalid .yblevel file: missing level.json');
  const jsonStr = await jsonFile.async('string');
  const levelData: LevelJson = JSON.parse(jsonStr);

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
