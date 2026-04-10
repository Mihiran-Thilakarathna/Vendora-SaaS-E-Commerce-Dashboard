import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("vendora_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || "";
    const authPublic = url.includes("/auth/login") || url.includes("/auth/register");
    if (err.response?.status === 401 && !authPublic) {
      const had = localStorage.getItem("vendora_token");
      if (had) {
        localStorage.removeItem("vendora_token");
        if (!window.location.pathname.startsWith("/login")) {
          window.location.assign("/login");
        }
      }
    }
    return Promise.reject(err);
  }
);

export default api;
