# App icons

The PWA needs three PNG icons in this directory:

- `icon-192.png` — 192x192, used by Android home-screen install
- `icon-512.png` — 512x512, used by Chrome splash screens
- `icon-512-maskable.png` — 512x512 with safe-area padding (~10% margin on all sides), used for adaptive icons
- `apple-touch-icon.png` — 180x180, used by iOS home-screen install

Easiest path: generate these from `favicon.svg` using any online favicon generator (realfavicongenerator.net works well), or run:

```bash
# One-time install
npm install -g sharp-cli

# Then
sharp -i favicon.svg -o icon-192.png resize 192
sharp -i favicon.svg -o icon-512.png resize 512
sharp -i favicon.svg -o apple-touch-icon.png resize 180
# For the maskable icon, create a version with extra padding first
```

Until these files exist, the PWA install prompt may not appear, but the app will otherwise work.
