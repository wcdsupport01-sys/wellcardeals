import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";

export default function Unauthorized() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white text-center px-6">
      <ShieldAlert size={40} className="text-gray-400 mb-4" />
      <h1 className="text-2xl font-bold text-gray-900">You don't have access to this page</h1>
      <p className="text-gray-500 mt-2 max-w-sm">
        Your account isn't authorized to view this section. If you think this is a mistake,
        contact support.
      </p>
      <Link
        to="/"
        className="mt-6 bg-[#0B2545] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#123a6b] transition"
      >
        Back to Home
      </Link>
    </div>
  );
}
