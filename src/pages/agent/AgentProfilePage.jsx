import { useAuth } from "../../auth/AuthContext";

export default function AgentProfilePage() {
  const { profile } = useAuth();

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#0B2545] mb-1">Profile</h1>
        <p className="text-sm text-[#6B7A9A]">Your agent account details.</p>
      </div>

      <div className="rounded-2xl border border-[#E3E8F5] bg-white p-5 space-y-3">
        <div>
          <p className="text-xs text-[#93A0BD]">Agent ID</p>
          <p className="text-sm font-semibold text-[#0B2545]">{profile?.agent_code}</p>
        </div>
        <div>
          <p className="text-xs text-[#93A0BD]">Name</p>
          <p className="text-sm font-semibold text-[#0B2545]">{profile?.full_name}</p>
        </div>
        <div>
          <p className="text-xs text-[#93A0BD]">Phone</p>
          <p className="text-sm font-semibold text-[#0B2545]">{profile?.phone || "—"}</p>
        </div>
      </div>

      {/* Password can only be changed by an Admin, from the Manage Agents
          panel — agents no longer have a self-service password form. If
          you've forgotten your password or need it changed, contact an
          admin to reset it for you. */}
      <div className="rounded-2xl border border-[#E3E8F5] bg-[#F5F8FD] p-5">
        <p className="text-sm text-[#0B2545] font-semibold mb-1">Need a password change?</p>
        <p className="text-xs text-[#6B7A9A]">
          Only an admin can reset your password. Contact your admin and they'll issue you a new one.
        </p>
      </div>
    </div>
  );
}
