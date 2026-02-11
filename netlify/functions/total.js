// netlify/functions/total.js

const BASE_URL = process.env.SOLARMAN_BASE_URL;
const API_ID = process.env.SOLARMAN_API_ID;
const API_SECRET = process.env.SOLARMAN_API_SECRET;
const EMAIL = process.env.SOLARMAN_USERNAME;
const PASSWORD = process.env.SOLARMAN_PASSWORD;

async function getAccessToken() {
  const res = await fetch(BASE_URL + "/account/v1.0/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      appId: API_ID,
      appSecret: API_SECRET,
      email: EMAIL,
      password: PASSWORD
    })
  });

  if (!res.ok) {
    throw new Error("Token request failed: " + res.status);
  }

  const data = await res.json();

  if (!data.access_token) {
    throw new Error("No access_token returned");
  }

  return data.access_token;
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

  if (!res.ok) {
    throw new Error("Station list failed: " + res.status);
  }

  const data = await res.json();
  return data?.data?.list || [];
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
