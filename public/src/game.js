const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const dialog = document.querySelector("#dialog");
const toast = document.querySelector("#toast");
const heartsEl = document.querySelector("#hearts");
const missionEl = document.querySelector("#mission");
const toolsEl = document.querySelector("#tools");
const bagEl = document.querySelector("#bag");

const W = canvas.width;
const H = canvas.height;
const SAVE_KEY = "overgrown-quest-save-v1";

const keys = {};
const justPressed = {};
const colors = {
  grass: "#4eaa55",
  grassDark: "#3a8542",
  grassLight: "#72bf67",
  dirt: "#b29463",
  path: "#c2aa75",
  wood: "#795334",
  woodDark: "#513721",
  wall: "#73513b",
  gold: "#f5d879",
  text: "#fff7d1",
  water: "#5aa7d8",
  thorn: "#762f4b",
  shadow: "rgba(0,0,0,0.25)"
};

const toolDefs = {
  trowel: { name: "Trowel", short: "Trowel", damage: 1, range: 34, cooldown: 320 },
  can: { name: "Watering Can", short: "Can", damage: 1, range: 72, cooldown: 460 },
  shears: { name: "Pruning Shears", short: "Shears", damage: 2, range: 38, cooldown: 360 },
  shovel: { name: "Shovel", short: "Shovel", damage: 2, range: 42, cooldown: 520 },
  lantern: { name: "Lantern", short: "Lantern", damage: 0, range: 82, cooldown: 600 }
};

const state = {
  mode: "playing",
  scene: "garden",
  tools: ["trowel"],
  activeTool: "trowel",
  items: new Set(),
  flags: new Set(),
  fixings: 0,
  dialogOpen: false,
  dialogAction: null,
  toastTimer: 0,
  attackTimer: 0,
  attackArc: null,
  endingTimer: 0
};

const player = {
  x: 312,
  y: 344,
  w: 20,
  h: 23,
  speed: 2.25,
  dir: "down",
  hp: 6,
  maxHp: 6,
  invuln: 0,
  moving: false,
  frame: 0,
  anim: 0
};

