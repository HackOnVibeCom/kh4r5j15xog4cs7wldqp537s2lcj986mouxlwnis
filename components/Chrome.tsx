import Link from "next/link";
import { activeProvider, PROVIDER_LABEL } from "@/lib/analyze";

export function TopBar() {
  return (
    <header className="topbar">
      <Link href="/" className="brand">
        <span className="brand-mark" aria-hidden>
          !
        </span>
        ScamCheck
      </Link>
      <span className="pill">Free · no sign-up</span>
    </header>
  );
}

export function Footer() {
  const provider = activeProvider();
  const ai = provider ? PROVIDER_LABEL[provider] : "an AI service";
  return (
    <footer className="footer">
      <div>
        We never call a message &ldquo;safe&rdquo;: nobody can know for sure who sent it. We tell you what looks wrong and why. Labels
        show which reasons come from the AI and which we checked ourselves.
      </div>
      <div>
        Your message is sent to {ai} to be checked. We don&apos;t save it. Please don&apos;t paste passwords, PINs or full card
        numbers. A warning link holds only the cleaned-up message: your own name, account and card numbers and codes are hidden, and links can&apos;t be clicked.
      </div>
    </footer>
  );
}
