import {
  CalendarDays,
  CreditCard,
  Globe,
  Mail,
  MessageSquare,
  Users,
} from "lucide-react";

const features = [
  {
    icon: CalendarDays,
    title: "Smart Scheduling",
    description: "Online booking, calendar sync, and automated reminders to reduce no-shows.",
  },
  {
    icon: CreditCard,
    title: "Payments & Deposits",
    description: "Accept deposits, process payments, and manage invoices — all built in.",
  },
  {
    icon: Globe,
    title: "Portfolio Website",
    description: "A stunning portfolio site that updates automatically as you upload new work.",
  },
  {
    icon: Users,
    title: "Client CRM",
    description: "Track client history, preferences, allergies, and consent forms in one place.",
  },
  {
    icon: Mail,
    title: "Email Marketing",
    description: "Send campaigns, promotions, and flash sale announcements to your client list.",
  },
  {
    icon: MessageSquare,
    title: "Reputation Management",
    description: "Collect and showcase Google reviews to build trust and attract new clients.",
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="section-padding">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-display mb-4">
            Everything You Need,{" "}
            <span className="text-gradient">Nothing You Don't</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Purpose-built tools for the tattoo industry — no bloated software, no steep learning curve.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-lg border border-border bg-card p-6 hover:border-primary/40 transition-all duration-300"
            >
              <f.icon className="h-8 w-8 text-accent mb-3 group-hover:text-primary transition-colors" />
              <h3 className="font-display text-base mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
