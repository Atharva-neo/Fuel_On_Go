import { API_BASE_URL } from "@/lib/config";

const BASE_URL = API_BASE_URL;

async function request(path, options = {}) {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      cache: "no-store",
    });

    const isJson = response.headers.get("content-type")?.includes("application/json");
    const payload = isJson ? await response.json() : null;

    if (!response.ok) {
      const message = payload?.error || payload?.message || "Request failed";
      throw new Error(message);
    }

    // For endpoints with a data field, return that. Otherwise, return entire payload
    if (payload?.data !== undefined) {
      return payload.data;
    }
    // For other responses like loginreturn the whole object minus success/message
    const { success, message, ...data } = payload;
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Backend not connected. Please ensure the server is running.");
  }
}

export async function getPumps() {
  return request("/pumps");
}

export async function getSlots(pumpId) {
  return request(`/slots/${pumpId}`);
}

export async function bookSlot(data) {
  return request("/bookings", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function adminLogin(data) {
  return request("/admin/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
