import { Link } from "react-router-dom";
import { Phone, Mail, HelpCircle, ArrowRight } from "lucide-react";

const CONTACTS = [
  { icon: Phone, title: "Call Us", value: "+91 72899 06245", href: "tel:+917289906245" },
  { icon: Mail, title: "Email", value: "wellcardeal@gmail.com", href: "mailto:wellcardeal@gmail.com" },
];

const FAQS = [
  {
    q: "How do I buy a car?",
    a: "Browse listings under Buy Cars, open a car you like, and either purchase at the listed price or place a bid where an auction is live.",
  },
  {
    q: "How do I sell my car?",
    a: "Go to Sell My Car and submit your car's details. Our team reviews it and lists it for dealer bidding once approved — track the status under My Listings.",
  },
  {
    q: "How long does approval take?",
    a: "Most listing requests are reviewed within 24–48 hours. You'll see the status update under My Listings.",
  },
];

export default function HelpSupportPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-navy-900 mb-1">Help & Support</h1>
      <p className="text-gray-500 mb-8">Our team is here to help you.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {CONTACTS.map(({ icon: Icon, title, value, href }) => (
          <a key={title} href={href} className="card card-hover p-5 flex items-center gap-4">
            <span className="h-11 w-11 rounded-xl bg-brand-50 text-brand flex items-center justify-center shrink-0">
              <Icon size={20} />
            </span>
            <div>
              <p className="text-sm text-gray-500">{title}</p>
              <p className="font-semibold text-navy-900">{value}</p>
            </div>
          </a>
        ))}
      </div>

      <div className="card p-6 mb-8">
        <h2 className="font-bold text-navy-900 mb-4">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {FAQS.map(({ q, a }) => (
            <div key={q} className="flex items-start gap-3">
              <span className="mt-0.5 h-7 w-7 rounded-lg bg-brand-50 text-brand flex items-center justify-center shrink-0">
                <HelpCircle size={14} />
              </span>
              <div>
                <p className="font-medium text-navy-900 text-sm">{q}</p>
                <p className="text-sm text-gray-500 mt-0.5">{a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Link to="/contact" className="btn-outline text-sm inline-flex">
        Full Contact Page <ArrowRight size={15} />
      </Link>
    </div>
  );
}
