import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/api";

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
        const { data } = await api.get("/auth/me");
        setUser(data.data);
      } catch {
        localStorage.removeItem("vendora_token");
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();
  }, [token]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    const authToken = data.data.token;
    localStorage.setItem("vendora_token", authToken);
    setToken(authToken);
    setUser(data.data.user);
    return data.data.user;
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
