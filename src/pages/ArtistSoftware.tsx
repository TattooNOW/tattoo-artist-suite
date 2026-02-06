import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import {
  Inbox,
  Users,
  Globe,
  Phone,
  MessageSquare,
  Star,
  CalendarDays,
  CalendarCheck,
  Mail,
  Clock,
  HeartHandshake,
} from "lucide-react";

const tools = [
  { icon: Inbox, title: "One-Box", desc: "Unified inbox for all client communications." },
  { icon: Users, title: "CRM", desc: "Track every client detail, from preferences to consent forms." },
  { icon: Globe, title: "Website Builder", desc: "Launch a portfolio site in minutes — no coding needed." },
  { icon: Phone, title: "IVR Phone System", desc: "Professional auto-attendant for your business line." },
  { icon: MessageSquare, title: "Text-to-Pay", desc: "Send payment links via text and get paid instantly." },
  { icon: Star, title: "Reputation", desc: "Automate review requests and manage your online presence." },
  { icon: CalendarDays, title: "Calendars", desc: "Sync across platforms and share your availability." },
  { icon: CalendarCheck, title: "Appointments", desc: "Online booking with deposits, reminders, and follow-ups." },
  { icon: Mail, title: "Email Marketing", desc: "Drip campaigns, flash sales, and newsletters made easy." },
  { icon: Clock, title: "Post Scheduler", desc: "Plan and auto-publish to Instagram, Facebook, and more." },
  { icon: HeartHandshake, title: "Gabe's Help", desc: "Dedicated support from a real tattoo industry expert." },
];

const packages = [
  {
    name: "Artist Essentials",
    price: "$99",
    features: [
      "One-Box unified inbox",
      "Client CRM",
      "Portfolio website",
      "Online booking",
      "Payment processing",
      "Calendar sync",
      "Email support",
    ],
    featured: false,
  },
  {
    name: "Professional",
    price: "$199",
    features: [
      "Everything in Essentials",
      "IVR phone system",
      "Text-to-Pay",
      "Reputation management",
      "Email marketing",
      "Post scheduler",
      "Gabe's personal help",
      "Priority support",
    ],
    featured: true,
  },
];

export default function ArtistSoftware() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-16">
        {/* Hero */}
        <section className="section-padding">
          <div className="container max-w-4xl text-center">
            <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-4">
              For Tattoo Artists
            </p>
            <h1 className="text-4xl md:text-6xl font-display leading-tight mb-6">
              Your Art Deserves a{" "}
              <span className="text-gradient">Better Business</span>
            </h1>
            <blockquote className="text-lg text-muted-foreground italic mb-8 max-w-2xl mx-auto border-l-2 border-primary pl-4 text-left">
              "I built this because I was tired of watching incredible artists struggle with the business side. 
              You deserve tools that work as hard as you do."
              <cite className="block mt-2 text-sm text-foreground not-italic font-semibold">
                — Gabe Ripley
              </cite>
            </blockquote>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="hero" size="lg">
                Start Free Trial
              </Button>
              <Button variant="heroOutline" size="lg">
                Book a Demo
              </Button>
            </div>
          </div>
        </section>

        {/* Tools Grid */}
        <section className="section-padding bg-card/50">
          <div className="container">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-display mb-4">
                11 Tools, <span className="text-gradient">One Platform</span>
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Everything you need to book clients, get paid, and grow your reputation.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {tools.map((tool) => (
                <div
                  key={tool.title}
                  className="group flex items-start gap-4 rounded-lg border border-border bg-card p-5 hover:border-primary/40 transition-all duration-300"
                >
                  <tool.icon className="h-8 w-8 text-accent shrink-0 group-hover:text-primary transition-colors" />
                  <div>
                    <h3 className="font-display text-sm mb-1">{tool.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{tool.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="section-padding">
          <div className="container max-w-4xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-display mb-4">
                Choose Your <span className="text-gradient">Package</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {packages.map((pkg) => (
                <div
                  key={pkg.name}
                  className={`rounded-lg border p-8 flex flex-col ${
                    pkg.featured
                      ? "border-primary bg-card glow-border"
                      : "border-border bg-card"
                  }`}
                >
                  {pkg.featured && (
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
                      Recommended
                    </span>
                  )}
                  <h3 className="font-display text-xl mb-4">{pkg.name}</h3>
                  <div className="mb-6">
                    <span className="text-4xl font-display">{pkg.price}</span>
                    <span className="text-muted-foreground text-sm">/mo</span>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {pkg.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={pkg.featured ? "hero" : "heroOutline"}
                    className="w-full"
                  >
                    Start Free Trial
                  </Button>
                </div>
              ))}
            </div>

            <p className="text-center text-xs text-muted-foreground mt-8">
              Usage-based pricing applies for SMS, calls, and email sends beyond included limits.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="section-padding bg-card/50">
          <div className="container max-w-2xl text-center">
            <h2 className="text-3xl md:text-4xl font-display mb-4">
              Ready to Level Up?
            </h2>
            <p className="text-muted-foreground mb-8">
              Join thousands of tattoo artists who run their business smarter with TattooNOW.
            </p>
            <Button variant="hero" size="lg">
              Start Your Free Trial
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
