# 🎃 Graveyard Escape

A Halloween chase game. You're the hero (make her look like you!), a ghost is after you,
and you have to find the keys, dodge the spooky stuff, hide when it gets close, and escape
through the gate.

It's a web app: plain HTML and JavaScript with no build step, no downloads and no image or
sound files (everything is drawn and synthesised in code). It runs in Safari on the iPhone
and in any browser on the Mac.

## Play it

```bash
~/Development/graveyard-escape/play.sh
```

This prints the addresses to open:

- **On the Mac:** http://localhost:8080
- **On the iPhone (same Wi-Fi):** the `http://<mac-name>.local:8080` address `play.sh` prints.
  This name keeps working even if the router gives the Mac a new IP address.
- **On the iPhone (Tailscale):** the `http://100.x.x.x:8080` address

**Make it an iPhone app:** open the address in Safari, then tap **Share → Add to Home Screen**.
It opens full screen with its own icon. The Mac needs to be running `play.sh` while you play.

Press `Ctrl+C` to stop the server.

## How to play

It's a stealth game: sneak, hide, distract, and only run when you have to.

| | |
|---|---|
| 👆 | Drag to move. A **small** drag sneaks silently 🤫, a **big** drag runs (and makes noise) |
| ⚡ | Hold **SPRINT** to run faster than any ghost, until you run out of breath |
| 👁️ | Ghosts see only inside their **cone of light**. Walls, trees and tombstones block it |
| ❓ | A ghost that notices you stops and its **?** fills up. Full means **!** and it chases you |
| 🔊 | Footsteps make noise (sprinting a lot). Ghosts come to investigate what they hear |
| 🙈 | **HIDE** in bushes, coffins and crypts, but a ghost that *watches* you hide will drag you out |
| 🪨 | **THROW** a pebble: ghosts go to check the clatter |
| 😱 | **Banshee:** blind, but hears everything and screams for the ghosts |
| 🌫️ | **Phantom:** slow, floats through walls, senses you nearby |
| 🕸️ 🖐️ 🦇 | Webs slow you down; zombie hands grab you and bats make you dizzy (and you yell!) |
| 🗺️ | The map (top right) fills in as you explore. Tap it to make it bigger |

**Computer controls:** arrows/WASD move · hold **X** to sneak · **Shift** sprint · **Space** hide · **F** throw · **M** map

Each level has three stars: ⭐ escape, ⭐ collect all the candy, ⭐ **never get spotted**
(no ghost chases you and no banshee screams). Your best time is saved too.
You have 3 hearts per level.

### The six levels

1. **The Old Gate:** learn cones, sneaking and hiding (the ghost is slower than you)
2. **Pumpkin Patch:** the ghosts are now faster than your run, so you need sprint
3. **Bat Alley:** bats, plus pebbles for distracting ghosts
4. **The Banshee's Garden:** sneak past a blind banshee (trick: a pebble near her makes her scream about the wrong place)
5. **The Crypts:** a maze with a phantom that floats through walls
6. **Midnight Escape:** everything at once, with a ghost guarding the gate

## Design your own levels together

Open `js/levels.js`. Each level is a map drawn with letters:

```
#  stone wall            T  spooky tree         t  tombstone
+  stone cross           P  jack-o'-lantern     .  grass
_  dirt path             B  bush    (hide!)     C  coffin (hide!)
M  crypt   (hide!)       w  spider web (slow)   h  zombie hand (grabs)
b  bat that flies ←→     v  bat that flies ↑↓   k  key
c  candy                 s  lollipop (speed!)   o  pebbles (+2)
@  you start here        E  exit gate (put it in the outside wall)
G  ghost                 W  banshee             X  phantom
```

Rules: every row must be the same length, put `#` all round the edge, and use exactly one
`@` and one `E`. Each level also has settings you can tweak: the villain's name, ghost colour,
`ghostSpeed` (she sneaks at 1.9, runs at 3.7 and sprints at 5.6), `ghostSight`, `patrolRange`,
starting `pebbles`, `darkness` and the tip text.

Save the file and reload the page. If something's wrong (for example a key that can't be
reached), the level's start screen says what and where, in plain words.

To add a new level, copy one of the `{ ... }` blocks and paste it at the end of the list.

**Tip:** add `?unlock` to the address (http://localhost:8080/?unlock) to unlock every level
for testing.

## Files

| File | What's in it |
|---|---|
| `index.html` | The page and the menu screens |
| `css/style.css` | How the menus look |
| `js/levels.js` | **The maps (edit me!)** |
| `js/game.js` | The game: movement, ghosts, hiding, hazards, screens |
| `js/art.js` | All the drawings: the hero, ghosts, tombstones, pumpkins… |
| `js/audio.js` | Music and sound effects |
| `play.sh`, `serve.py` | Start the local web server |
| `manifest.webmanifest`, `sw.js`, `icons/` | Home-screen app bits |

## Ideas for next time

- New enemies: a zombie that follows a fixed route, a gargoyle statue with a turning searchlight
- Power-ups: a lantern that shines further, an invisibility cloak, smoke bombs
- A difficulty switch (Normal / Nightmare) and a speed-run leaderboard for the family
- A boss level with the Pumpkin King
- Record her saying "BOO!" and use it as the sound effect
- Put it online (for example GitHub Pages) so it works without the Mac
