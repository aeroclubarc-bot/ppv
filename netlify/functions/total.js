import crypto from "crypto";

const BASE_URL = process.env.SOLARMAN_BASE_URL || "https://globalapi.solarmanpv.com/account/v1.0/token?appId=3024071796931544&language=en";
const API_ID = process.env.SOLARMAN_API_ID;
const API_SECRET = process.env.SOLARMAN_API_SECRET;

function sign(params, secret) {
  const sortedKeys = Object.keys(params).sort();
  const str = sortedKeys.map(k => k + params[k]).join("") + secret;
  return crypto.createHash("md5").update(str).digest("hex");
}

async function getAccessToken() {
  const path = "/account/v1.0/token";
  const timestamp = Date.now();

  const params = {
    appId: API_ID,
    timestamp: timestamp
  };

  const signature = sign(params, API_SECRET);

  const res = await fetch(BASE_URL + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      appId: API_ID,
      timestamp,
      sign: signature
    })
  });

  if (!res.ok) throw new Error("Token request failed");

  const data = await res.json();
  return data?.access_token;
}

async function getPlantList(token) {
  const res = await fetch(BASE_URL + "/station/v1.0/list", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify({
      page: 1,
      size: 10
    })
  });

  if (!res.ok) throw new Error("Station list failed");

  const data = await res.json();
  return data?.data?.list || [];
}

export const handler = async () => {
  try {
    if (!API_ID || !API_SECRET) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing API credentials" })
      };
    }

    const token = await getAccessToken();
    const stations = await getPlantList(token);

    if (!stations.length) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "No station found" })
      };
    }

    const station = stations[0];

    const total_kwh =
      station.totalEnergy ||
      station.totalYield ||
      station.generationTotal ||
      0;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300"
      },
      body: JSON.stringify({
        station_name: station.stationName,
        total_kwh: Number(total_kwh),
        updated_at: station.lastUpdateTime || null
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
