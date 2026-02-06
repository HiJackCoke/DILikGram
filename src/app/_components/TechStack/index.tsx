import TechBadge from "./TechBadge.client";

const technologies = [
  {
    name: "React Cosmos Diagram",
    href: "https://www.npmjs.com/package/react-cosmos-diagram",
  },
  { name: "TypeScript", href: "" },
  { name: "React 19", href: "https://ko.react.dev/versions" },
  { name: "Next.js 16", href: "https://nextjs.org/" },
  { name: "Tailwind CSS", href: "https://tailwindcss.com/" },
];

export default function TechStack() {
  return (
    <section
      id="tech-stack"
      className="py-24 px-6 bg-gradient-to-b from-gray-900 to-black"
    >
      <div className="max-w-6xl mx-auto">
        {/* Section header (static - Server Component) */}
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Built with Modern Technologies
          </h2>
          <p className="text-lg sm:text-xl text-gray-400">
            Powered by the latest web development tools and frameworks
          </p>
        </div>

        {/* Tech badges */}
        <div className="flex flex-wrap justify-center gap-4">
          {technologies.map((tech, index) => (
            <a
              key={tech.name}
              href={tech.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <TechBadge key={index} name={tech.name} />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
