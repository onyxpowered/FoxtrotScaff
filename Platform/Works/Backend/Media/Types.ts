export type Kind = "image" | "video" | "audio" | "model" | "file";

export type Spec = { Ext: string; Mime: string; Kind: Kind; Cap: number; Mode?: "text" | "zip" };

const MB = 1024 * 1024;
const Caps = { Image: 15 * MB, Video: 100 * MB, Audio: 50 * MB, File: 100 * MB, Text: 2 * MB, Model: 50 * MB };

function Make(Kind: Kind, Cap: number, Mode: Spec["Mode"], Rows: [string, string][]) {
  return Rows.map(([Ext, Mime]) => [Ext, { Ext, Mime, Kind, Cap, Mode }] as const);
}

export const Specs = new Map<string, Spec>([
  ...Make("image", Caps.Image, undefined, [["png", "image/png"], ["jpg", "image/jpeg"], ["gif", "image/gif"], ["webp", "image/webp"], ["avif", "image/avif"], ["bmp", "image/bmp"]]),
  ...Make("file", Caps.Image, undefined, [["tif", "image/tiff"], ["heic", "image/heic"], ["jxl", "image/jxl"]]),
  ...Make("video", Caps.Video, undefined, [["mp4", "video/mp4"], ["m4v", "video/mp4"], ["mov", "video/quicktime"], ["webm", "video/webm"], ["ogv", "video/ogg"]]),
  ...Make("file", Caps.Video, undefined, [["mkv", "video/x-matroska"], ["avi", "video/x-msvideo"], ["3gp", "video/3gpp"], ["wmv", "video/x-ms-wmv"], ["flv", "video/x-flv"], ["mpg", "video/mpeg"]]),
  ...Make("audio", Caps.Audio, undefined, [["mp3", "audio/mpeg"], ["ogg", "audio/ogg"], ["opus", "audio/ogg"], ["oga", "audio/ogg"], ["flac", "audio/flac"], ["wav", "audio/wav"], ["m4a", "audio/mp4"], ["aac", "audio/aac"], ["weba", "audio/webm"]]),
  ...Make("file", Caps.Audio, undefined, [["aiff", "audio/aiff"], ["mid", "audio/midi"], ["wma", "audio/x-ms-wma"], ["mka", "audio/x-matroska"], ["xm", "audio/x-xm"], ["it", "audio/x-it"]]),
  ...Make("file", Caps.File, undefined, [
    ["pdf", "application/pdf"], ["ai", "application/pdf"], ["rtf", "application/rtf"],
    ["psd", "image/vnd.adobe.photoshop"], ["psb", "image/vnd.adobe.photoshop"], ["xcf", "image/x-xcf"],
    ["clip", "application/octet-stream"], ["aseprite", "application/octet-stream"],
    ["blend", "application/x-blender"],
    ["pdn", "application/octet-stream"], ["exr", "image/x-exr"], ["dds", "image/vnd.ms-dds"],
    ["ttf", "font/ttf"], ["otf", "font/otf"], ["woff", "font/woff"], ["woff2", "font/woff2"],
  ]),
  ...Make("file", Caps.File, "zip", [
    ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], ["odt", "application/vnd.oasis.opendocument.text"],
    ["epub", "application/epub+zip"], ["kra", "application/x-krita"], ["ora", "image/openraster"],
    ["procreate", "application/octet-stream"], ["usdz", "model/vnd.usdz+zip"],
    ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], ["pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    ["odp", "application/vnd.oasis.opendocument.presentation"], ["ods", "application/vnd.oasis.opendocument.spreadsheet"],
  ]),
  ...Make("file", Caps.Text, "text", [
    ["txt", "text/plain"], ["md", "text/markdown"], ["csv", "text/csv"], ["srt", "application/x-subrip"], ["vtt", "text/vtt"],
    ["lrc", "text/plain"], ["ass", "text/x-ssa"],
  ]),
  ...Make("model", Caps.Model, undefined, [["glb", "model/gltf-binary"], ["vrm", "model/gltf-binary"], ["fbx", "application/octet-stream"]]),
  ...Make("model", Caps.Model, "zip", [["3mf", "model/3mf"]]),
  ...Make("model", Caps.Model, "text", [["obj", "model/obj"], ["gltf", "model/gltf+json"], ["stl", "model/stl"], ["ply", "model/ply"]]),
]);

const Alias: Record<string, string> = {
  jpeg: "jpg", jpe: "jpg", jfif: "jpg", apng: "png", tiff: "tif", heif: "heic", markdown: "md",
  ase: "aseprite", midi: "mid", qt: "mov", mpeg: "mpg",
};

export const Denied = new Set([
  "exe", "dll", "msi", "bat", "cmd", "com", "scr", "sh", "bash", "zsh", "ps1", "vbs", "js", "mjs", "cjs", "jar",
  "apk", "ipa", "app", "dmg", "pkg", "deb", "rpm", "html", "htm", "xhtml", "svg", "svgz", "xml", "swf", "lnk",
  "iso", "php", "py", "rb", "pl", "hta", "wasm", "zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz",
]);

function Extension(Name: string) {
  const Dot = Name.lastIndexOf(".");
  const Raw = Dot === -1 ? "" : Name.slice(Dot + 1).toLowerCase();
  return Alias[Raw] ?? Raw;
}

function At(B: Uint8Array, Offset: number, Text: string) {
  for (let I = 0; I < Text.length; I++) if (B[Offset + I] !== Text.charCodeAt(I)) return false;
  return true;
}

