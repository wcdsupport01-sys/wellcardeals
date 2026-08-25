import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import carImage from "../assets/car.png";
import bgSkyline from "../assets/bg-skyline.png";
import sellCarImage from "../assets/car.jpg";
import marutiLogo from "../assets/maruti.png";
import hyundaiLogo from "../assets/hyundai.png";
import hondaLogo from "../assets/honda.png";
import tataLogo from "../assets/tata.png";
import mahindraLogo from "../assets/mahindra.png";
import kiaLogo from "../assets/kia.png";
import toyotaLogo from "../assets/toyota.png";
import Testimonials from "../components/Testimonials";
import PopularBrands from "../components/PopularBrands";
import Benefits from "../components/Benefits";
import HowItWorksVideo from "../components/HowItWorksVideo";
import CityCoverage from "../components/CityCoverage";
import DownloadApp from "../components/DownloadApp";
import CTA from "../components/CTA";
import FeaturedCarsCarousel from "../components/FeaturedCarsCarousel";
import DealerPendingCard from "../components/DealerPendingCard";
import { useAuth } from "../auth/AuthContext";
import { motion } from "framer-motion";
import {
  Search,
  ShieldCheck,
  BadgeIndianRupee,
  Lock,
  Headphones,
  MapPin,
  Users,
  Gavel,
  CheckCircle2,
  Zap,
  Wallet,
} from "lucide-react";

const trustFeatures = [
  { icon: <ShieldCheck size={18} />, title: "Verified Cars", desc: "100% quality checked and verified" },
  { icon: <BadgeIndianRupee size={18} />, title: "Best Price", desc: "Get the best deals at the right price" },
  { icon: <Lock size={18} />, title: "Secure Bidding", desc: "Safe, transparent & secure process" },
  { icon: <Headphones size={18} />, title: "24/7 Support", desc: "We're here to help you anytime" },
];

const howItWorksSteps = [
  { num: "1", title: "List Your Car", desc: "Add your car details in a few minutes" },
  { num: "2", title: "Get Inspection", desc: "We inspect your car at your doorstep" },
  { num: "3", title: "Live Auction", desc: "Verified dealers bid live for your car" },
  { num: "4", title: "Get Best Price", desc: "Accept the best offer and get paid" },
];

const statsData = [
  { icon: <Users size={22} />, value: "5000+", label: "Cars Listed" },
  { icon: <Gavel size={22} />, value: "3000+", label: "Happy Customers" },
  { icon: <Zap size={22} />, value: "2000+", label: "Auctions Completed" },
  { icon: <MapPin size={22} />, value: "10+", label: "Cities Covered" },
  { icon: <ShieldCheck size={22} />, value: "100+", label: "Verified Dealers" },
  { icon: <CheckCircle2 size={22} />, value: "99.9%", label: "Secure & Trusted" },
];

const sellSteps = [
  { num: "1", title: "Enter Details", desc: "Fill in your car details in a few minutes" },
  { num: "2", title: "Get Offers", desc: "Receive best offers from verified dealers" },
  { num: "3", title: "Sell & Get Paid", desc: "Complete the deal and get paid instantly" },
];

const sellWhy = [
  { icon: <BadgeIndianRupee size={20} />, title: "Best Price", desc: "Get the maximum value for your car" },
  { icon: <Zap size={20} />, title: "Quick Process", desc: "Sell your car in just a few hours" },
  { icon: <ShieldCheck size={20} />, title: "Verified Buyers", desc: "Only genuine, verified buyers" },
  { icon: <Wallet size={20} />, title: "Safe & Secure", desc: "Secure payment, every time" },
];

const heroBrands = [
  { name: "Maruti Suzuki", logo: marutiLogo },
  { name: "Hyundai", logo: hyundaiLogo },
  { name: "Honda", logo: hondaLogo },
  { name: "Tata", logo: tataLogo },
  { name: "Mahindra", logo: mahindraLogo },
  { name: "Kia", logo: kiaLogo },
  { name: "Toyota", logo: toyotaLogo },
];

