# Realmfall RTS V3

Playable mobile browser RTS prototype for iPhone Safari.

## Major V3 changes

- One generic currency: **Resource**.
- Three ways to gather Resource:
  1. **Farm**: generates Resource over time.
  2. **Chop trees**: workers chop naturally scattered trees; depleted trees become visible stumps.
  3. **Mine**: workers mine Resource from deposits scattered across the map.
- Evil faction has a **Slaughterhouse** concept that increases enemy spawn pressure.
- Combat-focused unit counter system:
  - Swordsmen are strong vs Spearmen and weak vs Archers.
  - Spearmen are strong vs Cavalry and weak vs Swordsmen.
  - Archers are strong vs Swordsmen and weak vs Cavalry.
  - Cavalry are strong vs Archers and weak vs Spearmen.
- Damage modifiers:
  - Strong matchup: +50% damage.
  - Weak matchup: -50% damage.
  - Neutral: normal damage.
- Added Spearmen, Cavalry, mines, Resource bars, chopped trees, stronger RTS UI, and a help panel.

## iPhone controls

- 1 finger drag: pan camera.
- Pinch: zoom.
- Tap unit: select.
- Two-finger drag: group select.
- Tap ground with units selected: move.
- Tap enemy with units selected: attack.
- Select workers + Chop: chop nearest trees.
- Select workers + Mine: mine nearest deposit.
- Select worker + Farm/Tower: place building near worker.
- Tap minimap: jump camera.

## Run on iPhone

### Best: GitHub Pages

1. Create a GitHub repo.
2. Upload `index.html`, `style.css`, `game.js`, and `manifest.json`.
3. Go to Settings → Pages.
4. Select Deploy from branch → `main` → `/root`.
5. Open the generated URL in iPhone Safari.
6. Tap Share → Add to Home Screen.

### Local network

From this folder on Mac/PC:

```bash
python3 -m http.server 8000
```

Then open on iPhone Safari:

```text
http://YOUR-COMPUTER-IP:8000
```

Your phone and computer must be on the same Wi-Fi.

## Suggested V4

- Replace canvas-drawn units with PNG sprites.
- Add fog of war.
- Add barracks/stables/archery range.
- Add hero units and abilities.
- Add AI base rebuilding.
- Add sound and music.
