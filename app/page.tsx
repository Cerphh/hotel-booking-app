// app/page.tsx
import { redirect } from "next/navigation";

export default function Home() {
  // Redirect root URL to /hotels
  redirect("/hotels");

  // Optional: fallback UI while redirecting
  return null;
}
