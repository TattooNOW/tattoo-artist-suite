import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HeroSection from "@/components/HeroSection";
import AudienceSection from "@/components/AudienceSection";
import SocialProofSection from "@/components/SocialProofSection";
import FeaturesSection from "@/components/FeaturesSection";
import PricingSection from "@/components/PricingSection";
import FAQSection from "@/components/FAQSection";
import NewsletterSection from "@/components/NewsletterSection";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-16">
        <HeroSection />
        <AudienceSection />
        <SocialProofSection />
        <FeaturesSection />
        <PricingSection />
        <FAQSection />
        <NewsletterSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
