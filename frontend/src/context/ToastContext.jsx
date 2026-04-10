import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    ({ title, message = "", type = "info", duration = 3000 }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev, { id, title, message, type }]);
      window.setTimeout(() => removeToast(id), duration);
    },
    [removeToast]
  );

  const value = useMemo(
    () => ({
      success: (title, message) => pushToast({ title, message, type: "success" }),
      error: (title, message) => pushToast({ title, message, type: "error" }),
      info: (title, message) => pushToast({ title, message, type: "info", duration: 2800 }),
    }),
    [pushToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-24 z-[70] flex w-[340px] max-w-[92vw] flex-col gap-2 md:top-4">
        {toasts.map((toast) => {
          const tone =
            toast.type === "success"
              ? "border-v-green/40 bg-v-card text-white"
              : toast.type === "error"
                ? "border-red-400/45 bg-[#1a1012] text-white"
                : toast.type === "info"
                  ? "border-v-accent/35 bg-v-card text-white"
                  : "border-white/12 bg-v-card text-white";
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto rounded-2xl border px-4 py-3.5 text-sm shadow-v-card ${tone}`}
            >
              <p className="font-semibold">{toast.title}</p>
              {toast.message ? <p className="mt-1 text-white/70">{toast.message}</p> : null}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
};
