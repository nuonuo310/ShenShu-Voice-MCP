/** Non-speech 0.7-second WAV tone used only to verify inline MCP audio delivery. */
import { validateWav } from "./contract.js";

export function makeInlineToneFixture() {
  const sampleRate = 16000;
  const sampleCount = 11200;
  const b = Buffer.alloc(44 + sampleCount * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sampleRate, 24);
  b.writeUInt32LE(sampleRate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(sampleCount * 2, 40);
  for (let i = 0; i < sampleCount; i++) {
    const envelope = Math.min(1, i / 900, (sampleCount - i) / 900);
    const amplitude = Math.round(4500 * Math.max(0, envelope) * Math.sin(2 * Math.PI * 440 * i / sampleRate));
    b.writeInt16LE(amplitude, 44 + i * 2);
  }
  const meta = validateWav(b);
  return Object.freeze({ audioBase64: b.toString("base64"), audioMimeType: meta.mimeType, durationSeconds: meta.durationSeconds });
}
