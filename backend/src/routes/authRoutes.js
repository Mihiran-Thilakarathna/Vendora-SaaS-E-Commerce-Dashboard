const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  changeEmail,
  uploadAvatar,
  deleteAvatar,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

const avatarDir = path.join(__dirname, "..", "..", "uploads", "avatars");
if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext) ? ext : ".png";
    cb(null, `${req.user._id}-${Date.now()}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) return cb(null, true);
    return cb(new Error("Only image uploads are allowed."));
  },
});

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);
router.patch("/profile", protect, updateProfile);
router.put("/password", protect, changePassword);
router.put("/email", protect, changeEmail);
router.post("/avatar", protect, upload.single("avatar"), uploadAvatar);
router.delete("/avatar", protect, deleteAvatar);

module.exports = router;
