# Church Feud

Real-time, three-screen Family Feud-style game show controller built with Next.js, Firebase Realtime Database, and Framer Motion.

## Run locally

```bash
npm install
npm run dev
```

Firebase configuration is kept directly in [firebase.ts](./lib/firebase.ts) for this simple setup. Replace the `PASTE_*_HERE` values with the Firebase Web App configuration from Firebase Console, then enable Realtime Database. For a trusted event network, configure database rules according to your deployment's security requirements; do not expose an open write policy beyond the event.

The app provides:

- `/display` — stage board, scores, answer flips, strike animation, buzzer winner indicator, and sound playback
- `/admin` — answer reveals, scoring, strikes, buzzer reset, question progression, end-game winner, and new-game reset
- `/buzzer?team=A` or `/buzzer?team=B` — atomic team buzzer screen

Team A is displayed as **Pastor Christ** and Team B is displayed as **Maam Ivy** throughout the landing page, player buzzers, admin controls, and stage display. The internal A/B identifiers remain unchanged so existing Firebase game data and buzzer links continue to work.

The display loops `public/background.mp3` as background music after the Start Game overlay is tapped. The admin page controls its volume from 0–100%; this setting is synchronized through Firebase. Add the file directly to the project's `public/` folder (the full path is `public/background.mp3`; it is not uploaded through the browser). The `ding.mp3`, `strike.mp3`, and `buzzer.mp3` files remain local display sound effects.

The initial Firebase shape is created by the first admin update and follows the flat `gameState` and `sfxTrigger` structure described in the product brief. Questions remain local in `data/questions.ts`.

## Game flow

Use **REVEAL** to add an answer's points multiplied by the round multiplier to the bank. Award the bank to a team before ending the game. **END GAME** calculates the winner from the final team scores and shows a full-screen winner announcement on `/display`; tied scores show a tie announcement. **NEW GAME** clears scores and returns to the first question.
