import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ShieldCheck,
  Gavel,
  Headphones,
  CheckCircle2,
  Users,
  UserCheck,
  Building2,
  Handshake,
  Target,
  Eye,
  Car,
  Search,
  Tag,
  ClipboardCheck,
  Trophy,
  BadgeIndianRupee,
  Zap,
  Lock,
  Linkedin,
  Mail as MailIcon,
  MapPin,
} from "lucide-react";

import carImage from "../assets/car.png";
import carImage2 from "../assets/car.jpg";
import bgSkyline from "../assets/bg-skyline.png";
import officeImage from "../assets/s2.jpg";

import teamShivam from "../assets/team-shivam.jpeg";
import teamRishi from "../assets/team-rishi.jpeg";
import teamShashwat from "../assets/team-shashwat.jpeg";

/* ---------------- Reusable fade-up wrapper ---------------- */
const FadeUp = ({ children, delay = 0, className = "" }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.2 }}
    transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.div>
);

/* ---------------- Data ---------------- */
const heroFeatures = [
  { icon: <ShieldCheck size={16} />, label: "Verified Cars" },
  { icon: <Gavel size={16} />, label: "Live Dealer Auctions" },
  { icon: <CheckCircle2 size={16} />, label: "Trusted Platform" },
  { icon: <Headphones size={16} />, label: "24×7 Support" },
];

const heroStats = [
  { icon: <Car size={18} />, value: "5,000+", label: "Cars Listed" },
  { icon: <ShieldCheck size={18} />, value: "100+", label: "Verified Dealers" },
  { icon: <Users size={18} />, value: "3,000+", label: "Happy Customers" },
  { icon: <MapPin size={18} />, value: "10+", label: "Cities Covered" },
];

const companyFeatures = [
  { icon: <ClipboardCheck size={20} />, title: "Verified Listings", desc: "Every vehicle is reviewed for authenticity and quality before it goes live." },
  { icon: <ShieldCheck size={20} />, title: "Dealer Verification", desc: "All dealers go through a strict verification process to ensure transparency." },
  { icon: <Gavel size={20} />, title: "Live Auction System", desc: "Real-time bidding helps sellers get the best value for their vehicles." },
  { icon: <Handshake size={20} />, title: "Customer First", desc: "We prioritize a secure, smooth and satisfying experience for every user." },
];

const buyerSteps = [
  { title: "Search Verified Cars", desc: "Explore from thousands of verified listings." },
  { title: "Compare Details", desc: "Compare price, specs, features and condition." },
  { title: "Contact Seller", desc: "Connect directly and clear your queries." },
  { title: "Buy With Confidence", desc: "Complete paperwork and drive with trust." },
];

const sellerSteps = [
  { title: "List Your Vehicle", desc: "Add all details and upload photos." },
  { title: "Get Verified", desc: "Our team verifies your listing." },
  { title: "Receive Dealer Bids", desc: "Verified dealers bid in live auction." },
  { title: "Accept Best Offer", desc: "Choose the best bid and close the deal." },
];

const dealerSteps = [
  { title: "Register Dealership", desc: "Create account and submit documents." },
  { title: "Get Approved", desc: "Admin verifies and approves your account." },
  { title: "Join Live Auctions", desc: "Participate in live bidding on vehicles." },
  { title: "Win The Bid", desc: "Win auctions and grow your inventory." },
];

const auctionTimeline = [
  { icon: <Car size={20} />, label: "Seller Lists Car" },
  { icon: <ShieldCheck size={20} />, label: "Admin Verification" },
  { icon: <Gavel size={20} />, label: "Auction Goes Live" },
  { icon: <Users size={20} />, label: "Verified Dealers Bid" },
  { icon: <Trophy size={20} />, label: "Highest Bid Wins" },
  { icon: <Handshake size={20} />, label: "Seller Accepts Offer" },
  { icon: <CheckCircle2 size={20} />, label: "Deal Completed" },
];

const whyChoose = [
  { icon: <ShieldCheck size={22} />, title: "Verified Dealers", desc: "Only verified and trusted dealers on our platform." },
  { icon: <Gavel size={22} />, title: "Transparent Auctions", desc: "Real-time bidding ensures complete transparency." },
  { icon: <Tag size={22} />, title: "Best Market Price", desc: "Get the best value for your vehicle through live bids." },
  { icon: <Zap size={22} />, title: "Fast Approval", desc: "Quick verification and smooth onboarding." },
  { icon: <Lock size={22} />, title: "Safe Transactions", desc: "Secure payments and documents for peace of mind." },
  { icon: <Headphones size={22} />, title: "Dedicated Support", desc: "Our support team is always here to help you." },
];