const scenes = {};

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function center(o) {
  return { x: o.x + o.w / 2, y: o.y + o.h / 2 };
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function hasTool(tool) {
  return state.tools.includes(tool);
}

function addTool(tool) {
  if (hasTool(tool)) return;
  state.tools.push(tool);
  state.activeTool = tool;
  flash(`New tool: ${toolDefs[tool].name}`);
  saveGame();
  updateHud();
}

function addFixing(name) {
  if (state.items.has(name)) return;
  state.items.add(name);
  state.fixings += 1;
  flash(`Recovered ${name}`);
  saveGame();
  updateHud();
}

function setFlag(flag) {
  state.flags.add(flag);
  saveGame();
}

function flash(text) {
  toast.textContent = text;
  toast.hidden = false;
  state.toastTimer = 2200;
}

function showDialog(name, text, action = null) {
  dialog.innerHTML = `<strong>${name}</strong>${text}<small>Press E, Space, or Talk to continue</small>`;
  dialog.hidden = false;
  state.dialogOpen = true;
  state.dialogAction = action;
}

function closeDialog() {
  dialog.hidden = true;
  state.dialogOpen = false;
  const action = state.dialogAction;
  state.dialogAction = null;
  if (action) action();
}

function saveGame() {
  const data = {
    scene: state.scene,
    x: player.x,
    y: player.y,
    hp: player.hp,
    tools: state.tools,
    activeTool: state.activeTool,
    items: Array.from(state.items),
    flags: Array.from(state.flags),
    fixings: state.fixings
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    state.scene = data.scene || "garden";
    player.x = Number.isFinite(data.x) ? data.x : player.x;
    player.y = Number.isFinite(data.y) ? data.y : player.y;
    player.hp = Number.isFinite(data.hp) ? data.hp : player.hp;
    state.tools = Array.isArray(data.tools) && data.tools.length ? data.tools : ["trowel"];
    state.activeTool = data.activeTool || state.tools[0];
    state.items = new Set(data.items || []);
    state.flags = new Set(data.flags || []);
    state.fixings = Number.isFinite(data.fixings) ? data.fixings : state.items.size;
  } catch {
    localStorage.removeItem(SAVE_KEY);
  }
}

function cycleTool() {
  const i = state.tools.indexOf(state.activeTool);
  state.activeTool = state.tools[(i + 1) % state.tools.length];
  updateHud();
}

function updateHud() {
  const full = Math.ceil(player.hp / 2);
  const empty = Math.ceil((player.maxHp - player.hp) / 2);
  heartsEl.textContent = `${"♥".repeat(full)}${"♡".repeat(empty)}`;

  if (state.mode === "won") {
    missionEl.textContent = "Garden restored";
  } else if (state.fixings >= 4) {
    missionEl.textContent = "Mission: open the buried greenhouse";
  } else {
    missionEl.textContent = `Mission: recover fixings ${state.fixings}/4`;
  }

  toolsEl.innerHTML = state.tools.map(tool => {
    const cls = tool === state.activeTool ? "tool active" : "tool";
    return `<span class="${cls}">${toolDefs[tool].short}</span>`;
  }).join("");

  const bag = Array.from(state.items);
  bagEl.textContent = bag.length ? `Bag: ${bag.join(", ")}` : "Bag: empty";
}

function makeEnemy(type, x, y, options = {}) {
  const defs = {
    slug: { name: "Nibble Slug", hp: 2, speed: 0.72, damage: 1, color: "#7e9155", r: 13 },
    weed: { name: "Snap Weed", hp: 3, speed: 0, damage: 1, color: "#276f36", r: 14 },
    beetle: { name: "Compost Beetle", hp: 3, speed: 1.25, damage: 1, color: "#4b3527", r: 12 },
    thorn: { name: "Thorn Sprite", hp: 2, speed: 0.58, damage: 1, color: "#8f355e", r: 11 },
    mower: { name: "Rusted Mower", hp: 6, speed: 1.05, damage: 2, color: "#9b6a4a", r: 18 },
    rootKing: { name: "Root-King", hp: 12, speed: 0.78, damage: 2, color: "#5e2f43", r: 26 }
  };
  return {
    type,
    x,
    y,
    w: (options.r || defs[type].r) * 2,
    h: (options.r || defs[type].r) * 2,
    hp: options.hp || defs[type].hp,
    maxHp: options.hp || defs[type].hp,
    speed: options.speed ?? defs[type].speed,
    damage: defs[type].damage,
    color: defs[type].color,
    homeX: x,
    homeY: y,
    invuln: 0,
    stun: 0,
    phase: 0,
    alive: true,
    drop: options.drop || null
  };
}

function buildScenes() {
  scenes.garden = {
    name: "Main Garden",
    bg: colors.grass,
    solids: borders(),
    doors: [
      { x: 292, y: 112, w: 56, h: 16, to: "shed", px: 306, py: 374, label: "Enter shed" },
      { x: 608, y: 208, w: 20, h: 64, to: "veg", px: 34, py: 236, label: "Vegetable patch" },
      { x: 32, y: 420, w: 78, h: 20, to: "compost", px: 530, py: 72, label: "Compost corner", needs: "shears", blocked: "The brambles need pruning shears." },
      { x: 524, y: 420, w: 82, h: 20, to: "patio", px: 80, py: 80, label: "Patio ruins", needs: "shovel", blocked: "Loose stones block the way. A shovel could lever them aside." },
      { x: 280, y: 20, w: 80, h: 18, to: "greenhouse", px: 308, py: 394, label: "Buried greenhouse", needsFlag: "greenhouseOpen", blocked: "The old weather vane has not revealed this path yet." }
    ],
    interactables: [
      npc(152, 246, "Garden Gnome", "The weather vane is sulking. Find the four lost fixings, then mend it at the shed bench."),
      npc(462, 240, "Bird Bath", "The bird bath burbles: water wakes what claws cannot.")
    ],
    enemies: [
      makeEnemy("slug", 418, 330),
      makeEnemy("slug", 210, 330)
    ],
    draw: drawGarden
  };

  scenes.shed = {
    name: "Tool Shed",
    bg: "#806346",
    solids: [
      { x: 0, y: 0, w: W, h: 58 }, { x: 0, y: 418, w: 286, h: 62 },
      { x: 354, y: 418, w: 286, h: 62 }, { x: 0, y: 0, w: 76, h: H },
      { x: 564, y: 0, w: 76, h: H }, { x: 112, y: 78, w: 248, h: 38 },
      { x: 420, y: 150, w: 64, h: 52 }
    ],
    doors: [
      { x: 286, y: 414, w: 68, h: 20, to: "garden", px: 310, py: 224, label: "Leave shed" }
    ],
    interactables: [
      {
        x: 128, y: 58, w: 44, h: 30, name: "Watering Can", prompt: "Take can",
        action: () => addTool("can"),
        draw: drawCan
      },
      {
        x: 186, y: 58, w: 44, h: 30, name: "Pruning Shears", prompt: "Take shears",
        action: () => state.items.has("Copper Clasp") ? addTool("shears") : showDialog("Pruning Shears", "The shears are rusted shut. A Copper Clasp from the vegetable patch would fix the spring."),
        draw: drawShears
      },
      {
        x: 244, y: 58, w: 44, h: 30, name: "Shovel", prompt: "Take shovel",
        action: () => state.items.has("Root Pin") ? addTool("shovel") : showDialog("Shovel", "The handle is split. Something from the compost corner could pin it back together."),
        draw: drawShovel
      },
      {
        x: 302, y: 58, w: 44, h: 30, name: "Lantern", prompt: "Take lantern",
        action: () => state.items.has("Glass Wick") ? addTool("lantern") : showDialog("Lantern", "The lantern needs a wick. The patio should have something glassy and useful."),
        draw: drawLantern
      },
      {
        x: 426, y: 152, w: 54, h: 48, name: "Crate", prompt: "Open crate",
        action: () => {
          if (!state.items.has("Old Map")) {
            state.items.add("Old Map");
            flash("Found Old Map");
            showDialog("Old Map", "A smudged X marks the vegetable patch. Very official. Almost certainly not drawn by the gnome.");
            saveGame();
            updateHud();
          } else {
            showDialog("Crate", "Empty, except for heroic amounts of straw.");
          }
        },
        draw: drawCrate
      },
      {
        x: 262, y: 100, w: 90, h: 28, name: "Workbench", prompt: "Repair vane",
        action: () => {
          if (state.fixings >= 4 && !state.flags.has("greenhouseOpen")) {
            setFlag("greenhouseOpen");
            showDialog("Workbench", "You fit the four fixings into the weather vane. It spins once, points straight down, and the garden path opens.");
          } else if (state.flags.has("greenhouseOpen")) {
            showDialog("Workbench", "The repaired vane points toward the buried greenhouse.");
          } else {
            showDialog("Workbench", `The vane still needs ${4 - state.fixings} fixing${4 - state.fixings === 1 ? "" : "s"}.`);
          }
        }
      }
    ],
    enemies: [],
    draw: drawShed
  };

  scenes.veg = {
    name: "Vegetable Patch",
    bg: "#568b48",
    solids: borders().concat([
      { x: 124, y: 90, w: 34, h: 230 }, { x: 250, y: 160, w: 34, h: 230 },
      { x: 382, y: 90, w: 34, h: 230 }, { x: 500, y: 160, w: 34, h: 230 }
    ]),
    doors: [
      { x: 0, y: 208, w: 20, h: 66, to: "garden", px: 586, py: 236, label: "Main garden" }
    ],
    interactables: [
      {
        x: 538, y: 96, w: 40, h: 36, name: "Wilted Tomato", prompt: "Water",
        action: () => {
          if (state.activeTool !== "can") {
            showDialog("Wilted Tomato", "It droops theatrically. Use the watering can.");
            return;
          }
          if (!state.items.has("Copper Clasp")) {
            addFixing("Copper Clasp");
            showDialog("Wilted Tomato", "The tomato perks up and coughs out a Copper Clasp. Gardening is strange today.");
          }
        },
        draw: drawTomato
      }
    ],
    enemies: [
      makeEnemy("weed", 210, 112),
      makeEnemy("slug", 336, 290),
      makeEnemy("mower", 520, 318, { drop: "Brass Gear" })
    ],
    draw: drawVeg
  };

  scenes.compost = {
    name: "Compost Corner",
    bg: "#425037",
    solids: borders().concat([
      { x: 88, y: 92, w: 130, h: 40 }, { x: 310, y: 112, w: 176, h: 42 },
      { x: 120, y: 330, w: 116, h: 46 }, { x: 386, y: 310, w: 104, h: 50 }
    ]),
    doors: [
      { x: 520, y: 32, w: 86, h: 18, to: "garden", px: 70, py: 394, label: "Main garden" }
    ],
    interactables: [
      {
        x: 82, y: 264, w: 48, h: 34, name: "Marked Soil", prompt: "Dig",
        action: () => {
          if (state.activeTool !== "shears" && state.activeTool !== "shovel") {
            showDialog("Marked Soil", "Roots cover the mark. Shears could clear them.");
            return;
          }
          if (!state.items.has("Root Pin")) {
            addFixing("Root Pin");
            showDialog("Marked Soil", "Under the roots is a Root Pin, exactly the sort of thing a broken shovel wants.");
          }
        },
        draw: drawSoil
      }
    ],
    enemies: [
      makeEnemy("beetle", 250, 210),
      makeEnemy("beetle", 460, 234),
      makeEnemy("thorn", 330, 354)
    ],
    draw: drawCompost
  };

  scenes.patio = {
    name: "Patio Ruins",
    bg: "#88806e",
    solids: borders().concat([
      { x: 130, y: 132, w: 76, h: 42 }, { x: 292, y: 94, w: 60, h: 110 },
      { x: 426, y: 252, w: 94, h: 44 }, { x: 110, y: 326, w: 170, h: 32 }
    ]),
    doors: [
      { x: 44, y: 32, w: 90, h: 18, to: "garden", px: 540, py: 394, label: "Main garden" }
    ],
    interactables: [
      {
        x: 472, y: 102, w: 44, h: 42, name: "Cracked Birdbath", prompt: "Dig out",
        action: () => {
          if (state.activeTool !== "shovel") {
            showDialog("Cracked Birdbath", "The base is wedged in place. A shovel could lever it up.");
            return;
          }
          if (!state.items.has("Glass Wick")) {
            addFixing("Glass Wick");
            showDialog("Cracked Birdbath", "You prise loose a Glass Wick. It hums with stored sunlight.");
          }
        },
        draw: drawBirdbath
      }
    ],
    enemies: [
      makeEnemy("thorn", 214, 238),
      makeEnemy("thorn", 380, 336),
      makeEnemy("mower", 520, 190, { hp: 4 })
    ],
    draw: drawPatio
  };

  scenes.greenhouse = {
    name: "Buried Greenhouse",
    bg: "#273126",
    solids: borders().concat([
      { x: 84, y: 92, w: 118, h: 34 }, { x: 438, y: 92, w: 118, h: 34 },
      { x: 84, y: 348, w: 118, h: 34 }, { x: 438, y: 348, w: 118, h: 34 }
    ]),
    doors: [
      { x: 286, y: 418, w: 68, h: 20, to: "garden", px: 310, py: 54, label: "Main garden" }
    ],
    interactables: [
      npc(292, 226, "Weather Vane", "Only the Root-King remains. Use every tool you learned, then bring the garden home.")
    ],
    enemies: [
      makeEnemy("rootKing", 292, 120)
    ],
    draw: drawGreenhouse
  };
}

function borders() {
  return [
    { x: 0, y: 0, w: W, h: 20 },
    { x: 0, y: H - 20, w: W, h: 20 },
    { x: 0, y: 0, w: 20, h: H },
    { x: W - 20, y: 0, w: 20, h: H }
  ];
}

function npc(x, y, name, text) {
  return {
    x, y, w: 24, h: 28, name, prompt: "Talk",
    action: () => showDialog(name, text),
    draw: drawNpc,
    solid: true
  };
}

function resetEnemyDrops() {
  for (const scene of Object.values(scenes)) {
    scene.enemies.forEach(enemy => {
      if (enemy.drop && state.items.has(enemy.drop)) enemy.alive = false;
      if (enemy.type === "rootKing" && state.flags.has("won")) enemy.alive = false;
    });
  }
}

function bindInput() {
  window.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();
    if (!keys[key]) justPressed[key] = true;
    keys[key] = true;
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "j", "z"].includes(key)) {
      event.preventDefault();
    }
  });
  window.addEventListener("keyup", event => {
    keys[event.key.toLowerCase()] = false;
  });

  document.querySelectorAll("#touchControls button").forEach(button => {
    const key = button.dataset.key;
    const press = event => {
      event.preventDefault();
      if (!keys[key]) justPressed[key] = true;
      keys[key] = true;
      button.classList.add("pressed");
    };
    const release = event => {
      event.preventDefault();
      keys[key] = false;
      button.classList.remove("pressed");
    };
    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
  });
}

