import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ClipboardCheck,
  CheckCircle2,
  Wrench,
  PaintBucket,
  Armchair,
  Zap,
  CircleDot,
  FileText,
  Loader2,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";

// Mirrors the categories used in the admin Inspection Report (see
// src/admin/lib/lookups.js INSPECTION_CATEGORIES) so the language a buyer
// sees here matches what actually gets checked on a listing.
const CHECKLIST = [
  { icon: Wrench, title: "Engine & Transmission", desc: "Engine health, oil leaks, gearbox, clutch and drivetrain." },
  { icon: PaintBucket, title: "Body & Paint", desc: "Dents, scratches, rust, panel alignment and accident repair signs." },
  { icon: Armchair, title: "Interior", desc: "Seats, dashboard, AC, upholstery and odour check." },
  { icon: Zap, title: "Electricals", desc: "Battery, lights, wipers, power windows and infotainment." },
  { icon: CircleDot, title: "Tyres & Suspension", desc: "Tread depth, alignment, brakes and suspension health." },
  { icon: FileText, title: "Documents", desc: "RC, insurance, PUC and ownership paperwork verified." },
];

const STEPS = [
  { num: "1", title: "You Request PDI", desc: "Share the car and your contact details below." },
  { num: "2", title: "We Schedule a Visit", desc: "Our inspector visits the car at the agreed location." },
  { num: "3", title: "150+ Point Check", desc: "Every category above is checked and documented." },
  { num: "4", title: "Report Shared", desc: "You get a clear report before the handover is finalised." },
];

export default function PDIService() {
  const [form, setForm] = useState({ name: "", phone: "", car_details: "", location: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState("");

  function updateField(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");

    if (!form.name.trim() || !form.phone.trim() || !form.car_details.trim()) {
      setFormError("Please fill in your name, phone number and car details.");
      return;
    }
    if (!isSupabaseConfigured) {
      setFormError("Sorry, PDI requests aren't available right now. Please call us instead.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("pdi_requests").insert({
      name: form.name.trim(),
      phone: form.phone.trim(),
      car_details: form.car_details.trim(),
      location: form.location.trim() || null,
      message: form.message.trim() || null,
    });
    setSubmitting(false);

    if (error) {
      setFormError(error.message || "Something went wrong. Please try again.");
      return;
    }

    setSent(true);
    setForm({ name: "", phone: "", car_details: "", location: "", message: "" });
  }

  return (
    <div className="bg-white text-navy-900">
      {/* HERO */}
      <section className="py-16 md:py-20 max-w-5xl mx-auto px-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-3 text-brand">
          <ClipboardCheck size={22} />
          <span className="text-sm font-semibold tracking-wide uppercase">PDI Service</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight">
          Pre-Delivery Inspection —
          <span className="block text-brand">One Final Check Before Handover</span>
        </h1>
        <p className="mt-5 text-gray-500 max-w-2xl mx-auto">
          Before any car is handed over, our team runs a 150+ point Pre-Delivery Inspection so what you were
          shown is exactly what you receive — no surprises at delivery.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <a href="#request-pdi" className="btn-primary">Request PDI</a>
          <Link to="/buy-car" className="btn-outline">Browse Cars</Link>
        </div>
      </section>

      {/* CHECKLIST */}
      <section className="py-16 bg-surface-muted">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand">What We Check</span>
            <h2 className="text-2xl md:text-3xl font-display font-bold mt-2">Every Category, Documented</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {CHECKLIST.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="card p-6">
                <span className="h-11 w-11 rounded-xl bg-brand-50 text-brand flex items-center justify-center mb-3">
                  <Icon size={19} />
                </span>
                <h3 className="font-semibold text-navy-900">{title}</h3>
                <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-16 max-w-6xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-brand">How It Works</span>
          <h2 className="text-2xl md:text-3xl font-display font-bold mt-2">Simple, Transparent Process</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {STEPS.map(({ num, title, desc }) => (
            <div key={num} className="text-center">
              <span className="mx-auto mb-3 h-11 w-11 rounded-full bg-navy-900 text-white flex items-center justify-center font-display text-lg">
                {num}
              </span>
              <p className="text-sm font-semibold text-navy-900">{title}</p>
              <p className="text-xs text-gray-500 mt-1 leading-snug">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="pb-16 max-w-4xl mx-auto px-6">
        <div className="flex flex-wrap items-center justify-center gap-6 border border-gray-200 rounded-2xl px-6 py-5">
          <span className="flex items-center gap-2 text-sm font-medium text-gray-600">
            <ShieldCheck size={16} className="text-brand" /> Independent Final Check
          </span>
          <span className="flex items-center gap-2 text-sm font-medium text-gray-600">
            <Clock size={16} className="text-brand" /> Scheduled at Your Convenience
          </span>
          <span className="flex items-center gap-2 text-sm font-medium text-gray-600">
            <FileText size={16} className="text-brand" /> Written Report Shared
          </span>
        </div>
      </section>

      {/* REQUEST FORM */}
      <section id="request-pdi" className="py-16 md:py-20 bg-surface-muted scroll-mt-24">
        <div className="max-w-2xl mx-auto px-6">
          <div className="bg-white border border-gray-200 rounded-3xl p-8 md:p-10 shadow-xl">
            <h2 className="text-2xl font-semibold text-center mb-2">Request a PDI</h2>
            <p className="text-gray-500 text-sm text-center mb-8">
              Share a few details and our team will get in touch to schedule the inspection.
            </p>

            {sent ? (
              <div className="flex flex-col items-center text-center py-8">
                <CheckCircle2 size={44} className="text-emerald-500 mb-4" />
                <p className="text-lg font-semibold text-gray-900">Request received!</p>
                <p className="text-gray-500 text-sm mt-2">
                  Our team will contact you shortly to schedule the inspection.
                </p>
                <button
                  onClick={() => setSent(false)}
                  className="mt-6 text-brand text-sm font-medium hover:underline"
                >
                  Submit another request
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Your Name"
                  value={form.name}
                  onChange={updateField("name")}
                  required
                  className="p-3.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand/30 transition"
                />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={form.phone}
                  onChange={updateField("phone")}
                  required
                  className="p-3.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand/30 transition"
                />
                <input
                  type="text"
                  placeholder="Car Details (e.g. Hyundai i20 2019, DL4C..."
                  value={form.car_details}
                  onChange={updateField("car_details")}
                  required
                  className="p-3.5 rounded-xl border border-gray-200 md:col-span-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
                <input
                  type="text"
                  placeholder="Location / Area (optional)"
                  value={form.location}
                  onChange={updateField("location")}
                  className="p-3.5 rounded-xl border border-gray-200 md:col-span-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
                <textarea
                  placeholder="Anything else you'd like us to know? (optional)"
                  rows="3"
                  value={form.message}
                  onChange={updateField("message")}
                  className="p-3.5 rounded-xl border border-gray-200 md:col-span-2 focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
                ></textarea>

                {formError && <p className="md:col-span-2 text-sm text-red-600 -mt-1">{formError}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="md:col-span-2 bg-brand text-white py-3.5 rounded-xl font-medium hover:bg-brand-600 transition shadow-lg hover:shadow-xl disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> Sending…
                    </>
                  ) : (
                    "Request PDI"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
