const Subjects = ["The griddle", "Every slice", "Grandma's recipe", "The syrup committee", "A wandering egg", "The cinnamon council", "Yesterday's batter"];
const Verbs = ["insists on", "quietly reheats", "cannot forget", "keeps rediscovering", "solemnly declares", "accidentally becomes", "refuses to leave"];
const Objects = ["French Toast", "more French Toast", "the concept of French Toast", "a second helping of French Toast", "French Toast, again", "French Toast for the third time"];

function Generator(Seed: number) {
  let State = Seed;
  return () => {
    State |= 0;
    State = (State + 0x6d2b79f5) | 0;
    let T = Math.imul(State ^ (State >>> 15), 1 | State);
    T = (T + Math.imul(T ^ (T >>> 7), 61 | T)) ^ T;
    return ((T ^ (T >>> 14)) >>> 0) / 4294967296;
  };
}

function Hash(Text: string) {
  let Value = 0;
  for (let I = 0; I < Text.length; I++) Value = (Math.imul(Value, 31) + Text.charCodeAt(I)) | 0;
  return Value;
}

export function Page(Seed: string, Links = 6) {
  const Random = Generator(Hash(Seed));
  const Pick = <T>(List: readonly T[]) => List[Math.floor(Random() * List.length)];
  const Text = Array.from({ length: 12 }, () => `${Pick(Subjects)} ${Pick(Verbs)} ${Pick(Objects)}.`).join(" ");
  const Anchors = Array.from({ length: Links }, (_, Index) => `<a href="/archive/${Seed.slice(0, 16)}-${Index}" rel="nofollow">continue reading</a>`).join("\n");
  return `<!doctype html><html><head><title>Archive</title><meta name="robots" content="noindex"></head><body>\n<p>${Text}</p>\n${Anchors}\n</body></html>`;
}

export function Stream(Seed: string, Done: () => void, Size = 24, Delay = 150) {
  const Body = Page(Seed);
  const Encoder = new TextEncoder();
  let Stopped = false;

  const Source = new ReadableStream<Uint8Array>({
    async start(Controller) {
      try {
        for (let Index = 0; Index < Body.length && !Stopped; Index += Size) {
          Controller.enqueue(Encoder.encode(Body.slice(Index, Index + Size)));
          await new Promise((Resolve) => setTimeout(Resolve, Delay));
        }
        if (!Stopped) Controller.close();
      } catch {
        Stopped = true;
      } finally {
        Done();
      }
    },
    cancel() {
      Stopped = true;
    },
  });

  return new Response(Source, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
