import React, { useState } from "react";
import { Mail, Phone, MapPin, Loader2, CheckCircle2 } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";

const Contact = () => {

    const locationLink =
        "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent("Mata Chanan Devi Hospital, C1 Janakpuri, New Delhi");

    const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
    const [submitting, setSubmitting] = useState(false);
    const [sent, setSent] = useState(false);
    const [formError, setFormError] = useState("");

    function updateField(field) {
        return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setFormError("");

        if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
            setFormError("Please fill in your name, email and message.");
            return;
        }
        if (!isSupabaseConfigured) {
            setFormError("Sorry, messaging isn't available right now. Please email us directly.");
            return;
        }

        setSubmitting(true);
        const { error } = await supabase.from("contact_messages").insert({
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim() || null,
            message: form.message.trim(),
        });
        setSubmitting(false);

        if (error) {
            setFormError(error.message || "Something went wrong. Please try again.");
            return;
        }

        setSent(true);
        setForm({ name: "", email: "", phone: "", message: "" });
    }

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

                        {sent ? (
                            <div className="flex flex-col items-center text-center py-10">
                                <CheckCircle2 size={44} className="text-emerald-500 mb-4" />
                                <p className="text-lg font-semibold text-gray-900">Message sent!</p>
                                <p className="text-gray-500 text-sm mt-2">
                                    Thanks for reaching out — our team will get back to you shortly.
                                </p>
                                <button
                                    onClick={() => setSent(false)}
                                    className="mt-6 text-[#1E6FD9] text-sm font-medium hover:underline"
                                >
                                    Send another message
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-6">

                                <input
                                    type="text"
                                    placeholder="Your Name"
                                    value={form.name}
                                    onChange={updateField("name")}
                                    required
                                    className="p-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6FD9]/30 transition"
                                />

                                <input
                                    type="email"
                                    placeholder="Your Email"
                                    value={form.email}
                                    onChange={updateField("email")}
                                    required
                                    className="p-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6FD9]/30 transition"
                                />

                                <input
                                    type="text"
                                    placeholder="Phone Number"
                                    value={form.phone}
                                    onChange={updateField("phone")}
                                    className="p-4 rounded-xl border border-gray-200 md:col-span-2 focus:outline-none focus:ring-2 focus:ring-[#1E6FD9]/30"
                                />

                                <textarea
                                    placeholder="Your Message"
                                    rows="5"
                                    value={form.message}
                                    onChange={updateField("message")}
                                    required
                                    className="p-4 rounded-xl border border-gray-200 md:col-span-2 focus:outline-none focus:ring-2 focus:ring-[#1E6FD9]/30"
                                ></textarea>

                                {formError && (
                                    <p className="md:col-span-2 text-sm text-red-600 -mt-2">{formError}</p>
                                )}

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="md:col-span-2 bg-[#1E6FD9] text-white py-4 rounded-xl font-medium hover:bg-[#155ab3] transition shadow-lg hover:shadow-xl disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" /> Sending…
                                        </>
                                    ) : (
                                        "Send Message"
                                    )}
                                </button>

                            </form>
                        )}

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
