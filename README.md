# Realmfall RTS V4

Playable mobile browser RTS prototype for iPhone Safari.

## V4 upgrades implemented

- 2D generated sprite sheets rendered in-game
- Fake 3D/top-down RTS unit perspective
- Animated walk cycles
- Textured procedural terrain:
  - grass
  - darker grass patches
  - dirt road
  - river
  - mine paths
- Better glowing selection rings
- Fog of war:
  - unseen areas are black
  - explored areas are dim
  - visible areas are clear
- Enemy units/buildings are hidden unless visible
- Rounded minimap with fog overlay
- Single Resource economy
- Three ways to get Resource:
  1. farms generate Resource over time
  2. workers chop natural trees into visible stumps
  3. workers mine deposits scattered across the map
- Balanced combat counter system:
  - Swordsmen strong vs Spearmen, weak vs Archers
  - Spearmen strong vs Cavalry, weak vs Swordsmen
  - Archers strong vs Swordsmen, weak vs Cavalry
  - Cavalry strong vs Archers, weak vs Spearmen

## Run on iPhone through GitHub Pages

Upload these files to a GitHub repository:

- `index.html`
- `style.css`
- `game.js`
- `manifest.json`

Then enable:

Settings → Pages → Deploy from branch → main → /root

Open the GitHub Pages URL in iPhone Safari, then tap:

Share → Add to Home Screen

## Notes

This version keeps sprites generated in code so the project is easy to upload and test.
A future V5 can replace generated sprites with external PNG sprite sheets.
