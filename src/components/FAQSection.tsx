import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Do I need any technical skills to use TattooNOW?",
    answer:
      "Not at all. TattooNOW is designed specifically for tattoo professionals, not tech experts. If you can use a smartphone, you can use our platform.",
  },
  {
    question: "Can I migrate my existing client data?",
    answer:
      "Yes! We offer free data migration assistance. Our team will help you import contacts, appointment history, and portfolio images from your existing tools.",
  },
  {
    question: "Is there a contract or commitment?",
    answer:
      "No long-term contracts. All plans are month-to-month and you can cancel anytime. We also offer a 14-day free trial on all plans.",
  },
  {
    question: "How does the booking system work?",
    answer:
      "Clients can book directly from your portfolio website or booking link. You set your availability, deposit requirements, and booking rules. Automatic confirmations and reminders are sent to reduce no-shows.",
  },
  {
    question: "Do you support payment processing?",
    answer:
      "Yes. We integrate with major payment processors so you can accept credit cards, deposits, and even text-to-pay invoices directly through the platform.",
  },
];

export default function FAQSection() {
  return (
    <section id="faq" className="section-padding">
      <div className="container max-w-3xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-display mb-4">
            Frequently Asked <span className="text-gradient">Questions</span>
          </h2>
        </div>

        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="border border-border rounded-lg px-6 bg-card"
            >
              <AccordionTrigger className="text-left font-body font-medium text-sm hover:no-underline">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