function currentScene() {
  return scenes[state.scene];
}

function transition(door) {
  if (door.needs && !hasTool(door.needs)) {
    showDialog("Blocked Path", door.blocked);
    return;
  }
  if (door.needsFlag && !state.flags.has(door.needsFlag)) {
    showDialog("Hidden Path", door.blocked);
    return;
  }
  state.scene = door.to;
  player.x = door.px;
  player.y = door.py;
  saveGame();
  flash(scenes[state.scene].name);
}

function update(dt) {
  if (state.toastTimer > 0) {
    state.toastTimer -= dt;
    if (state.toastTimer <= 0) toast.hidden = true;
  }

  if (state.mode === "won") {
    state.endingTimer += dt;
    if (justPressed.e || justPressed[" "] || justPressed.enter) closeDialog();
    return;
  }

  if (justPressed.escape) {
    if (state.mode === "paused") {
      state.mode = "playing";
      closeDialog();
    } else {
      state.mode = "paused";
      showDialog("Paused", "The garden waits politely.");
    }
  }

  if (state.dialogOpen) {
    if (justPressed.e || justPressed[" "] || justPressed.enter) closeDialog();
    return;
  }

  if (state.mode !== "playing") return;

  if (justPressed.q || justPressed.r) cycleTool();
  if (justPressed.j || justPressed.z) useTool();

  player.invuln = Math.max(0, player.invuln - dt);
  state.attackTimer = Math.max(0, state.attackTimer - dt);
  if (state.attackTimer <= 0) state.attackArc = null;

  movePlayer(dt);
  updateEnemies(dt);
  checkDoors();

  const interactable = nearbyInteractable();
  if (interactable && (justPressed.e || justPressed[" "] || justPressed.enter)) {
    interactable.action();
  }
}

