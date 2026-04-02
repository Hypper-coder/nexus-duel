# Nexus Duel - Arhitektura in Podatkovni Model

## 1. Projektna Struktura

```
nexus-duel/
├── public/
│   ├── assets/
│   │   ├── sprites/
│   │   │   ├── champions/
│   │   │   │   ├── warrior.png
│   │   │   │   └── mage.png
│   │   │   ├── abilities/
│   │   │   └── effects/
│   │   └── audio/
│   └── index.html
│
├── src/
│   ├── components/
│   │   ├── Game.jsx              # Phaser game container
│   │   ├── Lobby.jsx             # Room selection/creation
│   │   ├── CharSelect.jsx        # Champion picker
│   │   ├── GameOver.jsx          # End screen
│   │   └── UI/
│   │       ├── HealthBar.jsx
│   │       ├── ManaBar.jsx
│   │       ├── AbilitySlots.jsx
│   │       └── GameStatus.jsx
│   │
│   ├── game/
│   │   ├── GameScene.js          # Phaser main scene
│   │   ├── Player.js             # Player class
│   │   ├── Champion.js           # Champion data/stats
│   │   ├── Ability.js            # Ability class
│   │   └── mechanics/
│   │       ├── collision.js
│   │       ├── movement.js
│   │       ├── abilities.js
│   │       └── damage.js
│   │
│   ├── network/
│   │   ├── PeerConnection.js     # WebRTC/PeerJS setup
│   │   ├── GameSync.js           # State synchronization
│   │   └── Messages.js           # Message protocol
│   │
│   ├── utils/
│   │   ├── constants.js
│   │   ├── helpers.js
│   │   └── validators.js
│   │
│   ├── App.jsx
│   └── index.css
│
├── package.json
├── vite.config.js
└── README.md
```

---

## 2. Podatkovni Model - Game State

### Root Game State
```javascript
{
  // Lobby/Room Info
  roomId: "ROOM_ABC123",
  status: "waiting" | "champion_select" | "playing" | "finished",
  createdAt: 1712054400000,
  
  // Players
  players: {
    player1: PlayerState,
    player2: PlayerState
  },
  
  // Game Progress
  gameState: {
    startTime: 1712054400000,
    elapsedTime: 45000,  // ms
    totalDuration: 300000,  // 5 minutes
    winner: null | "player1" | "player2"
  }
}
```

### Player State (za svakog igrača)
```javascript
{
  // Identity
  id: "peer_1ab2cd3ef",
  username: "Blaz",
  
  // Champion Info
  champion: {
    name: "Warrior" | "Mage",
    level: 1,
    experience: 0
  },
  
  // Position & Movement
  position: {
    x: 300,
    y: 400,
    angle: 45  // direction in degrees
  },
  
  velocity: {
    x: 0,
    y: 0
  },
  
  // Stats
  stats: {
    health: 500,
    maxHealth: 500,
    mana: 200,
    maxMana: 200,
    armor: 0,
    magicResist: 0,
    attackSpeed: 1.0,
    movementSpeed: 250  // px/s
  },
  
  // Abilities
  abilities: {
    q: {
      name: "Slash",
      type: "melee",
      damage: 50,
      cooldown: 1.5,
      cooldownRemaining: 0,
      manaCost: 20,
      range: 64,
      isOnCooldown: false,
      isLearned: true
    },
    w: {
      name: "Stun",
      type: "control",
      damage: 0,
      cooldown: 10,
      cooldownRemaining: 0,
      manaCost: 60,
      range: 150,
      duration: 2.5,
      isOnCooldown: false,
      isLearned: true
    },
    e: {
      name: "Shield",
      type: "defense",
      cooldown: 8,
      cooldownRemaining: 0,
      manaCost: 40,
      damageReduction: 0.3,  // 30%
      duration: 4,
      isActive: false,
      isOnCooldown: false,
      isLearned: true
    },
    r: {
      name: "Ultimate",
      type: "aoe",
      damage: 120,
      cooldown: 45,
      cooldownRemaining: 0,
      manaCost: 150,
      range: 200,
      aoeRadius: 200,
      stunDuration: 1.5,
      isOnCooldown: false,
      isLearned: true
    }
  },
  
  // Status
  isAlive: true,
  isStunned: false,
  stunRemaining: 0,
  shieldActive: false,
  shieldRemaining: 0,
  
  // Network
  lastUpdateTime: 1712054400000,
  ping: 45  // ms
}
```

