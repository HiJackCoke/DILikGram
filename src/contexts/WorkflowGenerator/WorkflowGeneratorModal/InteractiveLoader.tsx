/* eslint-disable react-hooks/purity */
import { useEffect, useState } from "react";
import {
  Sparkles,
  Workflow,
  CheckCircle,
  GitBranch,
  Link,
  Package,
  Settings,
} from "lucide-react";
import type { ValidationProgress } from "../validators/types";

interface InteractiveLoaderProps {
  progress: ValidationProgress | null;
}

const LOADING_TIPS = [
  "💡 Tip: Use groups to organize complex workflows",
  "🚀 AI analyzes your PRD to create accurate nodes",
  "✨ Pro tip: Decision nodes branch your workflow logic",
  "🔍 Each validator ensures your workflow is executable",
  "⚡ Auto-fixing saves you from manual corrections",
];

const STEP_CONFIG = [
  {
    label: "Generating workflow with AI",
    icon: Sparkles,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
  },
  {
    label: "Checking for circular dependencies",
    icon: Workflow,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  {
    label: "Validating initial node configuration",
    icon: CheckCircle,
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  {
    label: "Checking decision node branches",
    icon: GitBranch,
    color: "text-orange-600",
    bgColor: "bg-orange-100",
  },
  {
    label: "Verifying data flow between nodes",
    icon: Link,
    color: "text-cyan-600",
    bgColor: "bg-cyan-100",
  },
  {
    label: "Checking group node structure",
    icon: Package,
    color: "text-indigo-600",
    bgColor: "bg-indigo-100",
  },
  {
    label: "Validating node execution logic",
    icon: Settings,
    color: "text-pink-600",
    bgColor: "bg-pink-100",
  },
];

export default function InteractiveLoader({
  progress,
}: InteractiveLoaderProps) {
  const [currentTip, setCurrentTip] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [previousStep, setPreviousStep] = useState(1);

  // Rotate tips every 3 seconds
  useEffect(() => {
    if (!progress) return;

    const interval = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % LOADING_TIPS.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [progress]);

  // Trigger celebration on completion
  useEffect(() => {
    if (progress?.status === "completed" && progress.currentStep === 7) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 2000);
    }
  }, [progress?.status, progress?.currentStep]);

  // Track step changes for transition animation
  useEffect(() => {
    const currentStep = progress?.currentStep || 1;
    if (currentStep !== previousStep) {
      setPreviousStep(currentStep);
    }
  }, [progress?.currentStep, previousStep]);

  if (!progress) return null;

  const currentStep = progress.currentStep || 1;
  const totalSteps = progress.totalSteps || 7;
  const stepIndex = currentStep - 1;
  const stepConfig = STEP_CONFIG[stepIndex];
  const StepIcon = stepConfig?.icon || Sparkles;

  return (
    <div className="top-0 left-0 absolute w-full h-full content-center space-y-6 p-6 bg-[rgba(0,0,0,0.15)] rounded-2xl overflow-hidden">
      {/* Large Animated Icon */}
      <div className="flex flex-col items-center gap-4">
        {/* Animated Icon Container */}
        <div
          className={`relative w-32 h-32 rounded-full ${stepConfig?.bgColor} flex items-center justify-center animate-pulse transition-all duration-500 ease-out ${
            currentStep !== previousStep ? "scale-110" : "scale-100"
          }`}
        >
          <StepIcon
            className={`w-16 h-16 ${stepConfig?.color} animate-bounce`}
          />

          {/* Orbiting Particles (only for AI generation step) */}
          {currentStep === 1 && (
            <>
              <div className="absolute w-3 h-3 bg-purple-400 rounded-full animate-orbit-1" />
              <div className="absolute w-2 h-2 bg-blue-400 rounded-full animate-orbit-2" />
              <div className="absolute w-2.5 h-2.5 bg-pink-400 rounded-full animate-orbit-3" />
            </>
          )}

          <div className="absolute w-full h-full opacity-5"></div>
        </div>

        {/* Step Counter */}
        <div className="text-center">
          <div className="text-3xl font-bold text-gray-800">
            Step {currentStep} <span className="text-gray-400">of</span>{" "}
            {totalSteps}
          </div>
          <div className={`text-sm font-medium mt-1 ${stepConfig?.color}`}>
            {stepConfig?.label}
          </div>
        </div>

        {/* Auto-fixing Badge */}
        {progress.status === "repairing" && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium animate-pulse">
            <Settings className="w-3 h-3 animate-spin" />
            Auto-fixing issues...
          </div>
        )}
      </div>

      {/* Loading Tip */}
      <div className="pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-600 italic text-center transition-opacity duration-500">
          {LOADING_TIPS[currentTip]}
        </p>
      </div>

      {/* Confetti Celebration */}
      {showCelebration && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-green-50/90 to-blue-50/90 rounded-2xl">
          {/* Floating confetti */}
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute text-2xl animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.5}s`,
              }}
            >
              {["🎉", "✨", "🎊", "⭐"][i % 4]}
            </div>
          ))}
          <div className="text-6xl animate-bounce z-10">✅</div>
        </div>
      )}
    </div>
  );
}
