import { Suspense, useLayoutEffect, useRef } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, Package, ShoppingCart, Sparkles, UserRound, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { gsap, useGSAP, prefersReducedMotion } from "../../lib/gsap";
import OperationalAlerts from "../alerts/OperationalAlerts";
import HeaderToolbox from "./HeaderToolbox";

const links = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, roles: ["Admin", "Staff"] },
  { label: "Orders", to: "/orders", icon: ShoppingCart, roles: ["Admin", "Staff"] },
  { label: "Inventory", to: "/inventory", icon: Package, roles: ["Admin"] },
  { label: "Team", to: "/team", icon: Users, roles: ["Admin"] },
  { label: "Profile", to: "/profile", icon: UserRound, roles: ["Admin", "Staff"] },
];

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

const Logo = ({ className = "" }) => (
  <Link to="/dashboard" className={`inline-flex shrink-0 items-center gap-2 font-extrabold tracking-tight text-v-accent ${className}`}>
    <img
      src="/vendora-logo.png"
      alt=""
      aria-hidden="true"
      className="h-9 w-9 object-contain"
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
    Vendora
  </Link>
);

const AppLayout = () => {
  const location = useLocation();
  const { user } = useAuth();
  const navRef = useRef(null);
  const indicatorRef = useRef(null);
  const contentRef = useRef(null);
  const firstPaint = useRef(true);

  const visibleLinks = links.filter((link) => link.roles.includes(user?.role));
  const showOperationalAlerts = !location.pathname.startsWith("/profile");
  const activeTo = visibleLinks.find((l) => location.pathname.startsWith(l.to))?.to;

  // Sliding active-pill indicator in the sidebar.
  useLayoutEffect(() => {
    const nav = navRef.current;
    const indicator = indicatorRef.current;
    if (!nav || !indicator) return;
    const active = nav.querySelector(`[data-nav="${activeTo}"]`);
    if (!active) {
      gsap.set(indicator, { opacity: 0 });
      return;
    }
    const props = { y: active.offsetTop, height: active.offsetHeight, opacity: 1 };
    if (firstPaint.current || prefersReducedMotion()) {
      gsap.set(indicator, props);
    } else {
      gsap.to(indicator, { ...props, duration: 0.55, ease: "elastic.out(1, 0.75)" });
    }
  }, [activeTo, visibleLinks.length]);

  // Page transition on route change + sidebar entrance on first load.
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      if (firstPaint.current) {
        gsap.from("[data-side-in]", { opacity: 0, x: -24, duration: 0.6, stagger: 0.06 });
        firstPaint.current = false;
      }
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 18, filter: "blur(6px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.6, ease: "power3.out", clearProps: "filter,transform" }
      );
    },
    { dependencies: [location.pathname] }
  );


  return (
    <div className="min-h-screen bg-v-page font-sans text-white antialiased">
        {/* ---------- Desktop sidebar ---------- */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-white/[0.06] bg-v-elevated/80 px-4 py-6 backdrop-blur-xl lg:flex">
          <div data-side-in className="px-2">
            <Logo className="text-2xl" />
          </div>

          <div data-side-in className="mt-10 px-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">Store</p>
            <p className="mt-1 truncate text-sm font-bold text-white/85" title={user?.store?.name}>
              {user?.store?.name || "Workspace"}
            </p>
          </div>
          <nav ref={navRef} className="relative mt-3 flex flex-col gap-1" aria-label="Main">
            <span
              ref={indicatorRef}
              className="pointer-events-none absolute left-0 right-0 top-0 rounded-2xl bg-v-accent shadow-v-glow"
              style={{ opacity: 0 }}
              aria-hidden
            />
            {visibleLinks.map((link) => {
              const active = activeTo === link.to;
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  data-nav={link.to}
                  data-side-in
                  aria-current={active ? "page" : undefined}
                  className={`relative z-10 flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold transition-colors duration-300 ${
                    active ? "text-black" : "text-white/55 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <Icon size={18} strokeWidth={2.2} />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-3">
            {user?.isDemo ? (
              <div data-side-in className="v-gradient-border rounded-2xl p-px">
                <div className="rounded-[15px] bg-v-card p-4">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-v-accent">
                    <Sparkles size={13} /> Live demo
                  </p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-white/50">
                    You're in the shared <span className="font-semibold text-white/80">{user.role}</span> demo.
                    Changes are visible to other visitors.
                  </p>
                </div>
              </div>
            ) : null}
            <Link
              to="/profile"
              data-side-in
              className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 transition hover:border-white/15 hover:bg-white/[0.04]"
              title="Open your profile"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-v-accent/15 text-sm font-extrabold text-v-accent">
                {user?.avatarURL ? <img src={user.avatarURL} alt="" className="h-full w-full object-cover" /> : (user?.name || "?").charAt(0)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{user?.name}</p>
                <p className="truncate text-[11px] text-white/45">{user?.role}</p>
              </div>
            </Link>
          </div>
        </aside>

        <div className="lg:pl-[248px]">
          {/* ---------- Top bar ---------- */}
          <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-v-page/80 backdrop-blur-xl">
            <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <Logo className="text-xl lg:hidden" />
                <div className="hidden min-w-0 lg:block">
                  <p className="truncate text-sm font-semibold text-white">
                    {greeting()}, <span className="font-extrabold">{user?.name || "there"}</span>
                  </p>
                  <p className="text-xs text-white/40">
                    {new Date().toLocaleDateString("en-LK", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                </div>
                <div className="hidden min-w-0 min-[400px]:block lg:hidden">
                  <p className="max-w-[40vw] truncate text-xs font-semibold text-white/50">{user?.store?.name}</p>
                </div>
              </div>
              <HeaderToolbox />
            </div>

            <nav className="flex gap-2 v-no-scrollbar overflow-x-auto px-4 pb-3 lg:hidden" aria-label="Main mobile">
              {visibleLinks.map((link) => {
                const active = activeTo === link.to;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
                      active ? "border-v-accent bg-v-accent text-black" : "border-white/10 bg-v-surface text-white/75"
                    }`}
                  >
                    <Icon size={15} />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </header>

          <main className="mx-auto max-w-[1500px] px-4 py-6 lg:px-8 lg:py-8">
            {user?.isDemo ? (
              <p className="mb-5 flex items-center gap-2 rounded-2xl border border-v-accent/25 bg-v-accent/[0.06] px-4 py-2.5 text-xs text-white/70 lg:hidden">
                <Sparkles size={14} className="shrink-0 text-v-accent" />
                Live {user.role} demo: data is shared with other visitors.
              </p>
            ) : null}
            <div ref={contentRef}>
              {showOperationalAlerts ? <OperationalAlerts userRole={user?.role} /> : null}
              <Suspense
                fallback={
                  <div className="flex min-h-[50vh] items-center justify-center">
                    <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-v-accent" aria-label="Loading" />
                  </div>
                }
              >
                <Outlet />
              </Suspense>
            </div>
          </main>
        </div>
    </div>
  );
};

export default AppLayout;
