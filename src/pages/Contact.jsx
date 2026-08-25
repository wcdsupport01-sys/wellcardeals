import React from "react";
import { Mail, Phone, MapPin } from "lucide-react";

const Contact = () => {

    const locationLink =
        "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent("Mata Chanan Devi Hospital, C1 Janakpuri, New Delhi");

    return (
        <div className="bg-white text-gray-900">

            {/* HERO */}
            <section className="py-24 text-center max-w-4xl mx-auto px-6">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                    Get in Touch with
                    <span className="block bg-gradient-to-r from-[#0B2545] to-[#1E6FD9] bg-clip-text text-transparent">
                        Our Team
                    </span>
                </h1>

                <p className="mt-6 text-gray-500 text-lg">
                    Have questions or want to join the network? We’re here to help.
                </p>
            </section>

            {/* CONTACT CARDS */}
            <section className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-8 mb-20">

                {[
                    {
                        icon: <Phone />,
                        title: "Call Us",
                        value: "+91 xxxxxxxxxx",
                    },
                    {
                        icon: <Mail />,
                        title: "Email",
                        value: "wcdsupport01@gmail.com",
                        link: "mailto:wcdsupport01@gmail.com",
                    },
                    {
                        icon: <MapPin />,
                        title: "Location",
                        value: "Mata Chanan Devi Hospital, C1 Janakpuri",
                        link: locationLink,
                    },
                ].map((item, i) => (
                    <div
                        key={i}
                        className="group p-8 rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-2xl hover:-translate-y-2 transition duration-300 text-center"
                    >
                        <div className="w-14 h-14 mx-auto flex items-center justify-center rounded-xl bg-gray-100 text-gray-800 group-hover:bg-[#1E6FD9] group-hover:text-white transition mb-5">
                            {item.icon}
                        </div>

                        <h3 className="font-semibold text-lg">{item.title}</h3>

                        {item.link ? (
                            <a
                                href={item.link}
                                target={item.link.startsWith("http") ? "_blank" : undefined}
                                rel={item.link.startsWith("http") ? "noreferrer" : undefined}
                                className="text-gray-500 text-sm mt-2 block hover:text-[#1E6FD9] transition"
                            >
                                {item.value}
                            </a>
                        ) : (
                            <p className="text-gray-500 text-sm mt-2">{item.value}</p>
                        )}
                    </div>
                ))}

            </section>

            {/* FORM */}
            <section className="py-24 bg-gradient-to-b from-white via-gray-50 to-white">
                <div className="max-w-5xl mx-auto px-6">

                    <div className="bg-white border border-gray-200 rounded-3xl p-10 shadow-xl">

                        <h2 className="text-2xl font-semibold text-center mb-10">
                            Send a Message
                        </h2>

                        <form className="grid md:grid-cols-2 gap-6">

                            <input
                                type="text"
                                placeholder="Your Name"
                                className="p-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6FD9]/30 transition"
                            />

                            <input
                                type="email"
                                placeholder="Your Email"
                                className="p-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6FD9]/30 transition"
                            />

                            <input
                                type="text"
                                placeholder="Phone Number"
                                className="p-4 rounded-xl border border-gray-200 md:col-span-2 focus:outline-none focus:ring-2 focus:ring-[#1E6FD9]/30"
                            />

                            <textarea
                                placeholder="Your Message"
                                rows="5"
                                className="p-4 rounded-xl border border-gray-200 md:col-span-2 focus:outline-none focus:ring-2 focus:ring-[#1E6FD9]/30"
                            ></textarea>

                            <button
                                type="submit"
                                className="md:col-span-2 bg-[#1E6FD9] text-white py-4 rounded-xl font-medium hover:bg-[#155ab3] transition shadow-lg hover:shadow-xl"
                            >
                                Send Message
                            </button>

                        </form>

                    </div>

                </div>
            </section>

            {/* MAP */}
            <section className="py-20">
                <div className="max-w-6xl mx-auto px-6">

                    <div className="mb-8 text-center">
                        <h2 className="text-2xl font-semibold">
                            Visit Our Office
                        </h2>
                        <p className="text-gray-500 mt-2">
                            Located at precise coordinates for easy navigation.
                        </p>
                    </div>

                    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-xl">

                        <iframe
                            title="map"
                            src="https://www.google.com/maps?q=28.617417,77.077667&output=embed"
                            className="w-full h-[400px] border-0"
                            loading="lazy"
                        ></iframe>

                    </div>

                </div>
            </section>

        </div>
    );
};

export default Contact;