### Champion Data (Static)
```javascript
CHAMPIONS = {
  warrior: {
    name: "Warrior",
    description: "Melee fighter with high HP",
    sprite: "warrior.png",
    baseStats: {
      health: 500,
      mana: 200,
      armor: 20,
      magicResist: 5,
      attackSpeed: 0.9,
      movementSpeed: 250
    },
    abilities: {
      q: { name: "Slash", damage: 50, cooldown: 1.5, manaCost: 20 },
      w: { name: "Stun", damage: 0, cooldown: 10, manaCost: 60 },
      e: { name: "Shield", cooldown: 8, manaCost: 40, reduction: 0.3 },
      r: { name: "Ultimate", damage: 120, cooldown: 45, manaCost: 150 }
    }
  },
  
  mage: {
    name: "Mage",
    description: "Ranged caster with high mana",
    sprite: "mage.png",
    baseStats: {
      health: 300,
      mana: 400,
      armor: 5,
      magicResist: 15,
      attackSpeed: 1.2,
      movementSpeed: 280
    },
    abilities: {
      q: { name: "Fireball", damage: 80, cooldown: 2, manaCost: 50 },
      w: { name: "ManaShield", cooldown: 0, manaCost: 30 },
      e: { name: "Blink", cooldown: 12, manaCost: 80 },
      r: { name: "Meteor", damage: 200, cooldown: 50, manaCost: 200 }
    }
  }
}
```

---

## 3. Network Arhitektura

### P2P WebRTC Flow
```
┌─────────────────────┐              ┌─────────────────────┐
│   Igralec A         │              │   Igralec B         │
│   Browser           │              │   Browser           │
│                     │              │                     │
│  React Component    │              │  React Component    │
│       ↓             │              │       ↓             │
│  Phaser Game        │              │  Phaser Game        │
│  GameScene.js       │              │  GameScene.js       │
│       ↓             │              │       ↓             │
│  Local Game Logic   │              │  Local Game Logic   │
│       ↓             │              │       ↓             │
│  Player Input       │              │  Player Input       │
│  (WASD, Abilities)  │              │  (WASD, Abilities)  │
│       ↓             │              │       ↓             │
│  GameSync.js ◄──────┼──WebRTC ─────►GameSync.js         │
│  (State Updates)    │   (100ms)     │  (State Updates)    │
│                     │              │                     │
│  Local State ◄──────┼──────────────►Remote State         │
└─────────────────────┘              └─────────────────────┘
       ↓                                      ↓
    Render                                 Render
  60 FPS Update                          60 FPS Update
```

### Komunikacijski Protokol

#### 1. Initialization Message
```javascript
{
  type: "init",
  playerId: "peer_1ab2cd3ef",
  username: "Blaz",
  roomId: "ROOM_ABC123",
  champion: "warrior",
  timestamp: 1712054400000
}
```

#### 2. Game State Sync (vsak 100ms)
```javascript
{
  type: "state",
  playerId: "peer_1ab2cd3ef",
  
  // Position & Movement
  position: { x: 300, y: 400 },
  velocity: { x: 50, y: 0 },
  angle: 45,
  
  // Health & Resources
  health: 450,
  mana: 120,
  
  // Status Effects
  isStunned: false,
  shieldActive: false,
  
  // Ability Cooldowns
  abilities: {
    q: { cooldownRemaining: 0.5 },
    w: { cooldownRemaining: 7.2 },
    e: { cooldownRemaining: 0 },
    r: { cooldownRemaining: 30 }
  },
  
  timestamp: 1712054400000
}
```

