export const TOKEN_KEY = "token";
const AUTH_API_URL =
  import.meta.env.VITE_AUTH_API_URL || "http://localhost:5000/api/v1";

async function request(path, payload) {
  let response;
  try {
    response = await fetch(`${AUTH_API_URL}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Could not reach the bookstore API. Please try again.");
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("The bookstore API returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(data?.error?.message || "Unable to complete your request.");
  }

  return data;
}

export async function register({ name, email, password }) {
  return request("/auth/register", { name, email, password });
}

export async function login({ email, password }) {
  return request("/auth/login", { email, password });
}
