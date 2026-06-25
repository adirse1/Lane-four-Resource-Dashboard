# Deploying to GitHub Pages (live, per-viewer Salesforce login)

The hosted app uses **Salesforce OAuth (PKCE)**: each viewer signs in with their own
Salesforce account, gets their own token (held only in their browser), and queries
the REST API directly. No backend, no secrets in the build, and each person sees
only the data their Salesforce permissions allow.

There are three one-time setup areas: a **Connected App**, the **CORS allowlist**,
and **GitHub Pages**. Plan ~20 minutes. (Connected App changes can take ~10 min to
propagate, so do that first.)

Throughout, replace:
- `<USER>` = your GitHub username/org
- `<REPO>` = the repo name (e.g. `lane-four-resource-dashboard`)
- App URL = `https://<USER>.github.io/<REPO>/`  ← note the trailing slash
- My Domain = `https://nuvem.my.salesforce.com` (the lf-prod PSA org)

---

## 1. Salesforce Connected App (in lf-prod)

Setup → **App Manager** → **New Connected App** (classic Connected App).

- **Connected App Name:** Lane Four Dashboard
- **Contact Email:** your email
- Check **Enable OAuth Settings**
  - **Callback URL:** `https://<USER>.github.io/<REPO>/`  (exact, with trailing slash)
  - **Selected OAuth Scopes:** add
    - *Manage user data via APIs (api)*
    - *Perform requests at any time (refresh_token, offline_access)*
  - Check **Require Proof Key for Code Exchange (PKCE)**
  - **Uncheck** *Require Secret for Web Server Flow*
  - **Uncheck** *Require Secret for Refresh Token Flow*
- **Save**, then wait ~10 minutes.

After it saves: open the app → **Manage Consumer Details** → copy the
**Consumer Key**. That is your `VITE_SF_CLIENT_ID`.

Optional hardening — open the app → **Manage** → **Edit Policies**:
- **Permitted Users:** *Admin approved users are pre-authorized*, then assign the
  profiles / permission sets who should see the dashboard. (Default
  *All users may self-authorize* lets any SF user in.)
- Set a session timeout if you want tokens to expire sooner.

---

## 2. CORS allowlist (in lf-prod)

Setup → **CORS** → **New**.

- **Origin URL Pattern:** `https://<USER>.github.io`  (origin only — no path, no trailing slash)
- Save.

This lets the browser call the Salesforce token + query endpoints from the Pages origin.

---

## 3. GitHub repo + Pages

```bash
# from the project root
git remote add origin https://github.com/<USER>/<REPO>.git
git push -u origin main
```

In the repo on GitHub:

1. **Settings → Pages → Build and deployment → Source = GitHub Actions.**
2. **Settings → Secrets and variables → Actions → Variables** tab → **New repository variable**:
   - `VITE_SF_CLIENT_ID` = the Consumer Key from step 1
   - `VITE_SF_LOGIN_URL` = `https://nuvem.my.salesforce.com`
   (These are not secrets — the PKCE client ID is public — so Variables, not Secrets.)
3. The included workflow ([.github/workflows/deploy.yml](.github/workflows/deploy.yml))
   builds and deploys on every push to `main`. Trigger it by pushing, or run it from
   the **Actions** tab.

Your app goes live at `https://<USER>.github.io/<REPO>/`.

> Free GitHub Pages requires a **public repo**, so your source code is visible. That
> is safe here: there are no secrets in the code (PKCE has no client secret), and
> all data is fetched per-viewer with their own Salesforce login.

---

## 4. Verify

1. Open `https://<USER>.github.io/<REPO>/`.
2. Click **Sign in with Salesforce**, log in, approve.
3. You return to the dashboard with live data.

### Troubleshooting

- **redirect_uri_mismatch** — the Connected App Callback URL must exactly equal the
  app URL including the trailing slash and `<REPO>` path.
- **CORS error in the console** — the Pages origin isn't on the CORS allowlist
  (step 2), or you're still within the ~10-min propagation window.
- **invalid_client_id** — `VITE_SF_CLIENT_ID` variable not set, or the build ran
  before it was added (re-run the Actions workflow).
- **Blank / 404 assets** — `VITE_BASE` must be `/<REPO>/`; the workflow sets this
  automatically from the repo name.

---

## Local development is unchanged

- `npm run dev` — sample fixtures, no credentials.
- `npm run proxy` + `npm run dev:live` — live data via your `sf` CLI (the proxy).
- Production build (`npm run build`) — the OAuth mode described above.

The mode is decided in [src/lib/env.js](src/lib/env.js).