#### 3. Ability Cast Message
```javascript
{
  type: "ability",
  playerId: "peer_1ab2cd3ef",
  abilityKey: "q",  // "q" | "w" | "e" | "r"
  castPosition: { x: 300, y: 400 },
  targetPosition: { x: 500, y: 300 },  // za ranged abilities
  timestamp: 1712054400050
}
```

#### 4. Damage/Hit Message
```javascript
{
  type: "hit",
  attackerId: "peer_1ab2cd3ef",
  targetId: "peer_2xy9ab1",
  ability: "Slash",
  damage: 50,
  isCritical: false,
  timestamp: 1712054400075
}
```

#### 5. Death Message
```javascript
{
  type: "death",
  playerId: "peer_2xy9ab1",
  killerId: "peer_1ab2cd3ef",
  abilityUsed: "Ultimate",
  timestamp: 1712054400100
}
```

#### 6. Game Over Message
```javascript
{
  type: "gameover",
  winner: "peer_1ab2cd3ef",
  loser: "peer_2xy9ab1",
  duration: 180000,  // seconds
  timestamp: 1712054400500
}
```

---

## 4. Game Loop Architecture

```
┌──────────────────────────────────────────────────┐
│         PHASER GAME LOOP (60 FPS)                │
│         Update every ~16.67ms                    │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ 1. HANDLE INPUT (Keyboard/Mouse)                 │
│    - WASD: Update player.velocity                │
│    - Q/W/E/R: Queue ability cast                 │
│    - Click: Target position for ranged abilities │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ 2. UPDATE GAME STATE (Local)                     │
│    - Update player position based on velocity     │
│    - Update opponent position (from network)      │
│    - Apply velocity to sprites                   │
│    - Update ability cooldowns (tick down)        │
│    - Check collision detection                   │
│    - Update status effects (stuns, shields)      │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ 3. PROCESS ABILITIES                             │
│    - Cast queued abilities                       │
│    - Check mana requirements                     │
│    - Check cooldowns                             │
│    - Calculate damage                            │
│    - Apply effects (stun, shield, etc)           │
│    - Broadcast ability to opponent               │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ 4. COLLISION & COMBAT                            │
│    - Check if abilities hit target                │
│    - Apply damage                                │
│    - Update health                               │
│    - Check if player is dead                     │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ 5. RENDER (Phaser Physics + Graphics)           │
│    - Draw player sprites                         │
│    - Draw opponent sprites                       │
│    - Draw ability effects/projectiles             │
│    - Draw UI (health bars, mana, abilities)      │
│    - Update canvas texture                       │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ 6. NETWORK SYNC (Every 100ms / 6 frames)        │
│    - Package current state                       │
│    - Send to opponent via WebRTC                 │
│    - Receive opponent state                      │
│    - Interpolate movement for smoothness         │
└──────────────────────────────────────────────────┘

          ↓
    [Loop Repeats at 60 FPS]
```

---

## 5. Arena/Map Data

### Arena Configuration
```javascript
ARENA = {
  width: 1200,
  height: 800,
  
  spawnPoints: {
    player1: { x: 150, y: 400 },
    player2: { x: 1050, y: 400 }
  },
  
  centerPoint: { x: 600, y: 400 },
  
  boundaries: {
    minX: 50,
    maxX: 1150,
    minY: 50,
    maxY: 750
  },
  
  obstacles: [
    // Optional: walls, trees, etc
  ]
}
```

### Visual Layout
```
┌────────────────────────────────────────────┐
│ (50,50)                              (1150,50)
│  ┌──────────────────────────────────────┐ │
│  │                                      │ │
│  │  Red Base                  Blue Base │ │
│  │  (150,400)                (1050,400) │ │
│  │                                      │ │
│  │            Nexus                     │ │
│  │           (600,400)                  │ │
│  │                                      │ │
│  │                                      │ │
│  └──────────────────────────────────────┘ │
│ (50,750)                            (1150,750)
└────────────────────────────────────────────┘
```