function movePlayer(dt) {
  let dx = 0;
  let dy = 0;
  if (keys.arrowleft || keys.a) { dx -= 1; player.dir = "left"; }
  if (keys.arrowright || keys.d) { dx += 1; player.dir = "right"; }
  if (keys.arrowup || keys.w) { dy -= 1; player.dir = "up"; }
  if (keys.arrowdown || keys.s) { dy += 1; player.dir = "down"; }
  player.moving = dx !== 0 || dy !== 0;

  if (player.moving) {
    const len = Math.hypot(dx, dy);
    dx = dx / len * player.speed;
    dy = dy / len * player.speed;
    moveAxis(dx, 0);
    moveAxis(0, dy);
    player.anim += dt;
    if (player.anim > 130) {
      player.frame = (player.frame + 1) % 4;
      player.anim = 0;
    }
  } else {
    player.frame = 0;
  }
}

function moveAxis(dx, dy) {
  const scene = currentScene();
  const nx = player.x + dx;
  const ny = player.y + dy;
  const box = { x: nx + 2, y: ny + 10, w: player.w - 4, h: player.h - 10 };
  const solids = scene.solids.concat(scene.interactables.filter(i => i.solid));
  if (!solids.some(s => rectsOverlap(box, s))) {
    player.x = nx;
    player.y = ny;
  }
}

function useTool() {
  const tool = toolDefs[state.activeTool];
  if (!tool || state.attackTimer > 0) return;
  state.attackTimer = tool.cooldown;
  const origin = center(player);
  const target = facingPoint(origin, tool.range);
  state.attackArc = { x: target.x, y: target.y, r: state.activeTool === "can" || state.activeTool === "lantern" ? 24 : 18, tool: state.activeTool };

  let hitAny = false;
  currentScene().enemies.forEach(enemy => {
    if (!enemy.alive || enemy.invuln > 0) return;
    const enemyCenter = center(enemy);
    if (dist(target, enemyCenter) <= state.attackArc.r + enemy.w / 2) {
      damageEnemy(enemy, tool.damage, state.activeTool);
      hitAny = true;
    }
  });

  if (state.activeTool === "lantern" && !hitAny) flash("The lantern reveals old roots.");
}

function facingPoint(origin, range) {
  const p = { x: origin.x, y: origin.y };
  if (player.dir === "left") p.x -= range;
  if (player.dir === "right") p.x += range;
  if (player.dir === "up") p.y -= range;
  if (player.dir === "down") p.y += range;
  return p;
}

