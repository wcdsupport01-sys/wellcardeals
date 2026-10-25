import { Bell } from "lucide-react";
import { Link } from "react-router-dom";

export default function NotificationsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-navy-900 mb-2">Notifications</h1>
      <div className="card p-8 text-center">
        <Bell size={28} className="mx-auto mb-4 text-brand" aria-hidden="true" />
        <h2 className="text-lg font-semibold mb-2">In-app notifications are not available yet</h2>
        <p className="text-gray-500 mb-6">You can check the current status of your requests in My Orders and My Listings.</p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/buyer/orders" className="text-brand underline">My Orders</Link>
          <Link to="/buyer/my-listings" className="text-brand underline">My Listings</Link>
          <Link to="/buyer/help" className="text-brand underline">Help &amp; Support</Link>
        </div>
      </div>
    </div>
  );
}
