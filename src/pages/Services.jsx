import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Gavel,
  LayoutDashboard,
  Car,
  FileText,
  Calculator,
  AlertTriangle,
  Bot,
  BarChart3,
  ShieldCheck,
  IndianRupee,
  Lock,
  Headphones,
  UserPlus,
  UserCheck,
  Trophy,
  CheckCircle2,
  Users,
  Star,
  ArrowRight,
  ChevronDown,
  Search,
  HelpCircle,
} from "lucide-react";
import heroCar from "../assets/hero-car-new.png";
import neonRings from "../assets/neon-rings-bg.png";
import ctaCar from "../assets/car.jpg";
import maruti from "../assets/maruti.png";
import hyundai from "../assets/hyundai.png";
import tata from "../assets/tata.png";

const TRUST_BADGES = [
  { icon: ShieldCheck, title: "Verified Cars", desc: "100% quality checked and verified" },
  { icon: IndianRupee, title: "Best Price", desc: "Get the best deals at the right price" },
  { icon: Lock, title: "Secure Bidding", desc: "Safe, transparent & secure process" },
  { icon: Headphones, title: "24/7 Support", desc: "We're here to help you anytime" },
];

const SERVICES = [
  {
    icon: Gavel,
    title: "Live Auctions",
    desc: "Real-time dealer bidding with live countdown and transparent process.",
    to: "/live-auctions",
    tone: "brand",
  },
  {
    icon: LayoutDashboard,
    title: "Dealer Portal",
    desc: "Complete dealer dashboard with listings, bids, approvals & more.",
    to: "/dealer-login",
    tone: "brand",
  },
  {
    icon: Car,
    title: "Buy & Sell Vehicles",
    desc: "Verified used cars with detailed inspection reports and best deals.",
    to: "/buy-car",
    tone: "teal",
  },
  {
    icon: FileText,
    title: "RC Verification",
    desc: "Instant RC status check and vehicle registration verification.",
    to: "/rc-check",
    tone: "brand",
  },
  {
    icon: Calculator,
    title: "EMI Calculator",
    desc: "Check loan eligibility and EMI estimates in just a few clicks.",
    to: "/car-loan-emi",
    tone: "brand",
  },
  {
    icon: AlertTriangle,
    title: "Challan Checker",
    desc: "Instant traffic challan lookup and payment details.",
    to: "/challan-check",
    tone: "brand",
  },
  {
    icon: Bot,
    title: "AI Price Estimator",
    desc: "AI powered market value prediction for smarter decisions.",
    tone: "brand",
  },
  {
    icon: BarChart3,
    title: "Market Analytics",
    desc: "Real-time market trends, price insights & demand analytics.",
    tone: "teal",
  },
  {
    icon: ShieldCheck,
    title: "Secure Payments",
    desc: "100% secure payments and safe transactions for peace of mind.",
    tone: "brand",
  },
];

const STEPS = [
  { icon: UserPlus, title: "Dealer Registers", desc: "Sign up and submit your details." },
  { icon: UserCheck, title: "Admin Approval", desc: "Our team verifies and approves your account." },
  { icon: Car, title: "Vehicle Listed", desc: "Add your vehicle and set auction details." },
  { icon: Gavel, title: "Live Auction", desc: "Bidding starts in real time with verified dealers." },
  { icon: Trophy, title: "Highest Bid Wins", desc: "Highest bidder wins the auction." },
  { icon: ShieldCheck, title: "Secure Payment", desc: "Safe payment and smooth handover." },
];

const WHY_POINTS = [
  "Verified cars & dealers",
  "Transparent bidding process",
  "Best prices guaranteed",
  "Advanced analytics & insights",
  "24/7 expert support",
];

const STATS = [
  { icon: Car, value: "5,000+", label: "Cars Listed" },
  { icon: Users, value: "100+", label: "Verified Dealers" },
  { icon: ShieldCheck, value: "99.9%", label: "Secure Transactions" },
  { icon: Star, value: "98%", label: "Customer Satisfaction", tone: "accent" },
];

const DEALER_POINTS = [
  "Add & manage vehicle listings",
  "Live auction management",
  "Real-time bid notifications",
  "Bid history & reports",
  "Analytics & performance insights",
];

