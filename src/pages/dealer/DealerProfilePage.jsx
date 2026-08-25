import { User, Mail, Phone, Building2, FileText, MapPin } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";

export default function DealerProfilePage() {
  const { user, profile } = useAuth();
  const displayName = profile?.dealer_name || "Dealer";
  const initial = displayName.trim().charAt(0).toUpperCase() || "D";

  const FIELDS = [
    { icon: User, label: "Dealer Name", value: profile?.dealer_name || "—" },
    { icon: Building2, label: "Business Name", value: profile?.business_name || "—" },
    { icon: Mail, label: "Email", value: user?.email || "—" },
    { icon: Phone, label: "Mobile Number", value: profile?.mobile_number || "—" },
    { icon: FileText, label: "GST Number", value: profile?.gst_number || "—" },
    { icon: FileText, label: "PAN Number", value: profile?.pan_number || "—" },
    {
      icon: MapPin,
      label: "Business Address",
      value: [profile?.business_address, profile?.city, profile?.state].filter(Boolean).join(", ") || "—",
    },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Profile</h1>
      <p className="text-sm text-[#93A0BD] mb-6">Your dealership account details.</p>

      <div className="bg-white rounded-2xl border border-[#EAEEF7] p-6 max-w-xl">
        <div className="flex items-center gap-4 mb-6">
          {profile?.profile_image_url ? (
            <img
              src={profile.profile_image_url}
              alt={displayName}
              className="h-16 w-16 rounded-full object-cover border border-[#EAEEF7]"
            />
          ) : (
            <span className="h-16 w-16 rounded-full bg-[#1E4FD9]/10 text-[#1E4FD9] flex items-center justify-center text-xl font-bold">
              {initial}
            </span>
          )}
          <div>
            <p className="font-bold text-[#0B2545] text-lg">{displayName}</p>
            <p className="text-sm text-[#93A0BD]">Dealer</p>
          </div>
        </div>

        <div className="space-y-4">
          {FIELDS.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 border-t border-[#EAEEF7] pt-4 first:border-t-0 first:pt-0">
              <span className="h-9 w-9 rounded-lg bg-[#F1F4FB] text-[#93A0BD] flex items-center justify-center shrink-0">
                <Icon size={16} />
              </span>
              <div>
                <p className="text-xs text-[#93A0BD]">{label}</p>
                <p className="text-sm font-medium text-[#0B2545]">{value}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-[#93A0BD] mt-6">Editing your profile is coming soon.</p>
      </div>
    </div>
  );
}
