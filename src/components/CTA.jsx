import React from "react";
import { Link } from "react-router-dom";
import { openAuthModal } from "../utils/authBus";

const CTA = () => {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-5xl mx-auto px-6">

        {/* Card Container */}
        <div className="relative rounded-3xl border border-gray-200 bg-gradient-to-br from-gray-900 to-black px-10 py-16 text-center overflow-hidden">

          {/* Glow Effect */}
          <div className="absolute -top-20 -left-20 w-72 h-72 bg-pink-500/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl"></div>

          {/* Content */}
          <div className="relative z-10">

            <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              Join the Private Dealer Network
            </h2>

            <p className="mt-4 text-gray-300 max-w-xl mx-auto">
              Access verified auctions, connect with trusted dealers, and unlock better opportunities — all in one place.
            </p>

            {/* Buttons */}
            <div className="mt-10 flex justify-center gap-4 flex-wrap">

              {/* Primary */}
              <button
                onClick={() => openAuthModal("signup")}
                className="bg-white text-[#0B1F4D] px-7 py-3 rounded-xl text-sm font-semibold hover:bg-gray-200 transition shadow-lg"
              >
                Request Access
              </button>

              {/* Secondary */}
              <Link
                to="/services"
                className="border border-white/30 text-white px-7 py-3 rounded-xl text-sm font-medium hover:border-white transition"
              >
                Learn More
              </Link>

            </div>

          </div>

        </div>
      </div>
    </section>
  );
};

export default CTA;