const BUYER_POINTS = [
  "Search from thousands of verified cars",
  "Place bids in real-time",
  "Detailed inspection reports",
  "Best deals at the right price",
  "Easy & secure payments",
];

const FAQS = [
  { q: "How does the live auction work?", a: "Verified dealers bid in real time on a listed car until the countdown ends. The highest bid when the timer hits zero wins the vehicle." },
  { q: "Is it free to register as a dealer?", a: "Yes, creating a dealer account is free. Our team just verifies your details before approving access to live auctions." },
  { q: "How are the cars verified?", a: "Every listing goes through an inspection and RC/document check before it's approved and published on the marketplace." },
  { q: "What documents are required?", a: "For buyers, just a valid ID for payment. Dealers additionally submit business details and a license for verification." },
  { q: "How do payments work?", a: "All payments are processed through secure, encrypted channels, with funds released only once the handover is confirmed." },
  { q: "Can I cancel my bid?", a: "Bids are binding once placed to keep the auction fair for everyone, so review the listing carefully before bidding." },
];

function FaqItem({ q, a, isOpen, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-navy-900/8 rounded-xl px-5 py-4 hover:border-brand/30 transition"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-navy-900">{q}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-brand transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </div>
      {isOpen && <p className="text-sm text-gray-500 mt-3 leading-relaxed">{a}</p>}
    </button>
  );
}

