/** Contract-only, NO live TTS calls. Independent of Asteria-Call. */
export const MAX_TEXT_BYTES = 800;
export const MAX_DURATION_SECONDS = 60;
export const MAX_WAV_BYTES = 2 * 1024 * 1024;
export const VOICE_LABEL = '沈述';

export function checkText(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('invalid_text');
  const bytes = Buffer.byteLength(value, 'utf8');
  if (bytes > MAX_TEXT_BYTES || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) throw new Error('invalid_text');
  return value;
}

/** Only accept the exact format established by the Call Worker contract. */
export function validateWav(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 44 || buffer.length > MAX_WAV_BYTES) throw new Error('invalid_audio');
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') throw new Error('invalid_audio');
  const riffLength = buffer.readUInt32LE(4) + 8;
  if (riffLength !== buffer.length) throw new Error('invalid_audio');
  let pos = 12, fmtOK = false, dataLength = null;
  while (pos + 8 <= buffer.length) {
    const kind = buffer.toString('ascii', pos, pos + 4);
    const n = buffer.readUInt32LE(pos + 4);
    if (pos + 8 + n > buffer.length) throw new Error('invalid_audio');
    if (kind === 'fmt ') {
      if (n < 16 || fmtOK) throw new Error('invalid_audio');
      const p = pos + 8;
      fmtOK = buffer.readUInt16LE(p) === 1 && buffer.readUInt16LE(p+2) === 1 && buffer.readUInt32LE(p+4) === 16000 && buffer.readUInt32LE(p+8) === 32000 && buffer.readUInt16LE(p+12) === 2 && buffer.readUInt16LE(p+14) === 16;
    }
    if (kind === 'data') { if (dataLength !== null) throw new Error('invalid_audio'); dataLength = n; }
    pos += 8 + n + (n % 2);
  }
  if (!fmtOK || dataLength === null || pos !== buffer.length || dataLength % 2) throw new Error('invalid_audio');
  const seconds = dataLength / 32000;
  if (seconds < .2 || seconds > MAX_DURATION_SECONDS) throw new Error('invalid_audio');
  return { durationSeconds: seconds, mimeType: 'audio/wav' };
}

export function makeVoiceRecord({ id, text, audioUrl, durationSeconds }) {
  checkText(text);
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(id)) throw new Error('invalid_id');
  if (typeof audioUrl !== 'string' || !audioUrl.startsWith('https://')) throw new Error('invalid_audio_url');
  if (typeof durationSeconds !== 'number' || durationSeconds < .2 || durationSeconds > 60) throw new Error('invalid_duration');
  return Object.freeze({ id, title: '沈述 · 语音留言', text, audioUrl, durationSeconds, voiceLabel: VOICE_LABEL });
}
