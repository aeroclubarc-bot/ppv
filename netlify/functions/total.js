// netlify/functions/total.js
const crypto = require("crypto");

const BASE_URL = "https://globalapi.solarmanpv.com";

// 🔵 CALIBRATION (production réelle SOLARMAN)
const BASE_TOTAL_KWH = 6517.50;

const API_ID = process.env.SOLARMAN_API_ID;
const API_SECRET = process.env.SOLARMAN_API_SECRET;
const EMAIL = process.env.SOLARMAN_USERNAME;
const PASSWORD = process.env.SOLARMAN_PASSWORD;


// mémoire runtime
let addedEnergy = global.addedEnergy || 0;
let lastTimestamp = global.lastTimestamp || Date.now();

function sha256Lower(str) {
  return crypto.createHash("sha256").update(str).digest("hex").toLowerCase();
}

function extractToken(data) {
  return data?.access_token || data?.data?.access_token || null;
}

// TOKEN
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
  if (!token) throw new Error("Token failed");

  return token;
}

// STATION
async function getStation(token) {
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
  return data?.data?.list?.[0];
}


// HANDLER
exports.handler = async function () {
  try {

    const token = await getAccessToken();
    const station = await getStation(token);

    const powerW = Number(station.generationPower || 0);

    // calcul énergie produite depuis dernier appel
    const now = Date.now();
    const deltaHours = (now - lastTimestamp) / 3600000;

    addedEnergy += (powerW / 1000) * deltaHours;

    lastTimestamp = now;
    global.addedEnergy = addedEnergy;
    global.lastTimestamp = lastTimestamp;

    const totalEnergy = BASE_TOTAL_KWH + addedEnergy;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-cache"
      },
      body: JSON.stringify({
        station_name: station.name,
        current_power_w: powerW,
        total_kwh: Number(totalEnergy.toFixed(2)),
        battery_soc: station.batterySoc
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
