"use client";

import { useEffect, useState } from "react";
import { ShareActions } from "@/components/ShareActions";
import { VERDICT_COPY } from "@/lib/copy";
import type { Verdict } from "@/lib/schema";

/** Passing a warning on is the point: every recipient can forward it again in one tap. */
export function WarnOthers({ verdict, headline }: { verdict: Verdict; headline: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(window.location.href), []);
  if (verdict === "no_red_flags" || !url) return null;

  return (
    <div className="share">
      <h3>Pass the warning on</h3>
      <p>Know someone who might get this message? Send it to them too.</p>
      <ShareActions url={url} text={`⚠️ ${VERDICT_COPY[verdict].short}: ${headline}. If you get a message like this, don't reply. Here's why:`} />
    </div>
  );
}
