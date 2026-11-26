export type Entry = {
  Token: string;
  Send: (Text: string) => void;
  Close: (Code: number, Reason: string) => void;
};

export const Cap = 8;

const Rooms = new Map<string, Set<Entry>>();

function Shut(Entry: Entry, Code: number, Reason: string) {
  try {
    Entry.Close(Code, Reason);
  } catch {}
}

export function Join(UserId: string, Entry: Entry) {
  const Room = Rooms.get(UserId) ?? new Set<Entry>();
  Rooms.set(UserId, Room);
  Room.add(Entry);
  while (Room.size > Cap) {
    const Oldest = Room.values().next().value!;
    Room.delete(Oldest);
    Shut(Oldest, 1008, "Too many connections");
  }
}

export function Leave(UserId: string, Entry: Entry) {
  const Room = Rooms.get(UserId);
  if (!Room) return;
  Room.delete(Entry);
  if (Room.size === 0) Rooms.delete(UserId);
}

export function Push(UserId: string, Payload: object) {
  const Room = Rooms.get(UserId);
  if (!Room) return;
  const Text = JSON.stringify(Payload);
  for (const Entry of [...Room]) {
    try {
      Entry.Send(Text);
    } catch {
      Room.delete(Entry);
    }
  }
}

export function Drop(UserId: string) {
  for (const Entry of [...(Rooms.get(UserId) ?? [])]) Shut(Entry, 1008, "Signed out");
  Rooms.delete(UserId);
}

export function Revoke(Token: string) {
  for (const [UserId, Room] of [...Rooms]) {
    for (const Entry of [...Room]) {
      if (Entry.Token !== Token) continue;
      Room.delete(Entry);
      Shut(Entry, 1008, "Signed out");
    }
    if (Room.size === 0) Rooms.delete(UserId);
  }
}

export function Audit(Valid: (Token: string) => boolean) {
  for (const [UserId, Room] of [...Rooms]) {
    for (const Entry of [...Room]) {
      if (Valid(Entry.Token)) continue;
      Room.delete(Entry);
      Shut(Entry, 1008, "Session expired");
    }
    if (Room.size === 0) Rooms.delete(UserId);
  }
}

export function Count() {
  let Total = 0;
  for (const Room of Rooms.values()) Total += Room.size;
  return Total;
}