const Home = () => {
  const navigate = useNavigate();
  const { role, dealerStatus } = useAuth();
  const isPendingDealer = role === "dealer" && dealerStatus === "pending";
  const [lookingFor, setLookingFor] = useState("All Cars");
  const [brand, setBrand] = useState("");
  const [budget, setBudget] = useState("");
  const [location, setLocation] = useState("");

  function handleSearch(e) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (brand) params.set("brand", brand);
    if (budget) params.set("budget", budget);
    if (location) params.set("location", location);
    navigate(`/buy-car${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="bg-white text-navy-900 font-sans">
      {isPendingDealer && <DealerPendingCard />}

      {/* HERO SECTION */}
      <section className="relative pt-6 sm:pt-10 md:pt-16 pb-24 md:pb-32 bg-gradient-to-b from-blue-50/60 via-white to-white">

        {/* Skyline background with its own overflow-hidden */}
        <div className="hidden md:block absolute top-0 right-0 bottom-0 w-[65%] lg:w-[58%] z-0 pointer-events-none overflow-hidden">
          <img
            src={bgSkyline}
            alt="Skyline background"
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-white via-white/80 to-transparent" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-12 gap-6 items-center relative z-10">

          {/* LEFT COLUMN: Clean Compact Stack */}
          <div className="col-span-12 md:col-span-6 lg:col-span-5 z-10 flex flex-col justify-center">
            
            <span className="inline-flex items-center gap-1.5 w-fit text-[10px] sm:text-xs font-semibold tracking-wide text-brand-700 bg-blue-100/70 border border-blue-200/50 rounded-full px-3 py-0.5 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block shrink-0" />
              India's Trusted Used Car Marketplace
            </span>

            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-none text-slate-900 font-extrabold tracking-tight">
              FIND. <span className="text-[#2E6BFF]">BID.</span> DRIVE.
            </h1>

            <p className="mt-2 text-slate-600 text-xs sm:text-sm md:text-base leading-snug max-w-lg">
              Discover verified used cars, place your best bid, and drive home your dream car.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                to="/buy-car"
                className="bg-[#173772] text-white px-5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold hover:bg-[#0B1F4D] transition shadow-md shadow-[#173772]/20"
              >
                Browse Cars
              </Link>
              <Link
                to="/services"
                className="border border-slate-300 bg-white/80 text-slate-700 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold hover:bg-slate-50 transition flex items-center gap-1.5"
              >
                <span className="w-3.5 h-3.5 rounded-full border border-slate-400 flex items-center justify-center text-[7px] shrink-0">▶</span>
                How It Works
              </Link>
            </div>

            {/* TRUST FEATURES GRID */}
            <div className="grid grid-cols-4 gap-2 mt-6 pt-2 border-t border-slate-100">
              {trustFeatures.map((item, i) => (
                <div key={i} className="flex flex-col items-start gap-0.5">
                  <span className="text-[#2563EB]">{item.icon}</span>
                  <p className="text-[11px] font-bold text-slate-800 leading-tight">{item.title}</p>
                  <p className="text-[9px] text-slate-400 leading-tight hidden sm:block">{item.desc}</p>
                </div>
              ))}
            </div>

            {/* BRAND LOGOS STRIP */}
            <div className="mt-4">
              <p className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase mb-1.5">
                TRUSTED BRANDS ON OUR PLATFORM
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {heroBrands.map((brand, i) => (
                  <img
                    key={i}
                    src={brand.logo}
                    alt={brand.name}
                    className="h-4 sm:h-5 w-auto object-contain grayscale opacity-70 hover:opacity-100 transition"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Car Container */}
          <div className="col-span-12 md:col-span-6 lg:col-span-7 relative flex justify-center items-center h-[220px] sm:h-[300px] md:h-[460px] lg:h-[500px] z-20">
            {/* Foreground Transparent Car Image */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="relative z-20 w-full flex justify-center items-center"
            >
              <img
                src={carImage}
                alt="Featured car"
                // CHANGED: reduced scales, increased translate-x (right), added translate-y (down)
                className=" object-contain
                      drop-shadow-[0_25px_35px_rgba(0,0,0,0.3)]
                      saturate-[1.25]
                      contrast-[1.05]

                      w-[100%]
                      sm:w-[105%]
                      md:w-full

                      max-w-[600px]
                      md:max-w-[800px]

                      scale-[0.85]
                      sm:scale-[0.9]
                      md:scale-[0.95]
                      lg:scale-[1.05]

                      translate-x-[-12px]
                      sm:translate-x-0
                      md:translate-x-20
                      lg:translate-x-24

                      translate-y-6
                      sm:translate-y-8
                      md:translate-y-24"
              />
            </motion.div>
          </div>

        </div>

        {/* FLOATING SEARCH BAR (Fully Visible Now) */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-[-75px] md:-bottom-7 w-full max-w-5xl px-4 z-30">
          <motion.form
            onSubmit={handleSearch}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full bg-[linear-gradient(to_right,#0B1B3D,#163C8C,#163C8C,#0B1B3D)] text-navy-100 rounded-2xl p-3 sm:p-4 flex flex-wrap lg:flex-nowrap items-end gap-2.5 border border-[#1A3775] shadow-2xl"
          >
            <div className="flex-1 min-w-[140px]">
              <label className="block text-[9px] uppercase font-semibold text-slate-300 mb-1">
                I'm Looking For
              </label>
              <select
                value={lookingFor}
                onChange={(e) => setLookingFor(e.target.value)}
                className="w-full bg-[#132B61] border border-[#28488D] rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none"
              >
                <option>All Cars</option>
                <option>Sedan</option>
                <option>SUV</option>
                <option>Hatchback</option>
              </select>
            </div>

            <div className="flex-1 min-w-[140px]">
              <label className="block text-[9px] uppercase font-semibold text-slate-300 mb-1">
                Brand
              </label>
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full bg-[#132B61] border border-[#28488D] rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none"
              >
                <option>Select Brand</option>
                <option>Maruti</option>
                <option>Hyundai</option>
                <option>Honda</option>
                <option>Tata</option>
              </select>
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="block text-[9px] uppercase font-semibold text-slate-300 mb-1">
                Budget
              </label>
              <input
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="Min Price - Max Price"
                className="w-full bg-[#132B61] border border-[#28488D] rounded-lg px-2.5 py-2 text-white placeholder:text-slate-400 text-xs focus:outline-none"
              />
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="block text-[9px] uppercase font-semibold text-slate-300 mb-1">
                Location
              </label>
              <div className="relative">
                <MapPin
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="All Locations"
                  className="w-full bg-[#132B61] border border-[#28488D] rounded-lg pl-7 pr-2.5 py-2 text-white placeholder:text-slate-400 text-xs focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="h-[36px] px-6 bg-[#2E6BFF] hover:bg-[#1E5CFF] rounded-lg text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer"
            >
              <Search size={14} />
              Search Cars
            </button>
          </motion.form>
        </div>
      </section>

      {/* HOW IT WORKS SECTION */}
      <section className="pt-16 pb-12 bg-surface">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-10">
            <span className="text-[10px] font-semibold tracking-widest text-accent-600 uppercase">How It Works</span>
            <h2 className="font-display text-3xl md:text-4xl text-navy-900 mt-1">
              4 Simple Steps
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {howItWorksSteps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="text-center"
              >
                <div className="w-12 h-12 mx-auto rounded-full bg-navy-900 text-white flex items-center justify-center font-display text-xl shadow-md">
                  {step.num}
                </div>
                <h3 className="mt-3 text-sm font-semibold text-navy-900">{step.title}</h3>
                <p className="text-xs text-navy-700/70 mt-0.5">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <PopularBrands />

      {/* FEATURED CARS */}
      <FeaturedCarsCarousel limit={8} viewMoreLink="/buy-car" />

      {/* WHY CHOOSE US / SELL IN 3 STEPS / HOW IT WORKS */}
      <section className="py-12 bg-surface">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-6 items-stretch">
          <div className="card p-5">
            <h3 className="font-display text-base text-navy-900 mb-3">Why Choose Well Car Deals</h3>
            <ul className="space-y-3">
              {trustFeatures.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="h-6 w-6 shrink-0 rounded-lg bg-brand-50 text-brand flex items-center justify-center">
                    {React.cloneElement(item.icon, { size: 14 })}
                  </span>
                  <div className="leading-tight">
                    <p className="text-xs font-semibold text-navy-900">{item.title}</p>
                    <p className="text-[11px] text-navy-700/60">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-5">
            <h3 className="font-display text-base text-navy-900 mb-4">Sell Your Car in 3 Easy Steps</h3>
            <div className="flex justify-between gap-2">
              {sellSteps.map((step, i) => (
                <div key={i} className="text-center flex-1">
                  <div className="w-8 h-8 mx-auto rounded-full bg-navy-900 text-white flex items-center justify-center text-xs font-bold">
                    {step.num}
                  </div>
                  <p className="mt-1.5 text-xs font-semibold text-navy-900">{step.title}</p>
                  <p className="text-[10px] text-navy-700/55 leading-snug mt-0.5">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 pt-4 pb-1">
              <h3 className="font-display text-base text-navy-900">How It Works?</h3>
              <Link to="/services" className="text-xs font-semibold text-brand hover:text-brand-700">Watch Video →</Link>
            </div>
            <div className="relative mt-2 mx-5 mb-5 rounded-xl overflow-hidden aspect-video bg-navy-900 group cursor-pointer">
              <img
                src={sellCarImage}
                alt="How Well Car Deal works"
                className="w-full h-full object-cover opacity-70 group-hover:opacity-80 transition"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="h-10 w-10 rounded-full bg-white/90 flex items-center justify-center shadow-md group-hover:scale-110 transition">
                  <span className="w-0 h-0 border-y-[6px] border-y-transparent border-l-[10px] border-l-navy-900 ml-0.5" />
                </span>
              </div>
              <p className="absolute bottom-2.5 left-2.5 right-2.5 text-white text-[11px] font-medium leading-snug">
                See how Well Car Deal makes buying & selling cars simple &amp; secure.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Benefits />

      {/* SELL YOUR CAR */}
      <section className="py-16 bg-surface">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="text-xs font-semibold tracking-widest text-accent-600 uppercase">Sell Your Car</span>
            <h2 className="font-display text-3xl md:text-4xl text-navy-900 mt-1 mb-5">
              Get the Best Price for Your Car
            </h2>

            <div className="space-y-4">
              {sellSteps.map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 shrink-0 rounded-full bg-navy-900 text-white flex items-center justify-center text-xs font-semibold">
                    {step.num}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-navy-900">{step.title}</h4>
                    <p className="text-xs text-navy-700/70">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link
              to="/sell-car"
              className="inline-block mt-6 bg-navy-900 text-white px-6 py-3 rounded-lg text-xs font-semibold hover:bg-navy-700 transition shadow-md"
            >
              Get Started
            </Link>
          </div>

          <div>
            <img
              src={sellCarImage}
              alt="Sell your car"
              className="w-full h-auto rounded-2xl object-cover shadow-lg"
            />

            <div className="grid grid-cols-2 gap-3 mt-4">
              {sellWhy.map((item, i) => (
                <div key={i} className="bg-white border border-navy-900/10 rounded-xl p-3 flex items-start gap-2.5">
                  <div className="w-8 h-8 shrink-0 rounded-lg bg-accent-50 text-accent-600 flex items-center justify-center">
                    {item.icon}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-navy-900">{item.title}</h4>
                    <p className="text-[11px] text-navy-700/70 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <section className="bg-[linear-gradient(to_right,#0B1B3D,#163C8C,#163C8C,#0B1B3D)] text-navy-100 py-8">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {statsData.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.3, delay: i * 0.08 }}
              className="flex flex-col items-center text-center gap-1"
            >
              <span className="text-brand-300">{stat.icon}</span>
              <p className="text-xl font-extrabold text-accent-500">{stat.value}</p>
              <p className="text-[11px] text-navy-100/70">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <HowItWorksVideo />
      <CityCoverage />
      <Testimonials />
      <DownloadApp />
      <CTA />
    </div>
  );
};

export default Home;