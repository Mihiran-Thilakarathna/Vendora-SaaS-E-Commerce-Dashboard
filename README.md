# Vendora — SaaS E-Commerce Dashboard 🚀

Vendora is a modern, full-stack e-commerce **admin/staff dashboard** designed to seamlessly manage products (inventory), orders, and operational notifications with strict role-based access control (RBAC).

Featuring a sleek dark-themed UI with neon accents, it provides business owners with real-time analytics, optimistic UI updates, and robust backend architecture. Data is stored in **MongoDB** and survives browser restarts as long as the database is unchanged.

---

## ✨ Key Features

* **🔐 Authentication & User Profiles**
  * JWT-based authentication (Bearer token).
  * Profile management: name, address, telephone; change email/password (invalidates old tokens).
  * Avatar image uploads (via `multipart/form-data`); **remove** photo via API (default header shows a user icon until a photo is uploaded).
* **👥 Role-Based Access Control (RBAC)**
  * **Admin:** Full access to inventory CRUD, order management, and detailed analytics.
  * **Staff:** Restricted access (view products/orders, update order statuses, view low-stock alerts).
* **📊 Real-time Analytics Dashboard**
  * Visualized business data using **Recharts** (Revenue, Growth, Order Status) with date-range filtering.
  * Growth vs prior period of same length (or "New" when there is no prior revenue baseline).
  * Localized currency formatting (Sri Lankan Rupees - Rs.).
  * **Download full report:** generates a PDF in the browser (preview + download) using **jsPDF** + **jspdf-autotable**.
* **📦 Inventory Management**
  * Complete product CRUD operations (including **image URL** per product).
  * Automated low-stock alerts and highlighting.
  * Server-side pagination, search, and filtering.
* **🛒 Order Processing**
  * List, view, and create orders (stock validated server-side).
  * **Optimistic UI updates** for rapid order status changes.
* **🔔 Operational Notifications**
  * System alerts with "Mark as read" functionality (polled from the header).

---

## 🛠️ Tech Stack

**Frontend:**
* React 18 + Vite 5
* Tailwind CSS 4 (Dark theme aesthetics)
* React Router DOM
* Recharts (Data Visualization)
* Axios (API Communication)
* Lucide React (Icons)
* jsPDF + jspdf-autotable (PDF Report Generation)

**Backend:**
* Node.js & Express.js
* MongoDB & Mongoose
* JSON Web Tokens (JWT) & Bcrypt.js (Security)
* Multer (File uploads)
* Morgan & CORS

---

## 📂 Monorepo Structure

```text
Vendora/
 ├── backend/      # Express API + MongoDB models + Controllers
 ├── frontend/     # React dashboard (Vite)
 └── package.json  # Root convenience scripts to run both environments
```

---

## 🚀 Quick Start (Development)

### 1. Prerequisites

* Node.js: v18+ recommended
* MongoDB: Local installation or hosted (MongoDB Atlas)

### 2. Install Dependencies

From the repository root, install **all three** places (root only installs the monorepo helper `concurrently`):

```bash
npm install
npm install --prefix frontend
npm install --prefix backend
```

### 3. Configure Environment Variables

Backend — copy `backend/.env.example` to `backend/.env`:

```
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/vendora
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=7d
```

Frontend — copy `frontend/.env.example` to `frontend/.env`:

```
VITE_API_BASE_URL=http://localhost:5000/api
```

Never commit `.env` files. Examples stay in `*.env.example` only.

### 4. Seed Demo Data (Optional but recommended)

This will wipe existing `User`, `Product`, and `Order` collections, then insert sample data. Seeded users have **no** default profile photo URLs.

```bash
npm run seed --prefix backend
```

Default Credentials:

| Role  | Email               | Password    |
|-------|---------------------|-------------|
| Admin | `admin@vendora.com` | `Admin@123` |
| Staff | `staff@vendora.com` | `Staff@123` |

### 5. Run the Application

Run both backend and frontend concurrently from the root directory:

