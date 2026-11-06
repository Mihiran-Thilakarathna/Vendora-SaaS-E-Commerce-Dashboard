import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./routes/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";

const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const DashboardPage = lazy(() => import("./pages/dashboard/DashboardPage"));
const InventoryPage = lazy(() => import("./pages/inventory/InventoryPage"));
const OrdersPage = lazy(() => import("./pages/orders/OrdersPage"));
const ProfilePage = lazy(() => import("./pages/profile/ProfilePage"));
const TeamPage = lazy(() => import("./pages/team/TeamPage"));

const App = () => {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-v-accent" aria-label="Loading" />
        </div>
      }
    >
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute allowedRoles={["Admin", "Staff"]} />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route element={<ProtectedRoute allowedRoles={["Admin"]} />}>
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/team" element={<TeamPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
};

export default App;
