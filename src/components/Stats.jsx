import React from "react";
import { Users, Gavel, IndianRupee, MapPin } from "lucide-react";

const Stats = () => {
  return (
    <section className="bg-white py-24">
      <div className="max-w-6xl mx-auto px-6">

        {/* Heading */}
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
            Platform at a Glance
          </h2>
          <p className="mt-3 text-gray-500 max-w-xl mx-auto">
            Built for dealers who value speed, trust, and transparency.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">

          {[
            {
              icon: <Users size={24} />,
              value: "500+",
              label: "Dealers",
              color: "text-blue-600 bg-blue-50",
            },
            {
              icon: <Gavel size={24} />,
              value: "10K+",
              label: "Auctions",
              color: "text-purple-600 bg-purple-50",
            },
            {
              icon: <IndianRupee size={24} />,
              value: "₹50Cr+",
              label: "Transactions",
              color: "text-green-600 bg-green-50",
            },
            {
              icon: <MapPin size={24} />,
              value: "10+",
              label: "Cities",
              color: "text-pink-600 bg-pink-50",
            },
          ].map((stat, index) => (
            <div
              key={index}
              className="group bg-white border border-gray-200 rounded-xl p-5 text-center hover:shadow-md transition duration-300"
            >

              {/* Icon */}
              <div
                className={`w-10 h-10 mx-auto flex items-center justify-center rounded-lg mb-4 ${stat.color}`}
              >
                {stat.icon}
              </div>

              {/* Value */}
              <h3 className="text-2xl md:text-3xl font-semibold text-gray-900">
                {stat.value}
              </h3>

              {/* Label */}
              <p className="text-gray-500 text-sm mt-1">
                {stat.label}
              </p>

            </div>
          ))}

        </div>
      </div>
    </section>
  );
};

export default Stats;