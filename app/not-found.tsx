import Link from "next/link";
import { Footer, TopBar } from "@/components/Chrome";

/** A cut-off or edited warning link lands here; send people to the checker instead of a dead end. */
export default function NotFound() {
  return (
    <main>
      <TopBar />
      <section className="hero">
        <h1>This warning link is incomplete</h1>
        <p>
          Part of the link may have been cut off when it was copied or forwarded, or it was changed. Ask the person who sent it to
          send it again, or check the message yourself. It takes a few seconds and needs no sign-up.
        </p>
      </section>
      <div className="cta">
        <h3>Got a message that feels off?</h3>
        <p>Paste it or add a screenshot and get a straight answer.</p>
        <Link href="/" className="btn">
          Check a message →
        </Link>
      </div>
      <Footer />
    </main>
  );
}
