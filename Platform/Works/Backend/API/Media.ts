import { Hono, type Context } from "hono";
import { Find, Locate, Save } from "../Media/Blobs.ts";
import { Listed } from "../Media/Types.ts";
import { Fail } from "../Store/Fail.ts";
import { Need, type Env } from "./Context.ts";
import { Limit } from "./Limit.ts";

export const Media = new Hono<Env>();

Media.get("/types", (c) => {
  Need(c);
  return c.json(Listed());
});

Media.post("/", Limit(200, 60_000), async (c) => {
  const Viewer = Need(c);
  const Form = await c.req.parseBody();
  const Upload = Form["File"];
  if (!(Upload instanceof File)) throw new Fail(400, "File is required");
  const Blob = await Save(new Uint8Array(await Upload.arrayBuffer()), Upload.name, Viewer.Id);
  return c.json({ Hash: Blob.Hash, Mime: Blob.Mime, Kind: Blob.Kind, Ext: Blob.Ext, Size: Blob.Size, Name: Upload.name.slice(0, 200) }, 201);
});

export async function Serve(c: Context<Env>) {
  Need(c);
  const Blob = Find(c.req.param("Hash") ?? "");
  if (!Blob) throw new Fail(404, "Not found");

  const Source = Bun.file(Locate(Blob.Hash));
  const Inline = Blob.Kind === "image" || Blob.Kind === "video" || Blob.Kind === "audio";
  const Headers: Record<string, string> = {
    "Content-Type": Inline ? Blob.Mime : "application/octet-stream",
    "Content-Disposition": Inline ? "inline" : `attachment; filename="${Blob.Hash.slice(0, 12)}.${Blob.Ext ?? "bin"}"`,
    "Cache-Control": "private, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Accept-Ranges": "bytes",
  };

  const Range = c.req.header("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (!Range || (Range[1] === "" && Range[2] === "")) return new Response(Source, { headers: Headers });

  const Start = Range[1] === "" ? Blob.Size - Number(Range[2]) : Number(Range[1]);
  const End = Range[1] === "" || Range[2] === "" ? Blob.Size - 1 : Math.min(Number(Range[2]), Blob.Size - 1);
  if (Start < 0 || Start > End || Start >= Blob.Size) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${Blob.Size}` } });
  }

  return new Response(Source.slice(Start, End + 1), {
    status: 206,
    headers: { ...Headers, "Content-Range": `bytes ${Start}-${End}/${Blob.Size}`, "Content-Length": String(End - Start + 1) },
  });
}
