import { Checker } from "@/components/Checker";
import { Footer, TopBar } from "@/components/Chrome";
import { ProtectSomeone } from "@/components/ProtectSomeone";
import { botUsername } from "@/lib/telegram";

export default async function Home({ searchParams }: { searchParams: Promise<{ from?: string | string[] }> }) {
  const [{ from }, bot] = await Promise.all([searchParams, botUsername()]);
  const sender = typeof from === "string" ? from.trim().slice(0, 40) : "";

  return (
    <main>
      <TopBar />
      <section className="hero">
        <h1>Got a message that feels off?</h1>
        <p>Paste it here or add a screenshot. In a few seconds you&apos;ll know if it looks like a scam and why, and you can warn your family in one tap.</p>
        {bot && (
          <p className="telegram-line">
            On Telegram? Forward the message to{" "}
            <a href={`https://t.me/${bot}`} target="_blank" rel="noopener noreferrer">
              @{bot}
            </a>{" "}
            and get the answer right in the chat.
          </p>
        )}
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
