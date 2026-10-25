import { useAuth } from "../../auth/AuthContext";
export function useStaffAccess() {
  const { role } = useAuth();
  return { canManage: ["admin", "manager"].includes(role), canDelete: role === "admin" };
}