function damageEnemy(enemy, amount, tool) {
  if (tool === "can" && ["slug", "weed", "rootKing"].includes(enemy.type)) amount += 1;
  if (tool === "shears" && ["weed", "thorn", "rootKing"].includes(enemy.type)) amount += 1;
  if (tool === "shovel" && ["beetle", "mower", "rootKing"].includes(enemy.type)) amount += 1;
  if (tool === "lantern" && enemy.type === "rootKing") amount = 2;
  if (amount <= 0) return;
  enemy.hp -= amount;
  enemy.invuln = 260;
  enemy.stun = 180;
  const ec = center(enemy);
  const pc = center(player);
  const angle = Math.atan2(ec.y - pc.y, ec.x - pc.x);
  enemy.x += Math.cos(angle) * 12;
  enemy.y += Math.sin(angle) * 12;
  if (enemy.hp <= 0) defeatEnemy(enemy);
}

function defeatEnemy(enemy) {
  enemy.alive = false;
  if (enemy.drop && !state.items.has(enemy.drop)) {
    addFixing(enemy.drop);
  }
  if (enemy.type === "rootKing") {
    setFlag("won");
    state.mode = "won";
    state.fixings = Math.max(state.fixings, 4);
    showDialog("Garden Restored", "The Root-King folds back into the soil. Sunlight pours through the buried glass, and every tool on your belt gives a proud little rattle.");
  }
}

function updateEnemies(dt) {
  const scene = currentScene();
  for (const enemy of scene.enemies) {
    if (!enemy.alive) continue;
    enemy.invuln = Math.max(0, enemy.invuln - dt);
    enemy.stun = Math.max(0, enemy.stun - dt);
    if (enemy.stun <= 0) moveEnemy(enemy);
    if (player.invuln <= 0 && rectsOverlap(playerBox(), enemy)) {
      hurtPlayer(enemy.damage);
    }
  }
}

function moveEnemy(enemy) {
  if (enemy.speed <= 0) return;
  const pc = center(player);
  const ec = center(enemy);
  const range = enemy.type === "rootKing" ? 420 : 180;
  const target = dist(pc, ec) < range ? pc : { x: enemy.homeX, y: enemy.homeY };
  const angle = Math.atan2(target.y - ec.y, target.x - ec.x);
  const dx = Math.cos(angle) * enemy.speed;
  const dy = Math.sin(angle) * enemy.speed;
  moveEnemyAxis(enemy, dx, 0);
  moveEnemyAxis(enemy, 0, dy);
}

function moveEnemyAxis(enemy, dx, dy) {
  const scene = currentScene();
  const nx = enemy.x + dx;
  const ny = enemy.y + dy;
  const box = { x: nx, y: ny, w: enemy.w, h: enemy.h };
  if (!scene.solids.some(s => rectsOverlap(box, s))) {
    enemy.x = nx;
    enemy.y = ny;
  }
}

function hurtPlayer(amount) {
  player.hp -= amount;
  player.invuln = 900;
  flash("Ouch");
  if (player.hp <= 0) {
    player.hp = player.maxHp;
    player.x = 312;
    player.y = 344;
    state.scene = "garden";
    showDialog("Back To The Shed", "You tumble out of the weeds, bruised but still heroic.");
  }
  updateHud();
  saveGame();
}

function playerBox() {
  return { x: player.x + 2, y: player.y + 8, w: player.w - 4, h: player.h - 8 };
}

function checkDoors() {
  const box = playerBox();
  for (const door of currentScene().doors) {
    if (rectsOverlap(box, door)) {
      transition(door);
      return;
    }
  }
}

function nearbyInteractable() {
  const pc = center(player);
  let best = null;
  let bestDist = 999;
  for (const item of currentScene().interactables) {
    const d = dist(pc, center(item));
    if (d < 56 && d < bestDist) {
      best = item;
      bestDist = d;
    }
  }
  return best;
}

function draw() {
  const scene = currentScene();
  scene.draw(scene);
  drawDoors(scene);
  drawInteractables(scene);
  drawEnemies(scene);
  drawPlayer();
  drawAttack();
  drawPrompt();
  if (state.mode === "paused") drawOverlay("Paused");
  if (state.mode === "won") drawEnding();
}

function drawBase(scene) {
  ctx.fillStyle = scene.bg;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 220; i += 1) {
    const x = (i * 47) % W;
    const y = (i * 83) % H;
    ctx.fillStyle = i % 2 ? colors.grassDark : colors.grassLight;
    ctx.fillRect(x, y, 2, 3);
  }
}

function drawGarden(scene) {
  drawBase(scene);
  ctx.fillStyle = colors.path;
  ctx.fillRect(300, 122, 40, 272);
  ctx.fillRect(300, 226, 310, 38);
  ctx.fillRect(34, 390, 574, 36);
  drawFence();
  drawShedExterior();
  drawTree(74, 66); drawTree(132, 68); drawTree(538, 72); drawTree(70, 354); drawTree(548, 346);
  drawFlowers();
}

function drawShed(scene) {
  ctx.fillStyle = "#7e6242";
  ctx.fillRect(0, 0, W, H);
  for (let y = 58; y < 418; y += 22) {
    ctx.fillStyle = "#6f5638";
    ctx.fillRect(76, y, 488, 2);
  }
  ctx.fillStyle = colors.wall;
  ctx.fillRect(0, 0, W, 58);
  ctx.fillRect(0, 0, 76, H);
  ctx.fillRect(564, 0, 76, H);
  ctx.fillRect(0, 418, 286, 62);
  ctx.fillRect(354, 418, 286, 62);
  ctx.fillStyle = "#8e5e32";
  ctx.fillRect(112, 78, 248, 38);
  ctx.fillStyle = "#53331d";
  ctx.fillRect(112, 78, 248, 6);
  ctx.fillStyle = colors.grass;
  ctx.fillRect(286, 418, 68, 62);
}

