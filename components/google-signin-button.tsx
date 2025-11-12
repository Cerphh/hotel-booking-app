"use client";

import { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { Button } from "./ui/button";
import { TermsAndConditionsDialog } from "./terms-and-conditions";
import { motion } from "framer-motion";
import { buttonHover } from "@/lib/animations";

export function GoogleSignInButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  let debounce = false;
  const handleGoogleSignIn = async () => {
    if (debounce || loading) return;
    debounce = true;
    if (!agreedToTerms) {
      setError("You must agree to the Terms & Conditions to continue");
      debounce = false;
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const error = err as any;
      setError(error.message || "Failed to sign in with Google");
      console.error("Google Sign-In Error:", error);
    } finally {
      setLoading(false);
      debounce = false;
    }
  };

  return (
    <motion.div
      className="flex flex-col gap-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="flex items-start gap-3"
        whileHover={{ x: 4 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        <input
          type="checkbox"
          id="terms"
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
          className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
        />
        <label htmlFor="terms" className="text-sm text-zinc-600 dark:text-zinc-400">
          I agree to the{' '}
          <button
            type="button"
            className="text-blue-600 hover:underline dark:text-blue-400 bg-transparent border-none p-0 m-0"
            onClick={() => setTermsOpen(true)}
          >
            Terms & Conditions
          </button>
          {' '}and{' '}
          <button
            type="button"
            className="text-blue-600 hover:underline dark:text-blue-400 bg-transparent border-none p-0 m-0"
            onClick={() => setTermsOpen(true)}
          >
            Privacy Policy
          </button>
        </label>
        <TermsAndConditionsDialog open={termsOpen} setOpen={setTermsOpen} />
      </motion.div>

      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        <Button
          onClick={handleGoogleSignIn}
          disabled={loading || !agreedToTerms}
          className="w-full"
          size="lg"
        >
          {loading ? "Signing in..." : "Sign in with Google"}
        </Button>
      </motion.div>

      {error && (
        <motion.p
          className="text-sm text-red-600"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {error}
        </motion.p>
      )}
    </motion.div>
  );
}
