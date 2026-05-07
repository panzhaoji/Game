# Realmfall RTS Prototype V2

This is a more advanced iPhone Safari RTS prototype.

## New in V2

- Polished fantasy UI
- Multi-unit selection using two-finger drag box
- Group movement and group attack
- Archer ranged unit
- Tower placement mode
- Minimap
- Better visual effects
- Apple mobile web app metadata and manifest

## iPhone controls

- One finger drag: move camera
- Pinch: zoom
- Tap your unit: select it
- Two-finger drag: select multiple units
- Tap ground with units selected: move
- Tap enemy with units selected: attack
- Select worker(s), then tap Gather: gather wood
- Select worker, tap Place Tower, then tap map near worker

## Run on iPhone using GitHub Pages

1. Create a GitHub repository, for example `realmfall-rts`.
2. Upload `index.html`, `style.css`, `game.js`, and `manifest.json`.
3. Go to Settings → Pages.
4. Choose Deploy from branch.
5. Select `main` and `/root`.
6. Open the Pages link on iPhone Safari.
7. Tap Share → Add to Home Screen.

## Local network method

On a Mac/PC in this folder:

```bash
python3 -m http.server 8000
```

Then open this on your iPhone, replacing the IP:

```text
http://YOUR-COMPUTER-IP:8000
```

Your iPhone and computer must be on the same Wi-Fi.

## IP note

This prototype is original IP. It uses no Lord of the Rings names, characters, logos, music, maps, or assets. It aims for the general feel of a classic fantasy RTS while staying legally safer.
