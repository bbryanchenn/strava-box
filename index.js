require("dotenv").config();
const { Octokit } = require("@octokit/rest");
const fs = require("fs");

const {
  GIST_ID: gistId,
  GIT_TOKEN: githubToken,
  STRAVA_ATHLETE_ID: stravaAtheleteId,
  STRAVA_ACCESS_TOKEN: stravaAccessToken,
  STRAVA_REFRESH_TOKEN: stravaRefreshToken,
  STRAVA_CLIENT_ID: stravaClientId,
  STRAVA_CLIENT_SECRET: stravaClientSecret,
  UNITS: units
} = process.env;
const API_BASE = "https://www.strava.com/api/v3/";
const AUTH_CACHE_FILE = "strava-auth.json";

const octokit = new Octokit({
  auth: `token ${githubToken}`
});

async function main() {
  const stravaData = await getStravaData();
  await updateGist(stravaData);
}

/**
 * Updates cached strava authentication tokens if necessary
 */
async function getStravaToken() {
  // default env vars
  let cache = {
    // stravaAccessToken: stravaAccessToken,
    stravaRefreshToken: stravaRefreshToken,
    stravaAccessToken: null
  };
  // read cache from disk
  try {
    const jsonStr = fs.readFileSync(AUTH_CACHE_FILE);
    const c = JSON.parse(jsonStr);
    Object.keys(c).forEach(key => {
      cache[key] = c[key];
    });
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(`Unable to read ${AUTH_CACHE_FILE}\n${error}`);
    }
  }

  if (!cache.stravaRefreshToken) {
    throw new Error(
      "Missing STRAVA_REFRESH_TOKEN and no cached token found in strava-auth.json"
    );
  }

  // get new tokens
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: stravaClientId,
    client_secret: stravaClientSecret,
    refresh_token: cache.stravaRefreshToken
  });

  const tokenResponse = await fetch(
    "https://www.strava.com/api/v3/oauth/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    }
  );

  const rawBody = await tokenResponse.text();
  let data;
  try {
    data = JSON.parse(rawBody);
  } catch (error) {
    data = null;
  }

  if (!tokenResponse.ok || !data || !data.access_token || !data.refresh_token) {
    const stravaMessage =
      data && (data.message || data.error || JSON.stringify(data));
    const fallbackMessage = rawBody || "No response body";
    throw new Error(
      `Unable to refresh Strava token (status ${
        tokenResponse.status
      }): ${stravaMessage || fallbackMessage}`
    );
  }

  cache.stravaAccessToken = data.access_token;
  cache.stravaRefreshToken = data.refresh_token;

  // save to disk
  fs.writeFileSync(AUTH_CACHE_FILE, JSON.stringify(cache));

  return cache.stravaAccessToken;
}

/**
 * Fetches your data from the Strava API
 * The distance returned by the API is in meters
 */
async function getStravaData() {
  const accessToken = await getStravaToken();

  const meResponse = await fetch(`${API_BASE}athlete`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const meText = await meResponse.text();
  const me = parseJsonSafely(meText);

  if (!meResponse.ok) {
    throw new Error(
      `Unable to fetch authenticated athlete (status ${
        meResponse.status
      }): ${formatApiError(me, meText)}`
    );
  }

  const statsApi = `${API_BASE}athletes/${me.id}/stats`;
  const recentApi = `${API_BASE}athlete/activities?per_page=3&page=1`;

  const authHeaders = {
    Authorization: `Bearer ${accessToken}`
  };

  const [statsResponse, recentResponse] = await Promise.all([
    fetch(statsApi, { headers: authHeaders }),
    fetch(recentApi, { headers: authHeaders })
  ]);

  const [statsText, recentText] = await Promise.all([
    statsResponse.text(),
    recentResponse.text()
  ]);

  const stats = parseJsonSafely(statsText);
  const recentActivities = parseJsonSafely(recentText);

  if (!statsResponse.ok) {
    throw new Error(
      `Unable to fetch Strava stats (status ${
        statsResponse.status
      }): ${formatApiError(stats, statsText)}`
    );
  }

  if (!recentResponse.ok) {
    throw new Error(
      `Unable to fetch recent Strava activities (status ${
        recentResponse.status
      }): ${formatApiError(recentActivities, recentText)}`
    );
  }

  if (!Array.isArray(recentActivities)) {
    throw new Error(
      `Unexpected recent activities response: ${formatApiError(
        recentActivities,
        recentText
      )}`
    );
  }

  return { stats, recentActivities };
}

async function updateGist(data) {
  let gist;
  try {
    gist = await octokit.gists.get({ gist_id: gistId });
  } catch (error) {
    console.error(`Unable to get gist\n${error}`);
    throw error;
  }

  const recentActivities = Array.isArray(data.recentActivities)
    ? data.recentActivities.slice(0, 3)
    : [];

  const lines = ["Top 3 Recent Activities", ""];

  if (!recentActivities.length) {
    lines.push("No recent activities found.");
  } else {
    const emojiMap = {
      Run: "🏃",
      Swim: "🏊",
      Walk: "🚶",
      Workout: "🏋️"
    };

    recentActivities.forEach((activity, index) => {
      const name = activity.name || "Untitled Activity";
      const type = activity.type || "Activity";
      const emoji = emojiMap[type] || "📍";

      const distance = formatDistance(activity.distance || 0);
      const movingTime = formatDuration(activity.moving_time || 0);
      const date = formatDate(activity.start_date_local || activity.start_date);

      lines.push(`${index + 1}. ${emoji} ${name}`);
      lines.push(`   ${distance} • ${movingTime} • ${date}`);

      // Add extra spacing between activities for readability
      if (index < recentActivities.length - 1) {
        lines.push("");
      }
    });
  }

  try {
    // Get original filename to update that same file
    const filename = Object.keys(gist.data.files)[0];
    await octokit.gists.update({
      gist_id: gistId,
      files: {
        [filename]: {
          filename: `strava-activities`,
          content: lines.join("\n")
        }
      }
    });
  } catch (error) {
    console.error(`Unable to update gist\n${error}`);
    throw error;
  }
}

function formatDistance(distance) {
  switch (units) {
    case "meters":
      return `${metersToKm(distance)} km`;
    case "miles":
      return `${metersToMiles(distance)} mi`;
    default:
      return `${metersToKm(distance)} km`;
  }
}

function metersToMiles(meters) {
  const CONVERSION_CONSTANT = 0.000621371192;
  return (meters * CONVERSION_CONSTANT).toFixed(2);
}

function metersToKm(meters) {
  const CONVERSION_CONSTANT = 0.001;
  return (meters * CONVERSION_CONSTANT).toFixed(2);
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatDate(dateString) {
  if (!dateString) {
    return "Unknown date";
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toISOString().substring(0, 10);
}

function parseJsonSafely(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function formatApiError(json, rawText) {
  if (json && typeof json === "object") {
    if (json.message) {
      return json.message;
    }
    if (json.error) {
      return json.error;
    }
    return JSON.stringify(json);
  }

  return rawText || "No response body";
}

(async () => {
  await main();
})();
