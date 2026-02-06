import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "$49",
    period: "/mo",
    description: "Perfect for solo artists getting started.",
    features: [
      "Online booking page",
      "Client CRM",
      "Payment processing",
      "Portfolio website",
      "Email support",
    ],
    cta: "Start Free Trial",
    featured: false,
  },
  {
    name: "Professional",
    price: "$99",
    period: "/mo",
    description: "For serious artists who want to grow.",
    features: [
      "Everything in Starter",
      "Email marketing",
      "Reputation management",
      "Text-to-Pay",
      "IVR phone system",
      "Priority support",
    ],
    cta: "Start Free Trial",
    featured: true,
  },
  {
    name: "Studio",
    price: "$199",
    period: "/mo",
    description: "Multi-artist studios and franchises.",
    features: [
      "Everything in Professional",
      "Multi-artist management",
      "Walk-in queue",
      "Advanced analytics",
      "Custom branding",
      "Dedicated account manager",
    ],
    cta: "Contact Sales",
    featured: false,
  },
];

export default function PricingSection() {
  return (
    <section id="pricing" className="section-padding bg-card/50">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-display mb-4">
            Simple, <span className="text-gradient">Transparent</span> Pricing
          </h2>
          <p className="text-muted-foreground">No hidden fees. Cancel anytime.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-lg border p-8 flex flex-col ${
                plan.featured
                  ? "border-primary bg-card glow-border scale-[1.02]"
                  : "border-border bg-card"
              }`}
            >
              {plan.featured && (
                <span className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
                  Most Popular
                </span>
              )}
              <h3 className="font-display text-xl mb-1">{plan.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
              <div className="mb-6">
                <span className="text-4xl font-display">{plan.price}</span>
                <span className="text-muted-foreground text-sm">{plan.period}</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                variant={plan.featured ? "hero" : "heroOutline"}
                className="w-full"
              >
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
