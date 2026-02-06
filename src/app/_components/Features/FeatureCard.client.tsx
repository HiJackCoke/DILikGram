"use client";

import { motion } from "framer-motion";
import { Circle, Play, Sparkles, GitBranch, GitMerge } from "lucide-react";

const iconMap = {
  Circle,
  Play,
  Sparkles,
  GitBranch,
  GitMerge,
} as const;

type IconName = keyof typeof iconMap;

interface FeatureCardProps {
  iconName: IconName;
  title: string;
  description: string;
  gradient: string;
}

export default function FeatureCard({
  iconName,
  title,
  description,
  gradient,
}: FeatureCardProps) {
  const Icon = iconMap[iconName];

  return (
    <motion.div
      className="glass-card p-6 rounded-2xl hover:shadow-2xl transition-all duration-300 glow-on-hover"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6 }}
      whileHover={{ scale: 1.05 }}
    >
      {/* Icon */}
      <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${gradient} mb-4`}>
        <Icon className="w-8 h-8 text-white" />
      </div>

      {/* Title */}
      <h3 className="text-xl font-bold text-white mb-3">
        {title}
      </h3>

      {/* Description */}
      <p className="text-gray-400 leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
}
