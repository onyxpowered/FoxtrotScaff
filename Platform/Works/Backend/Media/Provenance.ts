const Markers = [
  "trainedAlgorithmicMedia",
  "compositeWithTrainedAlgorithmicMedia",
  "CFG scale",
  "Negative prompt:",
  "KSampler",
  "invokeai_metadata",
  "sd-metadata",
  "NovelAI",
  "Midjourney",
  "Stable Diffusion",
  "DALL-E",
  "Adobe Firefly",
].map((Text) => ({ Text, Bytes: Buffer.from(Text) }));

const Reach = 4 * 1024 * 1024;

export function Scan(Bytes: Uint8Array) {
  const Head = Buffer.from(Bytes.buffer, Bytes.byteOffset, Math.min(Bytes.byteLength, Reach));
  return Markers.find((Marker) => Head.includes(Marker.Bytes))?.Text ?? null;
}
