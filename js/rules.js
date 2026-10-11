/*
  GRAVEYARD ESCAPE — MULTIPLAYER RULES
  ====================================
  Everything players read about the multiplayer modes and roles lives here,
  so it's easy to change the wording together.
*/
const RULES = {
  modes: {
    coop: {
      name: 'Escape Together',
      icon: '🤝',
      short: 'Everyone is a human. Work together to escape the computer ghosts.',
      rules: [
        'Everyone plays a human. The ghosts are controlled by the computer.',
        'Keys count for the whole team. When all the keys are found, the gate opens.',
        'Caught? You get locked in a ghost cage 🔒. A teammate frees you by standing next to the cage for 2 seconds.',
        'Run out through the gate 🚪 to escape. The team wins when every player who isn\'t caged has escaped.',
        'If everyone is caged at the same time, the ghosts win.',
        'Teamwork tip: one of you throws pebbles 🪨 to lure a ghost away while another sneaks in for the key.',
      ],
    },
    versus: {
      name: 'Ghosts vs Humans',
      icon: '⚔️',
      short: 'One team haunts, the other escapes, before the clock strikes midnight!',
      rules: [
        'Humans: find the keys, open the gate and escape. Humans win if at least half of them escape before midnight (6 minutes).',
        'Ghosts: catch the humans! Ghosts win if every human is caged at the same time, or if the clock strikes midnight first.',
        'A caged human can be freed by a teammate standing next to the cage for 2 seconds.',
        'Ghosts only see what is inside their cone of light, but they see the noise rings of running, sprinting and pebbles.',
        'Humans who hide are invisible. But if a ghost watched you hide, it gets a 👀 marker on that spot.',
        'Ghosts can CHECK a hiding spot: if someone is inside, they are caught. If it\'s empty, the ghost is confused and slow for 3 seconds.',
        'The computer can add extra ghosts to make it harder for the humans.',
      ],
    },
  },
  humans: 'You see the whole graveyard with your lantern, your teammates and every ghost (they glow). Sneak, hide, throw pebbles, and free caged friends.',
  perks: [
    { id: 'runner', icon: '🏃', name: 'Runner', text: 'Your sprint lasts longer and recharges faster.' },
    { id: 'sneaker', icon: '🤫', name: 'Sneaker', text: 'You sneak faster, and running makes less noise.' },
    { id: 'trickster', icon: '🪨', name: 'Trickster', text: 'You start with 3 extra pebbles and throw them further.' },
    { id: 'medic', icon: '⛑️', name: 'Medic', text: 'You free caged friends in 1 second, and they get a longer head start.' },
  ],
  ghosts: [
    { id: 'ghost', icon: '👻', name: 'Ghost', button: '💨<br>LUNGE', text: 'Sees inside its cone of light and floats faster than humans run (but slower than they sprint). LUNGE: a quick burst of speed, every 7 seconds.' },
    { id: 'banshee', icon: '😱', name: 'Banshee', button: '😱<br>SCREAM', text: 'Blind, but sees every noise on the whole map. SCREAM: shows your team every human near you for 4 seconds, every 14 seconds.' },
    { id: 'phantom', icon: '🌫️', name: 'Phantom', button: '🌫️<br>FADE', text: 'Slow, but floats through walls and senses humans within 6 squares. FADE: invisible to humans for 4 seconds, every 16 seconds.' },
  ],
  allGhosts: 'Every ghost catches humans by touching them, and can CHECK hiding spots. Humans can always see ghosts glowing in the dark, so sneak up from behind walls!',
  emotes: [
    { id: 'help', icon: '🆘', text: 'Help!' },
    { id: 'here', icon: '📍', text: 'Over here!' },
    { id: 'danger', icon: '👻', text: 'Ghost!' },
    { id: 'go', icon: '🏃', text: 'Go, go, go!' },
  ],
};
