import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  PackageX,
  Store,
  UserRound,
  Users,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { gsap, useGSAP, prefersReducedMotion } from "../../lib/gsap";
import SpotlightCard from "../../components/reactbits/SpotlightCard";
import { useServerStatus, waitForServer, warmUpServer } from "../../services/serverStatus";

const GOOGLE_ENABLED = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
const MIN_PASSWORD = 6;

const DEMO_ROLES = [
  { id: "Admin", text: "Analytics, inventory & team" },
  { id: "Staff", text: "Orders & stock alerts" },
];

const FEATURES = [
  { label: "Sales & profit analytics", icon: BarChart3 },
  { label: "Low-stock alerts", icon: PackageX },
  { label: "Admin & Staff roles", icon: Users },
];

const TABS = [
  { id: "signin", label: "Sign in" },
  { id: "signup", label: "Create store" },
];

const inputClass =
  "w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-v-accent/60 focus:ring-2 focus:ring-v-accent/15";
const submitClass =
  "flex w-full items-center justify-center gap-2 rounded-xl bg-v-accent py-3 text-sm font-bold text-black shadow-[0_8px_28px_-8px_rgba(225,251,21,0.55)] transition hover:bg-v-accent-hover disabled:opacity-60";
const switchLinkClass = "font-semibold text-v-accent underline-offset-4 transition hover:underline";

