"use client";

import { motion } from "framer-motion";
import { Github, Mail } from "lucide-react";

export default function AboutContent() {
  return (
    <>
      {/* Section header */}
      <motion.div
        className="text-center mb-12"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
          About This Project
        </h2>
      </motion.div>

      {/* Content */}
      <motion.div
        className="glass-card p-8 sm:p-12 rounded-2xl"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <p className="text-gray-300 text-lg leading-relaxed mb-8">
          DILikGram is a portfolio project showcasing expertise in modern
          full-stack development. Built with React 19, Next.js 16, and AI
          integration, it demonstrates:
        </p>

        <ul className="text-gray-300 text-lg space-y-3 mb-8 ml-6">
          <li className="flex items-start">
            <span className="text-blue-400 mr-3">•</span>
            <span>Complex state management with Zustand</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-400 mr-3">•</span>
            <span>Real-time visualization with React Cosmos Diagram</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-400 mr-3">•</span>
            <span>AI-powered features with OpenAI API</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-400 mr-3">•</span>
            <span>TypeScript for type safety</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-400 mr-3">•</span>
            <span>Responsive design with Tailwind CSS</span>
          </li>
        </ul>

        <p className="text-gray-300 text-lg leading-relaxed mb-8">
          Created as a demonstration of technical capabilities for software
          engineering roles, this project emphasizes clean architecture,
          reusable components, and thoughtful user experience design.
        </p>

        {/* Contact */}
        <div className="border-t border-gray-700 pt-8">
          <h3 className="text-white text-xl font-bold mb-4">Contact</h3>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="https://github.com/HiJackCoke"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <Github className="w-5 h-5" />
              <span>GitHub</span>
            </a>
            <a
              href="mailto:dkslsdkdl@naver.com"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <Mail className="w-5 h-5" />
              <span>Email</span>
            </a>
          </div>
        </div>
      </motion.div>
    </>
  );
}
