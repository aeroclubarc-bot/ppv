// netlify/functions/total.js
const crypto = require("crypto");

const BASE_URL = "https://globalapi.solarmanpv.com";

const API_ID = process.env.SOLARMAN_API_ID;
const API_SECRET = process.env.SOLARMAN_API_SECRET;
const EMAIL = process.env.SOLARMAN_USERNAME;
const PASSWORD = process.env.SOLARMAN_PASSWORD;


// SHA256 lowercase
function sha256Lower(str) {
  return crypto.createHash("sha256").update(str).digest("hex").toLowerCase();
}

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


// ---------- STATION
async function getStationList(token) {

  const res = await fetch(`${BASE_URL}/station/v1.0/list`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({})
  });

  const data = await res.json();
  return data?.stationList || data?.data?.list || [];
}


// ---------- DEVICE REALTIME (production réelle)
async function getDeviceRealtime(token, stationId) {

  const res = await fetch(
    `${BASE_URL}/device/v1.0/realTime`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        stationId: stationId
      })
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error("Realtime request failed: " + JSON.stringify(data));
  }

  return data?.data || [];
}


// ---------- HANDLER
exports.handler = async function () {
  try {

    const token = await getAccessToken();
    const stations = await getStationList(token);

    if (!stations.length) {
      throw new Error("No station found");
    }

    const station = stations[0];

    const devices = await getDeviceRealtime(token, station.id);

    const inverter = devices[0] || {};

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300"
      },
      body: JSON.stringify({
        station_name: station.name,
        total_kwh: inverter.totalEnergy,
        today_kwh: inverter.todayEnergy,
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