---

## 6. Tehnologije

| Komponenta | Tehnologija | Verzija |
|-----------|------------|---------|
| **Frontend Framework** | React | 18+ |
| **Game Engine** | Phaser 3 | 3.55+ |
| **P2P Networking** | PeerJS | 1.4+ |
| **Build Tool** | Vite | 5+ |
| **Package Manager** | npm | 9+ |
| **Styling** | CSS3 / Tailwind | - |
| **Language** | JavaScript (ES6+) | - |
| **Runtime** | Node.js 18+ | - |
| **Hosting** | Vercel | - |

---

## 7. Development Faze

### Faza 1: Setup (1-2 dana)
- [ ] Initialize React + Vite project
- [ ] Install Phaser 3
- [ ] Install PeerJS
- [ ] Setup basic folder structure
- [ ] Create basic React components (Lobby, Game, CharSelect)

### Faza 2: Game Mechanics (4-5 dana)
- [ ] Create Phaser GameScene
- [ ] Implement Player movement (WASD)
- [ ] Create Champion data structures
- [ ] Implement Ability system
- [ ] Add collision detection
- [ ] Implement damage calculation
- [ ] Add health/mana system

### Faza 3: Networking (3-4 dana)
- [ ] Setup PeerJS connection
- [ ] Implement state serialization
- [ ] Implement state sync (100ms interval)
- [ ] Handle opponent state updates
- [ ] Add lag compensation / interpolation
- [ ] Test on local network first

### Faza 4: UI & Polish (2-3 dana)
- [ ] Create UI components (health bar, mana, abilities)
- [ ] Add visual effects
- [ ] Add audio (optional)
- [ ] Improve responsiveness
- [ ] Fix bugs and edge cases

### Faza 5: Testing & Deployment (2 dana)
- [ ] Test on multiple browsers
- [ ] Test on mobile (optional)
- [ ] Optimize performance
- [ ] Build for production
- [ ] Deploy to Vercel

---

## 8. File Size Estimates

| File/Module | Lines | Size |
|-----------|------|------|
| GameScene.js | 400-500 | ~15KB |
| Player.js | 200-250 | ~8KB |
| PeerConnection.js | 200-300 | ~10KB |
| GameSync.js | 150-200 | ~6KB |
| UI Components | 300-400 | ~12KB |
| Champion Data | 200-300 | ~8KB |
| Abilities.js | 300-400 | ~12KB |
| Utils | 200-300 | ~10KB |
| **Totals** | **~2000-2500** | **~80KB** |

---

## 9. Performance Targets

- **FPS:** 60 (target), 30 (minimum acceptable)
- **Network Latency:** <150ms RTT optimal, <300ms acceptable
- **Update Frequency:** 10 updates/sec (100ms intervals)
- **Bundle Size:** <200KB gzipped
- **Load Time:** <3 seconds on 4G
- **Memory Usage:** <100MB per browser tab

---

## 10. Known Challenges & Solutions

| Izziv | Rešitev |
|------|---------|
| **Network Lag** | Interpolation, client-side prediction, rollback |
| **NAT Traversal** | PeerJS uses Google's STUN/TURN servers |
| **Cheating** | Client-side collision validation only (not critical for 1v1) |
| **Browser Compatibility** | WebRTC supported in 99%+ modern browsers |
| **Mobile Performance** | May need to reduce canvas resolution on mobile |
| **State Desynchronization** | Regular full-state validation every 1-2 seconds |

---

## 11. API Reference (Key Functions)

### GameScene Methods
```javascript
// Initialize game
create()

// Main update loop
update(time, delta)

// Handle player input
handleInput(keys)

// Cast ability
castAbility(key, targetPos)

// Apply damage
applyDamage(playerId, damage, ability)

// Update player position
updatePosition(playerId, newPos)

// Check collision
checkCollision(obj1, obj2)

// Send network update
sendStateUpdate()

// Receive network update
onRemoteStateUpdate(data)
```

