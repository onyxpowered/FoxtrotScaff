import { createBunWebSocket } from "hono/bun";

export const { upgradeWebSocket, websocket } = createBunWebSocket();

export const Config = { ...websocket, maxPayloadLength: 8 * 1024, idleTimeout: 120 };
