const express = require("express");
const { listNotifications, markOneRead, markAllRead } = require("../controllers/notificationController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get("/", listNotifications);
router.patch("/read-all", markAllRead);
router.patch("/:id/read", markOneRead);

module.exports = router;
