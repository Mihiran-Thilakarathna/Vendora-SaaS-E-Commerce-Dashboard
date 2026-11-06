require("dotenv").config();
const connectDB = require("./config/db");
const app = require("./app");
const { ensureTenancy } = require("./utils/ensureTenancy");
const { scheduleDemoActivity } = require("./utils/demoActivity");

const PORT = process.env.PORT || 5000;

// Listen first so the host sees a live service right away (health checks pass and
// requests get a fast answer), then connect to MongoDB in the background.
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${PORT}`);
});

connectDB()
  .then(() => ensureTenancy())
  // Keep the public demo store full of recent orders so its charts are never empty.
  .then(() => scheduleDemoActivity())
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Startup task failed:", error.message);
  });