### Player Class Methods
```javascript
// Constructor
constructor(playerData)

// Move player
move(velocity)

// Get position
getPosition()

// Update health
takeDamage(amount)

// Update mana
spendMana(amount)

// Apply effect
applyEffect(effect)

// Check if dead
isDead()
```

### PeerConnection Methods
```javascript
// Create new room
createRoom()

// Join existing room
joinRoom(roomId)

// Send message
sendMessage(message)

// Broadcast to all
broadcast(message)

// Handle message
onMessage(callback)

// Disconnect
disconnect()
```

---

## 13. Error Handling & Recovery

### Connection States
```javascript
CONNECTION_STATES = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  ERROR: 'error'
}
```

### Error Types & Recovery
| Error Type | Cause | Recovery Strategy |
|-----------|-------|------------------|
| **Connection Lost** | Network issues, browser close | Auto-reconnect (3 attempts), show reconnect UI |
| **Peer Not Found** | Invalid room ID, peer offline | Show "Waiting for opponent" screen, timeout after 5min |
| **State Desync** | Network lag, packet loss | Full state resync every 3 seconds |
| **Browser Tab Close** | User closes browser | Graceful disconnect, notify opponent |
| **WebRTC Failure** | Firewall, NAT issues | Fallback to TURN servers, show connection error |

### Reconnection Flow
```
1. Connection Lost → Show "Reconnecting..." overlay
2. Attempt reconnect (3 tries, 2s intervals)
3. If success → Resume game with state sync
4. If fail → Show "Connection lost" screen
5. Allow manual reconnect or return to lobby
```

---

## 14. State Validation & Synchronization

### Validation Protocol
```javascript
// Full state validation every 3 seconds
VALIDATION_MESSAGE = {
  type: "validate",
  playerId: "peer_1ab2cd3ef",
  checksum: "abc123def456",  // Hash of critical state
  criticalState: {
    health: 450,
    position: { x: 300, y: 400 },
    abilities: { q: 0.5, w: 7.2, e: 0, r: 30 }
  },
  timestamp: 1712054400000
}
```

### Desync Detection
```javascript
// Check for state differences > threshold
DESYNC_THRESHOLDS = {
  position: 50,      // px difference
  health: 10,        // hp difference
  cooldown: 0.5      // seconds difference
}

if (Math.abs(localHealth - remoteHealth) > DESYNC_THRESHOLDS.health) {
  requestFullSync();
}
```

### Rollback Mechanism
```javascript
// Store last 2 seconds of state history
stateHistory = [
  { timestamp: t-2000, state: {...} },
  { timestamp: t-1000, state: {...} },
  { timestamp: t, state: {...} }
]

// On desync, rollback and replay
rollbackToTimestamp(confirmedTimestamp);
replayActionsFrom(confirmedTimestamp);
```

---

## 15. Lag Compensation & Interpolation

### Client-Side Prediction
```javascript
// Predict movement locally, correct with server updates
predictedPosition = currentPosition + (velocity * deltaTime);
serverCorrection = receivedPosition - predictedPosition;

// Smooth correction over multiple frames
correctionAmount = serverCorrection * 0.1;  // 10% per frame
smoothedPosition += correctionAmount;
```

### Movement Interpolation
```javascript
// Interpolate between last known positions
interpolationFactor = (currentTime - lastUpdate) / updateInterval;
smoothedPosition = lerp(lastPosition, targetPosition, interpolationFactor);
```

### Ability Timing
```javascript
// Account for network delay in ability casts
networkDelay = measuredPing / 2;  // One-way delay
adjustedCastTime = localCastTime + networkDelay;

// Prevent ability spam during lag
if (lastCastTime + minCooldown > currentTime - networkDelay) {
  rejectAbilityCast();
}
```

---

## 16. Security & Anti-Cheat Basics

