export type ReplyGate = "everyone" | "followers" | "mutuals" | "mentioned" | "nobody";

export type Standing = {
  Gate: ReplyGate;
  Requester: string;
  Author: string;
  Follows: boolean;
  FollowedBy: boolean;
  Mentioned: boolean;
};

export function Allows(Standing: Standing) {
  if (Standing.Requester === Standing.Author) return true;
  switch (Standing.Gate) {
    case "nobody":
      return false;
    case "followers":
      return Standing.Follows;
    case "mutuals":
      return Standing.Follows && Standing.FollowedBy;
    case "mentioned":
      return Standing.Mentioned;
    default:
      return true;
  }
}
