// netlify/functions/total.js
const crypto = require("crypto");

const BASE_URL = "https://globalapi.solarmanpv.com";

const API_ID = process.env.SOLARMAN_API_ID;
const API_SECRET = process.env.SOLARMAN_API_SECRET;
const EMAIL = process.env.SOLARMAN_USERNAME;
const PASSWORD = process.env.SOLARMAN_PASSWORD;

// SHA256 lowercase (requis par SOLARMAN)
function sha256Lower(str) {
  return crypto
    .createHash("sha256")
    .update(str, "utf8")
    .digest("hex")
    .toLowerCase();
}

function extractToken(data) {
  return (
    data?.access_token ||
    data?.data?.access_token ||
    data?.data?.accessToken ||
    null
  );
}

// ---- TOKEN
async function getAccessToken() {

  const url =
    `${BASE_URL}/account/v1.0/token?appId=${API_ID}&language=en`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: EMAIL,
      password: sha256Lower(PASSWORD),
      appSecret: API_SECRET
    })
  });

  const data = await res.json();
  const token = extractToken(data);

  if (!res.ok || !token) {
    throw new Error("Token failed: " + JSON.stringify(data));
  }

  return token;
}

// ---- LISTE STATIONS
async function getStationList(token) {

  const res = await fetch(`${BASE_URL}/station/v1.0/list`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({})
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error("Station list failed: " + JSON.stringify(data));
  }

  return data?.stationList || data?.data?.list || [];
}

// ---- ENERGY (BON ENDPOINT POUR TON TENANT)
async function getStationEnergy(token, stationId) {

  const res = await fetch(
    `${BASE_URL}/station/v1.0/stationEnergy`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        stationId: stationId
      })
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error("Energy request failed: " + JSON.stringify(data));
  }

  return data?.data || data;
}

// ---- HANDLER NETLIFY
exports.handler = async function () {
  try {

    if (!API_ID || !API_SECRET || !EMAIL || !PASSWORD) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing API credentials" })
      };
    }

    const token = await getAccessToken();
    const stations = await getStationList(token);

    if (!stations.length) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "No station found" })
      };
    }

    const station = stations[0];
    const energy = await getStationEnergy(token, station.id);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300"
      },
      body: JSON.stringify({
        station_name: station.name,
        total_kwh: energy.totalEnergy,
        today_kwh: energy.todayEnergy,
        current_power_w: station.generationPower,
        updated_at: station.lastUpdateTime
      }, null, 2)
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