### Client-Side Validation (Non-Critical)
```javascript
// Validate on client (can't be trusted)
function validateAbilityCast(ability, playerState) {
  // Check cooldowns
  if (playerState.abilities[ability].cooldownRemaining > 0) {
    return false;
  }
  
  // Check mana
  if (playerState.stats.mana < playerState.abilities[ability].manaCost) {
    return false;
  }
  
  // Check range (basic)
  const distance = getDistance(playerPos, targetPos);
  if (distance > playerState.abilities[ability].range) {
    return false;
  }
  
  return true;
}
```

### Cheat Prevention Strategy
| Cheat Type | Detection | Prevention |
|-----------|-----------|------------|
| **Speed Hack** | Position changes too fast | Server-side position validation |
| **Infinite Mana** | Mana never decreases | Client-side only (not critical) |
| **Instant Cooldowns** | Abilities cast too fast | Client-side cooldown tracking |
| **Wall Hacks** | Impossible positioning | Collision detection |
| **Damage Hack** | Unrealistic damage | Client-side calculation only |

### Trust Model
- **Trusted:** Position, timing, collision detection
- **Semi-Trusted:** Health/mana changes (validated locally)
- **Untrusted:** Damage calculations (purely cosmetic)

---

## 17. Browser Storage Schema

### Local Storage Structure
```javascript
// User profile (localStorage)
{
  profile: {
    username: "Blaz",
    playerId: "peer_1ab2cd3ef",
    createdAt: 1712054400000,
    totalGames: 15,
    wins: 8,
    losses: 7,
    winRate: 0.533
  },
  
  preferences: {
    volume: {
      master: 0.8,
      music: 0.6,
      sfx: 1.0
    },
    graphics: {
      quality: "high",  // "low" | "medium" | "high"
      showFps: false,
      showPing: true
    },
    controls: {
      keyBindings: {
        moveUp: "KeyW",
        moveDown: "KeyS",
        moveLeft: "KeyA",
        moveRight: "KeyD",
        abilityQ: "KeyQ",
        abilityW: "KeyW",
        abilityE: "KeyE",
        abilityR: "KeyR"
      }
    }
  },
  
  gameHistory: [
    {
      gameId: "game_123",
      opponent: "Jane",
      champion: "warrior",
      result: "win",  // "win" | "loss"
      duration: 180000,
      date: 1712054400000,
      roomId: "ROOM_ABC123"
    }
  ]
}
```

### Session Storage (Temporary)
```javascript
// Current game session
{
  currentRoom: "ROOM_ABC123",
  playerRole: "host",  // "host" | "guest"
  gameStartTime: 1712054400000,
  lastSyncTime: 1712054400100,
  connectionState: "connected"
}
```

---

## 18. Testing Strategy

### Unit Tests (Jest)
```javascript
// Example test cases
describe('Player Movement', () => {
  test('should move player correctly with WASD', () => {
    const player = new Player({ x: 100, y: 100 });
    player.handleInput({ w: true, a: false, s: false, d: true });
    expect(player.velocity).toEqual({ x: 250, y: -250 });
  });
  
  test('should respect arena boundaries', () => {
    const player = new Player({ x: 50, y: 400 });
    player.move({ x: -100, y: 0 });  // Try to move left
    expect(player.position.x).toBe(50);  // Should not move
  });
});

describe('Ability System', () => {
  test('should prevent ability cast on cooldown', () => {
    const player = new Player();
    player.castAbility('q');
    expect(() => player.castAbility('q')).toThrow('Ability on cooldown');
  });
});
```

### Integration Tests
- **Network Tests:** Simulate packet loss, high latency
- **Game Flow Tests:** Complete game from lobby to finish
- **Multi-Tab Tests:** Same browser, different tabs

### Manual Testing Checklist
- [ ] Create room and join from another browser
- [ ] Test all ability combinations
- [ ] Verify collision detection
- [ ] Test network disconnection recovery
- [ ] Verify UI updates correctly
- [ ] Test on different browsers (Chrome, Firefox, Safari)
- [ ] Test on mobile devices
- [ ] Verify audio plays correctly
- [ ] Test high ping scenarios (>200ms)

