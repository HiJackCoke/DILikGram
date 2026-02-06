"use client";

import { motion } from "framer-motion";
import { GitBranch, Database, Workflow, Webhook } from "lucide-react";

const iconMap = {
  GitBranch,
  Database,
  Workflow,
  Webhook,
} as const;

type IconName = keyof typeof iconMap;

interface UseCaseCardProps {
  iconName: IconName;
  title: string;
  description: string;
  gradient: string;
}

export default function UseCaseCard({
  iconName,
  title,
  description,
  gradient,
}: UseCaseCardProps) {
  const Icon = iconMap[iconName];

  return (
    <motion.div
      className="glass-card p-6 rounded-2xl glow-on-hover"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6 }}
      whileHover={{ scale: 1.02 }}
    >
      {/* Icon */}
      <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${gradient} mb-4`}>
        <Icon className="w-6 h-6 text-white" />
      </div>

      {/* Title */}
      <h3 className="text-xl font-bold text-white mb-2">
        {title}
      </h3>

      {/* Description */}
      <p className="text-gray-400">
        {description}
      </p>
    </motion.div>
  );
}
