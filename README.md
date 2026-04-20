# Trad Tune Book

A personal, offline-first tunebook for Irish traditional music. Keep track of tunes you know and tunes you're learning, see what your friends play, practice with a random-draw, and link every tune to [thesession.org](https://thesession.org).

## Features

- **Offline-first PWA.** All reads and writes go to IndexedDB via Dexie. Installable to your phone home screen. Works fully offline.
- **Multi-device sync** via Dexie Cloud. Sign in on phone and laptop, see the same book.
- **Shared community view.** Invite friends; everyone sees everyone's tunes. Your "My tunes" view is the default.
- **"Also in" column.** See which friends have the same tune in their book, grouped by thesession.org ID or normalized name.
- **thesession.org integration.** Auto-matches tunes in the background, cached for offline.
- **Practice mode** with type filter, skip-for-now, and recency-biased random draw.

## Stack

- React 18 + Vite
- Dexie 4 with `dexie-cloud-addon`
- `vite-plugin-pwa` (Workbox)
- Cloudflare Pages hosting, deployed from GitHub

## Deploy (one-time setup, ~45 minutes)

### Prerequisites

```bash
node --version   # v20+
git --version
gh --version     # GitHub CLI — install with `brew install gh` if missing
```

### Step 1 — Push to GitHub

```bash
cd tradtunebook
gh auth login                # browser, GitHub.com, HTTPS, web browser
git init
git add -A
git commit -m "Initial commit"
gh repo create tradtunebook --private --source=. --push
```

### Step 2 — Create your Dexie Cloud database

Everything happens in the terminal. There is no web signup — the CLI does it all via email OTP.

```bash
npx dexie-cloud create
```

It will:
1. Prompt for your email → sends a one-time code → you paste it back
2. Create the database
3. Write `dexie-cloud.json` (the URL) and `dexie-cloud.key` (credentials) to the current directory
4. Print the database URL, which looks like `https://z1abcdef.dexie.cloud`

**Neither file should be committed.** `.gitignore` already excludes them.

Save the URL to a local `.env`:

```bash
echo "VITE_DEXIE_CLOUD_URL=$(cat dexie-cloud.json | grep -o 'https://[^"]*')" > .env
cat .env   # verify it looks right
```

### Step 3 — Whitelist the origins that can connect

Dexie Cloud requires an allow-list of origins. Run these once:

```bash
# Your local dev server
npx dexie-cloud whitelist add http://localhost:5173

# Your production domain (both www and apex)
npx dexie-cloud whitelist add https://tradtunebook.com
npx dexie-cloud whitelist add https://www.tradtunebook.com

# Your Cloudflare Pages default URL (you'll get this in step 6)
# npx dexie-cloud whitelist add https://tradtunebook.pages.dev
```

Come back and run the last one after you've deployed in step 6.

### Step 4 — Test locally

```bash
npm install
npm run fetch-aliases   # pulls ~2 MB aliases dump from thesession.org
npm run dev
```

Open http://localhost:5173. Click **Log in** in the header, enter your email, click the magic link, come back.

The first time you log in, the app automatically creates the shared realm. You'll now see a "+ invite" button in the header. Click it and invite a friend's email address — they'll get a magic-link email when they visit the app, sign in, and accept the invite.

Add a tune, refresh, confirm it's still there. Stop the dev server with Ctrl+C.

### Step 5 — Cloudflare account + first deploy

```bash
# Sign up if you haven't:  https://dash.cloudflare.com/sign-up

npm install -g wrangler
wrangler login

npm run fetch-aliases
npm run build
wrangler pages deploy dist --project-name=tradtunebook --branch=main
```

Accept "Create a new project?" on first run. It uploads and prints a URL like `https://tradtunebook.pages.dev`.

### Step 6 — Set the Dexie Cloud URL for production

```bash
wrangler pages secret put VITE_DEXIE_CLOUD_URL --project-name=tradtunebook
# Paste your https://xxxxx.dexie.cloud URL when prompted
```

Now whitelist the pages.dev origin:

```bash
npx dexie-cloud whitelist add https://tradtunebook.pages.dev
```

Rebuild and redeploy so the new env var takes effect:

```bash
npm run build
wrangler pages deploy dist --project-name=tradtunebook --branch=main
```

Visit your `pages.dev` URL. Log in. Should work.

### Step 7 — GitHub → Cloudflare auto-deploy

In the browser:

1. **https://dash.cloudflare.com** → **Workers & Pages** → `tradtunebook`
2. **Settings** → **Builds & deployments** → **Connect to Git**
3. Authorize Cloudflare for GitHub, select the `tradtunebook` repo
4. Build command: `npm run fetch-aliases && npm run build`
5. Build output: `dist`
6. Production branch: `main`
7. **Environment variables** (Production) → add `VITE_DEXIE_CLOUD_URL`
8. Save

From now on `git push` auto-deploys. Delete the GitHub Action:

```bash
rm .github/workflows/deploy.yml
git add -A && git commit -m "Use Cloudflare native GitHub integration" && git push
```

### Step 8 — Custom domain (GoDaddy DNS)

**In Cloudflare Pages → `tradtunebook` project → Custom domains:**

1. Click **Set up a custom domain** → enter `tradtunebook.com` → Continue
2. Cloudflare shows the DNS records to add. For GoDaddy (no apex CNAME support), it'll be two **A records**. Copy both IPs.
3. Repeat for `www.tradtunebook.com`. This time it'll be a **CNAME** to `tradtunebook.pages.dev`.

**In GoDaddy → My Products → tradtunebook.com → Manage DNS:**

1. Delete any existing **A records** with Name `@` (GoDaddy's parking page)
2. Delete any existing **CNAME** with Name `www` pointing to `@`
3. Add **A** record: Name `@`, Value = first Cloudflare IP, TTL 1 Hour
4. Add **A** record: Name `@`, Value = second Cloudflare IP, TTL 1 Hour
5. Add **CNAME** record: Name `www`, Value `tradtunebook.pages.dev`, TTL 1 Hour

Wait 10–15 minutes. Verify:

```bash
dig tradtunebook.com +short
dig www.tradtunebook.com +short
```

Back in Cloudflare Pages → Custom domains, both should flip from "Verifying" to **Active**.

### Step 9 — Whitelist the production domain in Dexie Cloud

If you haven't already:

```bash
npx dexie-cloud whitelist add https://tradtunebook.com
npx dexie-cloud whitelist add https://www.tradtunebook.com
```

Visit **https://tradtunebook.com**. Log in. Should work.

## Inviting friends

Once you're logged in as the realm creator, the header shows a "+ invite" button. Click it, enter their email, they'll receive an email with a sign-in link. When they visit the app and sign in, they'll see an invite banner at the top. Accepting syncs your shared tunebook to them.

Dexie Cloud's free tier supports 3 concurrent users, unlimited devices, and unlimited demo users. If you need more, paid plans start at $5/mo.

## Local development after the initial deploy

```bash
npm run dev
```

Make changes, `git push`, Cloudflare auto-deploys. To pick up new aliases from thesession.org:

```bash
npm run fetch-aliases
git add public/data/aliases.json && git commit -m "Refresh aliases" && git push
```

Or let the deploy pipeline do it every build (it does — the build command includes `fetch-aliases`).

## Project structure

```
tradtunebook/
├── public/
│   ├── data/aliases.json            # thesession.org aliases dump
│   └── favicon.svg
├── scripts/
│   └── fetch-aliases.mjs            # refresh aliases
├── src/
│   ├── components/                  # React components
│   ├── db/
│   │   ├── index.js                 # Dexie schema + cloud config
│   │   ├── bootstrap.js             # creates/discovers shared realm, invites
│   │   └── ops.js                   # write helpers
│   ├── hooks/
│   │   ├── useCurrentUser.js
│   │   └── useOnlineStatus.js
│   ├── lib/
│   │   ├── constants.js
│   │   └── grouping.js              # who-else-has-this-tune logic
│   ├── session-org/
│   │   ├── lookup.js                # two-tier matching
│   │   └── queue.js                 # background drainer
│   ├── App.jsx
│   ├── main.jsx
│   └── styles.css
├── .env.example
├── index.html
├── package.json
└── vite.config.js
```

## Troubleshooting

**"Login" does nothing in production** — Step 6's secret didn't apply. Re-run `wrangler pages secret put VITE_DEXIE_CLOUD_URL --project-name=tradtunebook` and redeploy.

**Sync fails in browser console: "Origin not allowed"** — You forgot step 3/9. Run `npx dexie-cloud whitelist add https://your-domain`.

**DNS isn't propagating** — Check you deleted GoDaddy's old A records. Two conflicting sets at the apex cause flappy resolution.

**Invite email doesn't arrive** — Check spam. Still nothing? Run `npx dexie-cloud members list` to confirm the invite was recorded.

**I lost `dexie-cloud.key`** — You can re-request credentials with `npx dexie-cloud connect <database-url>`. It'll OTP-verify your email and regenerate the key file locally.

## License

Private. Do what you want with it.