/** Text input with a leading icon. */
const Field = ({ label, hint, icon: Icon, className = inputClass, trailing, ...input }) => (
  <label className="block">
    <span className="mb-1.5 flex items-baseline justify-between gap-2 text-xs font-medium text-white/60">
      {label}
      {hint ? <span className="font-normal text-white/35">{hint}</span> : null}
    </span>
    <span className="relative block">
      <Icon size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" />
      <input className={className} {...input} />
      {trailing}
    </span>
  </label>
);

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login, signup, demoLogin, googleLogin, logout, isAuthenticated, isLoading } = useAuth();
  const toast = useToast();

  // True when the visitor pressed Back from inside the app to this page (see `run` below).
  const cameBack = Boolean(location.state?.fromSignIn);
  // Set while signing in from this page, so the "came back" sign-out below never ends the new session.
  const signingIn = useRef(false);

  const rootRef = useRef(null);
  const panelRefs = { signin: useRef(null), signup: useRef(null) };
  const mounted = useRef(false);

  const [tab, setTab] = useState("signin"); // "signin" | "signup"
  const [signinForm, setSigninForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({ name: "", storeName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(null); // "signin" | "signup" | "google" | "demo-Admin" | "demo-Staff"
  const [showPassword, setShowPassword] = useState(false);

  const serverStatus = useServerStatus();
  // Start waking the API the moment this page opens (free hosting sleeps when idle).
  useEffect(() => {
    warmUpServer();
  }, []);

  const setSignin = (key) => (e) => setSigninForm((p) => ({ ...p, [key]: e.target.value }));
  const setSignup = (key) => (e) => setSignupForm((p) => ({ ...p, [key]: e.target.value }));

  // Entrance: content rises in, staggered. No blur, so text is crisp from the first frame it shows.
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from("[data-logo]", { opacity: 0, y: -8, duration: 0.5 })
        .from("[data-line]", { opacity: 0, y: 24, duration: 0.7, stagger: 0.12 }, 0.1)
        .from("[data-fade]", { opacity: 0, y: 12, duration: 0.55 }, 0.3)
        .from("[data-panel-card]", { opacity: 0, y: 26, duration: 0.75, stagger: 0.1 }, 0.35);
    },
    { scope: rootRef }
  );

  // Crossfade the newly shown form when switching tabs.
  useLayoutEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const el = panelRefs[tab].current;
    if (prefersReducedMotion() || !el) return;
    gsap.fromTo(el, { opacity: 0, x: tab === "signup" ? 14 : -14 }, { opacity: 1, x: 0, duration: 0.3, ease: "power2.out" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Back from the dashboard lands here: end that session so the visitor can pick again
  // (another demo role, sign in, or create a store) instead of being bounced forward.
  useEffect(() => {
    if (!cameBack || isLoading || !isAuthenticated || signingIn.current) return;
    const wasDemo = Boolean(user?.isDemo || user?.store?.isDemo);
    logout();
    if (!wasDemo && user) toast.success("Signed out", "Sign in again to get back to your store.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameBack, isLoading, isAuthenticated]);

  // Opening the site while already signed in goes straight to the dashboard. Not while a
  // sign-in is in flight, or this would replace the login entry that Back should return to.
  if (!isLoading && isAuthenticated && !cameBack && !pending) {
    return <Navigate to="/dashboard" replace />;
  }

  const fail = (err, fallback, title) => {
    const offline = err?.request && !err?.response;
    const message =
      err?.response?.data?.message ||
      (offline ? "The server didn't respond. Please check your connection and try again." : fallback);
    setError(message);
    toast.error(title, message);
  };

  const run = async (kind, action, how, fallback, failTitle = "Sign in failed") => {
    if (pending) return;
    setError("");
    setPending(kind);
    signingIn.current = true;
    try {
      // If the API is still waking up, wait for it instead of failing straight away.
      if (!(await waitForServer())) {
        const unreachable = new Error("Server unavailable");
        unreachable.response = {
          data: {
            message:
              "The server isn't responding right now. Please try again in a minute.",
          },
        };
        throw unreachable;
      }
      const signedIn = await action();
      toast.success(`Welcome, ${signedIn.name}`, typeof how === "function" ? how(signedIn) : how);
      // Keep this page in history (push, not replace) and tag its entry, so the browser's
      // Back button returns here instead of leaving the site.
      window.history.replaceState(
        { ...window.history.state, usr: { ...(window.history.state?.usr || {}), fromSignIn: true } },
        ""
      );
      navigate("/dashboard");
    } catch (err) {
      signingIn.current = false;
      fail(err, fallback, failTitle);
    } finally {
      setPending(null);
    }
  };

  const startDemo = (role) =>
    run(`demo-${role}`, () => demoLogin(role), `You're exploring the ${role} demo.`, "Demo sign-in failed.");

  const switchTab = (next) => {
    if (next === tab) return;
    setError("");
    setShowPassword(false);
    setTab(next);
  };

  const onTabKey = (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = tab === "signin" ? "signup" : "signin";
    switchTab(next);
    document.getElementById(`auth-tab-${next}`)?.focus();
  };

  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword((v) => !v)}
      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/40 transition hover:text-white"
      aria-label={showPassword ? "Hide password" : "Show password"}
    >
      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );

  const googleButton = (kind) =>
    GOOGLE_ENABLED ? (
      <>
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={({ credential }) =>
              run("google", () => googleLogin(credential), "Signed in with Google.", "Google sign-in failed.")
            }
            onError={() => fail(null, "Google sign-in was cancelled.", "Sign in failed")}
            theme="filled_black"
            size="large"
            shape="pill"
            text={kind === "signup" ? "signup_with" : "continue_with"}
            width="340"
          />
        </div>
        <div className="my-3.5 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.14em] text-white/30">
          <span className="h-px flex-1 bg-white/10" />
          or with email
          <span className="h-px flex-1 bg-white/10" />
        </div>
      </>
    ) : null;

  const errorBox = error ? (
    <p role="alert" className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
      {error}
    </p>
  ) : null;

  // Both forms share one grid cell, so the card is always as tall as the taller form and never
  // jumps when switching tabs. The hidden one is `invisible`, which also takes it out of tab order.
  const panelClass = (id) =>
    `flex flex-col [grid-area:1/1] ${tab === id ? "" : "pointer-events-none invisible"}`;

  return (
    <div
      ref={rootRef}
      className="relative flex h-[100dvh] flex-col overflow-y-auto overflow-x-hidden bg-v-page font-sans text-white antialiased"
    >
      {/* ---------- Background: slow drifting light ---------- */}
      <div className="v-aurora fixed" aria-hidden>
        <span className="v-aurora-a" />
        <span className="v-aurora-b" />
        <span className="v-aurora-c" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-4 sm:px-6 lg:px-8">
        {/* ---------- Top bar: centred brand ---------- */}
        <header className="flex shrink-0 justify-center py-3 max-lg:[@media(max-height:740px)]:py-2 lg:py-5 lg:[@media(max-height:840px)]:py-3">
          <div data-logo className="flex items-center gap-3">
            <img src="/vendora-logo.png" alt="" className="h-11 w-11 object-contain max-lg:[@media(max-height:740px)]:h-9 max-lg:[@media(max-height:740px)]:w-9 sm:h-12 sm:w-12" />
            <span className="text-2xl font-extrabold tracking-tight max-lg:[@media(max-height:740px)]:text-xl sm:text-[28px]">Vendora</span>
          </div>
        </header>

        {/* Desktop: pitch + demo on the left, account card on the right. Phones: pitch, demo, account. */}
        <main className="grid flex-1 content-center gap-5 pb-2 [grid-template-areas:'hero'_'demo'_'auth'] max-lg:[@media(max-height:740px)]:gap-2.5 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-x-20 lg:gap-y-9 lg:py-4 lg:[grid-template-areas:'hero_auth'_'demo_auth'] lg:[@media(max-height:840px)]:gap-y-7">
          {/* ---------- Hero ---------- */}
          <section className="[grid-area:hero] lg:self-end">
            <h1 className="text-[28px] font-extrabold leading-[1.06] tracking-tight max-lg:[@media(max-height:740px)]:text-[26px] sm:text-5xl lg:text-[52px] lg:[@media(max-height:840px)]:text-[44px]">
              <span data-line className="block">
                Run your store
              </span>
              <span data-line className="block text-v-accent">
                from one dashboard.
              </span>
            </h1>
            <p data-fade className="mt-4 hidden max-w-md text-base text-white/55 sm:block lg:[@media(max-height:840px)]:mt-3">
              Sales, inventory, orders and your team, in one place.
            </p>
            <ul data-fade className="mt-5 hidden flex-wrap gap-x-5 gap-y-2 sm:flex lg:[@media(max-height:840px)]:mt-4">
              {FEATURES.map(({ label, icon: Icon }) => (
                <li key={label} className="flex items-center gap-2 text-sm text-white/65">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-v-accent text-black">
                    <Icon size={13} strokeWidth={2.4} />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </section>

          {/* ---------- Live demo: the main path for first-time visitors ---------- */}
          <section data-panel-card aria-labelledby="demo-heading" className="[grid-area:demo] lg:self-start">
            <div className="relative overflow-hidden rounded-[24px] border border-v-accent/25 bg-v-card/70 p-3.5 shadow-[0_24px_60px_-28px_rgba(225,251,21,0.28)] backdrop-blur-xl transition-colors duration-300 hover:border-v-accent/40 max-lg:[@media(max-height:740px)]:p-3 sm:p-5 lg:p-6 lg:max-w-xl lg:[@media(max-height:840px)]:p-5">
              {/* Soft lime light from the top-left corner: marks this as the main way in without shouting. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_90%_at_0%_0%,rgba(225,251,21,0.09),transparent_60%)]"
              />
              <div className="relative flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                <div className="min-w-0">
                  <h2 id="demo-heading" className="flex items-center gap-2 text-base font-bold text-white sm:gap-2.5 sm:text-xl">
                    <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-v-green opacity-60 [animation-duration:2.2s] motion-reduce:animate-none" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-v-green" />
                    </span>
                    Try the live demo
                  </h2>
                  <p className="mt-0.5 hidden text-sm text-white/50 sm:block">
                    Explore a fully loaded sample store as either role.
                  </p>
                </div>
                <span className="shrink-0 whitespace-nowrap rounded-full border border-v-accent/30 bg-v-accent/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-v-accent sm:px-2.5 sm:text-[10px] sm:tracking-[0.12em]">
                  No sign-up needed
                </span>
              </div>

              {serverStatus !== "ready" && serverStatus !== "checking" ? (
                <div
                  role="status"
                  className={`relative mt-3 flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-xs ${
                    serverStatus === "waking"
                      ? "border-white/10 bg-white/[0.03] text-white/65"
                      : "border-amber-400/30 bg-amber-400/[0.07] text-amber-100/85"
                  }`}
                >
                  {serverStatus === "waking" ? (
                    <Loader2 size={14} className="mt-0.5 shrink-0 animate-spin text-v-accent" />
                  ) : (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-300" />
                  )}
                  <span>
                    {serverStatus === "waking"
                      ? pending
                        ? "Starting the server. You'll be signed in automatically in a moment."
                        : "Starting the server. The first visit after a quiet period can take up to a minute."
                      : serverStatus === "db-down"
                        ? "The server is up but can't reach its database yet. It will retry automatically."
                        : "The server isn't responding right now. Please try again in a minute."}
                  </span>
                </div>
              ) : null}

              <div className="relative mt-3 grid grid-cols-2 gap-2.5 sm:mt-4">
                {DEMO_ROLES.map(({ id, text }) => {
                  const busy = pending === `demo-${id}`;
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={Boolean(pending)}
                      onClick={() => startDemo(id)}
                      aria-label={`Explore the live demo as ${id}`}
                      className="group flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.03] px-3 py-3.5 sm:gap-3 sm:px-4 text-left text-white transition duration-300 hover:-translate-y-0.5 hover:border-v-accent/60 hover:bg-v-accent/[0.06] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block whitespace-nowrap text-[15px] font-bold">
                          <span className="sm:hidden">{id} demo</span>
                          <span className="hidden sm:inline">Explore as {id}</span>
                        </span>
                        <span className="hidden truncate text-xs text-white/45 sm:block">{text}</span>
                      </span>
                      {busy ? (
                        <Loader2 size={20} className="shrink-0 animate-spin text-v-accent" />
                      ) : (
                        <ArrowUpRight
                          size={22}
                          strokeWidth={2}
                          className="h-[18px] w-[18px] shrink-0 text-white/60 sm:h-[22px] sm:w-[22px] transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-v-accent"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ---------- Account ---------- */}
          <div data-panel-card className="flex [grid-area:auth] lg:self-center">
              <SpotlightCard
                as="section"
                aria-label="Your account"
                spotlightColor="rgba(225, 251, 21, 0.05)"
                borderColor="rgba(225, 251, 21, 0.35)"
                className="flex w-full flex-col rounded-[24px] border border-white/10 bg-v-card/85 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85)] backdrop-blur-xl"
              >

                <div className="flex flex-1 flex-col p-4 max-lg:[@media(max-height:740px)]:p-3.5 sm:p-6 lg:[@media(max-height:840px)]:p-5">
                  <div
                    role="tablist"
                    aria-label="Account"
                    onKeyDown={onTabKey}
                    className="grid grid-cols-2 gap-1 rounded-2xl border border-white/[0.08] bg-black/30 p-1"
                  >
                    {TABS.map(({ id, label }) => {
                      const selected = tab === id;
                      return (
                        <button
                          key={id}
                          id={`auth-tab-${id}`}
                          type="button"
                          role="tab"
                          aria-selected={selected}
                          aria-controls={`auth-panel-${id}`}
                          tabIndex={selected ? 0 : -1}
                          onClick={() => switchTab(id)}
                          className={`rounded-xl py-2 text-sm font-semibold transition ${
                            selected ? "bg-white/[0.09] text-white shadow-sm" : "text-white/45 hover:text-white/80"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 grid flex-1 sm:mt-5 lg:[@media(max-height:840px)]:mt-4">
                    {/* Sign in */}
                    <div
                      ref={panelRefs.signin}
                      id="auth-panel-signin"
                      role="tabpanel"
                      aria-labelledby="auth-tab-signin"
                      className={panelClass("signin")}
                    >
                      <h2 className="text-xl font-bold text-white max-lg:[@media(max-height:740px)]:hidden">Welcome back</h2>
                      <p className="mt-1 text-sm text-white/50 max-lg:[@media(max-height:740px)]:hidden">
                        Sign in to your store's dashboard.
                      </p>
                      <div className="mt-4 max-lg:[@media(max-height:740px)]:mt-0 lg:[@media(max-height:840px)]:mt-3">
                        {googleButton("signin")}
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            run(
                              "signin",
                              () => login(signinForm.email, signinForm.password),
                              (u) => (u.store?.name ? `Signed in to ${u.store.name}.` : "Signed in successfully."),
                              "Login failed."
                            );
                          }}
                          className="space-y-3"
                        >
                          <Field
                            label="Email"
                            icon={Mail}
                            type="email"
                            autoComplete="email"
                            required
                            value={signinForm.email}
                            onChange={setSignin("email")}
                            placeholder="you@company.com"
                          />
                          <Field
                            label="Password"
                            icon={Lock}
                            type={showPassword ? "text" : "password"}
                            autoComplete="current-password"
                            required
                            value={signinForm.password}
                            onChange={setSignin("password")}
                            placeholder="••••••••"
                            className={`${inputClass} pr-11`}
                            trailing={passwordToggle}
                          />
                          <button type="submit" disabled={Boolean(pending)} className={`${submitClass} !mt-4`}>
                            {pending === "signin" ? <Loader2 size={16} className="animate-spin" /> : null}
                            {pending === "signin" ? "Signing in…" : "Sign in"}
                          </button>
                        </form>
                        {tab === "signin" ? errorBox : null}
                      </div>
                      <p className="mt-auto pt-4 text-center text-sm text-white/50 max-lg:[@media(max-height:740px)]:hidden">
                        New to Vendora?{" "}
                        <button type="button" onClick={() => switchTab("signup")} className={switchLinkClass}>
                          Create your store
                        </button>
                      </p>
                    </div>

                    {/* Create store */}
                    <div
                      ref={panelRefs.signup}
                      id="auth-panel-signup"
                      role="tabpanel"
                      aria-labelledby="auth-tab-signup"
                      className={panelClass("signup")}
                    >
                      <h2 className="text-xl font-bold text-white max-lg:[@media(max-height:740px)]:hidden">
                        Create your store
                      </h2>
                      <p className="mt-1 text-sm text-white/50 max-lg:[@media(max-height:740px)]:hidden">
                        You'll be the Admin and can add your team later.
                      </p>
                      <div className="mt-4 max-lg:[@media(max-height:740px)]:mt-0 lg:[@media(max-height:840px)]:mt-3">
                        {googleButton("signup")}
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            run(
                              "signup",
                              () => signup(signupForm),
                              (u) => `${u.store?.name || "Your store"} is ready.`,
                              "Sign up failed.",
                              "Sign up failed"
                            );
                          }}
                          className="space-y-3"
                        >
                          <div className="grid grid-cols-2 gap-3">
                            <Field
                              label="Your name"
                              icon={UserRound}
                              type="text"
                              autoComplete="name"
                              required
                              maxLength={60}
                              value={signupForm.name}
                              onChange={setSignup("name")}
                              placeholder="Nimal Perera"
                            />
                            <Field
                              label="Store name"
                              icon={Store}
                              type="text"
                              autoComplete="organization"
                              required
                              maxLength={80}
                              value={signupForm.storeName}
                              onChange={setSignup("storeName")}
                              placeholder="Perera Tech"
                            />
                          </div>
                          <Field
                            label="Work email"
                            icon={Mail}
                            type="email"
                            autoComplete="email"
                            required
                            value={signupForm.email}
                            onChange={setSignup("email")}
                            placeholder="you@company.com"
                          />
                          <Field
                            label="Password"
                            hint={`At least ${MIN_PASSWORD} characters`}
                            icon={Lock}
                            type={showPassword ? "text" : "password"}
                            autoComplete="new-password"
                            required
                            minLength={MIN_PASSWORD}
                            value={signupForm.password}
                            onChange={setSignup("password")}
                            placeholder="••••••••"
                            className={`${inputClass} pr-11`}
                            trailing={passwordToggle}
                          />
                          <button type="submit" disabled={Boolean(pending)} className={`${submitClass} !mt-4`}>
                            {pending === "signup" ? <Loader2 size={16} className="animate-spin" /> : null}
                            {pending === "signup" ? "Creating your store…" : "Create store"}
                            {pending === "signup" ? null : <ArrowRight size={16} />}
                          </button>
                        </form>
                        {tab === "signup" ? errorBox : null}
                      </div>
                      <p className="mt-auto pt-4 text-center text-sm text-white/50 max-lg:[@media(max-height:740px)]:hidden">
                        Already have an account?{" "}
                        <button type="button" onClick={() => switchTab("signin")} className={switchLinkClass}>
                          Sign in
                        </button>
                      </p>
                    </div>
                  </div>
                </div>
              </SpotlightCard>
            </div>
        </main>

        <footer className="shrink-0 py-2 text-center text-[11px] text-white/30 max-lg:[@media(max-height:740px)]:hidden lg:py-4 lg:[@media(max-height:840px)]:py-2.5">
          © {new Date().getFullYear()} Vendora · Each store's data is private to its own team.
        </footer>
      </div>
    </div>
  );
};

export default LoginPage;
