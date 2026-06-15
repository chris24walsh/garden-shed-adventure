# Garden Shed Adventure: Overgrown Quest

A small top-down Zelda-like garden adventure built with HTML5 Canvas. Explore the shed and garden, collect upgradeable tools, defeat enemies, recover the four lost fixings, and open the buried greenhouse for the final fight.

This is a forkable variation of `zincsoda/garden-shed-adventure`, keeping the original shed-and-garden charm while adding a primary mission, combat, progression, save/load, mobile controls, and an ending.

## Play

Serve the `public` directory locally or deploy the static assets. The root `index.html` and legacy `shed.html` point to the playable game.

## Controls

- **Move:** WASD or arrow keys
- **Use selected tool:** J or Z
- **Interact / continue dialog:** E or Space
- **Swap tool:** Q or R
- **Pause:** Escape

On touch devices, use the on-screen D-pad and action buttons.

## Local dev

```bash
cd public
python3 -m http.server 8787
```

Then open `http://localhost:8787`.

## Deploy

Hosted on Cloudflare Workers (static assets).

```bash
wrangler deploy
```
