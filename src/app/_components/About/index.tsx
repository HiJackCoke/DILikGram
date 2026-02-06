import AboutContent from "./AboutContent.client";

export default function About() {
  return (
    <section id="about" className="py-24 px-6 bg-gradient-to-b from-black to-gray-900">
      <div className="max-w-4xl mx-auto">
        <AboutContent />
      </div>
    </section>
  );
}
