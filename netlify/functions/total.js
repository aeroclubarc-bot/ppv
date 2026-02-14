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

  if (!token) throw new Error("Token failed");

  return token;
}


// ---------- DEVICE REALTIME
async function getRealtime(token, deviceSn) {

  const res = await fetch(
    `${BASE_URL}/device/v1.0/currentData`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        deviceSn: deviceSn
      })
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error("Realtime failed: " + JSON.stringify(data));
  }

  return data;
}


// ---------- HANDLER
exports.handler = async function () {
  try {

    const token = await getAccessToken();

    // TON numéro série trouvé dans ton JSON
    const deviceSn = "SE1ES430N5R271";

    const realtime = await getRealtime(token, deviceSn);

const list = realtime.data?.dataList || realtime.dataList || [];

const find = key =>
  list.find(i => i.key === key)?.value || 0;
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300"
      },
      body: JSON.stringify({
        station_name: "PPV Aéroclub ARC - LFPX",
        total_kwh: Number(find("Et_ge0")),
        today_kwh: Number(find("Etdy_ge1")),
        current_power_w: Number(find("P_INV1")),
        battery_soc: Number(find("B_left_cap1"))
      }, null, 2)
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
