import { MessageSquare } from "lucide-react";

export default function MessagesPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-navy-900 mb-1">Messages</h1>
      <p className="text-gray-500 mb-8">Chat with dealers and our support team.</p>

      <div className="card p-10 text-center">
        <span className="mx-auto mb-3 h-12 w-12 rounded-full bg-brand-50 text-brand flex items-center justify-center">
          <MessageSquare size={22} />
        </span>
        <p className="font-semibold text-navy-900 mb-1">Messages are coming soon</p>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          We're building in-app messaging so you can chat directly with dealers and our team. For now, reach us
          through Help &amp; Support.
        </p>
      </div>
    </div>
  );
}
