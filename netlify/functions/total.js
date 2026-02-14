// netlify/functions/total.js
const crypto = require("crypto");

const BASE_URL = "https://globalapi.solarmanpv.com";

const API_ID = process.env.SOLARMAN_API_ID;
const API_SECRET = process.env.SOLARMAN_API_SECRET;
const EMAIL = process.env.SOLARMAN_USERNAME;
const PASSWORD = process.env.SOLARMAN_PASSWORD;


// ---------- SHA256 lowercase (exigé par SOLARMAN)
function sha256Lower(str) {
  return crypto
    .createHash("sha256")
    .update(str, "utf8")
    .digest("hex")
    .toLowerCase();
}


// ---------- Extraction token
function extractToken(data) {
  return data?.access_token || data?.data?.access_token || null;
}


// ---------- TOKEN
async function getAccessToken() {

  const res = await fetch(
    `${BASE_URL}/account/v1.0/token?appId=${API_ID}&language=en`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: EMAIL,
        password: sha256Lower(PASSWORD),
        appSecret: API_SECRET
      })
    }
  );

  const data = await res.json();
  const token = extractToken(data);

  if (!token) {
    throw new Error("Token failed: " + JSON.stringify(data));
  }

  return token;
}


// ---------- STATION LIST
async function getStationList(token) {

  const res = await fetch(`${BASE_URL}/station/v1.0/list`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      pageNum: 1,
      pageSize: 10
    })
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error("Station list failed: " + JSON.stringify(data));
  }

  return data?.data?.list || data?.stationList || [];
}


// ---------- HANDLER NETLIFY
exports.handler = async function () {
  try {

    if (!API_ID || !API_SECRET || !EMAIL || !PASSWORD) {
      throw new Error("Missing API credentials");
    }

    // Authentification
    const token = await getAccessToken();

    // Centrale
    const stations = await getStationList(token);

    if (!stations.length) {
      throw new Error("No station found");
    }

    const station = stations[0];

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300"
      },
      body: JSON.stringify({
        station_name: station.name,
        current_power_w: station.generationPower,
        installed_kwp: station.installedCapacity,
        battery_soc: station.batterySoc,
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