const Services = () => {
  const [openFaq, setOpenFaq] = useState(0);

  const toneClasses = {
    brand: "bg-brand-50 text-brand group-hover:bg-brand group-hover:text-white",
    teal: "bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white",
  };

  return (
    <div className="bg-white text-navy-900">
      {/* -------- HERO -------- */}
      <section className="relative overflow-hidden bg-hero min-h-[550px] flex items-center">
        <img
          src={neonRings}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/70 to-transparent pointer-events-none" />
        
        <div className="relative max-w-7xl mx-auto px-6 md:px-8 py-12 md:py-20 grid md:grid-cols-12 gap-8 items-center w-full">
          {/* LEFT CONTENT */}
          <div className="md:col-span-6 lg:col-span-5 z-10">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand bg-brand-50 px-3 py-1.5 rounded-full mb-5">
              India's Trusted Used Car Marketplace
            </span>
            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight leading-[1.1]">
              OUR PREMIUM
              <span className="block text-brand">SERVICES</span>
            </h1>
            <p className="mt-5 text-gray-500 max-w-md">
              WellCarDeals provides a complete ecosystem for buying, selling &amp; bidding used cars with
              trust, transparency &amp; technology.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link to="/buy-car" className="btn-primary">
                Browse Cars <ArrowRight size={16} />
              </Link>
              <a href="#how-it-works" className="btn-outline">
                How It Works
              </a>
            </div>

            <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-6">
              {TRUST_BADGES.map(({ icon: Icon, title, desc }) => (
                <div key={title}>
                  <span className="h-9 w-9 rounded-lg bg-brand-50 text-brand flex items-center justify-center mb-2">
                    <Icon size={17} />
                  </span>
                  <p className="text-sm font-semibold text-navy-900">{title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-snug">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT CAR IMAGE - SIZE & ALIGNMENT ADJUSTED */}
          <div className="md:col-span-6 lg:col-span-7 relative flex items-center justify-center min-h-[350px] md:min-h-[450px]">
            <img
              src={heroCar}
              alt="Featured car"
              className="w-full h-auto object-contain scale-150 md:scale-130 lg:scale-140 translate-y-3 lg:translate-x-8 drop-shadow-[0_20px_30px_rgba(0,0,0,0.25)] transition-all duration-300"
            />
          </div>
        </div>
      </section>

      {/* -------- SERVICES GRID -------- */}
      <section className="py-20 md:py-24 max-w-7xl mx-auto px-6 md:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-brand">Our Services</span>
          <h2 className="text-3xl md:text-4xl font-display font-bold mt-2">
            Powerful Services for Dealers &amp; Buyers
          </h2>
          <p className="text-gray-500 mt-3">Everything you need to grow your car business.</p>
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
          {SERVICES.map(({ icon: Icon, title, desc, to, tone }) => {
            const Wrapper = to ? Link : "div";
            return (
              <Wrapper
                key={title}
                {...(to ? { to } : {})}
                className="group relative card card-hover p-6 block"
              >
                <span className={`h-12 w-12 rounded-xl flex items-center justify-center mb-4 transition ${toneClasses[tone]}`}>
                  <Icon size={20} />
                </span>
                <h3 className="font-semibold text-navy-900">{title}</h3>
                <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{desc}</p>
                <span className="absolute bottom-5 right-5 h-8 w-8 rounded-full border border-navy-900/8 flex items-center justify-center text-gray-400 group-hover:border-brand group-hover:text-brand group-hover:translate-x-0.5 transition">
                  <ArrowRight size={14} />
                </span>
              </Wrapper>
            );
          })}
        </div>
      </section>

      {/* -------- HOW IT WORKS -------- */}
      <section id="how-it-works" className="py-20 md:py-24 bg-surface-muted">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand">How It Works</span>
            <h2 className="text-3xl md:text-4xl font-display font-bold mt-2">Simple Steps, Smart Deals</h2>
          </div>

          <div className="relative grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-y-10 gap-x-4">
            <div className="hidden lg:block absolute top-6 left-[8%] right-[8%] border-t-2 border-dashed border-brand/25" />
            {STEPS.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className="relative text-center px-2">
                <span className="relative z-10 mx-auto mb-3 h-12 w-12 rounded-full bg-white border border-brand/20 shadow-soft text-brand flex items-center justify-center">
                  <Icon size={18} />
                </span>
                <p className="text-sm font-semibold text-navy-900">{title}</p>
                <p className="text-xs text-gray-500 mt-1 leading-snug">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------- WHY CHOOSE US -------- */}
      <section className="py-20 md:py-24 max-w-7xl mx-auto px-6 md:px-8">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand">Why Choose Well Cars Deal</span>
        <div className="grid md:grid-cols-2 gap-10 items-start mt-3">
          <div>
            <h2 className="text-3xl md:text-4xl font-display font-bold leading-tight">
              Built on Trust.
              <br />
              Driven by Technology.
            </h2>
            <ul className="mt-6 space-y-3">
              {WHY_POINTS.map((p) => (
                <li key={p} className="flex items-center gap-2.5 text-sm text-gray-600">
                  <CheckCircle2 size={16} className="text-brand shrink-0" /> {p}
                </li>
              ))}
            </ul>
            <Link to="/live-auctions" className="btn-primary mt-7">
              Explore Auctions <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {STATS.map(({ icon: Icon, value, label, tone }) => (
              <div key={label} className="card p-6 text-center">
                <span
                  className={`mx-auto mb-3 h-11 w-11 rounded-xl flex items-center justify-center ${
                    tone === "accent" ? "bg-accent-100 text-accent-600" : "bg-brand-50 text-brand"
                  }`}
                >
                  <Icon size={20} />
                </span>
                <p className="text-2xl font-bold text-navy-900">{value}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------- DASHBOARD PREVIEWS -------- */}
      <section className="pb-20 md:pb-24 max-w-7xl mx-auto px-6 md:px-8">
        <div className="grid md:grid-cols-2 gap-6">
          {/* For Dealers */}
          <div className="card p-6 md:p-8">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand">For Dealers</span>
            <h3 className="text-xl font-display font-bold mt-1.5 mb-4">Everything You Need in One Dashboard</h3>
            <ul className="space-y-2 mb-6">
              {DEALER_POINTS.map((p) => (
                <li key={p} className="flex items-center gap-2.5 text-sm text-gray-600">
                  <CheckCircle2 size={14} className="text-brand shrink-0" /> {p}
                </li>
              ))}
            </ul>
            <Link to="/dealer-login" className="btn-secondary mb-6">
              Learn More <ArrowRight size={16} />
            </Link>

            <div className="rounded-xl bg-surface-muted border border-navy-900/8 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-navy-900">Dashboard</span>
                <span className="text-[10px] text-gray-400">Live Auctions</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[{ v: "128", l: "Listings" }, { v: "45", l: "Live Bids" }, { v: "32", l: "Sold" }].map((s) => (
                  <div key={s.l} className="bg-white rounded-lg p-2 text-center border border-navy-900/5">
                    <p className="text-sm font-bold text-navy-900">{s.v}</p>
                    <p className="text-[9px] text-gray-400">{s.l}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {[
                  { img: maruti, name: "Maruti Swift 2020", price: "₹5,45,000" },
                  { img: hyundai, name: "Hyundai i20 2015", price: "₹3,80,000" },
                  { img: tata, name: "Tata Nexon 2022", price: "₹9,20,000" },
                ].map((c) => (
                  <div key={c.name} className="flex items-center gap-2.5 bg-white rounded-lg p-2 border border-navy-900/5">
                    <img src={c.img} alt="" className="h-7 w-10 object-contain shrink-0" />
                    <span className="text-xs text-gray-700 truncate flex-1">{c.name}</span>
                    <span className="text-xs font-semibold text-navy-900 shrink-0">{c.price}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* For Buyers */}
          <div className="card p-6 md:p-8">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand">For Buyers</span>
            <h3 className="text-xl font-display font-bold mt-1.5 mb-4">Find. Bid. Drive. Your Dream Car</h3>
            <ul className="space-y-2 mb-6">
              {BUYER_POINTS.map((p) => (
                <li key={p} className="flex items-center gap-2.5 text-sm text-gray-600">
                  <CheckCircle2 size={14} className="text-brand shrink-0" /> {p}
                </li>
              ))}
            </ul>
            <Link to="/buy-car" className="btn-secondary mb-6">
              Browse Cars <ArrowRight size={16} />
            </Link>

            <div className="rounded-xl bg-surface-muted border border-navy-900/8 p-4">
              <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-navy-900/8 mb-3">
                <Search size={14} className="text-gray-400 shrink-0" />
                <span className="text-xs text-gray-400">Search Cars</span>
              </div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Popular Cars</p>
              <div className="flex items-center gap-2.5 bg-white rounded-lg p-2.5 border border-navy-900/5">
                <img src={hyundai} alt="" className="h-8 w-12 object-contain shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-navy-900 truncate">Hyundai Creta 2021</p>
                  <p className="text-xs text-brand font-semibold">₹12,45,000</p>
                </div>
                <span className="ml-auto text-[9px] text-accent-600 font-semibold shrink-0">2h 15m left</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------- FAQ -------- */}
      <section className="py-20 md:py-24 bg-surface-muted">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand">Frequently Asked Questions</span>
            <h2 className="text-3xl md:text-4xl font-display font-bold mt-2">Got Questions? We've Got Answers</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-x-6 gap-y-4">
            {FAQS.map((f, i) => (
              <FaqItem key={f.q} {...f} isOpen={openFaq === i} onClick={() => setOpenFaq(openFaq === i ? -1 : i)} />
            ))}
          </div>

          <HelpCircle size={64} className="hidden md:block mx-auto mt-10 text-brand/10" />
        </div>
      </section>

      {/* -------- BOTTOM CTA -------- */}
      <section className="relative overflow-hidden bg-navy-gradient text-white">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-16 grid md:grid-cols-[auto,1fr,auto] gap-10 items-center">
          <img
            src={ctaCar}
            alt=""
            className="hidden md:block w-64 rounded-2xl object-cover h-40"
          />

          <div>
            <h2 className="text-2xl md:text-3xl font-display font-bold">Ready to Grow Your Car Business?</h2>
            <p className="text-white/70 mt-2 max-w-md text-sm">
              Join thousands of dealers who trust Well Cars Deal for smarter auctions and better profits.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/dealer-register" className="btn bg-white text-navy-900 hover:bg-white/90">
                Become Dealer
              </Link>
              <Link to="/live-auctions" className="btn border border-white/30 text-white hover:bg-white/10">
                Explore Auctions
              </Link>
            </div>
          </div>

          <ul className="space-y-3 text-sm shrink-0">
            {["Verified Dealers Only", "Secure & Transparent", "Best Price Guarantee", "24/7 Expert Support"].map(
              (t) => (
                <li key={t} className="flex items-center gap-2.5">
                  <CheckCircle2 size={15} className="text-white/70 shrink-0" /> {t}
                </li>
              )
            )}
          </ul>
        </div>
      </section>
    </div>
  );
};

export default Services;