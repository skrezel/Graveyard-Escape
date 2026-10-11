/*
  Graveyard Escape — multiplayer connection.
  Talks to the little relay server (server/ folder, runs on Cloudflare). The relay just
  forwards messages between the phones in a room; the host's phone runs the game.
*/
const Net = (() => {
  'use strict';
  // Set after deploying the relay (see server/README or play.sh). ?relay=wss://... overrides it.
  const PRODUCTION_RELAY = 'wss://graveyard-escape.graveyard-escape-relay.workers.dev';

  function relayBase() {
    const q = new URLSearchParams(location.search).get('relay');
    if (q) return q.replace(/\/$/, '');
    const h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local') || /^\d+\.\d+\.\d+\.\d+$/.test(h)) return `ws://${h}:8787`;
    return PRODUCTION_RELAY;
  }

  let ws = null, myId = null, hostId = null, onMessage = () => {};

  // Resolves once we're in the room. reason codes: taken, noroom, full, timeout, offline
  function connect(code, create) {
    close();
    return new Promise((resolve, reject) => {
      let done = false;
      const fail = (reason) => { if (!done) { done = true; reject(new Error(reason)); } };
      const timer = setTimeout(() => { fail('timeout'); close(); }, 8000);
      try {
        ws = new WebSocket(`${relayBase()}/room/${code}${create ? '?create=1' : ''}`);
      } catch (e) { clearTimeout(timer); fail('offline'); return; }
      const sock = ws;
      sock.onmessage = (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch (err) { return; }
        if (m.t === 'welcome') {
          myId = m.id;
          hostId = m.host ? m.id : ((m.peers.find((p) => p.host) || {}).id || null);
          clearTimeout(timer);
          done = true;
          resolve({ id: myId, host: m.host, peers: m.peers });
          return;
        }
        if (m.t === 'error') { clearTimeout(timer); fail(m.reason); return; }
        if (done && sock === ws) onMessage(m);
      };
      sock.onerror = () => { clearTimeout(timer); fail('offline'); };
      sock.onclose = () => {
        clearTimeout(timer);
        if (!done) fail('offline');
        else if (sock === ws) { ws = null; onMessage({ t: 'closed' }); }
      };
    });
  }

  function send(msg) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  }

  function close() {
    if (ws) { const s = ws; ws = null; try { s.close(); } catch (e) { /* ok */ } }
    myId = null;
    hostId = null;
  }

  return {
    connect, send, close, relayBase,
    get id() { return myId; },
    get hostId() { return hostId; },
    get connected() { return !!ws && ws.readyState === 1; },
    set onMessage(fn) { onMessage = fn; },
  };
})();
