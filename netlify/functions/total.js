// netlify/functions/total.js
import crypto from "crypto";

const BASE_URL = "https://globalapi.solarmanpv.com";

const API_ID = process.env.SOLARMAN_API_ID;
const API_SECRET = process.env.SOLARMAN_API_SECRET;
const EMAIL = process.env.SOLARMAN_USERNAME;
const PASSWORD = process.env.SOLARMAN_PASSWORD;

function sha256(str) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

function extractToken(data) {
  return data?.access_token ||
         data?.data?.access_token ||
         data?.data?.accessToken ||
         null;
}

async function getAccessToken() {

  const url = `${BASE_URL}/account/v1.0/token?appId=${API_ID}&language=en`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: EMAIL,
      password: sha256(PASSWORD),
      appSecret: API_SECRET
    })
  });

  const data = await res.json();

  const token = extractToken(data);

  if (!res.ok || !token) {
    throw new Error(
      "Token failed: " + JSON.stringify(data)
    );
  }

  return token;
}

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

export const handler = async () => {
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
        station_name: station.name || station.stationName,
        total_kwh: Number(total_kwh),
        updated_at: station.lastUpdateTime || null
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
