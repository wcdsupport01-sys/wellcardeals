import { Link } from "react-router-dom";

function LegalPage({ title, children }) {
  return (
    <article className="max-w-3xl mx-auto px-6 py-16 text-gray-700">
      <h1 className="text-3xl font-bold text-navy-900 mb-6">{title}</h1>
      <p className="rounded-xl bg-amber-50 border border-amber-200 p-4 mb-8 text-sm">
        Draft for review by WellCarDeals. These details need business and legal review before publication as a final policy.
      </p>
      <div className="space-y-6 leading-relaxed">{children}</div>
      <p className="mt-8">Questions? <Link to="/contact" className="text-brand underline">Contact our team</Link>.</p>
    </article>
  );
}

export function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy">
      <section><h2 className="text-xl font-semibold mb-2">Information you provide</h2><p>The website asks for account and contact details, vehicle information, and any photos or documents you choose to submit. Contact forms include your name, email, optional phone number, and message.</p></section>
      <section><h2 className="text-xl font-semibold mb-2">How the website uses information</h2><p>Information supports account access, vehicle listings, enquiries, inspection requests, dealer applications, and responses from the team. The website uses Supabase for account and application data.</p></section>
      <section><h2 className="text-xl font-semibold mb-2">Browser storage and location</h2><p>The website uses browser storage for sign-in sessions and some form drafts. Location is requested when you choose a location feature and your browser asks for permission. You can manage browser permissions and clear stored data in your browser settings.</p></section>
      <section><h2 className="text-xl font-semibold mb-2">Third-party services</h2><p>Some pages load fonts, maps, or videos from external services. Opening these resources may send request information to those providers. Their privacy policies apply to their services.</p></section>
      <section><h2 className="text-xl font-semibold mb-2">Privacy requests</h2><p>Contact the team with questions about your information or to request a correction or deletion. Do not send passwords or sensitive identity documents through the general contact form.</p></section>
    </LegalPage>
  );
}

export function TermsOfService() {
  return (
    <LegalPage title="Terms of Service">
      <section><h2 className="text-xl font-semibold mb-2">Using the marketplace</h2><p>WellCarDeals provides tools to browse vehicles, submit sale and purchase enquiries, and apply for dealer access. Live bidding is available to approved dealers.</p></section>
      <section><h2 className="text-xl font-semibold mb-2">Accounts and listings</h2><p>Provide accurate contact and vehicle details, keep your login details private, and submit only content you have permission to share. Do not impersonate another person or submit fraudulent listings.</p></section>
      <section><h2 className="text-xl font-semibold mb-2">Vehicle checks and estimates</h2><p>Verify ownership, registration, condition, price, and transaction details before proceeding with a vehicle purchase. Website valuation ranges and loan calculations are estimates rather than confirmed offers or lender approvals. Automatic RC and challan checks are unavailable until a lookup provider is connected.</p></section>
      <section><h2 className="text-xl font-semibold mb-2">Enquiries and transactions</h2><p>Submitting an enquiry or inspection request does not by itself confirm a purchase, payment, or transfer of ownership. Confirm the applicable price, fees, payment arrangements, and documentation with the team before proceeding.</p></section>
      <section><h2 className="text-xl font-semibold mb-2">Support</h2><p>Report inaccurate listings, access problems, or questions about a request through the contact page. Business-specific cancellation, refund, and dispute terms must be confirmed with the team before a transaction.</p></section>
    </LegalPage>
  );
}
