"use client";

import { useAuth } from "@/lib/auth-context";
import { GoogleSignInButton } from "@/components/google-signin-button";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-center">
          <p className="text-lg text-zinc-600 dark:text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="w-full max-w-sm px-6">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold mb-6 text-center text-black dark:text-white">
              Welcome to Hotbook
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400 text-center mb-8">
              Sign in to get started
            </p>
            <GoogleSignInButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-sm px-6">
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold mb-6 text-center text-black dark:text-white">
            Welcome, {user.displayName || "User"}!
          </h1>
          
          <div className="space-y-4 mb-8">
            {user.photoURL && (
              <img
                src={user.photoURL}
                alt="Profile"
                className="w-24 h-24 rounded-full mx-auto"
              />
            )}
            <div className="text-center">
              <p className="text-zinc-600 dark:text-zinc-400">
                <strong>Email:</strong> {user.email}
              </p>
              {user.displayName && (
                <p className="text-zinc-600 dark:text-zinc-400">
                  <strong>Name:</strong> {user.displayName}
                </p>
              )}
            </div>
          </div>

          <Button
            onClick={logout}
            className="w-full"
            variant="outline"
          >
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
