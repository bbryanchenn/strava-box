<p align="center">
  <img width="400" src="https://imgur.com/a/zNUgbxe">
  <h3 align="center">strava-box</h3>
  <p align="center">Update a gist to contain your latest Strava activities</p>
</p>

---

This repo is based off [matchai's waka-box](https://github.com/matchai/waka-box) and [JohnPhamous's strava-box](https://github.com/JohnPhamous/strava-box).

## Features

- Fetches your 3 most recent activities from Strava (running, cycling, swimming, etc.)
- Displays activity name, type, date, distance, and duration
- Updates a GitHub gist automatically
- Secure token refresh and caching
- Lightweight and fast

## Prerequisites

Before you start, you'll need:

1. **Node.js 14+** — [Download](https://nodejs.org)
2. **A Strava Account** — [Sign up](https://www.strava.com)
3. **A GitHub Account** — [Sign up](https://github.com)

## Setup

### Step 1: Create a Strava App

1. Go to [Strava Settings > API](https://www.strava.com/settings/apps)
2. Create a new app:
   - **Application name:** (e.g., "Strava Box")
   - **Category:** Training
   - **Website:** (your personal website or leave blank)
3. Copy your **Client ID** and **Client Secret**
4. Set **Authorization Callback Domain** to: `localhost`

### Step 2: Create a GitHub Gist

1. Go to [GitHub Gists](https://gist.github.com)
2. Create a new public or private gist with any content (e.g., "# Strava Activities")
3. Copy the gist ID from the URL:
   - Example: `gist.github.com/YOUR_USERNAME/a1b2c3d4...` → ID is `a1b2c3d4...`

### Step 3: Create a GitHub Personal Access Token

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click **Generate new token**
3. Name it "strava-box"
4. Select scope: `gist` (to read/write gists)
5. Click **Generate token** and copy it immediately ⚠️ (you won't see it again)

### Step 4: Generate Strava Refresh Token

1. Replace `YOUR_CLIENT_ID` with your Strava Client ID and visit:

```
https://www.strava.com/oauth/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost/exchange_token&response_type=code&approval_prompt=force&scope=read,activity:read_all
```

2. Click **Authorize**

3. Copy the `code` from the redirected URL (e.g., `http://localhost/exchange_token?code=YOUR_CODE...`)

4. In PowerShell, run:

```powershell
$body = @{
  client_id = "YOUR_CLIENT_ID"
  client_secret = "YOUR_CLIENT_SECRET"
  code = "YOUR_CODE"
  grant_type = "authorization_code"
}
$response = Invoke-RestMethod -Method Post -Uri "https://www.strava.com/oauth/token" -Body $body
$response.refresh_token
```

5. Copy the refresh token from the output

## Installation

### Clone or Download

```bash
git clone https://github.com/bbryanchenn/strava-box.git
cd strava-box
```

Or download as ZIP and extract.

### Install Dependencies

```bash
npm install
```

### Configure Environment Variables

Create a `.env` file in the project root:

```
GIST_ID=YOUR_GIST_ID
GITHUB_TOKEN=YOUR_GITHUB_TOKEN
STRAVA_ATHLETE_ID=YOUR_STRAVA_ATHLETE_ID
STRAVA_REFRESH_TOKEN=YOUR_REFRESH_TOKEN
STRAVA_CLIENT_ID=YOUR_CLIENT_ID
STRAVA_CLIENT_SECRET=YOUR_CLIENT_SECRET
UNITS=miles
```

**Environment Variables:**

- `GIST_ID` — Your GitHub gist ID
- `GITHUB_TOKEN` — Your GitHub personal access token
- `STRAVA_ATHLETE_ID` — Your Strava athlete ID (found on your Strava profile)
- `STRAVA_REFRESH_TOKEN` — Your refresh token (from Step 4 above)
- `STRAVA_CLIENT_ID` — Your Strava app Client ID
- `STRAVA_CLIENT_SECRET` — Your Strava app Client Secret
- `UNITS` — `miles` or `kilometers` (default: `kilometers`)

## Usage

### Run Once

```bash
npm start
```

or

```bash
node index.js
```

Your gist will update with your latest activities!

### Run on Schedule (GitHub Actions)

Create `.github/workflows/strava-box.yml`:

```yaml
name: Update Strava Box

on:
  schedule:
    - cron: "0 * * * *" # Runs every hour
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: "16"
      - run: npm install
      - run: npm start
        env:
          GIST_ID: ${{ secrets.GIST_ID }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          STRAVA_ATHLETE_ID: ${{ secrets.STRAVA_ATHLETE_ID }}
          STRAVA_REFRESH_TOKEN: ${{ secrets.STRAVA_REFRESH_TOKEN }}
          STRAVA_CLIENT_ID: ${{ secrets.STRAVA_CLIENT_ID }}
          STRAVA_CLIENT_SECRET: ${{ secrets.STRAVA_CLIENT_SECRET }}
          UNITS: miles
```

Then add your secrets to your GitHub repo settings.

## Output Example

Your gist will look like:

```
Top 3 Recent Activities

1. Morning Run
   Run | 2026-04-15
   5.23 mi | 45m

2. Lunch Ride
   Ride | 2026-04-14
   12.38 mi | 1h 2m

3. Evening Swim
   Swim | 2026-04-13
   1.24 mi | 32m

```

## Troubleshooting

**401 Authorization Error**

- Ensure your refresh token has `activity:read_all` scope (re-authorize if needed)

**Missing STRAVA_REFRESH_TOKEN**

- Complete Step 4 above and add token to `.env`

**Gist not updating**

- Verify `GIST_ID` and `GITHUB_TOKEN` are correct
- Check that GitHub token has `gist` scope

## License

ISC

## Author

bbryan
