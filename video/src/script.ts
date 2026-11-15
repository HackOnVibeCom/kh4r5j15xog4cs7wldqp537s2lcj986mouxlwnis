// The narration, one line per beat. HackOnVibe's judges ask the video to show the "successful
// client path" (what to press to get a result) rather than plans or a market overview, so almost
// every line plays over the real app.

export const VOICE = "aura-2-thalia-en";

export type Scene =
  | { kind: "intro"; graphic: "text" | "number" | "logo" }
  | { kind: "rec"; from: string; to: string }
  | { kind: "card"; graphic: "preview" | "telegram" | "close" };

export interface ScriptLine {
  key: string;
  text: string;
  scene: Scene;
  /** Short on-screen label next to the phone. */
  label?: string;
}

export const LINES: ScriptLine[] = [
  { key: "hook", scene: { kind: "intro", graphic: "text" }, text: "This is the kind of text message that empties bank accounts." },
  { key: "number", scene: { kind: "intro", graphic: "number" }, text: "In 2024, Americans reported losing twelve and a half billion dollars to fraud." },
  { key: "intro", scene: { kind: "intro", graphic: "logo" }, text: "ScamCheck tells you in seconds if a message is a scam, and why. It's free, and there's no sign-up." },
  { key: "open", scene: { kind: "rec", from: "home", to: "example" }, label: "Open the link", text: "Open the site on any phone. No account, and nothing to install." },
  { key: "tap", scene: { kind: "rec", from: "example", to: "result" }, label: "Tap an example", text: "Paste a message, add a screenshot, or tap an example. Let's try a fake parcel text." },
  { key: "verdict", scene: { kind: "rec", from: "result", to: "reasons" }, label: "The verdict", text: "A few seconds later: likely scam, with every warning sign highlighted right in the message." },
  { key: "labels", scene: { kind: "rec", from: "reasons", to: "advice" }, label: "AI reading vs checked fact", text: "Each reason is labeled. Purple is the AI's reading. Green is a fact we checked ourselves, like the domain registry having no record of this website." },
  { key: "advice", scene: { kind: "rec", from: "advice", to: "share" }, label: "What to do now", text: "Then it tells you exactly what to do next." },
  { key: "share", scene: { kind: "rec", from: "share", to: "warning" }, label: "Warn your family", text: "Now the part that makes it spread. One tap sends the warning to the family group chat." },
  { key: "warning", scene: { kind: "rec", from: "warning", to: "warningEnd" }, label: "The warning page", text: "Whoever opens it sees the warning, with personal details hidden and links made unclickable. And they can check their own messages in one tap." },
  { key: "preview", scene: { kind: "card", graphic: "preview" }, text: "In a chat, the link arrives as a warning card." },
  { key: "honest", scene: { kind: "rec", from: "legit", to: "legitEnd" }, label: "No false alarms", text: "It doesn't cry wolf. A real appointment reminder comes back with no red flags, and a reminder that this is never a guarantee." },
  { key: "language", scene: { kind: "rec", from: "spanish", to: "spanishEnd" }, label: "Any language", text: "And it answers in the message's own language. Here's a Spanish scam." },
  { key: "telegram", scene: { kind: "card", graphic: "telegram" }, text: "On Telegram, just forward the message to the ScamCheck bot, and the answer comes back right in the chat." },
  { key: "parent", scene: { kind: "rec", from: "protect", to: "protectEnd" }, label: "Set it up for a parent", text: "You can even set it up for a parent, with a link that says it's from you." },
  { key: "close", scene: { kind: "card", graphic: "close" }, text: "Scams spread through family chats. Now the warning does too. ScamCheck. Check before you click." },
];
