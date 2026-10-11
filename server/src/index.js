/*
  Graveyard Escape — multiplayer relay.
  A tiny post office: phones connect to /room/CODE over a WebSocket and every
  message is forwarded to the other phones in that room (or to one phone if it
  has a "to" field). The first phone in a room is the host and runs the game.
*/
import { DurableObject } from 'cloudflare:workers';

const MAX_PLAYERS = 8;
const MAX_MESSAGE = 16000;

export class Room extends DurableObject {
  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    const url = new URL(request.url);
    const create = url.searchParams.get('create') === '1';
    const others = this.ctx.getWebSockets();
    const [client, server] = Object.values(new WebSocketPair());
    let problem = '';
    if (create && others.length) problem = 'taken';
    else if (!create && !others.length) problem = 'noroom';
    else if (others.length >= MAX_PLAYERS) problem = 'full';
    if (problem) {
      server.accept();
      server.send(JSON.stringify({ t: 'error', reason: problem }));
      server.close(4000, problem);
      return new Response(null, { status: 101, webSocket: client });
    }
    const me = { id: crypto.randomUUID().slice(0, 8), host: others.length === 0 };
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(me);
    server.send(JSON.stringify({ t: 'welcome', id: me.id, host: me.host, peers: others.map((s) => s.deserializeAttachment()) }));
    this.broadcast(server, { t: 'join', id: me.id });
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, message) {
    if (typeof message !== 'string' || message.length > MAX_MESSAGE) return;
    let m;
    try { m = JSON.parse(message); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    m.from = ws.deserializeAttachment().id;
    this.broadcast(ws, m, m.to);
  }

  webSocketClose(ws) { this.left(ws); }
  webSocketError(ws) { this.left(ws); }

  left(ws) {
    const me = ws.deserializeAttachment();
    if (!me || me.gone) return;
    ws.serializeAttachment({ ...me, gone: true });
    this.broadcast(ws, { t: 'leave', id: me.id, host: me.host });
    try { ws.close(1000, 'bye'); } catch (e) { /* already closed */ }
  }

  broadcast(sender, msg, to) {
    const out = JSON.stringify(msg);
    for (const s of this.ctx.getWebSockets()) {
      if (s === sender) continue;
      const a = s.deserializeAttachment();
      if (!a || a.gone || (to && a.id !== to)) continue;
      try { s.send(out); } catch (e) { /* closing */ }
    }
  }
}

export default {
  async fetch(request, env) {
    const m = new URL(request.url).pathname.match(/^\/room\/([A-Z0-9]{4,6})$/);
    if (!m) return new Response('Graveyard Escape multiplayer relay 🎃', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(request);
  },
};
