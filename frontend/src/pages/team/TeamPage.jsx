import { useCallback, useEffect, useRef, useState } from "react";
import { Crown, Eye, EyeOff, KeyRound, Loader2, Lock, Save, Store, Trash2, UserPlus, UserRound } from "lucide-react";
import SplitText from "../../components/reactbits/SplitText";
import Modal from "../../components/ui/Modal";
import Select from "../../components/ui/Select";
import ConfirmDialog from "../../components/layout/ConfirmDialog";
import useStaggerReveal from "../../hooks/useStaggerReveal";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const MIN_PASSWORD = 6;
const ROLE_OPTIONS = [
  { value: "Staff", label: "Staff · orders and stock alerts" },
  { value: "Admin", label: "Admin · full access, manages team" },
];
const EMPTY_FORM = { name: "", email: "", role: "Staff", password: "" };

const inputClass =
  "mt-1.5 w-full rounded-2xl border border-white/10 bg-v-surface px-4 py-3 text-sm outline-none focus:border-v-accent/40";

/** Readable random starting password, e.g. "kite-74-amber". */
const generatePassword = () => {
  const words = ["amber", "river", "cedar", "maple", "orbit", "pixel", "lotus", "coral", "kite", "nova", "sage", "flint"];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  return `${pick()}-${10 + Math.floor(Math.random() * 90)}-${pick()}`;
};

const errorMessage = (err, fallback) => err?.response?.data?.message || fallback;

const Avatar = ({ member }) => {
  const [broken, setBroken] = useState(false);
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-v-accent/15 text-sm font-extrabold text-v-accent">
      {member.avatarURL && !broken ? (
        <img src={member.avatarURL} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        (member.name || "?").charAt(0).toUpperCase()
      )}
    </span>
  );
};

