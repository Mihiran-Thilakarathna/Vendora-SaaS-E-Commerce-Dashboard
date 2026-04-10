import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, ImagePlus, Save, UserRound } from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const ProfilePage = () => {
  const { user, applySession } = useAuth();
  const toast = useToast();

  const [name, setName] = useState("");
  const [telephone, setTelephone] = useState("");
  const [address, setAddress] = useState("");
  const [avatarURL, setAvatarURL] = useState("");
  const [localPreviewURL, setLocalPreviewURL] = useState("");
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    setName(user?.name || "");
    setTelephone(user?.telephone || "");
    setAddress(user?.address || "");
    setAvatarURL(user?.avatarURL || "");
    setAvatarLoadError(false);
    setNewEmail(user?.email || "");
  }, [user]);

  const avatarPreview = useMemo(() => {
    if (localPreviewURL) return localPreviewURL;
    return avatarURL?.trim();
  }, [avatarURL, localPreviewURL]);

  const handleRemovePhoto = async () => {
    if (localPreviewURL) {
      URL.revokeObjectURL(localPreviewURL);
      setLocalPreviewURL("");
      setSelectedFileName("");
      toast.success("Selection cleared");
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
      setAvatarLoadError(false);
      setSelectedFileName("");
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
    setSelectedFileName(file.name || "");
    if (!file.type.startsWith("image/")) {
      toast.error("Invalid file", "Please choose an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File too large", "Please use an image under 2MB.");
      return;
    }
    const previewObjectURL = URL.createObjectURL(file);
    setLocalPreviewURL(previewObjectURL);
    setAvatarLoadError(false);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const { data } = await api.post("/auth/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const token = localStorage.getItem("vendora_token");
      applySession(token, data.data);
      setAvatarURL(data.data.avatarURL || "");
      toast.success("Uploaded", "Profile photo updated.");
    } catch (err) {
      toast.error("Upload failed", err?.response?.data?.message || "Could not upload photo.");
      // Keep local preview so user can still see selected image even if upload failed.
    }
    event.target.value = "";
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { data } = await api.patch("/auth/profile", {
        name: name.trim(),
        telephone: telephone.trim(),
        address: address.trim(),
        avatarURL: avatarURL.trim(),
      });
      const token = localStorage.getItem("vendora_token");
      applySession(token, data.data);
      toast.success("Saved", "Profile updated.");
    } catch (err) {
      toast.error("Save failed", err?.response?.data?.message || "Could not update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const changeEmail = async (e) => {
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
    } catch (err) {
      toast.error("Email change failed", err?.response?.data?.message || "Try again.");
    } finally {
      setSavingEmail(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setSavingPwd(true);
    try {
      const { data } = await api.put("/auth/password", {
        currentPassword,
        newPassword,
      });
      applySession(data.data.token, data.data.user);
      toast.success("Password changed", "Use your new password next time you sign in.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      toast.error("Password change failed", err?.response?.data?.message || "Try again.");
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">Profile</h2>
        <p className="mt-2 text-sm text-white/50 md:text-base">
          Signed in as <span className="font-semibold text-v-accent">{user?.role}</span> · {user?.email}
        </p>
      </div>

      <form
        onSubmit={saveProfile}
        className="rounded-[28px] border border-white/[0.08] bg-v-card p-6 shadow-v-card"
      >
        <div className="grid gap-6 md:grid-cols-[180px,1fr]">
          <div className="space-y-3">
            <div className="h-40 w-40 overflow-hidden rounded-3xl border border-white/10 bg-v-surface">
              {avatarPreview && !avatarLoadError ? (
                <img
                  src={avatarPreview}
                  alt=""
                  className="h-full w-full object-cover"
                  onLoad={() => {
                    if (localPreviewURL) {
                      URL.revokeObjectURL(localPreviewURL);
                      setLocalPreviewURL("");
                    }
                  }}
                  onError={() => setAvatarLoadError(true)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-white/35">
                  <UserRound size={56} strokeWidth={2} aria-hidden />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <input
                id="profile-photo-input"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="sr-only"
              />
              <label
                htmlFor="profile-photo-input"
                className="inline-flex cursor-pointer items-center justify-center rounded-full bg-v-accent px-4 py-2 text-xs font-extrabold text-black shadow-v-glow transition hover:bg-v-accent-hover"
              >
                Choose file
              </label>
              {(user?.avatarURL?.trim() || localPreviewURL) ? (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={removingPhoto || savingProfile}
                  className="w-full rounded-full border border-red-400/35 py-2.5 text-xs font-bold text-red-200 transition hover:bg-red-500/10 disabled:opacity-50"
                >
                  {removingPhoto ? "Removing…" : localPreviewURL ? "Clear selection" : "Remove photo"}
                </button>
              ) : null}
              <p className="text-xs text-white/45">
                {selectedFileName ? selectedFileName : "No file selected"}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/45">
              <ImagePlus size={16} />
              Upload from this PC (saved with your profile).
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
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

            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-v-accent py-3 text-sm font-bold text-black shadow-v-glow disabled:opacity-60"
            >
              <Save size={18} />
              {savingProfile ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </form>

      <div className="grid gap-5 lg:grid-cols-2">
        <form
          onSubmit={changeEmail}
          className="rounded-[28px] border border-white/[0.08] bg-v-card p-6 shadow-v-card"
        >
          <h3 className="text-lg font-extrabold text-white">Change email</h3>
          <p className="mt-1 text-sm text-white/50">Requires your current password.</p>
          <div className="mt-4 space-y-3">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              className="w-full rounded-2xl border border-white/10 bg-v-surface px-4 py-3 text-sm outline-none focus:border-v-accent/40"
            />
            <input
              type="password"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              required
              placeholder="Current password"
              className="w-full rounded-2xl border border-white/10 bg-v-surface px-4 py-3 text-sm outline-none focus:border-v-accent/40"
            />
            <button
              type="submit"
              disabled={savingEmail}
              className="w-full rounded-full border border-v-accent/40 py-3 text-sm font-bold text-v-accent hover:bg-v-accent/10 disabled:opacity-60"
            >
              {savingEmail ? "Updating…" : "Update email"}
            </button>
          </div>
        </form>

        <form
          onSubmit={changePassword}
          className="rounded-[28px] border border-white/[0.08] bg-v-card p-6 shadow-v-card"
        >
          <h3 className="text-lg font-extrabold text-white">Change password</h3>
          <p className="mt-1 text-sm text-white/50">Old sessions will stop working.</p>
          <div className="mt-4 space-y-3">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              placeholder="Current password"
              className="w-full rounded-2xl border border-white/10 bg-v-surface px-4 py-3 text-sm outline-none focus:border-v-accent/40"
            />
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                placeholder="New password (min 6)"
                className="w-full rounded-2xl border border-white/10 bg-v-surface px-4 py-3 pr-12 text-sm outline-none focus:border-v-accent/40"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-xl p-2 text-white/55 hover:bg-white/5 hover:text-white"
                aria-label={showPwd ? "Hide password" : "Show password"}
              >
                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button
              type="submit"
              disabled={savingPwd}
              className="w-full rounded-full bg-v-accent py-3 text-sm font-bold text-black shadow-v-glow disabled:opacity-60"
            >
              {savingPwd ? "Updating…" : "Update password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;

