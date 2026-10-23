# Card Games for Jahangir Kabir

Large-print card games made for an older iPad (Safari 12 and up). Big cards, big buttons with words on them, and tap-to-move instead of dragging.

**Play:** https://justanotherwanderer.github.io/card-games-for-jahangir-kabir/

## Games

- **On your own:** Klondike Solitaire, FreeCell, Spider Solitaire, Pyramid
- **Against the computer:** Hearts, Spades, Canasta, Gin Rummy, Crazy Eights, Blackjack

Everything runs in the browser. There is no server, no account and no sign-in. Progress and settings are saved on the device.

## Editing

The source is in `src/`. After changing it, rebuild the page:

```
node build.js
```

This writes the playable page to `docs/index.html`, which GitHub Pages serves.
