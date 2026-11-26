export type Settings = { Burst: number; Refill: number; Now?: () => number };

type Level = { Tokens: number; At: number };

export function Bucket(Config: Settings) {
  const Now = Config.Now ?? Date.now;
  const Levels = new Map<string, Level>();

  function Top(Level: Level) {
    const Elapsed = (Now() - Level.At) / 1000;
    if (Elapsed <= 0) return;
    Level.Tokens = Math.min(Config.Burst, Level.Tokens + Elapsed * Config.Refill);
    Level.At = Now();
  }

  return {
    Take(Key: string) {
      let Level = Levels.get(Key);
      if (!Level) {
        Level = { Tokens: Config.Burst, At: Now() };
        Levels.set(Key, Level);
      }
      Top(Level);
      if (Level.Tokens < 1) return false;
      Level.Tokens -= 1;
      return true;
    },

    Sweep(Age: number) {
      const Cutoff = Now() - Age;
      for (const [Key, Level] of Levels) if (Level.At < Cutoff) Levels.delete(Key);
    },
  };
}
