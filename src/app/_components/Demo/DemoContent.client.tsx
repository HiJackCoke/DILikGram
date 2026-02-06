"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Button from "@/components/Button";
import { ArrowRight } from "lucide-react";

export default function DemoContent() {
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
          See It In Action
        </h2>
        <p className="text-lg sm:text-xl text-gray-400">
          Watch how DILikGram simplifies workflow creation
        </p>
      </motion.div>

      {/* Demo container */}
      <motion.div
        className="glass-card rounded-2xl overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        {/* Placeholder area */}
        <div className="aspect-video bg-gray-900 flex items-center justify-center">
          <div className="text-center p-8">
            <p className="text-white text-xl mb-4">
              📹 Demo Video Placeholder
            </p>
            <p className="text-gray-400 text-sm mb-2">
              Replace /public/demo-video.mp4 with your screen recording
            </p>
            <p className="text-gray-500 text-xs">
              Recommended: OBS Studio, QuickTime, Loom
            </p>
          </div>
        </div>

        {/* Try Demo Button */}
        <div className="p-6 text-center bg-gradient-to-b from-gray-900 to-black">
          <Link href="/workflow">
            <Button
              palette="success"
              size="lg"
              icon={<ArrowRight />}
              iconPosition="right"
              className="min-w-[200px]"
            >
              Try Live Demo
            </Button>
          </Link>
        </div>
      </motion.div>
    </>
  );
}
