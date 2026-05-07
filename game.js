(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const minimap = document.getElementById("minimap");
  const mctx = minimap.getContext("2d");

  const resourceEl = document.getElementById("resource");
  const unitCountEl = document.getElementById("unitCount");
  const messageEl = document.getElementById("message");
  const selectedNameEl = document.getElementById("selectedName");
  const selectedInfoEl = document.getElementById("selectedInfo");
  const counterInfoEl = document.getElementById("counterInfo");
  const helpPanel = document.getElementById("helpPanel");
  const menuBtn = document.getElementById("menuBtn");

  const buttons = {
    worker: document.getElementById("btnWorker"),
    sword: document.getElementById("btnSword"),
    spear: document.getElementById("btnSpear"),
    archer: document.getElementById("btnArcher"),
    cavalry: document.getElementById("btnCavalry"),
    farm: document.getElementById("btnFarm"),
    tower: document.getElementById("btnTower"),
    gather: document.getElementById("btnGather"),
    mine: document.getElementById("btnMine"),
    attack: document.getElementById("btnAttack")
  };

  const DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  let W = 0, H = 0, MW = 0, MH = 0;

  const state = {
    resource: 260,
    selected: [],
    mode: "normal",
    camera: { x: 650, y: 500, zoom: 1 },
    mapW: 2800,
    mapH: 1900,
    lastTime: 0,
    enemySpawnTimer: 0,
    gameOver: false,
    dragRect: null,
    placement: null,
    showHelp: true,
    unitCap: 70,
    time: 0
  };

  const objects = [];
  const units = [];
  const effects = [];
  let lastPointerWorld = null;

  // Fog of war grid.
  const fogCell = 80;
  const fogW = Math.ceil(state.mapW / fogCell);
  const fogH = Math.ceil(state.mapH / fogCell);
  const fog = new Uint8Array(fogW * fogH); // 0 unseen, 1 explored, 2 visible

  const unitInfo = {
    worker: { label: "Worker", strong: "gathering", weak: "combat" },
    sword: { label: "Swordsman", strong: "Spearmen", weak: "Archers" },
    spear: { label: "Spearman", strong: "Cavalry", weak: "Swordsmen" },
    archer: { label: "Archer", strong: "Swordsmen", weak: "Cavalry" },
    cavalry: { label: "Cavalry", strong: "Archers", weak: "Spearmen" },
    raider: { label: "Dark Swordsman", strong: "Spearmen", weak: "Archers" },
    impaler: { label: "Dark Spearman", strong: "Cavalry", weak: "Swordsmen" },
    darkarcher: { label: "Dark Archer", strong: "Swordsmen", weak: "Cavalry" },
    warg: { label: "Warg Rider", strong: "Archers", weak: "Spearmen" }
  };

  const counterMatrix = {
    sword: { spear: 1.5, archer: 0.5 },
    spear: { cavalry: 1.5, sword: 0.5 },
    archer: { sword: 1.5, cavalry: 0.5 },
    cavalry: { archer: 1.5, spear: 0.5 },
    raider: { spear: 1.5, archer: 0.5 },
    impaler: { cavalry: 1.5, sword: 0.5 },
    darkarcher: { sword: 1.5, cavalry: 0.5 },
    warg: { archer: 1.5, spear: 0.5 }
  };

  function combatType(type) {
    if (type === "raider") return "sword";
    if (type === "impaler") return "spear";
    if (type === "darkarcher") return "archer";
    if (type === "warg") return "cavalry";
    return type;
  }

  function damageModifier(attacker, target) {
    if (!attacker || !target || !target.type) return 1;
    const a = combatType(attacker.type);
    const t = combatType(target.type);
    return (counterMatrix[a] && counterMatrix[a][t]) || 1;
  }

  function resize() {
    W = Math.floor(window.innerWidth);
    H = Math.floor(window.innerHeight);
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    MW = Math.floor(minimap.clientWidth);
    MH = Math.floor(minimap.clientHeight);
    minimap.width = Math.floor(MW * DPR);
    minimap.height = Math.floor(MH * DPR);
    mctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  window.addEventListener("resize", resize);
  resize();

  function msg(text) { messageEl.textContent = text; }
  function rand(min, max) { return min + Math.random() * (max - min); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function screenToWorld(sx, sy) {
    return {
      x: (sx - W / 2) / state.camera.zoom + state.camera.x,
      y: (sy - H / 2) / state.camera.zoom + state.camera.y
    };
  }

  function worldToScreen(wx, wy) {
    return {
      x: (wx - state.camera.x) * state.camera.zoom + W / 2,
      y: (wy - state.camera.y) * state.camera.zoom + H / 2
    };
  }

  // Texture system: procedural tiled canvases.
  function makePattern(bg, specks, lines = false) {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = bg;
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < specks; i++) {
      const x = Math.random() * 128, y = Math.random() * 128;
      const shade = Math.floor(rand(-18, 18));
      const col = bg.match(/\d+/g).map(Number);
      g.fillStyle = `rgb(${clamp(col[0]+shade,0,255)},${clamp(col[1]+shade,0,255)},${clamp(col[2]+shade,0,255)})`;
      g.fillRect(x, y, rand(1,3), rand(1,3));
    }
    if (lines) {
      g.strokeStyle = "rgba(255,255,255,.05)";
      for (let i = 0; i < 8; i++) {
        g.beginPath();
        g.moveTo(rand(0,128), rand(0,128));
        g.lineTo(rand(0,128), rand(0,128));
        g.stroke();
      }
    }
    return ctx.createPattern(c, "repeat");
  }

  const terrain = {
    grass: makePattern("rgb(47,86,38)", 900),
    darkGrass: makePattern("rgb(29,58,28)", 700),
    road: makePattern("rgb(103,78,49)", 600, true),
    river: makePattern("rgb(38,91,119)", 500, true),
    rock: makePattern("rgb(83,81,72)", 500)
  };

  // Sprite sheets: generated in-memory, 8-frame fake 3D top-down units.
  const sprites = {};
  function makeUnitSheet(type, team) {
    const frame = 72, frames = 8;
    const c = document.createElement("canvas");
    c.width = frame * frames;
    c.height = frame;
    const g = c.getContext("2d");
    const isPlayer = team === "player";
    const blue = isPlayer ? "#2c65bd" : "#9c2724";
    const trim = isPlayer ? "#d9d4bd" : "#282828";
    const leather = isPlayer ? "#7c512f" : "#1a1010";

    for (let i = 0; i < frames; i++) {
      const ox = i * frame + frame/2;
      const bob = Math.sin(i / frames * Math.PI * 2) * 3;
      const sway = Math.cos(i / frames * Math.PI * 2) * 3;

      g.fillStyle = "rgba(0,0,0,.32)";
      g.beginPath();
      g.ellipse(ox, 56, 24, 9, 0, 0, Math.PI*2);
      g.fill();

      if (type === "cavalry" || type === "warg") {
        g.fillStyle = type === "warg" ? "#3d302b" : "#6a452a";
        g.beginPath();
        g.ellipse(ox, 39+bob, 27, 14, 0, 0, Math.PI*2);
        g.fill();
        g.fillStyle = "#2a1b12";
        g.beginPath();
        g.arc(ox+22, 35+bob, 9, 0, Math.PI*2);
        g.fill();
        g.fillStyle = blue;
        g.beginPath();
        g.arc(ox-5+sway, 25+bob, 10, 0, Math.PI*2);
        g.fill();
        g.fillStyle = trim;
        g.fillRect(ox+8, 22+bob, 28, 4);
        g.fillStyle = "#171717";
        g.fillRect(ox-18, 45+bob, 5, 18);
        g.fillRect(ox+14, 45-bob, 5, 18);
      } else {
        g.fillStyle = blue;
        g.beginPath();
        g.ellipse(ox, 34+bob, 14, 18, 0, 0, Math.PI*2);
        g.fill();
        g.fillStyle = trim;
        g.beginPath();
        g.arc(ox, 18+bob, 8, 0, Math.PI*2);
        g.fill();

        if (type === "worker") {
          g.fillStyle = leather;
          g.fillRect(ox+7, 20+bob, 5, 35);
          g.fillStyle = "#c9a15a";
          g.fillRect(ox-18, 39+bob, 16, 12);
        } else if (type === "spear" || type === "impaler") {
          g.fillStyle = "#140d08";
          g.fillRect(ox+13, 5+bob, 4, 53);
          g.fillStyle = trim;
          g.beginPath();
          g.moveTo(ox+15, 1+bob);
          g.lineTo(ox+7, 14+bob);
          g.lineTo(ox+23, 14+bob);
          g.fill();
        } else if (type === "archer" || type === "darkarcher") {
          g.strokeStyle = "#1a1008";
          g.lineWidth = 4;
          g.beginPath();
          g.arc(ox+12, 30+bob, 17, -1.2, 1.2);
          g.stroke();
          g.strokeStyle = "#e9d8a6";
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(ox+18, 14+bob);
          g.lineTo(ox+18, 46+bob);
          g.stroke();
        } else {
          g.fillStyle = trim;
          g.fillRect(ox+8, 26+bob, 28, 4);
          g.fillStyle = "rgba(255,255,255,.65)";
          g.beginPath();
          g.arc(ox-13, 31+bob, 10, 0, Math.PI*2);
          g.fill();
        }

        g.fillStyle = "#151515";
        g.fillRect(ox-8+sway, 47+bob, 5, 16);
        g.fillRect(ox+4-sway, 47-bob, 5, 16);
      }
    }
    return c;
  }

  ["worker","sword","spear","archer","cavalry"].forEach(t => sprites["player_"+t] = makeUnitSheet(t, "player"));
  ["raider","impaler","darkarcher","warg"].forEach(t => sprites["enemy_"+t] = makeUnitSheet(t, "enemy"));

  function addObject(o) { objects.push(o); return o; }

  function addUnit(u) {
    if (u.team === "player" && livingPlayerUnits().length >= state.unitCap) {
      msg("Unit cap reached.");
      return null;
    }
    const unit = Object.assign({
      selected: false,
      tx: u.x,
      ty: u.y,
      hp: u.maxHp,
      cooldown: 0,
      task: "idle",
      target: null,
      anim: Math.random() * 8,
      facing: 1
    }, u);
    units.push(unit);
    return unit;
  }

  const playerKeep = addObject({ type: "keep", team: "player", name: "Stonehall Keep", x: 620, y: 480, r: 76, hp: 950, maxHp: 950, vision: 420 });
  addObject({ type: "farm", team: "player", name: "Farm", x: 790, y: 565, r: 50, hp: 350, maxHp: 350, incomeTimer: 0, vision: 270 });
  const enemyCamp = addObject({ type: "camp", team: "enemy", name: "Dark Legion Camp", x: 2140, y: 1210, r: 88, hp: 820, maxHp: 820 });
  addObject({ type: "slaughterhouse", team: "enemy", name: "Slaughterhouse", x: 1995, y: 1370, r: 56, hp: 370, maxHp: 370, incomeTimer: 0 });

  addUnit({ type: "worker", team: "player", name: "Worker", x: 500, y: 520, r: 16, speed: 102, maxHp: 80, attack: 5, range: 24, vision: 260 });
  addUnit({ type: "worker", team: "player", name: "Worker", x: 540, y: 575, r: 16, speed: 102, maxHp: 80, attack: 5, range: 24, vision: 260 });
  addUnit({ type: "sword", team: "player", name: "Swordsman", x: 670, y: 510, r: 19, speed: 86, maxHp: 155, attack: 19, range: 32, vision: 300 });
  addUnit({ type: "spear", team: "player", name: "Spearman", x: 710, y: 545, r: 19, speed: 84, maxHp: 140, attack: 17, range: 39, vision: 300 });
  addUnit({ type: "archer", team: "player", name: "Archer", x: 735, y: 455, r: 17, speed: 90, maxHp: 95, attack: 14, range: 190, vision: 340 });
  addUnit({ type: "cavalry", team: "player", name: "Cavalry", x: 620, y: 635, r: 25, speed: 132, maxHp: 180, attack: 22, range: 39, vision: 340 });

  addUnit({ type: "raider", team: "enemy", name: "Dark Swordsman", x: 2020, y: 1140, r: 19, speed: 78, maxHp: 128, attack: 16, range: 31, vision: 280 });
  addUnit({ type: "impaler", team: "enemy", name: "Dark Spearman", x: 2075, y: 1105, r: 19, speed: 76, maxHp: 128, attack: 15, range: 39, vision: 280 });
  addUnit({ type: "darkarcher", team: "enemy", name: "Dark Archer", x: 2185, y: 1295, r: 17, speed: 82, maxHp: 88, attack: 13, range: 175, vision: 320 });
  addUnit({ type: "warg", team: "enemy", name: "Warg Rider", x: 2245, y: 1160, r: 25, speed: 122, maxHp: 165, attack: 20, range: 39, vision: 320 });

  function addTreeCluster(cx, cy, count, spread) {
    for (let i = 0; i < count; i++) {
      const angle = rand(0, Math.PI * 2);
      const radius = Math.pow(Math.random(), 0.7) * spread;
      addObject({
        type: "tree", team: "neutral",
        x: clamp(cx + Math.cos(angle) * radius + rand(-18,18), 80, state.mapW - 80),
        y: clamp(cy + Math.sin(angle) * radius + rand(-18,18), 80, state.mapH - 80),
        r: rand(20, 38), resource: rand(55, 90), maxResource: 90,
        variant: Math.floor(rand(0, 3))
      });
    }
  }
  addTreeCluster(330, 330, 22, 250);
  addTreeCluster(560, 1130, 20, 270);
  addTreeCluster(1220, 330, 18, 280);
  addTreeCluster(1500, 1500, 19, 280);
  addTreeCluster(2390, 430, 17, 240);

  addObject({ type: "mine", team: "neutral", name: "Resource Mine", x: 440, y: 1390, r: 60, resource: 560, maxResource: 560 });
  addObject({ type: "mine", team: "neutral", name: "Resource Mine", x: 1290, y: 850, r: 60, resource: 650, maxResource: 650 });
  addObject({ type: "mine", team: "neutral", name: "Resource Mine", x: 2320, y: 540, r: 60, resource: 610, maxResource: 610 });

  function livingPlayerUnits() { return units.filter(u => u.team === "player" && u.hp > 0); }

  function isVisibleWorld(x, y) {
    const gx = Math.floor(x / fogCell), gy = Math.floor(y / fogCell);
    if (gx < 0 || gy < 0 || gx >= fogW || gy >= fogH) return false;
    return fog[gy * fogW + gx] === 2;
  }

  function isExploredWorld(x, y) {
    const gx = Math.floor(x / fogCell), gy = Math.floor(y / fogCell);
    if (gx < 0 || gy < 0 || gx >= fogW || gy >= fogH) return false;
    return fog[gy * fogW + gx] > 0;
  }

  function updateFog() {
    for (let i = 0; i < fog.length; i++) if (fog[i] === 2) fog[i] = 1;
    const visionSources = [
      ...units.filter(u => u.team === "player" && u.hp > 0),
      ...objects.filter(o => o.team === "player" && (o.hp === undefined || o.hp > 0))
    ];
    for (const s of visionSources) {
      const vision = s.vision || 250;
      const gx0 = clamp(Math.floor((s.x - vision) / fogCell), 0, fogW-1);
      const gy0 = clamp(Math.floor((s.y - vision) / fogCell), 0, fogH-1);
      const gx1 = clamp(Math.floor((s.x + vision) / fogCell), 0, fogW-1);
      const gy1 = clamp(Math.floor((s.y + vision) / fogCell), 0, fogH-1);
      for (let gy = gy0; gy <= gy1; gy++) {
        for (let gx = gx0; gx <= gx1; gx++) {
          const cx = gx * fogCell + fogCell/2, cy = gy * fogCell + fogCell/2;
          if (Math.hypot(cx - s.x, cy - s.y) <= vision) fog[gy*fogW+gx] = 2;
        }
      }
    }
  }

  function findAt(world, teamFilter = null) {
    let candidates = [];
    for (const u of units) {
      if (u.hp <= 0) continue;
      if (teamFilter && u.team !== teamFilter) continue;
      if (u.team === "enemy" && !isVisibleWorld(u.x, u.y)) continue;
      if (Math.hypot(u.x - world.x, u.y - world.y) <= u.r + 12) candidates.push(u);
    }
    for (const o of objects) {
      if (o.hp !== undefined && o.hp <= 0) continue;
      if (teamFilter && o.team !== teamFilter) continue;
      if (o.team === "enemy" && !isVisibleWorld(o.x, o.y)) continue;
      if (Math.hypot(o.x - world.x, o.y - world.y) <= o.r + 10) candidates.push(o);
    }
    candidates.sort((a,b) => (a.r || 20) - (b.r || 20));
    return candidates[0] || null;
  }

  function clearSelection() {
    for (const u of units) u.selected = false;
    state.selected = [];
  }

  function selectUnits(list) {
    clearSelection();
    state.selected = list.filter(u => u && u.team === "player" && u.hp > 0);
    for (const u of state.selected) u.selected = true;
    if (state.selected.length === 1) msg(`${state.selected[0].name} selected.`);
    else if (state.selected.length > 1) msg(`${state.selected.length} units selected.`);
    updateSelectedCard();
  }

  function updateSelectedCard() {
    state.selected = state.selected.filter(u => u.hp > 0);
    if (state.selected.length === 0) {
      selectedNameEl.textContent = "No unit selected";
      selectedInfoEl.textContent = "Tap or two-finger drag select.";
      counterInfoEl.textContent = "Counters: Spear > Cavalry > Archer > Swordsman > Spear";
      return;
    }
    if (state.selected.length === 1) {
      const u = state.selected[0];
      const info = unitInfo[u.type] || { label: u.name, strong: "-", weak: "-" };
      selectedNameEl.textContent = info.label;
      selectedInfoEl.textContent = `HP ${Math.max(0, Math.floor(u.hp))}/${u.maxHp} • ${u.task}`;
      counterInfoEl.textContent = `Strong vs ${info.strong} • Weak vs ${info.weak}`;
      return;
    }
    const counts = {};
    for (const u of state.selected) counts[u.type] = (counts[u.type] || 0) + 1;
    selectedNameEl.textContent = `${state.selected.length} units selected`;
    selectedInfoEl.textContent = Object.entries(counts).map(([k,v]) => `${v} ${unitInfo[k]?.label || k}`).join(" • ");
    counterInfoEl.textContent = "Mixed army selected. Use counters to win fights.";
  }

  function orderMoveGroup(x, y) {
    const selected = state.selected.filter(u => u.hp > 0);
    if (selected.length === 0) return msg("Select units first.");
    const spread = Math.max(30, Math.min(90, selected.length * 9));
    selected.forEach((u, i) => {
      const angle = (i / Math.max(1, selected.length)) * Math.PI * 2;
      const ring = selected.length === 1 ? 0 : spread;
      u.tx = clamp(x + Math.cos(angle) * ring, 40, state.mapW - 40);
      u.ty = clamp(y + Math.sin(angle) * ring, 40, state.mapH - 40);
      u.task = "move";
      u.target = null;
    });
    msg(`Moving ${selected.length} unit${selected.length > 1 ? "s" : ""}.`);
  }

  function orderAttackGroup(target) {
    if (state.selected.length === 0) return msg("Select units first.");
    for (const u of state.selected) {
      u.target = target;
      u.task = "attack";
    }
    msg(`Attacking ${target.name || target.type}.`);
  }

  function nearestObject(u, type) {
    let best = null, bd = Infinity;
    for (const o of objects) {
      if (o.type !== type) continue;
      if ((type === "tree" || type === "mine") && (o.resource || 0) <= 0) continue;
      if (o.hp !== undefined && o.hp <= 0) continue;
      const d = Math.hypot(o.x - u.x, o.y - u.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  function nearestEnemy(u) {
    let best = null, bd = Infinity;
    for (const v of units) {
      if (v.team !== u.team && v.hp > 0 && (v.team !== "enemy" || isVisibleWorld(v.x, v.y))) {
        const d = Math.hypot(v.x - u.x, v.y - u.y);
        if (d < bd) { bd = d; best = v; }
      }
    }
    for (const o of objects) {
      if (o.team !== u.team && o.team !== "neutral" && o.hp > 0 && (o.team !== "enemy" || isVisibleWorld(o.x, o.y))) {
        const d = Math.hypot(o.x - u.x, o.y - u.y);
        if (d < bd) { bd = d; best = o; }
      }
    }
    return best;
  }

  function nearestPlayerAsset(enemy) {
    let best = playerKeep, bd = Infinity;
    for (const u of units) {
      if (u.team === "player" && u.hp > 0) {
        const d = Math.hypot(enemy.x - u.x, enemy.y - u.y);
        if (d < bd) { bd = d; best = u; }
      }
    }
    for (const o of objects) {
      if (o.team === "player" && o.hp > 0) {
        const d = Math.hypot(enemy.x - o.x, enemy.y - o.y);
        if (d < bd) { bd = d; best = o; }
      }
    }
    return best;
  }

  function orderGatherType(type) {
    const workers = state.selected.filter(u => u.type === "worker" && u.hp > 0);
    if (!workers.length) return msg("Select one or more workers.");
    for (const u of workers) {
      u.target = nearestObject(u, type);
      u.task = u.target ? (type === "mine" ? "mine" : "chop") : "idle";
    }
    msg(`${workers.length} worker${workers.length > 1 ? "s" : ""} ordered to ${type === "mine" ? "mine" : "chop trees"}.`);
  }

  function train(type) {
    const specs = {
      worker: { cost: 35, unit: { type: "worker", team: "player", name: "Worker", r: 16, speed: 102, maxHp: 80, attack: 5, range: 24, vision: 260 } },
      sword: { cost: 55, unit: { type: "sword", team: "player", name: "Swordsman", r: 19, speed: 86, maxHp: 155, attack: 19, range: 32, vision: 300 } },
      spear: { cost: 50, unit: { type: "spear", team: "player", name: "Spearman", r: 19, speed: 84, maxHp: 140, attack: 17, range: 39, vision: 300 } },
      archer: { cost: 60, unit: { type: "archer", team: "player", name: "Archer", r: 17, speed: 90, maxHp: 95, attack: 14, range: 190, vision: 340 } },
      cavalry: { cost: 90, unit: { type: "cavalry", team: "player", name: "Cavalry", r: 25, speed: 132, maxHp: 180, attack: 22, range: 39, vision: 340 } }
    };
    const s = specs[type];
    if (!s) return;
    if (livingPlayerUnits().length >= state.unitCap) return msg("Unit cap reached.");
    if (state.resource < s.cost) return msg(`Need ${s.cost} Resource.`);
    state.resource -= s.cost;
    const u = addUnit(Object.assign({}, s.unit, { x: playerKeep.x + rand(-90,90), y: playerKeep.y + rand(80,120) }));
    if (u) selectUnits([u]);
    msg(`${s.unit.name} trained.`);
  }

  function startPlacement(kind) {
    const cost = kind === "farm" ? 90 : 120;
    if (state.resource < cost) return msg(`Need ${cost} Resource.`);
    if (!state.selected.some(u => u.type === "worker")) return msg("Select a worker before placing a building.");
    state.mode = kind === "farm" ? "placeFarm" : "placeTower";
    state.placement = { type: kind };
    msg(`${kind === "farm" ? "Farm" : "Tower"} placement: tap the map near a worker.`);
    refreshButtonState();
  }

  function placeBuilding(x, y, kind) {
    const cost = kind === "farm" ? 90 : 120;
    const nearWorker = state.selected.some(u => u.type === "worker" && Math.hypot(u.x - x, u.y - y) < 280);
    if (!nearWorker) return msg("Place within worker building range.");
    if (state.resource < cost) return msg(`Need ${cost} Resource.`);
    state.resource -= cost;
    if (kind === "farm") {
      addObject({ type: "farm", team: "player", name: "Farm", x, y, r: 50, hp: 350, maxHp: 350, incomeTimer: 0, vision: 270 });
      msg("Farm built. It generates Resource over time.");
    } else {
      addObject({ type: "tower", team: "player", name: "Watchtower", x, y, r: 39, hp: 300, maxHp: 300, cooldown: 0, vision: 330 });
      msg("Watchtower built.");
    }
    state.mode = "normal";
    state.placement = null;
    refreshButtonState();
  }

  buttons.worker.onclick = () => train("worker");
  buttons.sword.onclick = () => train("sword");
  buttons.spear.onclick = () => train("spear");
  buttons.archer.onclick = () => train("archer");
  buttons.cavalry.onclick = () => train("cavalry");
  buttons.farm.onclick = () => startPlacement("farm");
  buttons.tower.onclick = () => startPlacement("tower");
  buttons.gather.onclick = () => orderGatherType("tree");
  buttons.mine.onclick = () => orderGatherType("mine");
  buttons.attack.onclick = () => { state.mode = "attack"; msg("Attack mode: tap an enemy target."); refreshButtonState(); };
  menuBtn.onclick = () => {
    state.showHelp = !state.showHelp;
    helpPanel.style.display = state.showHelp ? "" : "none";
  };

  function refreshButtonState() {
    for (const k in buttons) buttons[k].classList.remove("active");
    if (state.mode === "attack") buttons.attack.classList.add("active");
    if (state.mode === "placeFarm") buttons.farm.classList.add("active");
    if (state.mode === "placeTower") buttons.tower.classList.add("active");
  }

  function damage(target, baseAmount, attacker) {
    if (!target || target.hp === undefined) return;
    const mod = attacker ? damageModifier(attacker, target) : 1;
    const amount = baseAmount * mod;
    target.hp -= amount;
    const label = mod > 1 ? "STRONG" : (mod < 1 ? "WEAK" : "");
    effects.push({ x: target.x, y: target.y - (target.r || 20), text: `${label} -${Math.floor(amount)}`, life: .75, kind: "text", mod });
    if (target.hp <= 0) {
      if (target === playerKeep) {
        state.gameOver = true;
        msg("Your keep has fallen. Refresh to restart.");
      }
      if (target === enemyCamp) msg("Victory! The Dark Legion Camp has fallen.");
    }
  }

  function moveToward(u, dt) {
    const dx = u.tx - u.x, dy = u.ty - u.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return;
    const step = Math.min(d, u.speed * dt);
    u.x += dx / d * step;
    u.y += dy / d * step;
    u.facing = dx >= 0 ? 1 : -1;
    u.anim += dt * (u.type === "cavalry" || u.type === "warg" ? 11 : 8);
    u.x = clamp(u.x, 20, state.mapW - 20);
    u.y = clamp(u.y, 20, state.mapH - 20);
  }

  function updateGathering(u, dt, kind) {
    const t = u.target;
    if (!t || (t.resource || 0) <= 0) {
      u.target = nearestObject(u, kind === "mine" ? "mine" : "tree");
      if (!u.target) u.task = "idle";
      return;
    }
    const d = Math.hypot(t.x - u.x, t.y - u.y);
    if (d > u.r + t.r + 10) {
      u.tx = t.x; u.ty = t.y; moveToward(u, dt);
    } else if (u.cooldown <= 0) {
      const gained = Math.min(kind === "mine" ? 14 : 9, t.resource);
      t.resource -= gained;
      state.resource += gained;
      u.cooldown = kind === "mine" ? 1.05 : 0.80;
      u.anim += 1;
      effects.push({ x: t.x, y: t.y - t.r, text: `+${Math.floor(gained)}`, life: .55, kind: "gain" });
      if (t.type === "tree" && t.resource <= 0) effects.push({ x: t.x, y: t.y, text: "stump", life: .85, kind: "text" });
    }
  }

  function updateUnit(u, dt) {
    if (u.hp <= 0) return;
    u.cooldown = Math.max(0, u.cooldown - dt);

    if (u.team === "enemy") {
      const target = nearestPlayerAsset(u);
      if (target) { u.target = target; u.task = "attack"; }
    }

    if (u.task === "chop") return updateGathering(u, dt, "tree");
    if (u.task === "mine") return updateGathering(u, dt, "mine");

    if (u.task === "attack") {
      let t = u.target;
      if (!t || t.hp <= 0) { t = nearestEnemy(u); u.target = t; }
      if (!t) { u.task = "idle"; return; }
      const d = Math.hypot(t.x - u.x, t.y - u.y);
      if (d > u.range + (t.r || 20)) {
        u.tx = t.x; u.ty = t.y; moveToward(u, dt);
      } else if (u.cooldown <= 0) {
        damage(t, u.attack, u);
        u.cooldown = (u.type === "archer" || u.type === "darkarcher") ? 1.25 : (u.type === "cavalry" || u.type === "warg" ? .95 : 1.05);
        u.anim += 1.5;
        if (u.range > 80) effects.push({ x: u.x, y: u.y, tx: t.x, ty: t.y, life: .18, kind: "arrow" });
      }
      return;
    }

    if (u.task === "move") {
      moveToward(u, dt);
      if (Math.hypot(u.tx - u.x, u.ty - u.y) < 5) u.task = "idle";
    }

    if (u.team === "player" && u.task === "idle" && u.type !== "worker") {
      const e = nearestEnemy(u);
      if (e && Math.hypot(e.x-u.x, e.y-u.y) < u.range + 60) {
        u.target = e; u.task = "attack";
      }
    }
  }

  function updateBuildings(dt) {
    for (const o of objects) {
      if (o.hp !== undefined && o.hp <= 0) continue;
      if (o.type === "farm" && o.team === "player") {
        o.incomeTimer += dt;
        if (o.incomeTimer >= 1.55) {
          o.incomeTimer = 0;
          state.resource += 6;
          effects.push({ x: o.x, y: o.y - o.r, text: "+6", life: .45, kind: "gain" });
        }
      }
      if (o.type === "slaughterhouse" && o.team === "enemy") {
        o.incomeTimer += dt;
        if (o.incomeTimer >= 4.5) {
          o.incomeTimer = 0;
          state.enemySpawnTimer += 3.4;
        }
      }
      if (o.type === "tower" && o.team === "player") {
        o.cooldown = Math.max(0, (o.cooldown || 0) - dt);
        let target = null, bd = 310;
        for (const e of units) {
          if (e.team === "enemy" && e.hp > 0 && isVisibleWorld(e.x, e.y)) {
            const d = Math.hypot(e.x - o.x, e.y - o.y);
            if (d < bd) { bd = d; target = e; }
          }
        }
        if (target && o.cooldown <= 0) {
          damage(target, 23, { type: "archer" });
          o.cooldown = 1.08;
          effects.push({ x: o.x, y: o.y, tx: target.x, ty: target.y, life: .2, kind: "bolt" });
        }
      }
    }
  }

  function enemySpawner(dt) {
    if (enemyCamp.hp <= 0 || state.gameOver) return;
    state.enemySpawnTimer += dt;
    if (state.enemySpawnTimer > 14) {
      state.enemySpawnTimer = 0;
      const roll = Math.random();
      let spec;
      if (roll < .30) spec = { type: "raider", name: "Dark Swordsman", r: 19, speed: 78, maxHp: 128, attack: 16, range: 31, vision: 280 };
      else if (roll < .55) spec = { type: "impaler", name: "Dark Spearman", r: 19, speed: 76, maxHp: 128, attack: 15, range: 39, vision: 280 };
      else if (roll < .80) spec = { type: "darkarcher", name: "Dark Archer", r: 17, speed: 82, maxHp: 88, attack: 13, range: 175, vision: 320 };
      else spec = { type: "warg", name: "Warg Rider", r: 25, speed: 122, maxHp: 165, attack: 20, range: 39, vision: 320 };
      addUnit(Object.assign(spec, { team: "enemy", x: enemyCamp.x + rand(-85, 85), y: enemyCamp.y + rand(-85, 85) }));
      msg("Enemy reinforcements are moving through the fog.");
    }
  }

  function update(dt) {
    if (state.gameOver) return;
    state.time += dt;
    updateFog();
    for (const u of units) updateUnit(u, dt);
    updateBuildings(dt);
    enemySpawner(dt);

    for (let i = effects.length - 1; i >= 0; i--) {
      effects[i].life -= dt;
      if (effects[i].life <= 0) effects.splice(i, 1);
    }

    resourceEl.textContent = Math.floor(state.resource);
    unitCountEl.textContent = livingPlayerUnits().length;
    updateSelectedCard();
  }

  function drawGround() {
    const topLeft = screenToWorld(0, 0);
    ctx.save();
    ctx.translate(W/2 - state.camera.x * state.camera.zoom, H/2 - state.camera.y * state.camera.zoom);
    ctx.scale(state.camera.zoom, state.camera.zoom);

    ctx.fillStyle = terrain.grass;
    ctx.fillRect(0, 0, state.mapW, state.mapH);

    // Dark grass patches.
    ctx.fillStyle = terrain.darkGrass;
    [[250,300,460,360],[1030,240,470,330],[1320,1320,600,360],[2240,320,430,300],[400,1100,500,430]].forEach(p => {
      ctx.globalAlpha = .55;
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], p[2]/2, p[3]/2, .2, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // River.
    ctx.strokeStyle = terrain.river;
    ctx.lineWidth = 58;
    ctx.beginPath();
    ctx.moveTo(1360, -100);
    ctx.bezierCurveTo(1600, 420, 1210, 960, 1720, 2000);
    ctx.stroke();
    ctx.strokeStyle = "rgba(180,220,240,.22)";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(1340, -100);
    ctx.bezierCurveTo(1580, 420, 1190, 960, 1700, 2000);
    ctx.stroke();

    // Road.
    ctx.strokeStyle = terrain.road;
    ctx.lineWidth = 34;
    ctx.beginPath();
    ctx.moveTo(470, 520);
    ctx.quadraticCurveTo(1320, 800, 2140, 1210);
    ctx.stroke();

    // Mine trail.
    ctx.strokeStyle = "rgba(130,100,55,.25)";
    ctx.lineWidth = 18;
    ctx.beginPath(); ctx.moveTo(440,1390); ctx.lineTo(1290,850); ctx.lineTo(2320,540); ctx.stroke();

    ctx.strokeStyle = "rgba(255,220,130,.35)";
    ctx.lineWidth = 4;
    ctx.strokeRect(0,0,state.mapW,state.mapH);

    ctx.restore();
  }

  function drawHealth(e) {
    if (e.hp === undefined || e.maxHp === undefined || e.hp <= 0) return;
    const s = worldToScreen(e.x, e.y - e.r - 15);
    const w = Math.max(30, e.r * 2.1 * state.camera.zoom);
    ctx.fillStyle = "rgba(0,0,0,.62)";
    ctx.fillRect(s.x - w/2, s.y, w, 5);
    ctx.fillStyle = e.team === "player" ? "#5fe879" : "#ff5548";
    ctx.fillRect(s.x - w/2, s.y, w * clamp(e.hp / e.maxHp, 0, 1), 5);
  }

  function drawResourceBar(o) {
    if (o.resource === undefined || o.maxResource === undefined || o.resource <= 0) return;
    const s = worldToScreen(o.x, o.y + o.r + 9);
    const w = Math.max(34, o.r * 1.55 * state.camera.zoom);
    ctx.fillStyle = "rgba(0,0,0,.58)";
    ctx.fillRect(s.x - w/2, s.y, w, 4);
    ctx.fillStyle = "#d8a94a";
    ctx.fillRect(s.x - w/2, s.y, w * clamp(o.resource / o.maxResource, 0, 1), 4);
  }

  function drawObject(o) {
    if (o.hp !== undefined && o.hp <= 0) return;
    if (o.team === "enemy" && !isVisibleWorld(o.x, o.y)) return;
    if (o.team === "neutral" && !isExploredWorld(o.x, o.y)) return;

    const s = worldToScreen(o.x, o.y);
    const r = o.r * state.camera.zoom;
    ctx.save();
    ctx.translate(s.x, s.y);

    if (o.type === "tree") {
      if ((o.resource || 0) <= 0) {
        ctx.fillStyle = "#6b4b2d";
        ctx.beginPath(); ctx.ellipse(0, 0, r*.50, r*.34, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = "#b88b53"; ctx.lineWidth = Math.max(1, r*.08);
        ctx.beginPath(); ctx.moveTo(-r*.25, -r*.06); ctx.lineTo(r*.25, r*.07); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, r*.23, 0, Math.PI*2); ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(0,0,0,.28)";
        ctx.beginPath(); ctx.ellipse(0, r*.34, r*.78, r*.25, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#392313"; ctx.fillRect(-r*.16, r*.04, r*.32, r*.62);
        const greens = ["#153f1b", "#1d5523", "#254d1f"];
        ctx.fillStyle = greens[o.variant || 0];
        ctx.beginPath(); ctx.arc(0, -r*.16, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "rgba(70,130,50,.58)";
        ctx.beginPath(); ctx.arc(-r*.24, -r*.30, r*.52, 0, Math.PI*2); ctx.fill();
      }
    }

    if (o.type === "mine") {
      const depleted = (o.resource || 0) <= 0;
      ctx.fillStyle = depleted ? "#3c3b36" : "#5d5b51";
      ctx.beginPath(); ctx.ellipse(0, r*.05, r, r*.72, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = depleted ? "#1a1714" : "#211b14";
      ctx.beginPath(); ctx.arc(-r*.12, 0, r*.55, Math.PI, 0); ctx.lineTo(r*.43, r*.45); ctx.lineTo(-r*.66, r*.45); ctx.closePath(); ctx.fill();
      if (!depleted) {
        ctx.fillStyle = "#e0b95e";
        for (let i=0; i<5; i++) {
          const xs = [-.42,-.22,0,.18,.40][i] * r;
          ctx.beginPath(); ctx.arc(xs, r*.42 + (i%2)*r*.08, r*.08, 0, Math.PI*2); ctx.fill();
        }
      }
    }

    if (o.type === "keep") {
      ctx.fillStyle = "#837b6b"; ctx.fillRect(-r*.86, -r*.62, r*1.72, r*1.25);
      ctx.fillStyle = "#334f99";
      ctx.beginPath(); ctx.moveTo(-r*.62, -r*1.05); ctx.lineTo(-r*.42, -r*1.38); ctx.lineTo(-r*.22, -r*1.05); ctx.fill();
      ctx.beginPath(); ctx.moveTo(r*.22, -r*1.05); ctx.lineTo(r*.42, -r*1.38); ctx.lineTo(r*.62, -r*1.05); ctx.fill();
      ctx.fillStyle = "#51483d"; ctx.fillRect(-r*.64, -r*1.03, r*.42, r*.48); ctx.fillRect(r*.22, -r*1.03, r*.42, r*.48);
      ctx.fillStyle = "#25180f"; ctx.fillRect(-r*.23, r*.07, r*.46, r*.57);
      drawLabel("KEEP", r);
    }

    if (o.type === "farm") {
      ctx.fillStyle = "#8a6733"; ctx.fillRect(-r, -r*.48, r*1.85, r*1.0);
      ctx.fillStyle = "#2e5f29";
      for (let i=-3;i<=3;i++) ctx.fillRect(i*r*.25, r*.45, r*.09, r*.55);
      ctx.fillStyle = "#2b4f94"; ctx.beginPath(); ctx.moveTo(-r, -r*.48); ctx.lineTo(-r*.08, -r*1.08); ctx.lineTo(r*.84, -r*.48); ctx.fill();
    }

    if (o.type === "slaughterhouse") {
      ctx.fillStyle = "#3d1d17"; ctx.fillRect(-r, -r*.5, r*1.9, r*1.1);
      ctx.fillStyle = "#111"; ctx.beginPath(); ctx.moveTo(-r, -r*.5); ctx.lineTo(-r*.05, -r*1.14); ctx.lineTo(r*.9, -r*.5); ctx.fill();
      ctx.fillStyle = "#b12d24"; ctx.fillRect(-r*.2, r*.05, r*.35, r*.5);
    }

    if (o.type === "tower") {
      ctx.fillStyle = "#69675f"; ctx.fillRect(-r*.43, -r*.95, r*.86, r*1.58);
      ctx.fillStyle = "#2f4f9a"; ctx.beginPath(); ctx.moveTo(-r*.74, -r*.95); ctx.lineTo(0, -r*1.36); ctx.lineTo(r*.74, -r*.95); ctx.fill();
      ctx.fillStyle = "#f1d27d"; ctx.fillRect(-r*.16, -r*.73, r*.32, r*.20);
    }

    if (o.type === "camp") {
      ctx.fillStyle = "#351b18"; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "#111"; ctx.beginPath(); ctx.moveTo(-r*.72, r*.25); ctx.lineTo(0, -r*.95); ctx.lineTo(r*.72, r*.25); ctx.fill();
      ctx.fillStyle = "#c53c2b"; ctx.beginPath(); ctx.arc(0, -r*.10, r*.18, 0, Math.PI*2); ctx.fill();
      drawLabel("DARK CAMP", r);
    }

    ctx.restore();
    drawHealth(o);
    drawResourceBar(o);
  }

  function drawLabel(text, r) {
    ctx.fillStyle = "#ffe59a";
    ctx.font = `${Math.max(10, 12*state.camera.zoom)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(text, 0, -r-10);
  }

  function drawSelectionRing(u) {
    const s = worldToScreen(u.x, u.y);
    const r = (u.r + 10) * state.camera.zoom;
    const pulse = Math.sin(state.time * 5) * 2;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.strokeStyle = "#41c7ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 8 * state.camera.zoom, r + pulse, (r * .45) + pulse, 0, 0, Math.PI*2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(65,199,255,.24)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(0, 8 * state.camera.zoom, r + 5 + pulse, (r * .48) + pulse, 0, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }

  function drawUnit(u) {
    if (u.hp <= 0) return;
    if (u.team === "enemy" && !isVisibleWorld(u.x, u.y)) return;

    if (u.selected) drawSelectionRing(u);

    const s = worldToScreen(u.x, u.y);
    const scale = state.camera.zoom * (u.type === "cavalry" || u.type === "warg" ? 1.05 : .92);
    const frameW = 72, frameH = 72;
    const sheet = sprites[(u.team === "player" ? "player_" : "enemy_") + u.type] || sprites.player_sword;
    const frame = Math.floor(u.anim) % 8;

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.scale(u.facing, 1);
    ctx.drawImage(sheet, frame * frameW, 0, frameW, frameH, -frameW/2 * scale, -frameH/2 * scale, frameW * scale, frameH * scale);
    ctx.restore();
    drawHealth(u);
  }

  function drawEffects() {
    for (const e of effects) {
      if (e.kind === "arrow" || e.kind === "bolt") {
        const a = worldToScreen(e.x, e.y), b = worldToScreen(e.tx, e.ty);
        ctx.strokeStyle = e.kind === "bolt" ? "#ffe39b" : "#f8f1c2";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      } else {
        const s = worldToScreen(e.x, e.y);
        if (e.kind === "gain") ctx.fillStyle = `rgba(255,220,100,${clamp(e.life * 2, 0, 1)})`;
        else if (e.mod > 1) ctx.fillStyle = `rgba(80,255,110,${clamp(e.life * 2, 0, 1)})`;
        else if (e.mod < 1) ctx.fillStyle = `rgba(255,90,70,${clamp(e.life * 2, 0, 1)})`;
        else ctx.fillStyle = `rgba(255,230,140,${clamp(e.life * 2, 0, 1)})`;
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(e.text, s.x, s.y - (1-e.life)*24);
      }
    }
  }

  function drawPlacement() {
    if (state.mode !== "placeFarm" && state.mode !== "placeTower") return;
    const w = lastPointerWorld || screenToWorld(W/2, H/2);
    const s = worldToScreen(w.x, w.y);
    const r = (state.mode === "placeFarm" ? 50 : 39) * state.camera.zoom;
    ctx.strokeStyle = "rgba(255,224,112,.95)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle = "rgba(255,224,112,.25)";
    ctx.beginPath(); ctx.arc(s.x, s.y, 280 * state.camera.zoom, 0, Math.PI*2); ctx.stroke();
  }

  function drawDragRect() {
    if (!state.dragRect) return;
    const r = state.dragRect;
    ctx.strokeStyle = "#41c7ff";
    ctx.fillStyle = "rgba(65,199,255,.12)";
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }

  function drawFog() {
    const topLeft = screenToWorld(0, 0);
    const botRight = screenToWorld(W, H);
    const gx0 = clamp(Math.floor(topLeft.x / fogCell) - 1, 0, fogW-1);
    const gy0 = clamp(Math.floor(topLeft.y / fogCell) - 1, 0, fogH-1);
    const gx1 = clamp(Math.floor(botRight.x / fogCell) + 1, 0, fogW-1);
    const gy1 = clamp(Math.floor(botRight.y / fogCell) + 1, 0, fogH-1);

    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const v = fog[gy*fogW+gx];
        if (v === 2) continue;
        const s = worldToScreen(gx*fogCell, gy*fogCell);
        const size = fogCell * state.camera.zoom + 1;
        ctx.fillStyle = v === 1 ? "rgba(0,0,0,.38)" : "rgba(0,0,0,.88)";
        ctx.fillRect(s.x, s.y, size, size);
      }
    }
  }

  function renderMinimap() {
    mctx.clearRect(0,0,MW,MH);
    mctx.save();
    mctx.beginPath();
    mctx.arc(MW/2, MH/2, Math.min(MW,MH)/2 - 2, 0, Math.PI*2);
    mctx.clip();

    mctx.fillStyle = "#1d3318"; mctx.fillRect(0,0,MW,MH);
    function px(x) { return x / state.mapW * MW; }
    function py(y) { return y / state.mapH * MH; }

    mctx.strokeStyle = "rgba(56,120,150,.65)";
    mctx.lineWidth = 6;
    mctx.beginPath(); mctx.moveTo(px(1360), py(0)); mctx.bezierCurveTo(px(1600), py(420), px(1210), py(960), px(1720), py(1900)); mctx.stroke();

    for (const o of objects) {
      if (o.hp !== undefined && o.hp <= 0) continue;
      if (!isExploredWorld(o.x, o.y)) continue;
      if (o.type === "tree" && o.resource <= 0) continue;
      if (o.type === "tree") mctx.fillStyle = "#2d7a2d";
      else if (o.type === "mine") mctx.fillStyle = "#d8a94a";
      else mctx.fillStyle = o.team === "enemy" ? "#e04b38" : "#e6d28f";
      const size = o.type === "keep" || o.type === "camp" ? 5 : 3;
      mctx.fillRect(px(o.x)-size/2, py(o.y)-size/2, size, size);
    }

    for (const u of units) {
      if (u.hp <= 0) continue;
      if (u.team === "enemy" && !isVisibleWorld(u.x, u.y)) continue;
      if (u.team === "player" || isVisibleWorld(u.x, u.y)) {
        mctx.fillStyle = u.team === "enemy" ? "#ff4a3d" : "#3aa9ff";
        mctx.fillRect(px(u.x)-2, py(u.y)-2, 4, 4);
      }
    }

    // Minimap fog overlay.
    for (let gy = 0; gy < fogH; gy++) {
      for (let gx = 0; gx < fogW; gx++) {
        const v = fog[gy*fogW+gx];
        if (v === 2) continue;
        mctx.fillStyle = v === 1 ? "rgba(0,0,0,.35)" : "rgba(0,0,0,.8)";
        mctx.fillRect(px(gx*fogCell), py(gy*fogCell), px(fogCell)+1, py(fogCell)+1);
      }
    }

    const tl = screenToWorld(0,0), br = screenToWorld(W,H);
    mctx.strokeStyle = "#fff0a0";
    mctx.lineWidth = 1;
    mctx.strokeRect(px(tl.x), py(tl.y), px(br.x)-px(tl.x), py(br.y)-py(tl.y));
    mctx.restore();

    mctx.strokeStyle = "rgba(255,220,130,.72)";
    mctx.lineWidth = 2;
    mctx.beginPath(); mctx.arc(MW/2, MH/2, Math.min(MW,MH)/2 - 2, 0, Math.PI*2); mctx.stroke();
  }

  function render() {
    ctx.clearRect(0,0,W,H);
    drawGround();
    const drawables = [...objects, ...units].sort((a,b) => (a.y || 0) - (b.y || 0));
    for (const item of drawables) {
      if (units.includes(item)) drawUnit(item);
      else drawObject(item);
    }
    drawEffects();
    drawPlacement();
    drawDragRect();
    drawFog();
    renderMinimap();
  }

  let touchState = {
    panning: false,
    dragSelecting: false,
    lastX: 0, lastY: 0,
    startX: 0, startY: 0,
    startTime: 0,
    pinchDist: 0,
    startZoom: 1,
    twoStartMid: null
  };

  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      touchState.panning = true;
      touchState.dragSelecting = false;
      touchState.lastX = touchState.startX = t.clientX;
      touchState.lastY = touchState.startY = t.clientY;
      touchState.startTime = performance.now();
      lastPointerWorld = screenToWorld(t.clientX, t.clientY);
    } else if (e.touches.length === 2) {
      const a = e.touches[0], b = e.touches[1];
      const d = Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY);
      const mid = { x: (a.clientX+b.clientX)/2, y: (a.clientY+b.clientY)/2 };
      touchState.pinchDist = d;
      touchState.startZoom = state.camera.zoom;
      touchState.twoStartMid = mid;
      touchState.dragSelecting = false;
      state.dragRect = null;
    }
  }, { passive: false });

  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();

    if (e.touches.length === 1 && touchState.panning) {
      const t = e.touches[0];
      const dx = t.clientX - touchState.lastX;
      const dy = t.clientY - touchState.lastY;
      lastPointerWorld = screenToWorld(t.clientX, t.clientY);
      state.camera.x -= dx / state.camera.zoom;
      state.camera.y -= dy / state.camera.zoom;
      state.camera.x = clamp(state.camera.x, 0, state.mapW);
      state.camera.y = clamp(state.camera.y, 0, state.mapH);
      touchState.lastX = t.clientX;
      touchState.lastY = t.clientY;
    } else if (e.touches.length === 2) {
      const a = e.touches[0], b = e.touches[1];
      const d = Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY);
      const mid = { x: (a.clientX+b.clientX)/2, y: (a.clientY+b.clientY)/2 };
      lastPointerWorld = screenToWorld(mid.x, mid.y);

      const pinchRatio = d / Math.max(1, touchState.pinchDist);
      const midMove = Math.hypot(mid.x - touchState.twoStartMid.x, mid.y - touchState.twoStartMid.y);

      if (Math.abs(pinchRatio - 1) > .08) {
        state.camera.zoom = clamp(touchState.startZoom * pinchRatio, .55, 2.35);
      } else if (midMove > 18) {
        touchState.dragSelecting = true;
        const x1 = touchState.twoStartMid.x, y1 = touchState.twoStartMid.y;
        state.dragRect = {
          x: Math.min(x1, mid.x),
          y: Math.min(y1, mid.y),
          w: Math.abs(mid.x - x1),
          h: Math.abs(mid.y - y1)
        };
      }
    }
  }, { passive: false });

  canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    if (e.touches.length > 0) return;

    if (touchState.dragSelecting && state.dragRect) {
      selectByRect(state.dragRect);
      state.dragRect = null;
      touchState.dragSelecting = false;
      return;
    }

    const moved = Math.hypot(touchState.lastX - touchState.startX, touchState.lastY - touchState.startY);
    const elapsed = performance.now() - touchState.startTime;

    if (moved < 12 && elapsed < 380) handleTap(touchState.startX, touchState.startY);
    touchState.panning = false;
  }, { passive: false });

  canvas.addEventListener("mousemove", (e) => { lastPointerWorld = screenToWorld(e.clientX, e.clientY); });
  canvas.addEventListener("click", (e) => handleTap(e.clientX, e.clientY));

  function selectByRect(r) {
    const x1 = r.x, y1 = r.y, x2 = r.x + r.w, y2 = r.y + r.h;
    const list = livingPlayerUnits().filter(u => {
      const s = worldToScreen(u.x, u.y);
      return s.x >= x1 && s.x <= x2 && s.y >= y1 && s.y <= y2;
    });
    if (list.length) selectUnits(list);
    else msg("No units in selection box.");
  }

  function handleTap(sx, sy) {
    const world = screenToWorld(sx, sy);
    lastPointerWorld = world;

    if (state.mode === "placeFarm" || state.mode === "placeTower") {
      placeBuilding(world.x, world.y, state.mode === "placeFarm" ? "farm" : "tower");
      return;
    }

    const hitPlayer = findAt(world, "player");
    const hitEnemy = findAt(world, "enemy");
    const hitAny = findAt(world);

    if (state.mode === "attack") {
      if (hitEnemy) {
        orderAttackGroup(hitEnemy);
        state.mode = "normal";
        refreshButtonState();
      } else msg("Attack mode: tap a visible enemy target.");
      return;
    }

    if (hitPlayer && units.includes(hitPlayer)) {
      selectUnits([hitPlayer]);
      return;
    }

    if (state.selected.length) {
      if (hitEnemy) orderAttackGroup(hitEnemy);
      else if (hitAny && hitAny.type === "tree") {
        const workers = state.selected.filter(u => u.type === "worker");
        for (const u of workers) { u.target = hitAny; u.task = "chop"; }
        if (workers.length) msg(`${workers.length} worker${workers.length > 1 ? "s" : ""} chopping selected tree.`);
        else msg("Only workers can gather.");
      } else if (hitAny && hitAny.type === "mine") {
        const workers = state.selected.filter(u => u.type === "worker");
        for (const u of workers) { u.target = hitAny; u.task = "mine"; }
        if (workers.length) msg(`${workers.length} worker${workers.length > 1 ? "s" : ""} mining Resource.`);
        else msg("Only workers can mine.");
      } else orderMoveGroup(world.x, world.y);
    } else {
      if (hitEnemy) msg(`${hitEnemy.name || hitEnemy.type}: enemy target.`);
      else if (hitAny && hitAny.type === "mine") msg("Resource Mine: select workers and tap it, or use Mine.");
      else msg("Tap or two-finger drag to select your units.");
    }
  }

  minimap.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const rect = minimap.getBoundingClientRect();
    const t = e.touches[0];
    const x = (t.clientX - rect.left) / rect.width * state.mapW;
    const y = (t.clientY - rect.top) / rect.height * state.mapH;
    state.camera.x = clamp(x, 0, state.mapW);
    state.camera.y = clamp(y, 0, state.mapH);
  }, { passive: false });

  function loop(t) {
    const dt = Math.min(0.05, (t - state.lastTime) / 1000 || 0);
    state.lastTime = t;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  updateFog();
  msg("V4 loaded: sprite units, animated movement, textured terrain, selection rings, and fog of war.");
  requestAnimationFrame(loop);
})();
