import Link from "next/link";

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
  return (
    <footer className="footer">
      <div>
        We never call a message &ldquo;safe&rdquo;: nobody can know for sure who sent it. We tell you what looks wrong and why. Labels
        show which reasons come from the AI and which we checked ourselves.
      </div>
      <div>
        Your message is sent to our AI to be checked and is not saved by us. A warning link holds only the cleaned-up message, with
        personal details hidden and links made unclickable.
      </div>
    </footer>
  );
}
