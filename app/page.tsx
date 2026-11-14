import { Checker } from "@/components/Checker";
import { Footer, TopBar } from "@/components/Chrome";
import { ProtectSomeone } from "@/components/ProtectSomeone";

export default async function Home({ searchParams }: { searchParams: Promise<{ from?: string | string[] }> }) {
  const { from } = await searchParams;
  const sender = typeof from === "string" ? from.trim().slice(0, 40) : "";

  return (
    <main>
      <TopBar />
      <section className="hero">
        <h1>Got a message that feels off?</h1>
        <p>Paste it here or add a screenshot. In a few seconds you&apos;ll know if it looks like a scam and why, and you can warn your family in one tap.</p>
        {sender && (
          <div className="from-banner">
            {sender} set this up for you. Before you click a link, call back or pay anyone, paste the message here.
          </div>
        )}
      </section>
      <Checker />
      <ProtectSomeone />
      <Footer />
    </main>
  );
}
