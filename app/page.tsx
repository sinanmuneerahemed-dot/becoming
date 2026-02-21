import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { AboutSection } from "@/components/landing/AboutSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { DashboardPreviewSection } from "@/components/landing/DashboardPreviewSection";
import { CreatorSection } from "@/components/landing/CreatorSection";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <AboutSection />
      <HowItWorksSection />
      <DashboardPreviewSection />
      <CreatorSection />
    </div>
  );
}
