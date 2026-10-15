# The Old House — Horror Escape

A small original browser horror game inspired by first-person hide-and-escape games. It uses original procedural 3D geometry and a simple original monster model; it does not include Granny assets.

## Play locally
1. Extract the ZIP.
2. Open `index.html` in a modern browser with an internet connection.
3. If your browser blocks local scripts, run a local server from this folder:
   - Python: `python -m http.server 8000`
   - Open `http://localhost:8000`

The game loads Three.js from a CDN, so an internet connection is required.

## Publish with GitHub Pages
1. Create or open a GitHub repository.
2. Upload `index.html`, `style.css`, `game.js`, and `README.md` to the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**.
5. Choose the `main` branch and `/(root)`, then Save.
6. Wait for the Pages URL to appear.

## Controls
### Desktop
- `W A S D` / arrow keys: move
- Mouse: look around (click the game to lock the pointer)
- `E`: interact
- `Ctrl`: crouch (quieter, slower)
- `Shift`: run (faster, louder)
- `Esc`: pause / resume

### Mobile / tablet
- Left joystick: move
- Drag the right side of the screen: look around
- `E`: interact
- `CROUCH`: toggle crouching
- `RUN`: hold to run

## Objective
Find the basement key on the table in the east room. Read the note on the dining table for the symbol clue. Use the symbol lock three times to open the passage, then reach the exit door and interact with it. The caretaker patrols, hears noise, searches, and chases when close. You can hide in the wardrobe.

## Notes
This is a compact prototype rather than a commercial-scale game. Its 3D layout, monster, lighting, UI, puzzle flow, and win/lose screens are implemented in JavaScript. All models are generated from basic geometry at runtime.