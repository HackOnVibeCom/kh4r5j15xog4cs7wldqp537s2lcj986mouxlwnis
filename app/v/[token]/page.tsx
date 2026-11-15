import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer, TopBar } from "@/components/Chrome";
import { ResultView } from "@/components/ResultView";
import { VERDICT_COPY } from "@/lib/copy";
import { botUsername } from "@/lib/telegram";
import { verifyShare } from "@/lib/token";
import { WarnOthers } from "./WarnOthers";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = verifyShare((await params).token);
  if (!result) return { title: "ScamCheck" };
  const title = `${result.verdict === "no_red_flags" ? "" : "⚠️ "}${VERDICT_COPY[result.verdict].short}: ${result.headline}`;
  const description = result.flags[0]?.reason ?? "Checked with ScamCheck. Free, no sign-up.";
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: false },
  };
}

export default async function WarningPage({ params }: Props) {
  const [{ token }, bot] = await Promise.all([params, botUsername()]);
  const result = verifyShare(token);
  if (!result) notFound();

  return (
    <main>
      <TopBar />
      <p className="shared-note">Someone who cares about you checked this message and wanted you to see it.</p>
      <div className="card" style={{ marginTop: 0 }}>
        <ResultView result={result} />
        <WarnOthers verdict={result.verdict} headline={result.headline} />
      </div>
      <div className="cta">
        <h3>Got a message like this?</h3>
        <p>Paste it or add a screenshot. You&apos;ll get a straight answer in seconds. Free, no sign-up.</p>
        <Link href="/" className="btn">
          Check a message →
        </Link>
        {bot && (
          <p style={{ marginTop: 14, marginBottom: 0 }}>
            Or forward it to{" "}
            <a href={`https://t.me/${bot}`} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", fontWeight: 700 }}>
              @{bot}
            </a>{" "}
            on Telegram.
          </p>
        )}
      </div>
      <Footer />
    </main>
  );
}