### Performance Testing
- **Load Testing:** 100 concurrent games
- **Stress Testing:** Maximum abilities per second
- **Memory Testing:** Check for memory leaks
- **Network Testing:** Various connection qualities

---

## 19. Debug Mode Features

### Debug Overlay
```javascript
DEBUG_OVERLAY = {
  showFps: true,
  showPing: true,
  showPosition: true,
  showHitboxes: false,
  showNetworkPackets: false,
  showStateDiff: false
}
```

### Debug Commands (Console)
```javascript
// Enable debug mode
window.DEBUG = true;

// Show current game state
console.log(game.getState());

// Force ability cooldown
game.player.abilities.q.cooldownRemaining = 0;

// Simulate network lag
game.network.simulateLag(200);  // 200ms delay

// Show collision boxes
game.debug.showHitboxes = true;

// Log all network messages
game.network.onMessage((msg) => console.log('NET:', msg));
```

### Visual Debug Tools
- **Hitbox Visualization:** Draw red rectangles around colliders
- **Network Graph:** Show ping, packet loss, sync rate
- **State Inspector:** Real-time view of game state
- **Ability Range:** Draw circles showing ability ranges

---

## 20. Asset Pipeline

### Asset Organization
```
public/assets/
├── sprites/
│   ├── champions/
│   │   ├── warrior/
│   │   │   ├── idle.png (32x32, 4 frames)
│   │   │   ├── walk.png (32x32, 8 frames)
│   │   │   └── attack.png (32x32, 6 frames)
│   │   └── mage/
│   │       ├── idle.png
│   │       ├── walk.png
│   │       └── cast.png
│   ├── abilities/
│   │   ├── slash_effect.png (64x64, 8 frames)
│   │   ├── fireball.png (32x32, 6 frames)
│   │   └── shield.png (48x48, static)
│   └── ui/
│       ├── health_bar.png
│       ├── mana_bar.png
│       └── ability_slots.png
├── audio/
│   ├── sfx/
│   │   ├── slash.wav (44.1kHz, mono, <100KB)
│   │   ├── fireball.wav
│   │   └── shield.wav
│   └── music/
│       └── background.mp3 (128kbps, loop)
└── fonts/
    └── game_font.woff2
```

### Asset Loading Strategy
```javascript
// Preload all assets
preload() {
  // Champions
  this.load.spritesheet('warrior_idle', 'assets/sprites/champions/warrior/idle.png', {
    frameWidth: 32, frameHeight: 32, endFrame: 4
  });
  
  // Abilities
  this.load.spritesheet('slash_effect', 'assets/sprites/abilities/slash_effect.png', {
    frameWidth: 64, frameHeight: 64, endFrame: 8
  });
  
  // Audio
  this.load.audio('slash_sfx', 'assets/audio/sfx/slash.wav');
  
  // UI
  this.load.image('health_bar', 'assets/sprites/ui/health_bar.png');
}
```

### Asset Optimization
- **Sprites:** PNG-8 for small sprites, PNG-24 for complex
- **Audio:** MP3 for music, WAV/OGG for SFX (<100KB each)
- **Compression:** Gzip compression on server
- **Caching:** Browser cache with proper headers

---

## 21. Accessibility Features

### Keyboard Navigation
- **Tab Order:** Logical tab order through UI elements
- **Enter/Space:** Activate buttons and abilities
- **Escape:** Pause menu, cancel actions
- **Arrow Keys:** Alternative movement (besides WASD)

### Visual Accessibility
- **High Contrast Mode:** Toggle for better visibility
- **Colorblind Support:** Alternative color schemes
- **Font Scaling:** Adjustable text size
- **Reduced Motion:** Option to disable animations

### Audio Accessibility
- **Volume Controls:** Separate master/music/SFX sliders
- **Subtitles:** Text descriptions for important audio cues
- **Sound Cues:** Audio feedback for UI interactions

### Motor Accessibility
- **Large Click Targets:** Minimum 44px touch targets
- **Reduced Sensitivity:** Adjustable mouse/keyboard sensitivity
- **Alternative Controls:** Gamepad support

