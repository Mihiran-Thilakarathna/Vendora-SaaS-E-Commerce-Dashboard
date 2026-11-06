import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { waitForServer } from "../services/serverStatus";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("vendora_token"));
  const [isLoading, setIsLoading] = useState(true);

  const applySession = useCallback((authToken, userPayload) => {
    if (authToken) {
      localStorage.setItem("vendora_token", authToken);
      setToken(authToken);
    }
    if (userPayload) {
      setUser(userPayload);
    }
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        // The API may still be waking up (free hosting sleeps when idle): wait for it, so a
        // cold start doesn't look like an expired session and sign the visitor out.
        await waitForServer();
        const { data } = await api.get("/auth/me");
        setUser(data.data);
      } catch {
        // Expired/invalid session, or the server stayed unreachable even after waiting.
        localStorage.removeItem("vendora_token");
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();
  }, [token]);

  const startSession = (data) => {
    const authToken = data.data.token;
    localStorage.setItem("vendora_token", authToken);
    setToken(authToken);
    setUser(data.data.user);
    return data.data.user;
  };

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    return startSession(data);
  };

  /** Create a new store; the caller becomes its Admin and is signed straight in. */
  const signup = async ({ name, email, password, storeName }) => {
    const { data } = await api.post("/auth/signup", { name, email, password, storeName });
    return startSession(data);
  };

  /** One-click sign-in to the shared demo account for `role` ("Admin" | "Staff"). */
  const demoLogin = async (role) => {
    const { data } = await api.post("/auth/demo", { role });
    return startSession(data);
  };

  /** Exchange a Google Identity Services credential (ID token) for a Vendora session. */
  const googleLogin = async (credential) => {
    const { data } = await api.post("/auth/google", { credential });
    return startSession(data);
  };

  const logout = () => {
    localStorage.removeItem("vendora_token");
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: Boolean(token),
      login,
      signup,
      demoLogin,
      googleLogin,
      logout,
      applySession,
    }),
    [user, token, isLoading, applySession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
};
