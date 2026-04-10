import { Link, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, Package, ShoppingCart } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import OperationalAlerts from "../alerts/OperationalAlerts";
import HeaderToolbox from "./HeaderToolbox";

const links = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, roles: ["Admin", "Staff"] },
  { label: "Orders", to: "/orders", icon: ShoppingCart, roles: ["Admin", "Staff"] },
  { label: "Inventory", to: "/inventory", icon: Package, roles: ["Admin"] },
];

const AppLayout = () => {
  const location = useLocation();
  const { user } = useAuth();
  const logoSrc = "/vendora-logo.png";

  const visibleLinks = links.filter((link) => link.roles.includes(user?.role));
  const showOperationalAlerts = !location.pathname.startsWith("/profile");

  return (
    <div className="min-h-screen bg-v-page font-sans text-white antialiased">
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-v-page/85 shadow-[0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
        <div className="mx-auto grid max-w-[1600px] grid-cols-[1fr,auto] items-center gap-4 px-4 py-3.5 md:relative md:grid-cols-[1fr,auto,1fr] lg:px-8">
          <div className="flex min-w-0 items-center">
            <Link
              to="/dashboard"
              className="inline-flex shrink-0 items-center gap-1 text-xl font-extrabold tracking-tight text-v-accent md:text-2xl"
            >
              <img
                src={logoSrc}
                alt=""
                aria-hidden="true"
                className="h-11 w-11 rounded-md object-contain md:h-12 md:w-12"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              Vendora
            </Link>
          </div>

          <nav
            className="hidden md:absolute md:left-1/2 md:flex md:-translate-x-1/2"
            aria-label="Main"
          >
            <div className="flex rounded-full border border-white/10 bg-v-surface/90 p-1 shadow-inner shadow-black/40">
              {visibleLinks.map((link) => {
                const active = location.pathname.startsWith(link.to);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? "bg-v-accent text-black shadow-v-glow"
                        : "text-white/65 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon size={17} strokeWidth={2} />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="justify-self-end md:col-start-3">
            <HeaderToolbox />
          </div>
        </div>

        <div className="border-t border-white/[0.04] px-4 pb-3 pt-2 md:hidden">
          <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Main mobile">
            {visibleLinks.map((link) => {
              const active = location.pathname.startsWith(link.to);
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold ${
                    active
                      ? "border-v-accent bg-v-accent text-black"
                      : "border-white/10 bg-v-surface text-white/75"
                  }`}
                >
                  <Icon size={16} />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 lg:px-8">
        {showOperationalAlerts ? <OperationalAlerts userRole={user?.role} /> : null}
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
