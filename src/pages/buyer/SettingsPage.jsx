import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-navy-900 mb-1">Settings</h1>
      <p className="text-gray-500 mb-8">Manage your account preferences.</p>

      <div className="card p-10 text-center">
        <span className="mx-auto mb-3 h-12 w-12 rounded-full bg-brand-50 text-brand flex items-center justify-center">
          <Settings size={22} />
        </span>
        <p className="font-semibold text-navy-900 mb-1">Settings are coming soon</p>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Notification preferences, password changes, and account settings will live here. In the meantime, head
          to your Profile to update your details.
        </p>
      </div>
    </div>
  );
}
