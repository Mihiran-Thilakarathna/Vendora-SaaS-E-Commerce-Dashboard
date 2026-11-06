require("dotenv").config();
const connectDB = require("./config/db");
const app = require("./app");
const { ensureTenancy } = require("./utils/ensureTenancy");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  await ensureTenancy();
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on port ${PORT}`);
  });
};

startServer();
