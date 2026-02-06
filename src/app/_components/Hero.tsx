"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { ArrowRight, Github } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-hero-gradient opacity-50" />

      {/* Grid background */}
      <div className="absolute inset-0 grid-background opacity-20" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
        {/* Title */}
        <motion.h1
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6 gradient-text"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          Build Workflows <br /> That Work
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="text-lg sm:text-xl md:text-2xl text-gray-400 mb-12 max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          Visual workflow builder with AI-powered automation. Create, execute,
          and version control your workflows with ease.
        </motion.p>

        {/* CTAs */}
        <motion.div
          className="flex flex-col sm:flex-row gap-4 justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <Link href="/workflow">
            <Button
              palette="success"
              size="lg"
              icon={<ArrowRight />}
              iconPosition="right"
              className="min-w-[200px]"
            >
              Try Demo
            </Button>
          </Link>

          <a
            href="https://github.com/HiJackCoke"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              palette="neutral"
              size="lg"
              variant="outline"
              icon={<Github />}
              className="min-w-[200px]"
            >
              View on GitHub
            </Button>
          </a>
        </motion.div>
      </div>

      {/* Floating elements (decorative) */}
      <motion.div
        className="absolute top-20 left-10 w-32 h-32 rounded-full bg-blue-500/40 blur-2xl"
        animate={{
          y: [0, -20, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute bottom-20 right-10 w-40 h-40 rounded-full bg-purple-500/40 blur-2xl"
        animate={{
          y: [0, 20, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute top-1/2 left-1/4 w-36 h-36 rounded-full bg-cyan-500/30 blur-2xl"
        animate={{
          x: [0, 30, 0],
          y: [0, -30, 0],
          scale: [1, 1.15, 1],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute top-1/3 right-1/4 w-28 h-28 rounded-full bg-pink-500/35 blur-2xl"
        animate={{
          x: [0, -25, 0],
          y: [0, 25, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 5.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </section>
  );
}