const impactStats = [
  { icon: <Car size={20} />, value: "10,000+", label: "Cars Listed" },
  { icon: <UserCheck size={20} />, value: "500+", label: "Verified Dealers" },
  { icon: <Users size={20} />, value: "50,000+", label: "Happy Customers" },
  { icon: <MapPin size={20} />, value: "100+", label: "Cities Covered" },
  { icon: <BadgeIndianRupee size={20} />, value: "₹500Cr+", label: "Vehicle Transactions" },
  { icon: <span className="text-amber-400 font-bold">★</span>, value: "4.9★", label: "Customer Rating" },
];

const team = [
  { name: "Shivam", role: "Founder & CEO", desc: "Visionary leader with a passion for innovation and building trusted marketplaces.", founder: true, photo: teamShivam },
  { name: "Rishi", role: "Business Development Manager", desc: "Expert in partnerships and business growth. Driving our dealer network across India.", photo: teamRishi },
  { name: "Shashwat", role: "Operations & Logistics Manager", desc: "Handles operations, dealer success and ensures smooth experience for all users.", photo: teamShashwat },
];

/* ---------------- Small building blocks ---------------- */
const SectionEyebrow = ({ children }) => (
  <p className="text-xs font-bold tracking-[0.18em] text-brand-600 uppercase mb-3">
    {children}
  </p>
);

const StepColumn = ({ badge, badgeColor, icon, iconBg, steps, footnote }) => (
  <div className="bg-white rounded-[24px] border border-slate-100 shadow-card p-6 sm:p-7 h-full flex flex-col justify-between">
    <div>
      <div className="flex items-center justify-between mb-6">
        <span
          className="text-[11px] font-bold tracking-wider uppercase px-3 py-1.5 rounded-full"
          style={{ color: badgeColor, backgroundColor: `${badgeColor}14` }}
        >
          {badge}
        </span>
        <div
          className="h-11 w-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm"
          style={{ background: iconBg }}
        >
          {icon}
        </div>
      </div>

      <ol className="space-y-0">
        {steps.map((step, i) => (
          <li key={i} className="relative pl-10 pb-6 last:pb-0">
            {i !== steps.length - 1 && (
              <span className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-200" />
            )}
            <span
              className="absolute left-0 top-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
              style={{ background: iconBg }}
            >
              {i + 1}
            </span>
            <h4 className="font-semibold text-navy-900 text-sm">{step.title}</h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{step.desc}</p>
          </li>
        ))}
      </ol>
    </div>

    {footnote && (
      <div className="mt-4 rounded-xl bg-brand-50 text-brand-700 text-xs font-medium px-4 py-3 leading-relaxed border border-brand-100/50">
        {footnote}
      </div>
    )}
  </div>
);

