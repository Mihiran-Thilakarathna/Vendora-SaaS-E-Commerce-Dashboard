import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Bell, LogOut, UserRound } from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import ConfirmDialog from "./ConfirmDialog";
import ProfileSettingsModal from "./ProfileSettingsModal";

const ProfileAvatarTrigger = ({ user, open, onClick, circleBtnClass }) => {
  const [imgErr, setImgErr] = useState(false);
  const [cacheBust, setCacheBust] = useState(Date.now());
  useEffect(() => {
    setImgErr(false);
    setCacheBust(Date.now());
  }, [user?.avatarURL]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-haspopup="true"
      className={`${circleBtnClass} relative shrink-0 overflow-hidden ${
        open ? "ring-2 ring-v-accent/45" : ""
      }`}
      aria-label="Account menu"
    >
      {user?.avatarURL?.trim() && !imgErr ? (
        <img
          src={`${user.avatarURL}${user.avatarURL.includes("?") ? "&" : "?"}v=${cacheBust}`}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImgErr(true)}
        />
      ) : (
        <UserRound size={19} strokeWidth={2} aria-hidden />
      )}
    </button>
  );
};

const HeaderToolbox = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const wrapRef = useRef(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const { data } = await api.get("/notifications");
      setNotifications(data.data?.notifications || []);
      setUnreadCount(data.data?.unreadCount ?? 0);
    } catch {
      /* ignore poll errors */
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const id = window.setInterval(loadNotifications, 15000);
    return () => window.clearInterval(id);
  }, [loadNotifications]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setSearchOpen(false);
        setNotifOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const runSearch = (e) => {
    e.preventDefault();
    const q = searchQ.trim();
    setSearchOpen(false);
    navigate(q ? `/orders?search=${encodeURIComponent(q)}` : "/orders");
  };

  const markRead = async (id) => {
    try {
      const { data } = await api.patch(`/notifications/${id}/read`);
      setUnreadCount(data.data?.unreadCount ?? 0);
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
    } catch {
      /* */
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch("/notifications/read-all");
      await loadNotifications();
    } catch {
      /* */
    }
  };

  const circleBtn =
    "flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-[#2a2a2a] text-white/85 transition hover:bg-[#333333] hover:text-white";

  return (
    <div ref={wrapRef} className="flex items-center gap-2 sm:gap-2.5">
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setSearchOpen((v) => !v);
            setNotifOpen(false);
            setProfileOpen(false);
          }}
          className={circleBtn}
          aria-label="Search"
        >
          <Search size={19} strokeWidth={2} />
        </button>
        {searchOpen ? (
          <form
            onSubmit={runSearch}
            className="absolute right-0 top-full z-[60] mt-2 w-[min(100vw-2rem,320px)] rounded-2xl border border-white/10 bg-v-card p-3 shadow-v-card"
          >
            <input
              autoFocus
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search orders…"
              className="w-full rounded-xl border border-white/10 bg-v-surface px-3 py-2.5 text-sm outline-none focus:border-v-accent/40"
            />
            <button
              type="submit"
              className="mt-2 w-full rounded-full bg-v-accent py-2.5 text-sm font-bold text-black"
            >
              Go to orders
            </button>
          </form>
        ) : null}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setNotifOpen((v) => !v);
            setSearchOpen(false);
            setProfileOpen(false);
            loadNotifications();
          }}
          className={`${circleBtn} relative`}
          aria-label="Notifications"
        >
          <Bell size={19} strokeWidth={2} />
          {unreadCount > 0 ? (
            <span
              className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-v-accent shadow-[0_0_10px_rgba(225,251,21,0.95)]"
              aria-hidden
            />
          ) : null}
        </button>
        {notifOpen ? (
          <div className="absolute right-0 top-full z-[60] mt-2 w-[min(100vw-1.5rem,380px)] max-h-[min(70vh,420px)] overflow-hidden rounded-2xl border border-white/10 bg-v-card shadow-v-card">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
              <span className="text-sm font-bold text-white">Notifications</span>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs font-semibold text-v-accent hover:underline"
                >
                  Mark all read
                </button>
              ) : null}
            </div>
            <ul className="max-h-72 overflow-y-auto">
              {!notifications.length ? (
                <li className="px-4 py-10 text-center text-sm text-white/45">
                  No notifications yet.
                </li>
              ) : (
                notifications.map((n) => (
                  <li key={n._id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!n.read) markRead(n._id);
                      }}
                      className={`w-full border-b border-white/[0.04] px-3 py-3 text-left transition hover:bg-white/[0.04] ${
                        n.read ? "opacity-65" : "bg-v-accent/[0.07]"
                      }`}
                    >
                      <p className="font-semibold text-white">{n.title}</p>
                      <p className="text-xs leading-snug text-white/55">{n.message}</p>
                      <p className="mt-1 text-[10px] text-white/35">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="relative">
        <ProfileAvatarTrigger
          user={user}
          open={profileOpen}
          circleBtnClass={circleBtn}
          onClick={() => {
            setProfileOpen((v) => !v);
            setSearchOpen(false);
            setNotifOpen(false);
          }}
        />
        {profileOpen ? (
          <div className="absolute right-0 top-full z-[60] mt-2 w-60 rounded-2xl border border-white/10 bg-v-card py-2 shadow-v-card">
            <div className="border-b border-white/[0.06] px-3 py-2.5">
              <p className="truncate text-sm font-bold text-white">{user?.name}</p>
              <p className="truncate text-xs font-semibold text-v-accent">{user?.role}</p>
              <p className="truncate text-xs text-white/45">{user?.email}</p>
              {user?.telephone ? (
                <p className="truncate text-xs text-white/35">{user.telephone}</p>
              ) : null}
              {user?.address ? (
                <p className="mt-1 line-clamp-2 text-[11px] text-white/30">{user.address}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => {
                setProfileOpen(false);
                setProfileModalOpen(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white/85 hover:bg-white/[0.05]"
            >
              <UserRound size={17} strokeWidth={2} />
              Edit profile
            </button>
            <button
              type="button"
              onClick={() => {
                setSignOutOpen(true);
                setProfileOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-200 hover:bg-red-500/10"
            >
              <LogOut size={17} strokeWidth={2} />
              Sign out
            </button>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={signOutOpen}
        title="Sign out?"
        message="Are you sure you want to sign out?"
        confirmLabel="Yes, sign out"
        cancelLabel="Cancel"
        onCancel={() => setSignOutOpen(false)}
        onConfirm={() => {
          setSignOutOpen(false);
          logout();
          navigate("/login", { replace: true });
        }}
        danger
      />
      <ProfileSettingsModal open={profileModalOpen} onClose={() => setProfileModalOpen(false)} />
    </div>
  );
};

export default HeaderToolbox;
