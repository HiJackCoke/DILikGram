import Link from "next/link";
import { Github } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-black border-t border-gray-800 py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Product */}
          <div>
            <h3 className="text-white font-bold mb-4">Product</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/workflow"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Try Demo
                </Link>
              </li>
              <li>
                <a
                  href="#features"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Features
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/HiJackCoke"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-white font-bold mb-4">Resources</h3>
            <ul className="space-y-2">
              <li>
                <span className="text-gray-600 cursor-not-allowed">
                  Documentation (Coming Soon)
                </span>
              </li>
              <li>
                <span className="text-gray-600 cursor-not-allowed">
                  API Docs (Coming Soon)
                </span>
              </li>
              <li>
                <span className="text-gray-600 cursor-not-allowed">
                  Changelog (Coming Soon)
                </span>
              </li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h3 className="text-white font-bold mb-4">Social</h3>
            <div className="flex gap-4">
              <a
                href="https://github.com/HiJackCoke"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Github className="w-6 h-6" />
              </a>

              {/* <a
                href="mailto:your@email.com"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Mail className="w-6 h-6" />
              </a> */}
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 pt-8 border-t border-gray-800 text-center text-gray-500 text-sm">
          <p>© 2025 DILikGram. Built as a portfolio project.</p>
        </div>
      </div>
    </footer>
  );
}
