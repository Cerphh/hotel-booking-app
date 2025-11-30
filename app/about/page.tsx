"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  MapPin, 
  Users, 
  Heart, 
  Star, 
  Shield, 
  Sparkles,
  Github,
  Linkedin,
  Mail,
  Code2,
  Palmtree,
  Hotel
} from "lucide-react";
import { useRouter } from "next/navigation";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

export default function AboutPage() {
  const router = useRouter();

  const stats = [
    { icon: Hotel, label: "Hotels Listed", value: "500+" },
    { icon: Users, label: "Happy Guests", value: "10K+" },
    { icon: Star, label: "Average Rating", value: "4.8" },
    { icon: MapPin, label: "Locations", value: "Batangas" },
  ];

  const features = [
    {
      icon: Shield,
      title: "Secure Bookings",
      description: "Your personal information and payment details are protected with enterprise-grade security."
    },
    {
      icon: Heart,
      title: "Curated Selection",
      description: "Handpicked hotels offering the best experiences in Batangas, from beach resorts to mountain retreats."
    },
    {
      icon: Sparkles,
      title: "Flexible Hour Rates",
      description: "Book by the hour or by the night. Perfect for day trips, layovers, or extended stays—pay only for what you need."
    },
    {
      icon: Palmtree,
      title: "Local Expertise",
      description: "Born in Batangas, built for travelers who want authentic Filipino hospitality and hidden gems."
    },
  ];

  const team = [
    {
      name: "Paul Oliver E. Cruz",
      role: "Full Stack Developer",
      avatar: "/1x1pic.jpg",
      isImage: true,
      color: "bg-blue-500",
    },
    {
      name: "Nheil Eduria",
      role: "Full Stack Developer", 
      avatar: "NE",
      color: "bg-purple-500",
    },
  ];

  return (
    <div className="min-h-screen bg-[#EFECE3] dark:bg-zinc-950">
      {/* Hero Section */}
      <motion.section 
        initial="hidden"
        animate="visible"
        variants={fadeInUp}
        className="relative overflow-hidden bg-linear-to-br from-[#4A70A9] to-[#8FABD4] py-20 text-white"
      >
        <div className="absolute inset-0 bg-[url('/taal-gold.avif')] opacity-10 bg-cover bg-center" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <motion.div 
            variants={fadeInUp}
            className="text-center"
          >
            <Badge className="mb-4 bg-white/20 text-white hover:bg-white/30">
              About HotBook
            </Badge>
            <h1 className="mb-6 text-4xl font-bold sm:text-5xl lg:text-6xl">
              Your Gateway to <br />
              <span className="text-[#EFECE3]">Batangas Hospitality</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-blue-100 sm:text-xl">
              Discover, book, and experience the finest hotels across Batangas. 
              We're making travel planning effortless, one booking at a time.
            </p>
          </motion.div>

          {/* Stats Grid */}
          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
          >
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="rounded-2xl bg-white/10 p-6 backdrop-blur-sm"
              >
                <stat.icon className="mb-3 h-8 w-8 text-[#EFECE3]" />
                <div className="text-3xl font-bold">{stat.value}</div>
                <div className="text-sm text-blue-100">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* Story Section */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="mb-6 text-3xl font-bold text-[#0F172A] dark:text-white sm:text-4xl">
                Built for Travelers, <br />
                By Travelers
              </h2>
              <div className="space-y-4 text-zinc-600 dark:text-zinc-300">
                <p>
                  HotBook was born from a simple frustration: finding and booking quality hotels 
                  in Batangas shouldn't be complicated. We set out to create a platform that 
                  combines the ease of modern booking apps with the personal touch of local expertise.
                </p>
                <p>
                  Whether you're planning a romantic beach getaway, a family vacation, or a 
                  business trip, HotBook brings you closer to the perfect stay. We partner with 
                  hotels that embody Filipino hospitality and provide experiences worth remembering.
                </p>
                <p>
                  Our mission is to make every journey seamless—from discovery to checkout. 
                  We believe great travel starts with finding the right place to stay, and 
                  we're here to make that happen.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <div className="relative overflow-hidden rounded-3xl">
                <img 
                  src="/taal-gold.avif" 
                  alt="Batangas scenery" 
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-6 left-6 text-white">
                  <p className="text-sm font-medium">Discover Batangas</p>
                  <p className="text-2xl font-bold">Where Paradise Meets Comfort</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white/50 py-20 dark:bg-zinc-900/50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12 text-center"
          >
            <h2 className="mb-4 text-3xl font-bold text-[#0F172A] dark:text-white sm:text-4xl">
              Why Choose HotBook?
            </h2>
            <p className="mx-auto max-w-2xl text-zinc-600 dark:text-zinc-300">
              We're more than a booking platform. We're your travel companion for unforgettable Batangas experiences.
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid gap-6 sm:grid-cols-2"
          >
            {features.map((feature, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className="border-[#8FABD4]/40 bg-white/90 dark:bg-zinc-900/80 h-full">
                  <CardContent className="p-6">
                    <div className="mb-4 inline-flex rounded-xl bg-[#4A70A9]/10 p-3">
                      <feature.icon className="h-6 w-6 text-[#4A70A9]" />
                    </div>
                    <h3 className="mb-2 text-xl font-semibold text-[#0F172A] dark:text-white">
                      {feature.title}
                    </h3>
                    <p className="text-zinc-600 dark:text-zinc-300">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12 text-center"
          >
            <Badge className="mb-4 bg-[#4A70A9]/10 text-[#4A70A9]">
              Meet the Team
            </Badge>
            <h2 className="mb-4 text-3xl font-bold text-[#0F172A] dark:text-white sm:text-4xl">
              Built by Passionate Developers
            </h2>
            <p className="mx-auto max-w-2xl text-zinc-600 dark:text-zinc-300">
              Two developers with a vision to revolutionize hotel booking in Batangas.
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid gap-8 sm:grid-cols-2 lg:gap-12"
          >
            {team.map((member, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className="border-[#8FABD4]/40 bg-white/90 dark:bg-zinc-900/80 overflow-hidden">
                  <CardContent className="p-8 text-center">
                    {member.isImage ? (
                      <div className="mx-auto mb-4 h-24 w-24 overflow-hidden rounded-full ring-4 ring-[#4A70A9]/20">
                        <img src={member.avatar} alt={member.name} className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className={`mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full ${member.color} text-3xl font-bold text-white`}>
                        {member.avatar}
                      </div>
                    )}
                    <h3 className="mb-1 text-2xl font-bold text-[#0F172A] dark:text-white">
                      {member.name}
                    </h3>
                    <p className="mb-4 text-zinc-600 dark:text-zinc-300">
                      {member.role}
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <Badge variant="secondary" className="gap-1">
                        <Code2 className="h-3 w-3" />
                        Developer
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-linear-to-br from-[#4A70A9] to-[#8FABD4] py-20 text-white">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="mb-6 text-3xl font-bold sm:text-4xl">
              Ready to Start Your Journey?
            </h2>
            <p className="mb-8 text-lg text-blue-100">
              Explore hundreds of hotels across Batangas and book your perfect stay today.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button 
                size="lg" 
                className="bg-white text-[#4A70A9] hover:bg-white/90"
                onClick={() => router.push("/hotels")}
              >
                Browse Hotels
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-white text-[#4A70A9] dark:text-white hover:bg-white/10"
                onClick={() => router.push("/signin")}
              >
                Sign Up Free
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
