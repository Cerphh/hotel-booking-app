"use client";

import { useAuth } from "@/lib/auth-context";
import { GoogleSignInButton } from "@/components/google-signin-button";
import { TermsAndConditionsDialog } from "@/components/terms-and-conditions";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { motion } from "framer-motion";
import { fadeInUp, scaleIn } from "@/lib/animations";
import Link from "next/link";
import { ChevronLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const ADMIN_EMAIL = "admin@gmail.com";
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminAgreedToTerms, setAdminAgreedToTerms] = useState(false);
  // Support redirecting to intended page after login
  // For demo, navigate client-side after auth state is known
  useEffect(() => {
    if (loading) return;
    if (!user) return;
    const email = user?.email?.toLowerCase?.() || "";
    if (email === "admin@gmail.com") {
      router.replace("/admin");
      return;
    }
    router.replace("/dashboard");
  }, [loading, user, router]);

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminAgreedToTerms) {
      alert("You must agree to the Terms & Conditions to sign in as admin");
      return;
    }
    const email = adminEmail.trim().toLowerCase();
    const password = adminPassword;
    if (email !== ADMIN_EMAIL) {
      alert("Invalid admin email");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged in AuthProvider will trigger redirect; also navigate immediately
      router.push("/admin");
    } catch (err) {
      console.error("Firebase admin sign-in failed:", err);
      const msg = (err as Error)?.message || "Failed to sign in";
      alert(msg);
    }
  };

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

          {!showAdminForm && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <GoogleSignInButton />
            </motion.div>
          )}

          {/* Admin sign-in (email + password) for quick access during development */}
          <motion.div
            className="mt-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
              {!showAdminForm ? (
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    className="bg-zinc-200 text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                    onClick={() => setShowAdminForm(true)}
                  >
                    Sign in
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleAdminSignIn} className="flex flex-col gap-2">
                  <input
                    type="email"
                    placeholder="Email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full px-3 py-2 border rounded bg-white dark:bg-zinc-800 text-black dark:text-white"
                  />
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full pr-10 px-3 py-2 border rounded bg-white dark:bg-zinc-800 text-black dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 dark:text-zinc-300 p-1"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  <label className="flex items-center gap-2 mt-1">
                    <input
                      type="checkbox"
                      checked={adminAgreedToTerms}
                      onChange={(e) => setAdminAgreedToTerms(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">I agree to the{' '}
                      <button
                        type="button"
                        className="text-blue-600 hover:underline dark:text-blue-400 bg-transparent border-none p-0 m-0"
                        onClick={() => setTermsOpen(true)}
                      >
                        Terms & Conditions
                      </button>
                    </span>
                  </label>

                  <div className="flex justify-end gap-2">
                    <Button type="submit" disabled={!adminAgreedToTerms}>Sign in</Button>
                    <Button variant="outline" onClick={() => setShowAdminForm(false)}>Cancel</Button>
                  </div>
                </form>
              )}
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