function Has(B: Uint8Array, ...Values: number[]) {
  return Values.every((Value, Index) => B[Index] === Value);
}

function Plain(B: Uint8Array) {
  if (B.indexOf(0) !== -1) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(B);
    return true;
  } catch {
    return false;
  }
}

function Brand(B: Uint8Array, Ext: string) {
  const Name = String.fromCharCode(B[8], B[9], B[10], B[11]);
  if (Name === "avif" || Name === "avis") return "avif";
  if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(Name)) return "heic";
  if (Name === "qt  ") return "mov";
  if (Name === "M4A " || Name === "M4B ") return "m4a";
  if (Name.startsWith("3gp")) return "3gp";
  return Ext === "m4v" ? "m4v" : "mp4";
}

function Resolve(B: Uint8Array, Ext: string): string | null {
  if (B.length < 12) return null;
  if (Has(B, 0x89, 0x50, 0x4e, 0x47)) return "png";
  if (Has(B, 0xff, 0xd8, 0xff)) return "jpg";
  if (At(B, 0, "GIF8")) return "gif";
  if (At(B, 0, "RIFF")) return At(B, 8, "WEBP") ? "webp" : At(B, 8, "WAVE") ? "wav" : At(B, 8, "AVI ") ? "avi" : null;
  if (At(B, 0, "BM") && Ext === "bmp") return "bmp";
  if (At(B, 0, "II*\0") || At(B, 0, "MM\0*")) return "tif";
  if (At(B, 4, "ftyp")) return Brand(B, Ext);
  if (Has(B, 0x1a, 0x45, 0xdf, 0xa3)) return Ext === "mkv" ? "mkv" : Ext === "mka" ? "mka" : Ext === "weba" ? "weba" : "webm";
  if (At(B, 0, "OggS")) return Ext === "ogv" ? "ogv" : Ext === "opus" ? "opus" : Ext === "oga" ? "oga" : "ogg";
  if (At(B, 0, "fLaC")) return "flac";
  if (At(B, 0, "FORM") && (At(B, 8, "AIFF") || At(B, 8, "AIFC"))) return "aiff";
  if (At(B, 0, "MThd")) return "mid";
  if (Has(B, 0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11)) return Ext === "wma" ? "wma" : Ext === "wmv" ? "wmv" : null;
  if (At(B, 0, "FLV")) return "flv";
  if (At(B, 0, "%PDF-")) return Ext === "ai" ? "ai" : "pdf";
  if (At(B, 0, "{\\rtf")) return "rtf";
  if (At(B, 0, "8BPS")) return Ext === "psb" ? "psb" : "psd";
  if (At(B, 0, "gimp xcf")) return "xcf";
  if (At(B, 0, "CSFCHUNK")) return "clip";
  if (At(B, 0, "BLENDER")) return "blend";
  if (At(B, 0, "glTF")) return Ext === "vrm" ? "vrm" : "glb";
  if (At(B, 0, "Kaydara FBX Binary")) return "fbx";
  if (At(B, 0, "PDN3")) return "pdn";
  if (Has(B, 0x76, 0x2f, 0x31, 0x01)) return "exr";
  if (At(B, 0, "DDS ")) return "dds";
  if (At(B, 0, "OTTO")) return "otf";
  if (At(B, 0, "wOFF")) return "woff";
  if (At(B, 0, "wOF2")) return "woff2";
  if (Has(B, 0, 1, 0, 0) && Ext === "ttf") return "ttf";
  if (At(B, 0, "Extended Module:")) return "xm";
  if (At(B, 0, "IMPM")) return "it";
  if (Has(B, 0, 0, 1, 0xba) || Has(B, 0, 0, 1, 0xb3)) return "mpg";
  if (B[4] === 0xa5 && B[5] === 0xe0 && Ext === "aseprite") return "aseprite";
  if (Has(B, 0xff, 0x0a) || Has(B, 0, 0, 0, 0x0c, 0x4a, 0x58, 0x4c, 0x20)) return "jxl";
  if (At(B, 0, "ID3")) return "mp3";
  if (B[0] === 0xff && (B[1] & 0xf6) === 0xf0) return "aac";
  if (B[0] === 0xff && (B[1] & 0xe0) === 0xe0 && (B[1] & 0x06) !== 0) return "mp3";

  if (Has(B, 0x50, 0x4b, 0x03, 0x04) || Has(B, 0x50, 0x4b, 0x05, 0x06)) return Specs.get(Ext)?.Mode === "zip" ? Ext : null;

  const Declared = Specs.get(Ext);
  if (Declared?.Mode === "text") {
    if (Ext === "stl" && !At(B, 0, "solid")) {
      const Count = new DataView(B.buffer, B.byteOffset, B.byteLength).getUint32(80, true);
      return B.length === 84 + 50 * Count ? "stl" : null;
    }
    return Plain(B) ? Ext : null;
  }
  return null;
}

export function Detect(Bytes: Uint8Array, Name: string) {
  const Ext = Extension(Name);
  if (Denied.has(Ext)) return null;
  const Key = Resolve(Bytes, Ext);
  return Key ? (Specs.get(Key) ?? null) : null;
}

export function Listed() {
  return [...Specs.values()].map((Spec) => ({ Ext: Spec.Ext, Mime: Spec.Mime, Kind: Spec.Kind, Cap: Spec.Cap }));
}

export const Largest = Math.max(...[...Specs.values()].map((Spec) => Spec.Cap));
