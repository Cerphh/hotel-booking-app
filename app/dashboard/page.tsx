"use client";

import { useAuth } from "@/lib/auth-context";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { fadeInUp, staggerContainer, staggerItem } from "@/lib/animations";

export default function Dashboard() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  // Redirect to home if not logged in
  if (!user) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          className="mb-8"
          initial="initial"
          animate="animate"
          variants={fadeInUp}
        >
          <h1 className="text-4xl font-bold text-black dark:text-white mb-2">
            Dashboard
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Manage your bookings and profile
          </p>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ delay: 0.2 }}
        >
          <Tabs defaultValue="bookings" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-3 mb-8">
              <TabsTrigger value="bookings">My Bookings</TabsTrigger>
              <TabsTrigger value="favorites">Saved Hotels</TabsTrigger>
              <TabsTrigger value="profile">Profile</TabsTrigger>
            </TabsList>

            {/* Bookings Tab */}
            <TabsContent value="bookings" className="space-y-4">
              <motion.div
                initial="initial"
                animate="animate"
                variants={fadeInUp}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>My Bookings</CardTitle>
                    <CardDescription>
                      View and manage your hotel reservations
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                        No bookings yet
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-500">
                        Start exploring hotels and make your first booking
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Favorites Tab */}
            <TabsContent value="favorites" className="space-y-4">
              <motion.div
                initial="initial"
                animate="animate"
                variants={fadeInUp}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>Saved Hotels</CardTitle>
                    <CardDescription>
                      Your favorite hotels for quick access
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                        No saved hotels yet
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-500">
                        Favorite hotels will appear here
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-4">
              <motion.div
                initial="initial"
                animate="animate"
                variants={fadeInUp}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>
                      Your account details
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <motion.div
                      className="flex items-center space-x-4"
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                    >
                      {user.photoURL && (
                        <motion.img
                          src={user.photoURL}
                          alt="Profile"
                          className="w-16 h-16 rounded-full"
                          variants={staggerItem}
                        />
                      )}
                      <motion.div variants={staggerItem}>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          Display Name
                        </p>
                        <p className="text-lg font-semibold text-black dark:text-white">
                          {user.displayName || "Not set"}
                        </p>
                      </motion.div>
                    </motion.div>

                    <motion.div
                      variants={staggerItem}
                      initial="initial"
                      animate="animate"
                    >
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
                        Email Address
                      </p>
                      <p className="text-base font-medium text-black dark:text-white">
                        {user.email}
                      </p>
                    </motion.div>

                    {user.phoneNumber && (
                      <motion.div
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                      >
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
                          Phone Number
                        </p>
                        <p className="text-base font-medium text-black dark:text-white">
                          {user.phoneNumber}
                        </p>
                      </motion.div>
                    )}

                    <motion.div
                      variants={staggerItem}
                      initial="initial"
                      animate="animate"
                    >
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
                        Account Status
                      </p>
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Active
                      </Badge>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}
