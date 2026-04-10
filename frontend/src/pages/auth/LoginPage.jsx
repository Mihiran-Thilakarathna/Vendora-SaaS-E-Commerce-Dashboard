import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState({ email: "", password: "" });
  const [role, setRole] = useState("admin");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const onChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const loggedInUser = await login(form.email, form.password);
      toast.success("Welcome back", `${loggedInUser.name} signed in successfully.`);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const message = err?.response?.data?.message || "Login failed.";
      setError(message);
      toast.error("Login failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-v-page p-6 text-white">
      <div className="w-full max-w-md rounded-[28px] border border-white/[0.08] bg-v-card p-8 shadow-v-card">
        <div className="flex flex-col items-center">
          <img
            src="/vendora-logo.png"
            alt="Vendora"
            className="h-16 w-16 mb-2 object-contain"
          />
          <h2 className="text-4xl font-extrabold tracking-tight text-v-accent">Vendora</h2>
          <p className="mt-2 text-sm text-white/50">Sign in to your Vendora workspace</p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="flex justify-center mb-6 pl-1 pr-1 bg-v-surface/60 rounded-xl p-1 gap-1">
            <button
              type="button"
              onClick={() => setRole("admin")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${
                role === "admin"
                  ? "bg-v-accent text-black shadow-v-glow"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => setRole("staff")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${
                role === "staff"
                  ? "bg-v-accent text-black shadow-v-glow"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              Staff
            </button>
          </div>

          <input
            name="email"
            type="email"
            required
            value={form.email}
            onChange={onChange}
            placeholder="Email"
            className="w-full rounded-2xl border border-white/10 bg-v-surface px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-v-accent/50 focus:ring-1 focus:ring-v-accent/30"
          />
          <div className="relative">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              required
              value={form.password}
              onChange={onChange}
              placeholder="Password"
              className="w-full rounded-2xl border border-white/10 bg-v-surface px-4 py-3.5 pr-11 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-v-accent/50 focus:ring-1 focus:ring-v-accent/30"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-xl p-2 text-white/55 hover:bg-white/5 hover:text-white"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-v-accent py-3.5 text-sm font-bold text-black shadow-v-glow transition hover:bg-v-accent-hover disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
