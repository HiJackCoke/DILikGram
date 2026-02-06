import FeatureCard from "./FeatureCard.client";

const features = [
  {
    iconName: "Circle" as const,
    title: "Versatile Node System",
    description: "Five specialized node types cover any workflow scenario: Start/End points, Task execution, Decision branching, and Service integration.",
    gradient: "from-blue-500 to-purple-500",
  },
  {
    iconName: "Play" as const,
    title: "Real-time Execution",
    description: "Watch your workflows come to life with animated execution visualization. Debug with visual feedback and execution summaries.",
    gradient: "from-green-500 to-emerald-500",
  },
  {
    iconName: "Sparkles" as const,
    title: "AI Workflow Editor",
    description: "Right-click any node to open AI-powered editing. Modify entire workflow subtrees with natural language instructions.",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    iconName: "GitBranch" as const,
    title: "Built-in Versioning",
    description: "Every workflow change is tracked. Restore previous versions, compare changes, and maintain workflow history automatically.",
    gradient: "from-yellow-500 to-orange-500",
  },
  {
    iconName: "GitMerge" as const,
    title: "Dynamic Branching",
    description: "Decision nodes automatically route execution based on results. Create complex conditional logic without code.",
    gradient: "from-cyan-500 to-blue-500",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24 px-6 bg-gradient-to-b from-black to-gray-900">
      <div className="max-w-7xl mx-auto">
        {/* Section header (static - Server Component) */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Everything You Need to Build Workflows
          </h2>
          <p className="text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto">
            Powerful features designed for modern workflow automation
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <FeatureCard key={index} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
}