function drawVeg(scene) {
  drawBase(scene);
  for (let x = 116; x < 540; x += 126) {
    ctx.fillStyle = "#5d3d24";
    ctx.fillRect(x, 82, 48, 306);
    ctx.fillStyle = "#74b65c";
    for (let y = 100; y < 370; y += 30) ctx.fillRect(x + 10, y, 28, 8);
  }
  drawFence();
}

function drawCompost(scene) {
  ctx.fillStyle = scene.bg;
  ctx.fillRect(0, 0, W, H);
  drawFence();
  scene.solids.forEach((s, i) => {
    if (i < 4) return;
    ctx.fillStyle = "#5b4632";
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = "#3a2b20";
    ctx.fillRect(s.x + 8, s.y + 8, s.w - 16, 5);
  });
}

function drawPatio(scene) {
  ctx.fillStyle = scene.bg;
  ctx.fillRect(0, 0, W, H);
  for (let x = 20; x < W - 20; x += 48) {
    for (let y = 20; y < H - 20; y += 48) {
      ctx.strokeStyle = "#6f685b";
      ctx.strokeRect(x, y, 48, 48);
    }
  }
  drawFence();
  scene.solids.forEach((s, i) => {
    if (i < 4) return;
    ctx.fillStyle = "#6a6257";
    ctx.fillRect(s.x, s.y, s.w, s.h);
  });
}

function drawGreenhouse(scene) {
  ctx.fillStyle = scene.bg;
  ctx.fillRect(0, 0, W, H);
  for (let x = 48; x < W; x += 64) {
    ctx.strokeStyle = "rgba(144, 196, 166, 0.25)";
    ctx.beginPath();
    ctx.moveTo(x, 20);
    ctx.lineTo(x - 48, H - 20);
    ctx.stroke();
  }
  drawFence();
  ctx.fillStyle = "rgba(106, 153, 124, 0.25)";
  ctx.fillRect(96, 70, 448, 340);
  ctx.strokeStyle = "#87a989";
  ctx.lineWidth = 3;
  ctx.strokeRect(96, 70, 448, 340);
  ctx.lineWidth = 1;
}

function drawFence() {
  ctx.fillStyle = colors.wood;
  ctx.fillRect(0, 0, W, 20);
  ctx.fillRect(0, H - 20, W, 20);
  ctx.fillRect(0, 0, 20, H);
  ctx.fillRect(W - 20, 0, 20, H);
  ctx.fillStyle = colors.woodDark;
  for (let x = 0; x < W; x += 22) {
    ctx.fillRect(x, 0, 3, 20);
    ctx.fillRect(x, H - 20, 3, 20);
  }
}

function drawShedExterior() {
  ctx.fillStyle = colors.shadow;
  ctx.fillRect(238, 208, 168, 10);
  ctx.fillStyle = "#8d6a4e";
  ctx.fillRect(240, 104, 160, 110);
  ctx.fillStyle = "#60412a";
  ctx.beginPath();
  ctx.moveTo(226, 110);
  ctx.lineTo(320, 70);
  ctx.lineTo(414, 110);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#3d2619";
  ctx.fillRect(300, 172, 40, 42);
  ctx.fillStyle = colors.gold;
  ctx.fillRect(332, 192, 4, 4);
}

