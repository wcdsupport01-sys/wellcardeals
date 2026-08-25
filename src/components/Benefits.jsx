import React from "react";
import { motion } from "framer-motion";
import { ClipboardCheck, Zap, ShieldCheck, FileCheck2 } from "lucide-react";

const items = [
  {
    icon: <ClipboardCheck size={24} />,
    title: "Free Valuation",
    desc: "Get a fair, no-obligation price quote for your car in minutes.",
    color: "text-blue-600 bg-blue-50",
  },
  {
    icon: <Zap size={24} />,
    title: "Instant Payment",
    desc: "Receive your money the same day the deal is closed — no delays.",
    color: "text-[#2563EB] bg-amber-50",
  },
  {
    icon: <ShieldCheck size={24} />,
    title: "Secure Transfer",
    desc: "Every ownership transfer is verified and handled end-to-end.",
    color: "text-green-600 bg-green-50",
  },
  {
    icon: <FileCheck2 size={24} />,
    title: "Legal Indemnity",
    desc: "Documentation backed by legal indemnity for complete peace of mind.",
    color: "text-purple-600 bg-purple-50",
  },
];

const Benefits = () => {
  return (
    <section className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 md:px-8">

        {/* Heading */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
            Why Choose Us
          </h2>
          <p className="mt-3 text-gray-500 max-w-2xl mx-auto">
            A hassle-free selling experience built on trust, speed, and transparency.
          </p>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              viewport={{ once: true, amount: 0.3 }}
              className="bg-white border border-gray-200 rounded-2xl p-6 text-center hover:shadow-lg transition duration-300"
            >
              <div
                className={`w-14 h-14 mx-auto flex items-center justify-center rounded-xl mb-5 ${item.color}`}
              >
                {item.icon}
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {item.title}
              </h3>
              <p className="mt-2 text-gray-500 text-sm leading-relaxed">
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default Benefits;
