import { Header } from "@/components/Header"
import { Hero } from "@/components/Hero"
import { Marquee } from "@/components/Marquee"
import { ValueProps } from "@/components/ValueProps"
import { WorkShowcase } from "@/components/WorkShowcase"
import { Services } from "@/components/Services"
import { Process } from "@/components/Process"
import { Pricing } from "@/components/Pricing"
import { FAQ } from "@/components/FAQ"
import { Contact } from "@/components/Contact"
import { Footer } from "@/components/Footer"

export default function Home() {
  return (
    <main className="relative min-h-screen">
      {/* Fixed noise overlay */}
      <div className="noise-texture pointer-events-none fixed inset-0 z-50" />
      
      <Header />
      <Hero />
      <Marquee />
      <ValueProps />
      <WorkShowcase />
      <Services />
      <Process />
      <Pricing />
      <FAQ />
      <Contact />
      <Footer />
    </main>
  )
}