const TeamPage = () => {
  const { user, applySession } = useAuth();
  const toast = useToast();
  const pageRef = useRef(null);

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [storeName, setStoreName] = useState(user?.store?.name || "");
  const [savingStore, setSavingStore] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [showPassword, setShowPassword] = useState(true);

  const [roleBusyId, setRoleBusyId] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);

  const locked = Boolean(user?.store?.isDemo);

  useStaggerReveal(pageRef, [loading]);

  const loadMembers = useCallback(async () => {
    setLoadError("");
    try {
      const { data } = await api.get("/store/members");
      setMembers(data.data || []);
    } catch (err) {
      setLoadError(errorMessage(err, "Could not load your team."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    setStoreName(user?.store?.name || "");
  }, [user?.store?.name]);

  const saveStoreName = async (e) => {
    e.preventDefault();
    const name = storeName.trim();
    if (!name || name === user?.store?.name) return;
    setSavingStore(true);
    try {
      const { data } = await api.patch("/store", { name });
      applySession(null, { ...user, store: { ...user.store, name: data.data.name } });
      toast.success("Store renamed", `Your store is now called ${data.data.name}.`);
    } catch (err) {
      toast.error("Rename failed", errorMessage(err, "Could not rename the store."));
    } finally {
      setSavingStore(false);
    }
  };

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, password: generatePassword() });
    setShowPassword(true);
    setAddOpen(true);
  };

  const addMember = async (e) => {
    e.preventDefault();
    if (adding) return;
    setAdding(true);
    try {
      const { data } = await api.post("/store/members", {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        password: form.password,
      });
      setMembers((prev) => [...prev, data.data]);
      setAddOpen(false);
      toast.success(
        `${data.data.name} added`,
        `Send them their email and starting password. They can change it from Profile.`
      );
    } catch (err) {
      toast.error("Couldn't add member", errorMessage(err, "Please check the details and try again."));
    } finally {
      setAdding(false);
    }
  };

  const changeRole = async (member, role) => {
    if (role === member.role) return;
    setRoleBusyId(member._id);
    try {
      const { data } = await api.patch(`/store/members/${member._id}`, { role });
      setMembers((prev) => prev.map((m) => (m._id === member._id ? data.data : m)));
      toast.success("Role updated", `${member.name} is now ${role}. They'll need to sign in again.`);
    } catch (err) {
      toast.error("Role change failed", errorMessage(err, "Could not change the role."));
    } finally {
      setRoleBusyId(null);
    }
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await api.delete(`/store/members/${removeTarget._id}`);
      setMembers((prev) => prev.filter((m) => m._id !== removeTarget._id));
      toast.success("Member removed", `${removeTarget.name} no longer has access.`);
      setRemoveTarget(null);
    } catch (err) {
      toast.error("Remove failed", errorMessage(err, "Could not remove this member."));
    } finally {
      setRemoving(false);
    }
  };

  const adminCount = members.filter((m) => m.role === "Admin").length;

  return (
    <div ref={pageRef} className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">
            <SplitText text="Team" />
          </h1>
          <p className="mt-2 text-sm text-white/50 md:text-base">
            Who can sign in to <span className="font-semibold text-v-accent">{user?.store?.name || "your store"}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          disabled={locked}
          className="inline-flex items-center gap-2 rounded-full bg-v-accent px-5 py-3 text-sm font-bold text-black shadow-v-glow transition hover:bg-v-accent-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          <UserPlus size={18} /> Add member
        </button>
      </div>

      {locked ? (
        <p
          data-reveal
          className="flex items-start gap-2 rounded-2xl border border-v-accent/25 bg-v-accent/[0.06] px-4 py-3 text-sm text-white/70"
        >
          <Lock size={16} className="mt-0.5 shrink-0 text-v-accent" />
          This is the shared demo store, so its team and name are locked. Sign out and choose "Create your store" to
          try team management on your own store.
        </p>
      ) : null}

      {/* ---------- Store settings ---------- */}
      <form
        data-reveal
        onSubmit={saveStoreName}
        className="rounded-[28px] border border-white/[0.08] bg-v-card p-6 shadow-v-card"
      >
        <div className="flex items-center gap-2 text-white">
          <Store size={18} className="text-v-accent" />
          <h2 className="text-lg font-bold">Store</h2>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1">
            <span className="text-xs font-semibold text-white/45">Store name</span>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              maxLength={80}
              required
              disabled={locked}
              className={`${inputClass} disabled:opacity-60`}
            />
          </label>
          <button
            type="submit"
            disabled={locked || savingStore || !storeName.trim() || storeName.trim() === user?.store?.name}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/5 disabled:opacity-40"
          >
            {savingStore ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save name
          </button>
        </div>
      </form>

      {/* ---------- Members ---------- */}
      <section data-reveal className="rounded-[28px] border border-white/[0.08] bg-v-card shadow-v-card">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-6 py-4">
          <h2 className="text-lg font-bold text-white">Members</h2>
          {!loading && !loadError ? (
            <span className="text-xs text-white/45">
              {members.length} {members.length === 1 ? "person" : "people"} · {adminCount} admin
              {adminCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-14">
            <Loader2 size={24} className="animate-spin text-white/40" aria-label="Loading team" />
          </div>
        ) : loadError ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-red-200">{loadError}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                loadMembers();
              }}
              className="mt-3 text-sm font-semibold text-v-accent hover:underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {members.map((member) => {
              const editable = !locked && !member.isOwner && !member.isYou;
              return (
                <li key={member._id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar member={member} />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-white">
                        <span className="truncate">{member.name}</span>
                        {member.isOwner ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-v-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-v-accent">
                            <Crown size={11} /> Owner
                          </span>
                        ) : null}
                        {member.isYou ? (
                          <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/60">
                            You
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-white/45">{member.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:w-[300px] sm:justify-end">
                    {editable ? (
                      <>
                        <Select
                          compact
                          className="flex-1 sm:w-40 sm:flex-none"
                          ariaLabel={`Role for ${member.name}`}
                          value={member.role}
                          disabled={roleBusyId === member._id}
                          onChange={(role) => changeRole(member, role)}
                          options={["Staff", "Admin"]}
                        />
                        <button
                          type="button"
                          onClick={() => setRemoveTarget(member)}
                          className="rounded-xl border border-white/10 p-2 text-white/50 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300"
                          aria-label={`Remove ${member.name}`}
                          title="Remove from store"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    ) : (
                      <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-white/70">
                        {member.role}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---------- Add member ---------- */}
      <Modal
        open={addOpen}
        onClose={adding ? undefined : () => setAddOpen(false)}
        dismissible={!adding}
        eyebrow="Team"
        title="Add a member"
        description="They sign in with this email and starting password, then change the password from Profile."
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              disabled={adding}
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/5 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-member-form"
              disabled={adding}
              className="inline-flex items-center gap-2 rounded-full bg-v-accent px-4 py-2 text-sm font-bold text-black transition hover:bg-v-accent-hover disabled:opacity-60"
            >
              {adding ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              {adding ? "Adding…" : "Add member"}
            </button>
          </div>
        }
      >
        <form id="add-member-form" onSubmit={addMember} className="space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-white/45">Name</span>
            <span className="relative block">
              <input
                type="text"
                required
                autoFocus
                maxLength={60}
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Sachini Dias"
                className={inputClass}
              />
            </span>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-white/45">Email</span>
            <input
              type="email"
              required
              autoComplete="off"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="sachini@yourstore.com"
              className={inputClass}
            />
          </label>
          <div>
            <span className="text-xs font-semibold text-white/45">Role</span>
            <Select
              className="mt-1.5"
              ariaLabel="Role"
              value={form.role}
              onChange={(role) => setForm((p) => ({ ...p, role }))}
              options={ROLE_OPTIONS}
            />
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-white/45">
              Starting password (at least {MIN_PASSWORD} characters)
            </span>
            <span className="relative block">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={MIN_PASSWORD}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className={`${inputClass} pr-24`}
              />
              <span className="absolute right-2 top-1/2 mt-[3px] flex -translate-y-1/2 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, password: generatePassword() }))}
                  className="rounded-lg p-1.5 text-white/40 transition hover:text-white"
                  aria-label="Generate a new password"
                  title="Generate a new password"
                >
                  <KeyRound size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="rounded-lg p-1.5 text-white/40 transition hover:text-white"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </span>
          </label>
          <p className="flex items-start gap-2 rounded-2xl bg-white/[0.03] px-3 py-2.5 text-xs text-white/50">
            <UserRound size={14} className="mt-0.5 shrink-0" />
            Copy the password before saving: it isn't shown again.
          </p>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title={`Remove ${removeTarget?.name || "member"}?`}
        message="They'll be signed out and lose access to this store. Orders they created stay in your records."
        confirmLabel="Remove"
        danger
        busy={removing}
        onConfirm={confirmRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
};

export default TeamPage;