---

## 22. Future Scalability

### Path to 2v2 Mode
```javascript
// Extended game state for teams
{
  teams: {
    team1: ["player1", "player2"],
    team2: ["player3", "player4"]
  },
  
  // Team-based mechanics
  nexusHealth: {
    team1: 1000,
    team2: 1000
  },
  
  // Respawn mechanics
  respawnTimers: {
    player1: 10,  // seconds until respawn
    player2: 0
  }
}
```

### Tournament System
```javascript
TOURNAMENT_STATE = {
  bracket: {
    round1: [
      { player1: "Alice", player2: "Bob", winner: "Alice" },
      { player1: "Charlie", player2: "Dave", winner: "Charlie" }
    ],
    round2: [
      { player1: "Alice", player2: "Charlie", status: "pending" }
    ]
  },
  
  currentRound: 2,
  totalRounds: 3,
  tournamentId: "tourney_123"
}
```

### Leaderboards & Stats
```javascript
PLAYER_STATS = {
  globalRank: 1250,
  regionalRank: 89,
  favoriteChampion: "warrior",
  winStreaks: {
    current: 3,
    best: 12
  },
  achievements: [
    "First Win",
    "Speed Demon",
    "Ability Master"
  ]
}
```

### Monetization Hooks
- **Cosmetic Items:** Champion skins, effects
- **Battle Pass:** Seasonal rewards
- **Premium Features:** Extra champions, custom rooms

---

## 23. Monitoring & Analytics

### Performance Metrics
```javascript
GAME_METRICS = {
  fps: 60,
  ping: 45,
  memoryUsage: 85,  // MB
  networkPacketsSent: 1200,
  networkPacketsReceived: 1180,
  gameDuration: 180000,
  abilitiesCasted: 45,
  damageDealt: 2500
}
```

### Error Tracking
```javascript
// Log errors to console/service
logError(error, context) {
  console.error('Game Error:', {
    error: error.message,
    stack: error.stack,
    context: context,  // { phase: 'gameplay', action: 'ability_cast' }
    timestamp: Date.now(),
    gameState: getCurrentState()
  });
}
```

### User Behavior Analytics
- **Session Length:** Average game duration
- **Champion Popularity:** Which champions are picked most
- **Ability Usage:** Which abilities are used most/least
- **Drop-off Points:** Where players quit the game
- **Connection Issues:** Network failure rates

---

## 24. Deployment & DevOps

### Environment Configuration
```javascript
// config.js
const CONFIG = {
  development: {
    debug: true,
    logLevel: 'debug',
    peerJsHost: 'localhost',
    peerJsPort: 9000
  },
  
  production: {
    debug: false,
    logLevel: 'error',
    peerJsHost: 'peerjs-server.herokuapp.com',
    peerJsPort: 443
  }
};
```

### CI/CD Pipeline
1. **Linting:** ESLint for code quality
2. **Testing:** Jest unit tests + Cypress E2E
3. **Build:** Vite production build
4. **Deploy:** Vercel automatic deployment
5. **Monitoring:** Error tracking with Sentry

### Rollback Strategy
- **Blue-Green Deployment:** Keep old version running during deploy
- **Feature Flags:** Ability to disable features remotely
- **Version Pinning:** Lock dependency versions
- **Backup Strategy:** Database backups (if applicable)

---

## 25. Legal & Compliance

### Data Collection
- **Minimal Data:** Only username, game stats (no PII)
- **Cookie Consent:** EU GDPR compliance
- **Data Retention:** Delete after 1 year inactivity
- **Privacy Policy:** Clear data usage explanation

### Content Guidelines
- **Age Rating:** PEGI 7+ (mild violence)
- **Content Warnings:** Fantasy violence only
- **Moderation:** Basic chat filtering (future feature)
- **Reporting:** Player reporting system

### Open Source Considerations
- **License:** MIT License
- **Attribution:** Credit Phaser, PeerJS, React
- **Contributions:** GitHub pull request workflow
