import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useServerStatus } from "../services/serverStatus";
import BrandLoader from "../components/ui/BrandLoader";

const ProtectedRoute = ({ allowedRoles = [] }) => {
  const { user, isLoading, isAuthenticated } = useAuth();
  const serverStatus = useServerStatus();

  if (isLoading) {
    const waking = serverStatus === "waking" || serverStatus === "db-down";
    return (
      <BrandLoader
        fullScreen
        label={waking ? "Starting the server" : "Loading your workspace"}
        hint={waking ? "The first visit after a quiet period can take up to a minute." : undefined}
      />
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