const About = () => {
  return (
    <div className="bg-white text-navy-900 overflow-hidden">
      {/* ============================================================
          SECTION 1 — HERO
      ============================================================ */}
      <section className="relative pt-10 pb-20 md:pt-14 md:pb-28">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <img
            src={bgSkyline}
            alt=""
            aria-hidden="true"
            className="absolute right-0 top-10 w-[60%] max-w-2xl opacity-[0.08] pointer-events-none select-none"
          />
          <div className="absolute -right-24 top-0 h-[520px] w-[520px] rounded-full bg-brand-100/60 blur-3xl pointer-events-none" />
          <div className="absolute right-40 top-52 h-72 w-72 rounded-full border border-brand-200/70 pointer-events-none" />
          <div className="absolute right-10 top-24 h-96 w-96 rounded-full border border-brand-100 pointer-events-none" />
        </div>

        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            {/* Left */}
            <FadeUp>
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-100 rounded-full px-4 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
                India's Trusted Vehicle Marketplace
              </span>

              <h1 className="mt-5 text-3xl sm:text-4xl font-bold text-navy-900 tracking-tight">
                About WellCarDeals
              </h1>

              <p className="mt-3 text-3xl sm:text-[2.6rem] leading-[1.15] font-extrabold text-navy-900">
                Driving Trust.{" "}
                <span className="block sm:inline">
                  <span className="text-brand-600">Connecting</span> Buyers,
                </span>{" "}
                <span className="block">Sellers &amp; Dealers.</span>
              </p>

              <p className="mt-5 text-slate-500 text-base sm:text-lg leading-relaxed max-w-lg">
                WellCarDeals is India's modern vehicle marketplace where buyers,
                sellers, and verified dealers connect through a transparent,
                secure, and technology-driven platform.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  to="/buy-car"
                  className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold px-6 py-3.5 rounded-2xl shadow-glow transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                  Browse Cars <ArrowRight size={18} />
                </Link>
                <Link
                  to="/dealer-register"
                  className="inline-flex items-center gap-2 bg-white border-2 border-brand-600 text-brand-600 font-semibold px-6 py-3.5 rounded-2xl hover:bg-brand-50 transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                  Become a Dealer <ArrowRight size={18} />
                </Link>
              </div>

              <div className="mt-9 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
                {heroFeatures.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                    <span className="text-brand-600">{f.icon}</span>
                    {f.label}
                  </div>
                ))}
              </div>
            </FadeUp>

            {/* Right */}
            <FadeUp delay={0.15} className="relative">
              <motion.img
                src={carImage}
                alt="Well Car Deals Showcase SUV"
                className="relative z-10 w-full max-w-xl mx-auto drop-shadow-2xl"
                initial={{ y: 10 }}
                animate={{ y: [10, -6, 10] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              />

              <div className="relative z-10 mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {heroStats.map((s, i) => (
                  <FadeUp
                    key={i}
                    delay={0.2 + i * 0.08}
                    className="bg-white rounded-2xl shadow-card border border-slate-100 px-4 py-3.5 text-center"
                  >
                    <div className="flex items-center justify-center gap-1.5 text-brand-600 mb-1">
                      {s.icon}
                    </div>
                    <p className="text-base font-extrabold text-navy-900">{s.value}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{s.label}</p>
                  </FadeUp>
                ))}
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 2 — ABOUT COMPANY
      ============================================================ */}
      <section className="py-20 md:py-28 bg-surface">
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <FadeUp>
              <div className="rounded-[24px] overflow-hidden shadow-lift">
                <img
                  src={officeImage}
                  alt="Well Car Deals Headquarters Office"
                  loading="lazy"
                  className="w-full h-[340px] sm:h-[420px] object-cover"
                />
              </div>
            </FadeUp>

            <FadeUp delay={0.1}>
              <SectionEyebrow>Who We Are</SectionEyebrow>
              <h2 className="text-2xl sm:text-3xl font-bold text-navy-900">
                Built on Trust. Driven by Innovation.
              </h2>
              <p className="mt-5 text-slate-600 leading-relaxed">
                Well Car Deals is built to simplify the complete vehicle buying
                and selling experience.
              </p>
              <p className="mt-4 text-slate-600 leading-relaxed">
                Unlike traditional marketplaces, we connect buyers, individual
                sellers, and verified dealers through a transparent auction
                ecosystem.
              </p>
              <p className="mt-4 text-slate-600 leading-relaxed">
                Every listing is reviewed, every dealer is verified, and every
                transaction is designed around trust.
              </p>
            </FadeUp>
          </div>

          <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
            {companyFeatures.map((f, i) => (
              <FadeUp
                key={i}
                delay={i * 0.08}
                className="bg-white rounded-[24px] p-6 shadow-card border border-slate-100 hover:shadow-lift hover:-translate-y-1 transition-all duration-300"
              >
                <div className="h-11 w-11 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-navy-900 text-sm">{f.title}</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">{f.desc}</p>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 3 — MISSION & VISION
      ============================================================ */}
      <section className="py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-6 md:px-10 grid md:grid-cols-2 gap-6">
          <FadeUp className="rounded-[24px] bg-navy-gradient text-white p-8 sm:p-10 shadow-lift">
            <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center mb-5 backdrop-blur-sm">
              <Target size={22} />
            </div>
            <p className="text-xs font-bold tracking-widest uppercase text-brand-300 mb-2">
              Our Mission
            </p>
            <h3 className="text-xl sm:text-2xl font-bold leading-snug">
              To build India's most trusted digital automobile marketplace.
            </h3>
          </FadeUp>

          <FadeUp delay={0.1} className="rounded-[24px] bg-brand-50 border border-brand-100 p-8 sm:p-10">
            <div className="h-12 w-12 rounded-2xl bg-white text-brand-600 flex items-center justify-center mb-5 shadow-soft">
              <Eye size={22} />
            </div>
            <p className="text-xs font-bold tracking-widest uppercase text-brand-600 mb-2">
              Our Vision
            </p>
            <h3 className="text-xl sm:text-2xl font-bold text-navy-900 leading-snug">
              To redefine vehicle buying and selling through technology,
              transparency, and innovation.
            </h3>
          </FadeUp>
        </div>
      </section>

      {/* ============================================================
          SECTION 4 — HOW WELL CAR DEALS WORKS
      ============================================================ */}
      <section className="py-20 md:py-28 bg-surface">
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <FadeUp className="text-center max-w-xl mx-auto">
            <SectionEyebrow>How Well Car Deals Works</SectionEyebrow>
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-900">
              Simple Journey For <span className="text-brand-600">Everyone</span>
            </h2>
            <p className="mt-3 text-slate-500">
              Designed for Buyers, Sellers and Dealers
            </p>
          </FadeUp>

          <div className="mt-14 grid md:grid-cols-3 gap-6 items-stretch">
            <FadeUp>
              <StepColumn
                badge="For Buyers"
                badgeColor="#2563EB"
                icon={<Search size={20} />}
                iconBg="linear-gradient(135deg,#2563EB,#1d4ed8)"
                steps={buyerSteps}
              />
            </FadeUp>
            <FadeUp delay={0.1}>
              <StepColumn
                badge="For Sellers"
                badgeColor="#059669"
                icon={<Tag size={20} />}
                iconBg="linear-gradient(135deg,#10B981,#059669)"
                steps={sellerSteps}
              />
            </FadeUp>
            <FadeUp delay={0.2}>
              <StepColumn
                badge="For Dealers"
                badgeColor="#7C3AED"
                icon={<Building2 size={20} />}
                iconBg="linear-gradient(135deg,#8B5CF6,#7C3AED)"
                steps={dealerSteps}
                footnote={
                  <>
                    Dealer <strong>ONLY</strong> participates in bidding. Dealer{" "}
                    <strong>never</strong> uploads cars.
                  </>
                }
              />
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 5 — LIVE AUCTION PROCESS
      ============================================================ */}
      <section className="py-20 md:py-24">
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <FadeUp className="text-center mb-14">
            <SectionEyebrow>Live Auction Process</SectionEyebrow>
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-900">
              From Listing To Deal, Fully Transparent
            </h2>
          </FadeUp>

          <div className="relative">
            <div className="hidden md:block absolute top-6 left-0 right-0 h-px bg-slate-200 -z-0" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-y-10 gap-x-4">
              {auctionTimeline.map((step, i) => (
                <FadeUp
                  key={i}
                  delay={i * 0.08}
                  className="relative flex flex-col items-center text-center z-10"
                >
                  <div className="h-12 w-12 rounded-full bg-white border-2 border-brand-500 text-brand-600 flex items-center justify-center shadow-soft">
                    {step.icon}
                  </div>
                  <p className="mt-3 text-xs font-semibold text-navy-900 max-w-[100px] leading-snug">
                    {step.label}
                  </p>
                </FadeUp>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 6 — WHY CHOOSE WELL CAR DEALS
      ============================================================ */}
      <section className="py-20 md:py-28 bg-surface">
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <FadeUp className="text-center max-w-xl mx-auto mb-14">
            <SectionEyebrow>Why Choose Us</SectionEyebrow>
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-900">
              Why Choose Well Car Deals
            </h2>
          </FadeUp>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
            {whyChoose.map((f, i) => (
              <FadeUp
                key={i}
                delay={i * 0.06}
                className="group bg-white rounded-[24px] p-7 border border-slate-100 shadow-card hover:shadow-lift hover:-translate-y-1.5 transition-all duration-300"
              >
                <div className="h-12 w-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-5 group-hover:bg-brand-600 group-hover:text-white transition-colors duration-300">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-navy-900">{f.title}</h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">{f.desc}</p>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 7 — STATISTICS
      ============================================================ */}
      <section className="py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <FadeUp className="text-center mb-10">
            <SectionEyebrow>Our Impact In Numbers</SectionEyebrow>
          </FadeUp>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {impactStats.map((s, i) => (
              <FadeUp
                key={i}
                delay={i * 0.06}
                className="rounded-2xl bg-white border border-slate-100 shadow-soft px-4 py-6 text-center hover:shadow-card transition-shadow"
              >
                <div className="flex items-center justify-center text-brand-600 mb-2">
                  {s.icon}
                </div>
                <p className="text-xl font-extrabold text-navy-900">{s.value}</p>
                <p className="text-[11px] text-slate-500 mt-1">{s.label}</p>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 8 — LEADERSHIP TEAM*/}
      <section className="py-20 md:py-28 bg-surface">
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <FadeUp className="text-center max-w-xl mx-auto mb-14">
            <SectionEyebrow>Our Leadership Team</SectionEyebrow>
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-900">
              Meet The Team Behind{" "}
              <span className="text-brand-600">Well Car Deals</span>
            </h2>
            <p className="mt-3 text-slate-500 text-sm">
              Experienced professionals committed to revolutionizing the
              automobile marketplace in India.
            </p>
          </FadeUp>

          {/* items-stretch ensures all cards take the exact same height in the row */}
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 items-stretch max-w-4xl mx-auto">
            {team.map((member, i) => (
              <FadeUp
                key={i}
                delay={i * 0.08}
                className="h-full"
              >
                <div
                  className={`relative bg-white rounded-[24px] p-6 text-center border shadow-card hover:shadow-lift hover:-translate-y-1.5 transition-all duration-300 h-full flex flex-col justify-between ${
                    member.founder ? "border-brand-300 ring-1 ring-brand-100" : "border-slate-100"
                  }`}
                >
                  {/* Top Content (Photo + Name + Role + Description) */}
                  <div className="flex flex-col items-center">
                    {member.founder && (
                      <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wide bg-brand-600 text-white px-2.5 py-1 rounded-full z-10">
                        Founder
                      </span>
                    )}
                    <div className="h-32 w-32 sm:h-36 sm:w-36 mx-auto rounded-full overflow-hidden shadow-lift ring-4 ring-white shrink-0">
                      <img
                        src={member.photo}
                        alt={`${member.name} - ${member.role}`}
                        loading="lazy"
                        className="h-full w-full object-cover object-top"
                      />
                    </div>
                    <h3 className="mt-4 font-semibold text-navy-900">{member.name}</h3>
                    <p className="text-xs font-medium text-brand-600 mt-1">{member.role}</p>
                    <p className="text-xs text-slate-500 mt-3 leading-relaxed">{member.desc}</p>
                  </div>

                  {/* Bottom Social Icons (Always Aligned at Bottom) */}
                  <div className="flex items-center justify-center gap-3 mt-6 pt-2">
                    <a
                      href="#linkedin"
                      aria-label={`${member.name}'s LinkedIn Profile`}
                      className="h-8 w-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-brand-600 hover:text-white transition-colors"
                    >
                      <Linkedin size={14} />
                    </a>
                    <a
                      href="#mail"
                      aria-label={`Email ${member.name}`}
                      className="h-8 w-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-brand-600 hover:text-white transition-colors"
                    >
                      <MailIcon size={14} />
                    </a>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 9 — CALL TO ACTION
      ============================================================ */}
      <section className="py-16 md:py-20 px-6 md:px-10">
        <FadeUp className="max-w-7xl mx-auto rounded-[24px] bg-navy-gradient relative overflow-hidden">
          <div className="absolute -right-10 -top-16 h-64 w-64 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute right-24 bottom-0 h-40 w-40 rounded-full bg-brand-500/20 blur-2xl pointer-events-none" />

          <div className="relative grid md:grid-cols-2 items-center gap-8 px-8 sm:px-14 py-12 sm:py-16">
            <div>
              <h2 className="text-2xl sm:text-4xl font-bold text-white leading-tight">
                Ready To Find <br /> Your Next Car?
              </h2>
              <p className="mt-4 text-brand-100/80 max-w-md">
                Join thousands of buyers and dealers already trusting Well Car
                Deals.
              </p>
              <div className="mt-7 flex flex-wrap gap-4">
                <Link
                  to="/buy-car"
                  className="inline-flex items-center gap-2 bg-white text-brand-700 font-semibold px-6 py-3.5 rounded-2xl hover:-translate-y-0.5 active:translate-y-0 transition-transform shadow-md"
                >
                  Browse Cars <ArrowRight size={18} />
                </Link>
                <Link
                  to="/dealer-register"
                  className="inline-flex items-center gap-2 bg-transparent border-2 border-white/40 text-white font-semibold px-6 py-3.5 rounded-2xl hover:bg-white/10 transition-colors"
                >
                  Become a Dealer <ArrowRight size={18} />
                </Link>
              </div>
            </div>

            <motion.img
              src={carImage2}
              alt="Well Car Deals Platform"
              loading="lazy"
              className="w-full max-w-sm mx-auto md:ml-auto rounded-2xl object-cover hidden sm:block shadow-2xl"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            />
          </div>
        </FadeUp>
      </section>
    </div>
  );
};

export default About;