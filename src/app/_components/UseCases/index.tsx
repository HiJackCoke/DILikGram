import UseCaseCard from "./UseCaseCard.client";

const useCases = [
  {
    iconName: "GitBranch" as const,
    title: "CI/CD Pipeline Automation",
    description: "Automate build, test, and deployment workflows with conditional branching",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    iconName: "Database" as const,
    title: "Data Processing Workflows",
    description: "Chain data transformations, validations, and external API calls",
    gradient: "from-green-500 to-teal-500",
  },
  {
    iconName: "Workflow" as const,
    title: "Business Process Automation",
    description: "Model approval workflows, task assignments, and notifications",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    iconName: "Webhook" as const,
    title: "Webhook Orchestration",
    description: "Create complex webhook handling logic with decision nodes",
    gradient: "from-orange-500 to-red-500",
  },
];

export default function UseCases() {
  return (
    <section id="use-cases" className="py-24 px-6 bg-gradient-to-b from-black to-gray-900">
      <div className="max-w-6xl mx-auto">
        {/* Section header (static - Server Component) */}
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            What You Can Build
          </h2>
          <p className="text-lg sm:text-xl text-gray-400">
            From CI/CD pipelines to business automation
          </p>
        </div>

        {/* Use cases grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {useCases.map((useCase, index) => (
            <UseCaseCard key={index} {...useCase} />
          ))}
        </div>
      </div>
    </section>
  );
}
