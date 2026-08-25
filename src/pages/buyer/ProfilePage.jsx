import { User, Mail, Phone } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";

export default function ProfilePage() {
  const { user, profile } = useAuth();
  const displayName = profile?.full_name || "Buyer";
  const initial = displayName.trim().charAt(0).toUpperCase() || "B";

  const FIELDS = [
    { icon: User, label: "Full Name", value: profile?.full_name || "—" },
    { icon: Mail, label: "Email", value: user?.email || "—" },
    { icon: Phone, label: "Phone", value: profile?.phone || "—" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy-900 mb-1">Profile</h1>
      <p className="text-gray-500 mb-8">Your account details.</p>

      <div className="card p-6 max-w-xl">
        <div className="flex items-center gap-4 mb-6">
          {profile?.profile_image_url ? (
            <img
              src={profile.profile_image_url}
              alt={displayName}
              className="h-16 w-16 rounded-full object-cover border border-navy-900/8"
            />
          ) : (
            <span className="h-16 w-16 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xl font-bold">
              {initial}
            </span>
          )}
          <div>
            <p className="font-bold text-navy-900 text-lg">{displayName}</p>
            <p className="text-sm text-gray-400">Buyer</p>
          </div>
        </div>

        <div className="space-y-4">
          {FIELDS.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 border-t border-navy-900/8 pt-4 first:border-t-0 first:pt-0">
              <span className="h-9 w-9 rounded-lg bg-surface-muted text-gray-400 flex items-center justify-center shrink-0">
                <Icon size={16} />
              </span>
              <div>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-sm font-medium text-navy-900">{value}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-6">Editing your profile is coming soon.</p>
      </div>
    </div>
  );
}
