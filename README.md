# Calisthenics PWA

Guided beginner calisthenics plan for iPhone: 3 home strength mornings (Mon/Wed/Fri), evening Walk + Bar Stop, progression ladders, demos, timers, streaks.

- Data lives on the phone (IndexedDB). Export a JSON backup from Settings.
- Demos: tap **Demo & form**, find a clip on YouTube, paste the link to pin it per exercise.
- Progression rule: top of the rep range on every set, two sessions in a row → app offers the next step. 3 weeks stuck → deload week (2 sets).

## Develop
```sh
npm install
npm run dev      # local
npm test         # logic tests
npm run build
```

## Deploy
Pushing to `main` deploys via GitHub Actions to Pages.
One-time: repo **Settings → Pages → Source: GitHub Actions**.

Install on iPhone: open the Pages URL in Safari → Share → Add to Home Screen.