function drawTree(x, y) {
  ctx.fillStyle = "#66401f";
  ctx.fillRect(x + 12, y + 22, 12, 24);
  ctx.fillStyle = "#245d31";
  ctx.beginPath();
  ctx.arc(x + 18, y + 18, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#327b3f";
  ctx.beginPath();
  ctx.arc(x + 10, y + 15, 12, 0, Math.PI * 2);
  ctx.arc(x + 28, y + 17, 12, 0, Math.PI * 2);
  ctx.fill();
}

function drawFlowers() {
  const petals = ["#f08aac", "#f1dc69", "#e9f4ff", "#a477c5"];
  for (let i = 0; i < 22; i += 1) {
    const x = 152 + (i * 37) % 340;
    const y = 134 + (i * 61) % 218;
    ctx.fillStyle = "#276f36";
    ctx.fillRect(x + 3, y + 5, 2, 5);
    ctx.fillStyle = petals[i % petals.length];
    ctx.beginPath();
    ctx.arc(x + 4, y + 4, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDoors(scene) {
  scene.doors.forEach(door => {
    ctx.fillStyle = "rgba(245, 216, 121, 0.18)";
    ctx.fillRect(door.x, door.y, door.w, door.h);
  });
}

function drawInteractables(scene) {
  scene.interactables.forEach(item => {
    if (item.name === "Watering Can" && hasTool("can")) return;
    if (item.name === "Pruning Shears" && hasTool("shears")) return;
    if (item.name === "Shovel" && hasTool("shovel")) return;
    if (item.name === "Lantern" && hasTool("lantern")) return;
    if (item.draw) item.draw(ctx, item);
  });
}

function drawEnemies(scene) {
  scene.enemies.forEach(enemy => {
    if (!enemy.alive) return;
    const flashHit = enemy.invuln > 0 && Math.floor(enemy.invuln / 70) % 2 === 0;
    ctx.fillStyle = colors.shadow;
    ctx.beginPath();
    ctx.ellipse(enemy.x + enemy.w / 2, enemy.y + enemy.h - 2, enemy.w / 2, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flashHit ? "#fff5c2" : enemy.color;
    if (enemy.type === "weed") {
      ctx.fillRect(enemy.x + 7, enemy.y + 8, enemy.w - 14, enemy.h - 6);
      ctx.beginPath();
      ctx.arc(enemy.x + enemy.w / 2, enemy.y + 10, enemy.w / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.type === "rootKing") {
      ctx.beginPath();
      ctx.arc(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, enemy.w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2d7a3e";
      for (let i = 0; i < 6; i += 1) {
        const a = i * Math.PI / 3;
        ctx.fillRect(enemy.x + enemy.w / 2 + Math.cos(a) * 24, enemy.y + enemy.h / 2 + Math.sin(a) * 24, 30, 7);
      }
    } else {
      ctx.beginPath();
      ctx.ellipse(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, enemy.w / 2, enemy.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#171717";
    ctx.fillRect(enemy.x + enemy.w * 0.35, enemy.y + enemy.h * 0.35, 3, 3);
    ctx.fillRect(enemy.x + enemy.w * 0.62, enemy.y + enemy.h * 0.35, 3, 3);
    if (enemy.maxHp > 3) {
      ctx.fillStyle = "#2a1b1b";
      ctx.fillRect(enemy.x - 2, enemy.y - 10, enemy.w + 4, 5);
      ctx.fillStyle = "#db5d54";
      ctx.fillRect(enemy.x - 2, enemy.y - 10, (enemy.w + 4) * Math.max(0, enemy.hp / enemy.maxHp), 5);
    }
  });
}

function drawPlayer() {
  const px = Math.floor(player.x);
  const py = Math.floor(player.y);
  if (player.invuln > 0 && Math.floor(player.invuln / 80) % 2 === 0) return;
  ctx.fillStyle = colors.shadow;
  ctx.beginPath();
  ctx.ellipse(px + 10, py + 23, 11, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  const bob = player.moving && player.frame % 2 ? -1 : 0;
  ctx.fillStyle = "#2f7d3e";
  ctx.fillRect(px + 2, py + 10 + bob, 16, 12);
  ctx.fillStyle = "#5a3823";
  ctx.fillRect(px + 2, py + 18 + bob, 16, 2);
  ctx.fillStyle = "#ffd9b3";
  ctx.fillRect(px + 4, py + 4 + bob, 12, 8);
  ctx.fillStyle = "#1f5c2d";
  ctx.fillRect(px + 3, py + 1 + bob, 14, 5);
  ctx.beginPath();
  ctx.moveTo(px + 10, py - 3 + bob);
  ctx.lineTo(px + 20, py + 4 + bob);
  ctx.lineTo(px + 12, py + 5 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#171717";
  if (player.dir !== "up") {
    const eyeY = py + 8 + bob;
    ctx.fillRect(px + (player.dir === "right" ? 13 : 6), eyeY, 2, 2);
    if (player.dir === "down") ctx.fillRect(px + 12, eyeY, 2, 2);
  }
  ctx.fillStyle = "#3b2518";
  ctx.fillRect(px + 4, py + 20, 5, 4);
  ctx.fillRect(px + 11, py + 20, 5, 4);
}

function drawAttack() {
  if (!state.attackArc) return;
  const a = state.attackArc;
  const fill = {
    trowel: "rgba(230, 232, 210, 0.4)",
    can: "rgba(78, 170, 219, 0.45)",
    shears: "rgba(230, 242, 206, 0.48)",
    shovel: "rgba(190, 160, 112, 0.48)",
    lantern: "rgba(245, 216, 121, 0.4)"
  }[a.tool];
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
  ctx.fill();
}

function drawPrompt() {
  if (state.dialogOpen) return;
  const item = nearbyInteractable();
  if (!item) return;
  const c = center(item);
  const y = item.y - 10 + Math.sin(performance.now() / 220) * 2;
  ctx.fillStyle = "#10150f";
  ctx.fillRect(c.x - 11, y - 18, 22, 18);
  ctx.fillStyle = colors.gold;
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "center";
  ctx.fillText("E", c.x, y - 5);
  const txt = item.prompt || item.name;
  const width = ctx.measureText(txt).width + 12;
  ctx.fillStyle = "rgba(15, 20, 14, 0.78)";
  ctx.fillRect(c.x - width / 2, y + 2, width, 17);
  ctx.fillStyle = colors.text;
  ctx.font = "11px monospace";
  ctx.fillText(txt, c.x, y + 14);
  ctx.textAlign = "left";
}

function drawOverlay(text) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = colors.gold;
  ctx.font = "bold 34px monospace";
  ctx.textAlign = "center";
  ctx.fillText(text, W / 2, H / 2);
  ctx.textAlign = "left";
}

function drawEnding() {
  ctx.fillStyle = `rgba(245, 216, 121, ${0.12 + Math.sin(state.endingTimer / 400) * 0.04})`;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = colors.gold;
  ctx.font = "bold 20px monospace";
  ctx.textAlign = "center";
  ctx.fillText("The Overgrown Quest is complete", W / 2, 54);
  ctx.textAlign = "left";
}

function drawNpc(ctxArg, o) {
  ctxArg.fillStyle = colors.shadow;
  ctxArg.beginPath();
  ctxArg.ellipse(o.x + 12, o.y + 27, 12, 4, 0, 0, Math.PI * 2);
  ctxArg.fill();
  ctxArg.fillStyle = "#b94b42";
  ctxArg.fillRect(o.x + 5, o.y + 13, 14, 14);
  ctxArg.fillStyle = "#ffd9b3";
  ctxArg.fillRect(o.x + 7, o.y + 8, 10, 7);
  ctxArg.fillStyle = "#e2e5dc";
  ctxArg.fillRect(o.x + 7, o.y + 15, 10, 4);
  ctxArg.fillStyle = "#b94b42";
  ctxArg.beginPath();
  ctxArg.moveTo(o.x + 4, o.y + 10);
  ctxArg.lineTo(o.x + 12, o.y - 3);
  ctxArg.lineTo(o.x + 20, o.y + 10);
  ctxArg.closePath();
  ctxArg.fill();
}

function drawCan(ctxArg, o) {
  if (hasTool("can")) return;
  ctxArg.fillStyle = colors.water;
  ctxArg.fillRect(o.x + 8, o.y + 8, 22, 16);
  ctxArg.fillRect(o.x + 27, o.y + 11, 12, 4);
  ctxArg.strokeStyle = "#d7eefb";
  ctxArg.strokeRect(o.x + 10, o.y + 5, 14, 10);
}

function drawShears(ctxArg, o) {
  if (hasTool("shears")) return;
  ctxArg.strokeStyle = "#dfe5d8";
  ctxArg.lineWidth = 3;
  ctxArg.beginPath();
  ctxArg.moveTo(o.x + 10, o.y + 22);
  ctxArg.lineTo(o.x + 30, o.y + 7);
  ctxArg.moveTo(o.x + 30, o.y + 22);
  ctxArg.lineTo(o.x + 10, o.y + 7);
  ctxArg.stroke();
  ctxArg.lineWidth = 1;
}

function drawShovel(ctxArg, o) {
  if (hasTool("shovel")) return;
  ctxArg.fillStyle = "#7a4d2a";
  ctxArg.fillRect(o.x + 20, o.y + 3, 4, 24);
  ctxArg.fillStyle = "#a7aba4";
  ctxArg.beginPath();
  ctxArg.moveTo(o.x + 15, o.y + 24);
  ctxArg.lineTo(o.x + 29, o.y + 24);
  ctxArg.lineTo(o.x + 26, o.y + 34);
  ctxArg.lineTo(o.x + 18, o.y + 34);
  ctxArg.closePath();
  ctxArg.fill();
}

function drawLantern(ctxArg, o) {
  if (hasTool("lantern")) return;
  ctxArg.fillStyle = "#3c3c36";
  ctxArg.fillRect(o.x + 13, o.y + 8, 18, 20);
  ctxArg.fillStyle = colors.gold;
  ctxArg.fillRect(o.x + 17, o.y + 12, 10, 10);
}

function drawCrate(ctxArg, o) {
  ctxArg.fillStyle = "#8b5a32";
  ctxArg.fillRect(o.x, o.y, o.w, o.h);
  ctxArg.strokeStyle = "#4e3019";
  ctxArg.strokeRect(o.x, o.y, o.w, o.h);
  ctxArg.beginPath();
  ctxArg.moveTo(o.x, o.y);
  ctxArg.lineTo(o.x + o.w, o.y + o.h);
  ctxArg.moveTo(o.x + o.w, o.y);
  ctxArg.lineTo(o.x, o.y + o.h);
  ctxArg.stroke();
}

function drawTomato(ctxArg, o) {
  if (state.items.has("Copper Clasp")) return;
  ctxArg.fillStyle = "#2b7838";
  ctxArg.fillRect(o.x + 17, o.y + 8, 5, 24);
  ctxArg.fillStyle = "#b44438";
  ctxArg.beginPath();
  ctxArg.arc(o.x + 20, o.y + 12, 10, 0, Math.PI * 2);
  ctxArg.fill();
}

function drawSoil(ctxArg, o) {
  if (state.items.has("Root Pin")) return;
  ctxArg.fillStyle = "#4a3325";
  ctxArg.beginPath();
  ctxArg.ellipse(o.x + 24, o.y + 20, 25, 12, 0, 0, Math.PI * 2);
  ctxArg.fill();
  ctxArg.fillStyle = "#6a4a34";
  ctxArg.fillRect(o.x + 16, o.y + 14, 16, 3);
}

function drawBirdbath(ctxArg, o) {
  if (state.items.has("Glass Wick")) return;
  ctxArg.fillStyle = "#777a75";
  ctxArg.fillRect(o.x + 17, o.y + 18, 8, 22);
  ctxArg.beginPath();
  ctxArg.ellipse(o.x + 22, o.y + 14, 20, 8, 0, 0, Math.PI * 2);
  ctxArg.fill();
  ctxArg.fillStyle = "#a9d8e5";
  ctxArg.fillRect(o.x + 10, o.y + 11, 24, 4);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(40, now - last);
  last = now;
  update(dt);
  draw();
  Object.keys(justPressed).forEach(key => { justPressed[key] = false; });
  requestAnimationFrame(loop);
}

buildScenes();
loadGame();
resetEnemyDrops();
bindInput();
updateHud();
flash("Overgrown Quest");
requestAnimationFrame(loop);
