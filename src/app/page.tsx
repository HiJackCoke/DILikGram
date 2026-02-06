import Hero from "./_components/Hero";
import Features from "./_components/Features";
import TechStack from "./_components/TechStack";
import UseCases from "./_components/UseCases";
import Demo from "./_components/Demo";
import About from "./_components/About";
import Footer from "./_layout/Footer";

export default function HomePage() {
  return (
    <main className="bg-black">
      <Hero />
      <Features />
      <TechStack />
      <UseCases />
      <Demo />
      <About />
      <Footer />
    </main>
  );
}
