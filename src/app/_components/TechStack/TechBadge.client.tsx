"use client";

import { motion } from "framer-motion";

interface TechBadgeProps {
  name: string;
}

export default function TechBadge({ name }: TechBadgeProps) {
  return (
    <motion.div
      className="glass-card px-6 py-3 rounded-full text-white font-medium glow-on-hover"
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      whileHover={{ scale: 1.1 }}
    >
      {name}
    </motion.div>
  );
}
