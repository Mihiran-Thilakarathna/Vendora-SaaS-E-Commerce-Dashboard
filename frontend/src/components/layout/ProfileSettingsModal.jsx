import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { UserRound, X } from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const ProfileSettingsModal = ({ open, onClose }) => {
  const { user, applySession } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState("profile");

  const [name, setName] = useState("");
  const [avatarURL, setAvatarURL] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [localPreviewURL, setLocalPreviewURL] = useState("");
  const [address, setAddress] = useState("");
  const [telephone, setTelephone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab("profile");
    setName(user?.name || "");
    setAvatarURL(user?.avatarURL || "");
    setAvatarFile(null);
    setLocalPreviewURL("");
    setAddress(user?.address || "");
    setTelephone(user?.telephone || "");
    setNewEmail(user?.email || "");
    setCurrentPassword("");
    setNewPassword("");
    setEmailPassword("");
  }, [open, user]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    return () => {
      if (localPreviewURL) URL.revokeObjectURL(localPreviewURL);
    };
  }, [localPreviewURL]);

  const avatarPreview = (localPreviewURL || avatarURL || "").trim();

  if (!open) return null;

  const handleRemovePhoto = async () => {
    if (avatarFile || localPreviewURL) {
      if (localPreviewURL) URL.revokeObjectURL(localPreviewURL);
      setLocalPreviewURL("");
      setAvatarFile(null);
      toast.success("Selection cleared", "Choose a file again if you want a new photo.");
      return;
    }
    if (!user?.avatarURL?.trim()) {
      toast.error("No photo", "There is no profile photo to remove.");
      return;
    }
    setRemovingPhoto(true);
    try {
      const { data } = await api.delete("/auth/avatar");
      const token = localStorage.getItem("vendora_token");
      applySession(token, data.data);
      setAvatarURL("");
      toast.success("Photo removed", "Default icon will show until you upload again.");
    } catch (err) {
      toast.error("Remove failed", err?.response?.data?.message || "Could not remove photo.");
    } finally {
      setRemovingPhoto(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Invalid file", "Please choose an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File too large", "Please use an image under 2MB.");
      return;
    }

    if (localPreviewURL) URL.revokeObjectURL(localPreviewURL);
    setLocalPreviewURL(URL.createObjectURL(file));
    setAvatarFile(file);
    event.target.value = "";
    toast.success("Photo selected", "Save profile to apply your new photo.");
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      let nextAvatarURL = avatarURL.trim();
      if (avatarFile) {
        const form = new FormData();
        form.append("avatar", avatarFile);
        const uploadRes = await api.post("/auth/avatar", form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        nextAvatarURL = uploadRes?.data?.data?.avatarURL || nextAvatarURL;
      }
      const { data } = await api.patch("/auth/profile", {
        name: name.trim(),
        avatarURL: nextAvatarURL,
        address: address.trim(),
        telephone: telephone.trim(),
      });
      const token = localStorage.getItem("vendora_token");
      applySession(token, data.data);
      setAvatarFile(null);
      setAvatarURL(nextAvatarURL);
      if (localPreviewURL) {
        URL.revokeObjectURL(localPreviewURL);
        setLocalPreviewURL("");
      }
      toast.success("Profile updated", "Your details were saved.");
      onClose();
    } catch (err) {
      toast.error("Update failed", err?.response?.data?.message || "Could not save profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setSavingPwd(true);
    try {
      const { data } = await api.put("/auth/password", {
        currentPassword,
        newPassword,
      });
      applySession(data.data.token, data.data.user);
      toast.success("Password changed", "Please use your new password next time you sign in.");
      setCurrentPassword("");
      setNewPassword("");
      onClose();
    } catch (err) {
      toast.error("Password change failed", err?.response?.data?.message || "Try again.");
    } finally {
      setSavingPwd(false);
    }
  };

  const handleChangeEmail = async (e) => {
    e.preventDefault();
    setSavingEmail(true);
    try {
      const { data } = await api.put("/auth/email", {
        newEmail: newEmail.trim().toLowerCase(),
        currentPassword: emailPassword,
      });
      applySession(data.data.token, data.data.user);
      toast.success("Email updated", "Your sign-in email has been changed.");
      setEmailPassword("");
      onClose();
    } catch (err) {
      toast.error("Email change failed", err?.response?.data?.message || "Try again.");
    } finally {
      setSavingEmail(false);
    }
  };

  if (typeof document === "undefined" || !document.body) return null;

  // Extra safety: never show a blank overlay.
  const content = (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-white/15 bg-[#181818] p-6 shadow-v-card"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="profile-modal-title" className="text-xl font-extrabold text-white">
              Account settings
            </h2>
            <p className="mt-1 text-sm text-white/50">
              Signed in as <span className="font-semibold text-v-accent">{user?.role}</span> ·{" "}
              {user?.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/15 p-2 text-white/70 hover:bg-white/10"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-5 flex gap-2 rounded-full border border-white/10 bg-v-surface p-1">
          {[
            { id: "profile", label: "Profile" },
            { id: "security", label: "Email & password" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-full py-2 text-sm font-bold transition ${
                tab === t.id ? "bg-v-accent text-black" : "text-white/55 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "profile" ? (
          <form onSubmit={handleSaveProfile} className="mt-6 space-y-5">
            <div className="grid gap-5 md:grid-cols-[140px,1fr]">
              <div className="space-y-3">
                <div className="h-32 w-32 overflow-hidden rounded-3xl border border-white/10 bg-v-surface">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/40">
                      <UserRound size={44} strokeWidth={2} aria-hidden />
                    </div>
                  )}
                </div>
                <label className="block">
                  <span className="sr-only">Upload profile photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="block w-full text-xs text-white/55 file:mr-3 file:rounded-full file:border-0 file:bg-v-accent file:px-3 file:py-2 file:font-bold file:text-black hover:file:bg-v-accent-hover"
                  />
                </label>
                {(user?.avatarURL?.trim() || avatarFile || localPreviewURL) ? (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={removingPhoto || savingProfile}
                    className="w-full rounded-full border border-red-400/35 py-2.5 text-xs font-bold text-red-200 transition hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {removingPhoto ? "Removing…" : avatarFile || localPreviewURL ? "Clear selection" : "Remove photo"}
                  </button>
                ) : null}
                <p className="text-[11px] text-white/35">Upload from this device.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-white/45">Display name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="mt-1.5 w-full rounded-2xl border border-white/10 bg-v-surface px-4 py-3 text-sm outline-none focus:border-v-accent/40"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-white/45">Telephone</label>
                  <input
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    placeholder="+94 77 123 4567"
                    className="mt-1.5 w-full rounded-2xl border border-white/10 bg-v-surface px-4 py-3 text-sm outline-none focus:border-v-accent/40"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-white/45">Address</label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={3}
                    placeholder="No. 12, Example Road, Colombo"
                    className="mt-1.5 w-full rounded-2xl border border-white/10 bg-v-surface px-4 py-3 text-sm outline-none focus:border-v-accent/40"
                  />
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="w-full rounded-full bg-v-accent py-3 text-sm font-bold text-black shadow-v-glow disabled:opacity-50"
            >
              {savingProfile ? "Saving…" : "Save profile"}
            </button>
          </form>
        ) : (
          <div className="mt-6 space-y-6">
            <form onSubmit={handleChangeEmail} className="space-y-3 rounded-2xl border border-white/[0.06] bg-v-surface/50 p-4">
              <h3 className="text-sm font-bold text-white">Change email</h3>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className="w-full rounded-2xl border border-white/10 bg-v-elevated px-4 py-3 text-sm outline-none focus:border-v-accent/40"
              />
              <input
                type="password"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                placeholder="Current password"
                required
                className="w-full rounded-2xl border border-white/10 bg-v-elevated px-4 py-3 text-sm outline-none focus:border-v-accent/40"
              />
              <button
                type="submit"
                disabled={savingEmail}
                className="w-full rounded-full border border-v-accent/40 py-2.5 text-sm font-bold text-v-accent hover:bg-v-accent/10 disabled:opacity-50"
              >
                {savingEmail ? "Updating…" : "Update email"}
              </button>
            </form>

            <form onSubmit={handleChangePassword} className="space-y-3 rounded-2xl border border-white/[0.06] bg-v-surface/50 p-4">
              <h3 className="text-sm font-bold text-white">Change password</h3>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                required
                className="w-full rounded-2xl border border-white/10 bg-v-elevated px-4 py-3 text-sm outline-none focus:border-v-accent/40"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 6 characters)"
                required
                minLength={6}
                className="w-full rounded-2xl border border-white/10 bg-v-elevated px-4 py-3 text-sm outline-none focus:border-v-accent/40"
              />
              <p className="text-xs text-white/40">
                After changing your password or email, old sessions stop working — you must use the new
                credentials.
              </p>
              <button
                type="submit"
                disabled={savingPwd}
                className="w-full rounded-full bg-v-accent py-3 text-sm font-bold text-black shadow-v-glow disabled:opacity-50"
              >
                {savingPwd ? "Updating…" : "Update password"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default ProfileSettingsModal;
