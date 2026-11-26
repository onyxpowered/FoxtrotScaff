import { Hono } from "hono";
import { z } from "zod";
import * as Social from "../Store/Social.ts";
import * as Preferences from "../Store/Preferences.ts";
import * as Notifications from "../Store/Notifications.ts";
import * as Hidden from "../Store/Hidden.ts";
import * as Feeds from "../Feeds/Feeds.ts";
import { Find } from "../Media/Blobs.ts";
import { Fail } from "../Store/Fail.ts";
import { ByUsername, Profile, Update } from "../Store/Users.ts";
import { Need, type Env } from "./Context.ts";
import { Json, Paging, Query, Rating, Value } from "./Parse.ts";

export const Users = new Hono<Env>();

const Place = z.string().trim().max(60).nullable().transform((Value) => (Value ? Value : null));

Users.patch("/me", async (c) => {
  const Viewer = Need(c);
  const Input = await Json(c, z.object({
    Display: z.string().trim().min(1).max(40).optional(),
    Bio: z.string().trim().max(500).optional(),
    Avatar: z.string().regex(/^[a-f0-9]{64}$/).nullable().optional(),
    City: Place.optional(),
    Region: Place.optional(),
  }));

  if (Input.Avatar) {
    const Blob = Find(Input.Avatar);
    if (!Blob || !Blob.Mime.startsWith("image/")) throw new Fail(400, "Avatar must be an uploaded image");
  }
  return c.json(Update(Viewer.Id, Input));
});

Users.get("/me/preferences", (c) => c.json(Preferences.Get(Need(c).Id)));

Users.put("/me/preferences", async (c) => {
  const Viewer = Need(c);
  const Input = await Json(c, z.object({ MaxRating: Rating }));
  return c.json(Preferences.Set(Viewer.Id, Input.MaxRating));
});

const Label = z.string().trim().toLowerCase().transform((Value) => Value.replace(/^#/, "")).pipe(z.string().regex(/^[a-z0-9_-]{1,32}$/, "Tags are 1-32 letters, numbers, - or _"));

Users.get("/me/hidden", (c) => c.json(Hidden.List(Need(c).Id)));

Users.put("/me/hidden/:Tag", (c) => {
  const Viewer = Need(c);
  Hidden.Hide(Viewer.Id, Value(Label, decodeURIComponent(c.req.param("Tag"))));
  return c.body(null, 204);
});

Users.delete("/me/hidden/:Tag", (c) => {
  const Viewer = Need(c);
  Hidden.Show(Viewer.Id, Value(Label, decodeURIComponent(c.req.param("Tag"))));
  return c.body(null, 204);
});

Users.get("/:Username", (c) => {
  const Viewer = Need(c);
  return c.json(Profile(c.req.param("Username"), Viewer.Id));
});

Users.get("/:Username/posts", (c) => {
  const Viewer = Need(c);
  const Target = Profile(c.req.param("Username"), Viewer.Id);
  const Input = Query(c, Paging);
  return c.json(Feeds.Author(Viewer.Id, Target.Id, Input.Before, Input.Limit));
});

const Listing = z.object({ Limit: z.coerce.number().int().min(1).max(100).default(50), Offset: z.coerce.number().int().min(0).default(0) });

Users.get("/:Username/followers", (c) => {
  const Viewer = Need(c);
  const Target = Profile(c.req.param("Username"), Viewer.Id);
  const Input = Query(c, Listing);
  return c.json(Social.Followers(Target.Id, Input.Limit, Input.Offset));
});

Users.get("/:Username/following", (c) => {
  const Viewer = Need(c);
  const Target = Profile(c.req.param("Username"), Viewer.Id);
  const Input = Query(c, Listing);
  return c.json(Social.Following(Target.Id, Input.Limit, Input.Offset));
});

function Other(c: Parameters<typeof Need>[0]) {
  const Viewer = Need(c);
  const Target = ByUsername(c.req.param("Username") ?? "");
  if (!Target || Target.SuspendedAt) throw new Fail(404, "User not found");
  if (Target.Id === Viewer.Id) throw new Fail(400, "That is you");
  return { Viewer, Target };
}

Users.post("/:Username/follow", (c) => {
  const { Viewer, Target } = Other(c);
  if (Social.Blocked(Viewer.Id, Target.Id)) throw new Fail(404, "User not found");
  if (Social.Follow(Viewer.Id, Target.Id)) Notifications.Notify(Target.Id, Viewer.Id, "follow");
  return c.body(null, 204);
});

Users.delete("/:Username/follow", (c) => {
  const { Viewer, Target } = Other(c);
  Social.Unfollow(Viewer.Id, Target.Id);
  return c.body(null, 204);
});

Users.post("/:Username/block", (c) => {
  const { Viewer, Target } = Other(c);
  Social.Block(Viewer.Id, Target.Id);
  return c.body(null, 204);
});

Users.delete("/:Username/block", (c) => {
  const { Viewer, Target } = Other(c);
  Social.Unblock(Viewer.Id, Target.Id);
  return c.body(null, 204);
});

Users.post("/:Username/mute", (c) => {
  const { Viewer, Target } = Other(c);
  Social.Mute(Viewer.Id, Target.Id);
  return c.body(null, 204);
});

Users.delete("/:Username/mute", (c) => {
  const { Viewer, Target } = Other(c);
  Social.Unmute(Viewer.Id, Target.Id);
  return c.body(null, 204);
});
