"use client";

import { useAuth } from "@/lib/auth-context";
import { GoogleSignInButton } from "@/components/google-signin-button";
import { TermsAndConditionsDialog } from "@/components/terms-and-conditions";
import { useState } from "react";
import { redirect } from "next/navigation";
import { motion } from "framer-motion";
import { fadeInUp, scaleIn } from "@/lib/animations";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
  const { user, loading } = useAuth();
  // Support redirecting to intended page after login
  // For demo, always redirect to /dashboard after login
  if (!loading && user) {
    redirect("/dashboard");
  }

  // State for Terms modal
  const [termsOpen, setTermsOpen] = useState(false);

  // Handler for footer links
  const openTerms = () => setTermsOpen(true);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center px-4">
      <motion.div
        className="w-full max-w-sm"
        initial="initial"
        animate="animate"
        variants={fadeInUp}
      >
        {/* Back Button */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Link href="/">
            <Button
              variant="ghost"
              className="flex items-center gap-2 text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Hotels
            </Button>
          </Link>
        </motion.div>

        {/* Sign In Card */}
        <motion.div
          className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-8 border border-zinc-200 dark:border-zinc-800"
          variants={scaleIn}
          initial="initial"
          animate="animate"
          transition={{ delay: 0.2 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
              Welcome Back
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400 mb-8">
              Sign in to your Hotbook account to book hotels and manage your reservations
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <GoogleSignInButton />
          </motion.div>

          <motion.div
            className="mt-8 pt-8 border-t border-zinc-200 dark:border-zinc-800"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center mb-4">
              New to Hotbook?
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-500 text-center">
              Sign in with Google to create an account and start booking amazing hotels today!
            </p>
          </motion.div>
        </motion.div>

        {/* Footer */}
        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            By signing in, you agree to our{' '}
            <button
              type="button"
              className="text-blue-600 hover:underline dark:text-blue-400 bg-transparent border-none p-0 m-0"
              onClick={openTerms}
            >
              Terms & Conditions
            </button>
            {' '}and{' '}
            <button
              type="button"
              className="text-blue-600 hover:underline dark:text-blue-400 bg-transparent border-none p-0 m-0"
              onClick={openTerms}
            >
              Privacy Policy
            </button>
          </p>
        </motion.div>

        {/* Terms & Conditions Modal */}
        <TermsAndConditionsDialog open={termsOpen} setOpen={setTermsOpen} />
      </motion.div>
    </div>
  );
}
