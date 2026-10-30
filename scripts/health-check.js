const HEALTH_URL = process.env.HEALTH_URL || "http://localhost:5000/health";

async function checkHealth() {
  try {
    const response = await fetch(HEALTH_URL);
    const body = await response.json();

    if (!response.ok || body.status !== "OK" || body.database !== "Connected") {
      console.error("Health check failed:", response.status, body);
      process.exitCode = 1;
      return;
    }

    console.log("Health check passed:", new Date().toISOString(), body);
  } catch (error) {
    console.error("Health check could not reach the server:", error.message);
    process.exitCode = 1;
  }
}

checkHealth();