```bash
npm run dev
```

* **API:** `http://localhost:5000` (health: `GET http://localhost:5000/api/health`)
* **Frontend:** Vite prints the URL (often `http://localhost:5173`; if the port is busy, e.g. `5174`)

Or run separately:

```bash
npm run dev:backend
npm run dev:frontend
```

### Production Build (Frontend only)

```bash
npm run build --prefix frontend
npm run preview --prefix frontend
```

Serve the API with `npm run start --prefix backend` (configure `PORT`, `MONGO_URI`, and CORS for your domain).

---

## 📡 API Overview

Base URL: `http://localhost:5000/api`

### Health

* `GET /health`

### Auth (`/api/auth`)

| Method   | Path       | Notes                                                     |
|----------|------------|-----------------------------------------------------------|
| `POST`   | `/register` |                                                          |
| `POST`   | `/login`    |                                                          |
| `GET`    | `/me`       | Protected                                                |
| `PATCH`  | `/profile`  | Protected                                                |
| `PUT`    | `/password` | Protected                                                |
| `PUT`    | `/email`    | Protected                                                |
| `POST`   | `/avatar`   | Protected, `multipart/form-data`, field `avatar`         |
| `DELETE` | `/avatar`   | Protected; clears `avatarURL` and removes uploaded file  |

### Products (`/api/products`)

| Method   | Path              | Access       |
|----------|-------------------|--------------|
| `GET`    | `/`               | Protected    |
| `GET`    | `/alerts/low-stock` | Admin, Staff |
| `GET`    | `/:id`            | Protected    |
| `POST`   | `/`               | Admin        |
| `PUT`    | `/:id`            | Admin        |
| `DELETE` | `/:id`            | Admin        |

### Orders (`/api/orders`)

| Method   | Path                  | Access                                              |
|----------|-----------------------|-----------------------------------------------------|
| `GET`    | `/`                   | Admin, Staff                                        |
| `GET`    | `/analytics/summary`  | Admin, Staff (`startDate`, `endDate` query: `YYYY-MM-DD`) |
| `GET`    | `/:id`                | Admin, Staff                                        |
| `POST`   | `/`                   | Admin, Staff                                        |
| `PATCH`  | `/:id/status`         | Admin, Staff                                        |
| `PUT`    | `/:id`                | Admin                                               |
| `DELETE` | `/:id`                | Admin                                               |

### Notifications (`/api/notifications`)

| Method  | Path         | Access    |
|---------|--------------|-----------|
| `GET`   | `/`          | Protected |
| `PATCH` | `/read-all`  | Protected |
| `PATCH` | `/:id/read`  | Protected |

### Static Files

* Uploaded avatars are served at `GET /uploads/...`
* The `backend/uploads/` folder is gitignored; use persistent storage in production.

---

## 💾 Data Persistence

Products, orders, and users are stored in **MongoDB**. Closing the browser or the Vite dev server does **not** remove data. Data is lost only if the database is dropped, collections are cleared (e.g. seed), or you point `MONGO_URI` at a different cluster.

---

## ✅ Before You Push to GitHub

- [ ] No `.env` or secrets in the repo (use `.env.example` only).
- [ ] No committed `node_modules/` (see `.gitignore`).
- [ ] No committed `backend/uploads/` (avatars are local/dev artifacts).
- [ ] Set `JWT_SECRET` and production `MONGO_URI` in your hosting provider's environment, not in the repo.

---

## ⚠️ Production Notes

* **Secrets:** Never commit `.env` files. Ensure `JWT_SECRET` is strong and private.
* **CORS:** The backend currently enables CORS for all origins for development ease. Restrict this to your specific frontend domain in production.
* **Uploads:** Local file uploads (`uploads/` directory) are ignored by Git. For production, switch to persistent cloud storage like AWS S3 or Cloudinary.
* **HTTPS:** Serve the API and frontend over HTTPS; set `VITE_API_BASE_URL` to your public API URL.

---

## License

ISC (see root `package.json`).