import { useState, useEffect, useRef, useCallback, useMemo, memo, createContext, useContext, Component } from "react";
import { serverTimestamp } from "firebase/firestore";
import { useAuthContext } from "@/context/AuthContext";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement } from "@stripe/react-stripe-js";
import { useAuthState, signUp, signIn, logOut, updateUserProfile, uploadAvatar } from "@/mytruepost/useAuth";
import {
  useFeed,
  useMyFeeds,
  useFeedsIConnected,
  useMyConversations,
  useChatDoc,
  useChatMessages,
  useDiscover,
  useAllChatUnreads,
  usePublicGhosts,
  react,
  sendConnect,
  acceptConnect,
  declineConnect,
  sendMessage,
  markChatRead,
  deleteChat,
  blockUser,
  reportChat,
  markTruthPaid,
  markTruthFailed,
  getFeedData,
  createTruthWithConfess,
  useFeedPaymentStatus,
  TRUTH_PRICE,
} from "@/mytruepost/useTruePost";
import { useTruthCardPayment, useTruthCashAppPayment, usePendingTruthsCheck } from "@/mytruepost/useTruthPayment";
import { useCardConfessingPayment, useCashAppConfessingPayment, usePendingCreditsCheck } from "@/mytruepost/useConfessingPayment";
import { useViews } from "@/mytruepost/useViews";

let _stripePromise;
function getStripe() {
  if (!_stripePromise) _stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  return _stripePromise;
}

/* ════════════════════════════════════════════════════════════════════════════
   MY TRUE POST — V4 · "Midnight Editorial" · LIVE on Firebase
   ────────────────────────────────────────────────────────────────────────────
   Thesis: truth creates connection.

   Firestore shape (unchanged):
     users/{uid}                            → profile (displayName, age, email,
                                               photoURL, confesses, createdAt)
     feeds/{feedId}                         → message, mood, author, connect[],
                                               felt/same/brave + *By[] arrays,
                                               paymentStatus, createdAt
     feeds/{feedId}/chats/{connectorUid}    → one private conversation
       …/messages/{msgId}                   → the lines

   What V4 adds on top of V3 WITHOUT touching the visual design language:
     • A real ghost field on the login + loading screens — the public truths now
       drift across the page as faint, italic, floating bodies (the "ghostly
       body" fix), with both horizontal and vertical wander and depth layering.
     • An in-brand notice/toast layer (NoticeProvider) so reactions, sends,
       passes, copies and errors confirm themselves in the interface's own voice.
     • An ErrorBoundary so one bad render never takes the whole night down.
     • A composer that breathes: live character meter, gentle ceiling, draft
       persistence within the session, and clearer mood semantics.
     • Esc-to-close + focus return on every overlay; scroll-to-top on the feed;
       a quiet "pass" confirm so no connection is dropped by accident.
     • Defensive helpers for time, ranking, reaction tallies, and identity hues
       that are reused everywhere instead of re-derived inline.

   Nothing here changes the palette, the typography, the layout, or the copy
   voice. It is the same paper — just printed more carefully.
   ════════════════════════════════════════════════════════════════════════════ */

/* ──────────────────────────────────────────────────────────────────────────
   DESIGN TOKENS — palette, type, motion. Single source of truth.
   ────────────────────────────────────────────────────────────────────────── */

const C = {
  bg: "#0E0B12",
  ink: "#F5EFE6",
  dim: "#8E8398",
  faint: "#544B5E",
  line: "rgba(245,239,230,0.08)",
  lineStrong: "rgba(245,239,230,0.14)",
  ember: "#FF7059",
  lav: "#B9A8E0",
  amber: "#E8B872",
  teal: "#7FB5A6",
  rose: "#FF8FB1",
  sky: "#8FB8FF",
};

const SERIF = "'Instrument Serif', Georgia, serif";
const UI = "'Outfit', 'Helvetica Neue', sans-serif";

/* Motion constants — kept identical in feel to V3's cubic-bezier rises. */
const EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";
const RISE_MS = 600;
const RISE_STAGGER_MS = 90;

/* Composer ceiling. Soft guidance, not a hard cut — a truth can run long. */
const TRUTH_SOFT_LIMIT = 280;
const TRUTH_HARD_LIMIT = 600;

/* Cash App return overlay: how long we wait for Firestore to confirm "paid". */
const CASHAPP_CONFIRM_TIMEOUT_MS = 30000;

/* Confessing balance packages — prepaid truths, no subscription, never expires. */
const CONFESSING_PACKAGES = [
  { cents: 500,  truths: 6,  per: "83¢ each", tag: null },
  { cents: 1000, truths: 13, per: "77¢ each", tag: "MOST POPULAR" },
  { cents: 2000, truths: 28, per: "71¢ each", tag: "BEST VALUE" },
];

/* How often relative timestamps ("3m", "2h") re-render across the app. */
const RELATIVE_TICK_MS = 30000;

/* ──────────────────────────────────────────────────────────────────────────
   MOODS — the four registers of a confession. Color is identity here.
   ────────────────────────────────────────────────────────────────────────── */

const MOODS = {
  raw: { label: "RAW", color: C.ember, hint: "unfiltered, straight from the chest" },
  soft: { label: "SOFT", color: C.lav, hint: "tender, quiet, careful" },
  spicy: { label: "SPICY", color: C.amber, hint: "the thing with heat behind it" },
  late: { label: "LATE NIGHT", color: C.teal, hint: "2am honesty, lights off" },
};

const MOOD_ORDER = ["raw", "soft", "spicy", "late"];

function moodOf(key) {
  return MOODS[key] || MOODS.raw;
}

/* ──────────────────────────────────────────────────────────────────────────
   PROMPTS — rotating composer provocations. Kept verbatim from V3, extended.
   ────────────────────────────────────────────────────────────────────────── */

const PROMPTS = [
  "What are you pretending not to feel?",
  "Say the thing you'd never post anywhere else.",
  "What's true at this exact hour?",
  "Who is this really about?",
  "What would you say if no one could trace it back?",
  "What have you been carrying quietly?",
  "What's the honest version of how you are?",
  "What do you keep rehearsing in your head?",
  "What truth have you been postponing?",
  "What are you grieving that no one knows about?",
  "Say the thing you're afraid to want.",
  "What do you do when no one's watching?",
  "What conversation do you keep having alone?",
  "What would you say to the person you were a year ago?",
  "What's true that you'd never say sober?",
  "Name the thing you've been circling for months.",
  "What would you need to forgive yourself for?",
  "What do you want that you're afraid to admit wanting?",
  "Say something that's been sitting in your chest.",
  "What's the weight you've been carrying longest?",
  "Who do you miss that you can't tell you miss them?",
  "What's the most honest thing about your life right now?",
  "If you had to tell one truth tonight, what would it be?",
  "What have you stopped explaining because no one gets it?",
  "What are you still waiting for?",
  "What do you do with the parts of yourself no one sees?",
  "What have you been telling yourself that isn't true?",
  "What's the last thing that made you feel something real?",
  "What's the truest sentence you could write right now?",
  "What are you holding that no one knows you're holding?",
  "Say the thing that's been in the back of your mind for weeks.",
];

function randomPrompt() {
  return PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
}

/* ── Anonymous names — poetic stand-ins for users who post without their name. */
const ANON_NAMES = [
  "a ghost in the room",
  "the 3am honest",
  "a quiet arsonist",
  "someone who stayed",
  "the last one awake",
  "a soft explosion",
  "the one who knew",
  "a late night truth",
  "a careful liar",
  "the one you forgot",
  "a small fire",
  "someone still here",
  "the one who left notes",
  "a voice in the dark",
  "the honest hour",
  "a long exhale",
  "something unfinished",
  "the words you swallowed",
  "a brief confession",
  "a familiar stranger",
];

function randomAnonName() {
  return ANON_NAMES[Math.floor(Math.random() * ANON_NAMES.length)];
}

/* ── Discover tab tips — rotate through these as contextual hints to help
   users engage with the Discover surface. Shown as a quiet caption. */
const DISCOVER_TIPS = [
  "Swipe right to reach out. Left to pass.",
  "You only see truths that haven't connected yet.",
  "The match is mutual. They have to feel yours too.",
  "Truths that sound like yours are sorted to the top.",
  "You can pass as many times as you want. No one knows.",
  "A connection starts with one truth and a reach.",
  "These are real people being honest at the same time you are.",
  "You're not browsing profiles. You're reading someone's truth.",
  "The best conversations start with a shared feeling, not an intro.",
  "Switch to list mode to see more truths at once.",
];

/* ── Mood insights — one poetic line per mood, shown in mood journal overlay
   and analytics overlays as a contextual caption. */
const MOOD_INSIGHTS = {
  raw:    "Raw truths cut cleanest. This is you without the edit.",
  soft:   "Softness isn't weakness. This mood holds the tender things.",
  spicy:  "Spicy is the mood of things that needed to be said.",
  late:   "Late-night honesty is its own category. The quiet hours know.",
  deep:   "Deep means you went somewhere most people won't. Thank you.",
  hope:   "Hope is the bravest thing a tired person can feel.",
  numb:   "Numbness is a truth too. Feeling nothing is still a feeling.",
  fire:   "Fire means something burned. That's not nothing. That's everything.",
};

/* ── Extra anonymous display names — poetic and emotionally resonant. */
const ANON_NAMES_EXTENDED = [
  "a match in the dark",
  "the one who stayed late",
  "a quiet departure",
  "the long way home",
  "someone between chapters",
  "a door left open",
  "the first honest sentence",
  "a slow exhale",
  "the version no one sees",
  "an unmailed letter",
  "a half-remembered dream",
  "someone at the edge of saying it",
  "a light left on",
  "the last honest thought before sleep",
  "a held breath finally released",
  "someone who circled back",
];

/* ── Weekly challenges — rotate every 7 days based on the epoch week number. */
const WEEKLY_CHALLENGES = [
  { prompt: "Post something you've never said out loud.", tag: "NEVER SAID" },
  { prompt: "Tell a truth about someone you love.", tag: "ABOUT THEM" },
  { prompt: "Say the thing you wish someone had told you.", tag: "WISH I KNEW" },
  { prompt: "What's the last thing that made you cry?", tag: "RAW MOMENT" },
  { prompt: "Post a truth about your body.", tag: "BODY TRUTH" },
  { prompt: "What's the bravest thing you've ever done quietly?", tag: "QUIET BRAVE" },
  { prompt: "Tell us something you used to believe that you don't anymore.", tag: "CHANGED" },
  { prompt: "What do you miss most?", tag: "MISSING" },
  { prompt: "Post a truth about where you grew up.", tag: "WHERE FROM" },
  { prompt: "What's the thing you're most proud of that no one celebrates?", tag: "UNSUNG" },
  { prompt: "Post a truth about something you're afraid of.", tag: "AFRAID" },
  { prompt: "What's the kindest thing you've ever done that no one saw?", tag: "UNSEEN KIND" },
  { prompt: "Post the most honest sentence you can write today.", tag: "ONE SENTENCE" },
  { prompt: "Tell a truth about your relationship with time.", tag: "TIME" },
  { prompt: "What do you need to hear right now?", tag: "NEED THIS" },
  { prompt: "Post something you've been putting off feeling.", tag: "DEFERRED" },
  { prompt: "What's a truth you've only told one person?", tag: "ONCE TOLD" },
  { prompt: "Say something real about who you are at midnight.", tag: "MIDNIGHT SELF" },
];

/* ── Achievement definitions — milestones that live in the user's journey. */
const ACHIEVEMENT_DEFS = [
  { id: "first_truth",   icon: "✦", name: "First Word",     desc: "Posted your first truth.",                      threshold: 1,   stat: "posts" },
  { id: "five_truths",   icon: "✦✦", name: "Five Deep",    desc: "Posted 5 truths.",                               threshold: 5,   stat: "posts" },
  { id: "ten_truths",    icon: "✦✦✦", name: "Ten Told",    desc: "Posted 10 truths.",                              threshold: 10,  stat: "posts" },
  { id: "first_felt",    icon: "♥",  name: "Felt",          desc: "Someone marked your truth as Felt.",            threshold: 1,   stat: "felt" },
  { id: "ten_felt",      icon: "♥♥", name: "Resonant",      desc: "10 people felt your truths.",                   threshold: 10,  stat: "felt" },
  { id: "first_connect", icon: "⟵⟶", name: "Connected",  desc: "Made your first connection.",                    threshold: 1,   stat: "connects" },
  { id: "five_connects", icon: "∞",  name: "Five Threads",  desc: "Made 5 connections.",                           threshold: 5,   stat: "connects" },
  { id: "brave_soul",    icon: "🔥", name: "Brave Soul",    desc: "10 people called your truth Brave.",            threshold: 10,  stat: "brave" },
  { id: "same_feeling",  icon: "🙌", name: "Same Feeling",  desc: "10 people said Same to your truth.",            threshold: 10,  stat: "same" },
  { id: "night_owl",     icon: "◑",  name: "Night Owl",     desc: "Posted 3 late-night truths.",                   threshold: 3,   stat: "late_posts" },
  { id: "raw_heart",     icon: "◈",  name: "Raw Heart",     desc: "Posted 3 RAW mood truths.",                     threshold: 3,   stat: "raw_posts" },
  { id: "truth_teller",  icon: "★",  name: "Truth Teller",  desc: "Earned all 4 mood achievements.",              threshold: 4,   stat: "mood_diversity" },
  { id: "twenty_truths", icon: "◉",  name: "Twenty Deep",   desc: "Posted 20 truths. You keep showing up.",        threshold: 20,  stat: "posts" },
  { id: "fifty_truths",  icon: "◉◉", name: "Fifty Told",    desc: "50 truths. This is your practice.",             threshold: 50,  stat: "posts" },
  { id: "echo_first",    icon: "↺",  name: "First Echo",    desc: "Echoed another person's truth.",                threshold: 1,   stat: "echoes" },
  { id: "saved_five",    icon: "✦",  name: "Keeper",        desc: "Saved 5 truths that stayed with you.",          threshold: 5,   stat: "saved" },
  { id: "streak_seven",  icon: "⚡", name: "Week of Truth", desc: "Posted every day for 7 days straight.",          threshold: 7,   stat: "streak" },
];

/* ──────────────────────────────────────────────────────────────────────────
   IDENTITY HUES — deterministic per-uid accent so the same person always
   carries the same color across feed, inbox, and chat.
   ────────────────────────────────────────────────────────────────────────── */

const HUES = [C.ember, C.lav, C.amber, C.teal, C.rose, C.sky];

function hueFor(uid = "") {
  let h = 0;
  for (const ch of uid) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
}

/* ──────────────────────────────────────────────────────────────────────────
   TIME HELPERS — tolerant of Firestore Timestamps, Dates, and raw millis.
   ────────────────────────────────────────────────────────────────────────── */

function toDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts instanceof Date) return ts;
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

function timeAgo(ts) {
  const d = toDate(ts);
  if (!d) return "now";
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 5) return "now";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const dd = Math.floor(h / 24);
  if (dd < 7) return `${dd}d`;
  return `${Math.floor(dd / 7)}w`;
}

function clockTime(ts) {
  const d = toDate(ts) || new Date();
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function monthYear(ts) {
  const d = toDate(ts);
  if (!d) return null;
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function dateline() {
  return new Date()
    .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    .toUpperCase();
}

/* The header eyebrow shifts with the hour — the loudest truth belongs to a
   time of day, not just a feed position. */
function loudestLabel() {
  const h = new Date().getUTCHours();
  if (h >= 5 && h < 12) return "THIS MORNING'S LOUDEST TRUTH";
  if (h >= 12 && h < 18) return "THIS AFTERNOON'S LOUDEST TRUTH";
  return "TONIGHT'S LOUDEST TRUTH";
}

/* ──────────────────────────────────────────────────────────────────────────
   REACTION HELPERS — one place that knows how a truth is scored and whether
   the current user has already spoken for it.
   ────────────────────────────────────────────────────────────────────────── */

const REACTION_KEYS = ["felt", "same", "brave"];
const NAH_BURY_THRESHOLD = 3; // nah must reach this AND exceed positives to bury

/* ── Glow words ─────────────────────────────────────────────────────────────
   Confessions containing these words render in bright white with a luminous
   glow. Includes the 7 core keywords and a broad set of Bible names.        */
const GLOW_WORDS = [
  // core keywords
  "god","jesus","spirit","lonely","single","help","love",
  // Old Testament
  "adam","eve","noah","abraham","isaac","jacob","joseph","moses","aaron",
  "joshua","caleb","samson","samuel","saul","david","solomon","elijah",
  "elisha","jonah","daniel","ezra","nehemiah","ruth","esther","deborah",
  "miriam","sarah","rachel","leah","rebekah","hannah","naomi","rahab",
  "bathsheba","tamar","lot","ishmael","esau","levi","judah","benjamin",
  "reuben","gideon","boaz","eli","nathan","absalom","ahab","jezebel",
  "hosea","joel","amos","micah","malachi","habakkuk","obadiah","zephaniah",
  "haggai","zechariah","balaam","phinehas","jephthah","othniel","ehud",
  "barak","jael","naaman","gehazi","hezekiah","josiah","uzziah","jehoshaphat",
  // New Testament
  "mary","john","peter","james","andrew","philip","thomas","matthew",
  "simon","judas","paul","barnabas","stephen","timothy","titus","silas",
  "luke","mark","apollos","lydia","phoebe","priscilla","aquila","martha",
  "lazarus","nicodemus","elizabeth","zacharias","gabriel","herod","pilate",
  "cornelius","ananias","sapphira","agabus","eunice","lois","onesimus",
  "philemon","epaphras","demas","tychicus","zacchaeus","bartimaeus",
  // emotional and existential keywords that deserve the glow treatment
  "afraid","scared","broken","healing","grief","loss","death","dying",
  "alive","hope","hopeless","ashamed","shame","proud","regret","forgive",
  "forgiven","forgotten","remember","miss","missing","ache","aching",
  "vulnerable","honest","silence","scream","numb","cry","crying",
  "alone","belong","belonging","real","truth","lie","hiding","seen",
  "invisible","worthy","worthless","tired","exhausted","peace","anxiety",
  "anxious","depressed","depression","trauma","recovery","sober","addict",
  "survivor","strength","broken","whole","holy","sacred","mercy","grace",
];
const GLOW_REGEX = new RegExp(`\\b(${GLOW_WORDS.join("|")})\\b`, "i");
function hasGlow(message) {
  return message ? GLOW_REGEX.test(message) : false;
}

const REACTION_META = {
  felt:  { label: "Felt",  icon: "♡", activeIcon: "♥", color: C.ember, by: "feltBy" },
  same:  { label: "Same",  icon: "🙌",                  color: C.lav,   by: "sameBy" },
  brave: { label: "Brave", icon: "🔥",                  color: C.amber, by: "braveBy" },
  nah:   { label: "Nah",   icon: "✕",                   color: C.rose,  by: "nahBy" },
};

function reactionTotal(post) {
  return (post.felt || 0) + (post.same || 0) + (post.brave || 0);
}

function rankScore(post) {
  return reactionTotal(post) - (post.nah || 0);
}

function votedState(post, myUid) {
  const out = {};
  for (const key of [...REACTION_KEYS, "nah"]) {
    const arr = post[REACTION_META[key].by];
    out[key] = !!(arr && arr.includes(myUid));
  }
  return out;
}

function isBuried(post) {
  const nah = post.nah || 0;
  return nah >= NAH_BURY_THRESHOLD && nah > reactionTotal(post);
}

/* Rank by net resonance (felt+same+brave − nah); most felt surfaces loudest. */
function rankTruths(posts) {
  return [...posts].sort((a, b) => {
    const diff = rankScore(b) - rankScore(a);
    if (diff !== 0) return diff;
    const ad = toDate(a.createdAt)?.getTime() || 0;
    const bd = toDate(b.createdAt)?.getTime() || 0;
    return bd - ad;
  });
}

/* ──────────────────────────────────────────────────────────────────────────
   AUTH ERROR COPY — failures speak in the interface's voice, never Firebase's.
   ────────────────────────────────────────────────────────────────────────── */

function prettyAuthError(code) {
  switch (code) {
    case "auth/invalid-email":
      return "That email doesn't look right.";
    case "auth/email-already-in-use":
      return "Someone's already confessing with that email.";
    case "auth/weak-password":
      return "Password needs at least 6 characters.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password didn't match.";
    case "auth/too-many-requests":
      return "Too many tries. Give it a minute.";
    case "auth/network-request-failed":
      return "The connection dropped. Try again.";
    default:
      return null;
  }
}

/* Fallback drifting truths for the login screen when the public-ghost feed is
   empty or still loading. These are the "ghostly bodies" that float behind the
   sign-in card. */
const FALLBACK_GHOSTS = [
  "I still have the voicemail.",
  "I'm not over it. I'm just quiet about it.",
  "I laugh loudest when I'm lonely.",
  "I want to be chosen first, once.",
  "I miss someone I've never met.",
  "I reread our last messages more than I'd admit.",
  "I'm fine is the biggest lie I tell.",
  "I keep a seat open for someone who left.",
  "I forgave them but I never told them.",
  "I'm scared of how much I want.",
  "I have a version of myself I've never shown anyone.",
  "I don't actually believe I'm okay.",
  "I've started over so many times I lost count.",
  "I'm still waiting for someone to notice.",
  "I cried in the car and then went back inside.",
  "I know exactly what I want and I'm terrified to say it.",
  "I pretend I'm over things I've never processed.",
  "I have a draft I'll never send.",
  "I remember everything we said that night.",
  "I've been meaning to apologize for years.",
  "I don't know who I am outside of other people.",
  "I said I was fine and drove home in tears.",
  "The silence after that call said everything.",
  "I thought about it longer than I should have.",
  "I'm proud of something no one would understand.",
  "I love someone I can't tell.",
  "I have a hope I'm almost ashamed of.",
  "I miss the version of us before everything.",
  "I still flinch at certain sounds.",
  "I want someone to ask me the real question.",
];

/* small id helper for ephemeral client-only things (notices, keys) */
let __idSeq = 0;
function localId(prefix = "id") {
  __idSeq += 1;
  return `${prefix}_${Date.now().toString(36)}_${__idSeq}`;
}

/* ════════════════════════════════════════════════════════════════════════════
   INFRASTRUCTURE — context, boundary, shared hooks. None of this is visible
   until something needs it; all of it is in-brand when it surfaces.
   ════════════════════════════════════════════════════════════════════════════ */

/* ──────────────────────────────────────────────────────────────────────────
   NOTICE LAYER — tiny, quiet confirmations. A reaction lands, a message sends,
   a pass is taken: the interface says so in one line, in its own voice, then
   fades. This is the only "toast" system and it stays out of the way.
   ────────────────────────────────────────────────────────────────────────── */

const NoticeContext = createContext(() => {});

function useNotice() {
  return useContext(NoticeContext);
}

function NoticeProvider({ children }) {
  const [notices, setNotices] = useState([]);

  const dismiss = useCallback((id) => {
    setNotices((list) => list.filter((n) => n.id !== id));
  }, []);

  const notify = useCallback(
    (text, tone = "neutral", ttl = 2600) => {
      if (!text) return;
      const id = localId("notice");
      setNotices((list) => [...list, { id, text, tone }]);
      if (ttl > 0) {
        setTimeout(() => {
          setNotices((list) => list.filter((n) => n.id !== id));
        }, ttl);
      }
      return id;
    },
    []
  );

  const toneColor = (tone) =>
    tone === "warn" ? C.ember : tone === "good" ? C.teal : C.lav;

  return (
    <NoticeContext.Provider value={notify}>
      {children}
      <div
        className="fixed left-0 right-0 z-[60] flex flex-col items-center gap-2 pointer-events-none"
        style={{ bottom: "5.6rem" }}
        aria-live="polite"
        aria-atomic="true"
      >
        {notices.map((n) => (
          <div
            key={n.id}
            className="mtp-notice pointer-events-auto"
            onClick={() => dismiss(n.id)}
            role="status"
            style={{
              fontFamily: UI,
              fontWeight: 600,
              fontSize: "0.8rem",
              letterSpacing: "0.02em",
              color: C.ink,
              background: "rgba(14,11,18,0.92)",
              backdropFilter: "blur(14px)",
              border: `1px solid ${toneColor(n.tone)}55`,
              borderLeft: `2px solid ${toneColor(n.tone)}`,
              borderRadius: "12px",
              padding: "10px 16px",
              maxWidth: "min(92vw, 30rem)",
              boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
              cursor: "pointer",
            }}
          >
            {n.text}
          </div>
        ))}
      </div>
    </NoticeContext.Provider>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   ERROR BOUNDARY — a single failed render should never blank the whole night.
   When something breaks we say so plainly and offer the one useful action.
   ────────────────────────────────────────────────────────────────────────── */

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || "" };
  }
  componentDidCatch(error, info) {
    // surfaced to the console for the founder; users only see the calm screen
    console.error("MyTruePost render error:", error, info);
  }
  reset = () => {
    this.setState({ hasError: false, message: "" });
  };
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-8 text-center gap-4"
        style={{ background: C.bg }}
      >
        <div
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: "clamp(2rem, 8vw, 2.8rem)",
            color: C.ink,
            textShadow: `0 0 40px ${C.ember}33`,
          }}
        >
          Something went quiet.
        </div>
        <p style={{ fontFamily: UI, fontSize: "0.9rem", color: C.dim, maxWidth: "28rem", lineHeight: 1.5 }}>
          A page hit a snag and stopped. Your truths are safe — they live on the
          server, not here. Reload to come back in.
        </p>
        <button
          onClick={() => {
            this.reset();
            if (typeof window !== "undefined") window.location.reload();
          }}
          style={{
            fontFamily: UI,
            fontWeight: 700,
            fontSize: "0.76rem",
            letterSpacing: "0.16em",
            color: C.bg,
            background: C.ember,
            border: "none",
            borderRadius: "999px",
            padding: "12px 26px",
            cursor: "pointer",
            marginTop: "0.4rem",
            boxShadow: `0 0 36px ${C.ember}40`,
          }}
        >
          RELOAD
        </button>
      </div>
    );
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   SHARED UX HOOKS
   ────────────────────────────────────────────────────────────────────────── */

/* Esc closes the topmost overlay; we return focus to where the user was. */
function useEscape(active, onEscape) {
  useEffect(() => {
    if (!active) return;
    const handler = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onEscape?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, onEscape]);
}

/* Lock body scroll while a full-screen overlay is open. */
function useBodyLock(active) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}

/* Re-render on an interval so relative timestamps stay honest without sockets. */
function useRelativeClock(ms = RELATIVE_TICK_MS) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

/* Track whether the user has scrolled far enough to warrant a scroll-to-top. */
function useScrolledPast(threshold = 600) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => setPast((prev) => {
      const next = window.scrollY > threshold;
      return next === prev ? prev : next;
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return past;
}

/* Tracks browser online/offline status. */
function useOnlineStatus() {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

/* Pull-to-refresh — detects a downward drag from the very top of the page.
   onRefresh is called when the user releases past the threshold. Returns
   pullY (current drag distance, 0 when idle) and refreshing (bool). */
function usePullToRefresh(onRefresh, threshold = 68) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const pullYRef = useRef(0);
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  useEffect(() => {
    const onTouchStart = (e) => {
      if (window.scrollY > 2) return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    };
    const onTouchMove = (e) => {
      if (!pulling.current) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && window.scrollY < 2) {
        const next = Math.min(delta * 0.42, threshold + 20);
        pullYRef.current = next;
        setPullY(next);
      } else {
        pulling.current = false;
        pullYRef.current = 0;
        setPullY(0);
      }
    };
    const onTouchEnd = async () => {
      if (!pulling.current) { pullYRef.current = 0; setPullY(0); return; }
      pulling.current = false;
      const y = pullYRef.current;
      pullYRef.current = 0;
      if (y >= threshold) {
        setRefreshing(true);
        setPullY(threshold);
        try { await onRefreshRef.current?.(); } catch {}
        setRefreshing(false);
      }
      setPullY(0);
    };
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [threshold]);

  return { pullY, refreshing };
}

/* Reading progress — returns 0–1 representing how far the user has scrolled. */
function useReadingProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const update = () => {
      const el = document.documentElement;
      const scrollable = el.scrollHeight - el.clientHeight;
      setProgress(scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 0);
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => window.removeEventListener("scroll", update);
  }, []);
  return progress;
}

/* Detect horizontal swipe on the document body.
   Returns "left" | "right" | null — null resets after each completed swipe. */
function useSwipeDirection(minDist = 64) {
  const [dir, setDir] = useState(null);
  const sx = useRef(0);
  const sy = useRef(0);

  useEffect(() => {
    const onStart = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      sx.current = e.touches[0].clientX;
      sy.current = e.touches[0].clientY;
      setDir(null);
    };
    const onEnd = (e) => {
      const dx = e.changedTouches[0].clientX - sx.current;
      const dy = e.changedTouches[0].clientY - sy.current;
      if (Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > minDist) {
        setDir(dx > 0 ? "right" : "left");
      }
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
    };
  }, [minDist]);

  return dir;
}

/* Long-press detector. Returns props to spread onto the target element.
   onLongPress({ x, y }) is called after `duration` ms of uninterrupted touch. */
function useLongPress(onLongPress, duration = 480) {
  const timer = useRef(null);
  const pos = useRef({ x: 0, y: 0 });
  const lpRef = useRef(onLongPress);
  useEffect(() => { lpRef.current = onLongPress; }, [onLongPress]);

  const clear = useCallback(() => { clearTimeout(timer.current); }, []);

  const start = useCallback((e) => {
    const t = e.touches?.[0] || e;
    pos.current = { x: t.clientX, y: t.clientY };
    timer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate([40]);
      lpRef.current?.(pos.current);
    }, duration);
  }, [duration]);

  return {
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchMove: clear,
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
  };
}

/* Keyboard shortcuts for desktop — N opens composer, 1-4 switch tabs,
   ? shows the shortcut list. Returns { showHelp, setShowHelp }. */
function useKeyboardNav(setTab, openComposer, extraActions = {}) {
  const [showHelp, setShowHelp] = useState(false);
  const TAB_KEYS = { "1": "feed", "2": "discover", "3": "inbox", "4": "profile" };
  // store extra actions in a ref so they don't force re-registration
  const actionsRef = useRef(extraActions);
  useEffect(() => { actionsRef.current = extraActions; });

  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const k = e.key;
      if (k === "?" || (k === "/" && !e.shiftKey)) {
        e.preventDefault();
        setShowHelp((v) => !v);
        return;
      }
      if (k === "Escape") { setShowHelp(false); return; }
      if (TAB_KEYS[k]) { setTab(TAB_KEYS[k]); return; }
      if ((k === "f" || k === "F") && !e.metaKey && !e.ctrlKey) { setTab("feed"); return; }
      if ((k === "d" || k === "D") && !e.metaKey && !e.ctrlKey) { setTab("discover"); return; }
      if ((k === "i" || k === "I") && !e.metaKey && !e.ctrlKey) { setTab("inbox"); return; }
      if ((k === "p" || k === "P") && !e.metaKey && !e.ctrlKey) { setTab("profile"); return; }
      if ((k === "n" || k === "N") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setTab("feed");
        openComposer?.();
        return;
      }
      if ((k === "s" || k === "S") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        actionsRef.current.openSearch?.();
        return;
      }
      if ((k === "b" || k === "B") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        actionsRef.current.openBooth?.();
        return;
      }
      if ((k === "v" || k === "V") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        actionsRef.current.openSaved?.();
        return;
      }
      if ((k === "m" || k === "M") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        actionsRef.current.openNotifs?.();
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setTab, openComposer]); // eslint-disable-line

  return { showHelp, setShowHelp };
}

/* Per-tab scroll restoration — remembers scroll position for each tab and
   restores it when the user navigates back. */
function useScrollRestore(tab) {
  const positions = useRef({});

  const saveScroll = useCallback((t) => {
    positions.current[t] = window.scrollY;
  }, []);

  const restoreScroll = useCallback((t) => {
    const y = positions.current[t] ?? 0;
    requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "instant" }));
  }, []);

  const prevTab = useRef(tab);
  useEffect(() => {
    if (prevTab.current !== tab) {
      saveScroll(prevTab.current);
      restoreScroll(tab);
      prevTab.current = tab;
    }
  }, [tab, saveScroll, restoreScroll]);
}

/* ════════════════════════════════════════════════════════════════════════════
   V5 HOOKS — new client-side state management. Each hook is self-contained
   and does NOT break existing functionality if it fails — all storage is
   localStorage-first with graceful Firestore sync where a path already exists.
   ════════════════════════════════════════════════════════════════════════════ */

const SAVED_KEY   = "mtp-saved-v1";
const SETTINGS_KEY = "mtp-settings-v1";
const NOTIFS_KEY   = "mtp-notifs-v1";
const ONBOARD_KEY  = "mtp-onboarded-v1";

/* ── useSavedTruths — bookmark / unbookmark truths ──────────────────────── */
function useSavedTruths(uid) {
  const [savedIds, setSavedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"); } catch { return []; }
  });
  const [savedPosts, setSavedPosts] = useState({});

  const isSaved = useCallback((id) => savedIds.includes(id), [savedIds]);

  const save = useCallback((post) => {
    setSavedIds((prev) => {
      if (prev.includes(post.id)) return prev;
      const next = [post.id, ...prev].slice(0, 100);
      try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    setSavedPosts((prev) => ({ ...prev, [post.id]: post }));
    if (uid) updateUserProfile(uid, { [`savedTruth_${post.id}`]: Date.now() }).catch(() => {});
  }, [uid]);

  const unsave = useCallback((id) => {
    setSavedIds((prev) => {
      const next = prev.filter((x) => x !== id);
      try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    setSavedPosts((prev) => { const n = { ...prev }; delete n[id]; return n; });
    if (uid) updateUserProfile(uid, { [`savedTruth_${id}`]: null }).catch(() => {});
  }, [uid]);

  const toggle = useCallback((post) => {
    if (isSaved(post.id)) unsave(post.id);
    else save(post);
  }, [isSaved, save, unsave]);

  const savedList = savedIds.map((id) => savedPosts[id]).filter(Boolean);

  return { savedIds, savedList, isSaved, save, unsave, toggle };
}

/* ── useDraftManager — multiple named drafts, max 10 ───────────────────── */
const DRAFTS_KEY = "mtp-drafts-v1";
const MAX_DRAFTS = 10;

function useDraftManager() {
  const [drafts, setDrafts] = useState(() => {
    try { return JSON.parse(localStorage.getItem(DRAFTS_KEY) || "[]"); } catch { return []; }
  });

  const persist = (list) => {
    try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(list)); } catch {}
  };

  const saveDraft = useCallback((text, mood, name = "") => {
    if (!text?.trim()) return;
    setDrafts((prev) => {
      const next = [
        { id: localId("draft"), text: text.trim(), mood: mood || "raw", name: name || text.trim().slice(0, 32), savedAt: Date.now() },
        ...prev,
      ].slice(0, MAX_DRAFTS);
      persist(next);
      return next;
    });
  }, []);

  const deleteDraft = useCallback((id) => {
    setDrafts((prev) => {
      const next = prev.filter((d) => d.id !== id);
      persist(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setDrafts([]);
    try { localStorage.removeItem(DRAFTS_KEY); } catch {}
  }, []);

  return { drafts, saveDraft, deleteDraft, clearAll };
}

/* ── useSettings — privacy and display preferences ──────────────────────── */
const DEFAULT_SETTINGS = {
  anonymousMode: false,
  hideAge: false,
  notifReactions: true,
  notifConnects: true,
  boothMode: false,
  compactFeed: false,
  showChallenge: true,
};

function useSettings(uid) {
  const [settings, setSettings] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      return { ...DEFAULT_SETTINGS, ...stored };
    } catch { return { ...DEFAULT_SETTINGS }; }
  });

  const updateSetting = useCallback((key, value) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch {}
      if (uid) updateUserProfile(uid, { [`setting_${key}`]: value }).catch(() => {});
      return next;
    });
  }, [uid]);

  return { settings, updateSetting };
}

/* ── useNotificationCenter — in-app notification history ────────────────── */
const MAX_NOTIFS = 50;

function useNotificationCenter(uid) {
  const [notifications, setNotifications] = useState(() => {
    try { return JSON.parse(localStorage.getItem(NOTIFS_KEY + uid) || "[]"); } catch { return []; }
  });
  const [lastReadAt, setLastReadAt] = useState(() => {
    try { return parseInt(localStorage.getItem(NOTIFS_KEY + uid + "_read") || "0", 10); } catch { return 0; }
  });

  const unreadCount = notifications.filter((n) => n.createdAt > lastReadAt).length;

  const addNotification = useCallback((type, text, data = {}) => {
    const n = { id: localId("notif"), type, text, data, createdAt: Date.now() };
    setNotifications((prev) => {
      const next = [n, ...prev].slice(0, MAX_NOTIFS);
      try { localStorage.setItem(NOTIFS_KEY + uid, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [uid]);

  const markAllRead = useCallback(() => {
    const now = Date.now();
    setLastReadAt(now);
    try { localStorage.setItem(NOTIFS_KEY + uid + "_read", String(now)); } catch {}
  }, [uid]);

  const clearAll = useCallback(() => {
    setNotifications([]);
    try { localStorage.removeItem(NOTIFS_KEY + uid); } catch {}
  }, [uid]);

  return { notifications, unreadCount, addNotification, markAllRead, clearAll };
}

/* ── useTruthAnalytics — compute rich stats from the user's own truths ───── */
function useTruthAnalytics(myFeeds) {
  return useMemo(() => {
    if (!myFeeds || myFeeds.length === 0) {
      return { bestPost: null, avgReactions: 0, bestMood: null, totalReach: 0, moodBreakdown: {}, topPost: null, reactionBreakdown: {} };
    }

    const totalFelt   = myFeeds.reduce((s, f) => s + (f.felt || 0), 0);
    const totalSame   = myFeeds.reduce((s, f) => s + (f.same || 0), 0);
    const totalBrave  = myFeeds.reduce((s, f) => s + (f.brave || 0), 0);
    const totalNah    = myFeeds.reduce((s, f) => s + (f.nah || 0), 0);
    const totalReach  = totalFelt + totalSame + totalBrave;
    const avgReactions = totalReach / myFeeds.length;

    const bestPost = [...myFeeds].sort((a, b) => rankScore(b) - rankScore(a))[0] || null;

    const moodBreakdown = {};
    MOOD_ORDER.forEach((k) => {
      moodBreakdown[k] = myFeeds.filter((f) => f.mood === k).length;
    });
    const bestMood = MOOD_ORDER.reduce((best, k) => (!best || moodBreakdown[k] > moodBreakdown[best] ? k : best), null);

    const reactionBreakdown = { felt: totalFelt, same: totalSame, brave: totalBrave, nah: totalNah };

    // Posts over time — last 30 days
    const now = Date.now();
    const dayMs = 86400000;
    const last30 = myFeeds.filter((f) => {
      const d = toDate(f.createdAt);
      return d && now - d.getTime() < 30 * dayMs;
    });

    return { bestPost, avgReactions: Math.round(avgReactions * 10) / 10, bestMood, totalReach, moodBreakdown, reactionBreakdown, last30Count: last30.length };
  }, [myFeeds]);
}

/* ── useAchievements — compute earned milestones from user data ──────────── */
function useAchievements(myFeeds, conversations) {
  return useMemo(() => {
    const posts       = myFeeds.length;
    const felt        = myFeeds.reduce((s, f) => s + (f.felt || 0), 0);
    const same        = myFeeds.reduce((s, f) => s + (f.same || 0), 0);
    const brave       = myFeeds.reduce((s, f) => s + (f.brave || 0), 0);
    const connects    = myFeeds.reduce((s, f) => s + (f.connect || []).filter((c) => c.flag === "accept").length, 0);
    const late_posts  = myFeeds.filter((f) => f.mood === "late").length;
    const raw_posts   = myFeeds.filter((f) => f.mood === "raw").length;
    const soft_posts  = myFeeds.filter((f) => f.mood === "soft").length;
    const spicy_posts = myFeeds.filter((f) => f.mood === "spicy").length;
    const moodDiversity = [late_posts, raw_posts, soft_posts, spicy_posts].filter((n) => n >= 1).length;

    const stats = { posts, felt, same, brave, connects, late_posts, raw_posts, soft_posts, spicy_posts, mood_diversity: moodDiversity };

    return ACHIEVEMENT_DEFS.map((def) => ({
      ...def,
      earned: (stats[def.stat] || 0) >= def.threshold,
      progress: Math.min((stats[def.stat] || 0) / def.threshold, 1),
    }));
  }, [myFeeds, conversations]);
}

/* ── useDailyChallenge — rotate challenge weekly ────────────────────────── */
/* ── Share-to-clipboard helper — copies a formatted version of a truth that
   can be pasted as text anywhere. Includes the mood label as a prefix so the
   emotional context travels with the quote wherever it lands. The trailing
   attribution keeps the source clear without being promotional. */
function formatTruthForClipboard(post) {
  const m = moodOf(post?.mood);
  const mood = m.label ? `[${m.label.toUpperCase()}] ` : "";
  return `${mood}"${post?.message}" — My True Post`;
}

/* Returns a rotating tip for the Discover tab; changes every 8 seconds. */
function useDiscoverTip() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % DISCOVER_TIPS.length), 8000);
    return () => clearInterval(t);
  }, []);
  return DISCOVER_TIPS[i];
}

function useDailyChallenge() {
  return useMemo(() => {
    const weekNum = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
    return WEEKLY_CHALLENGES[weekNum % WEEKLY_CHALLENGES.length];
  }, []);
}

/* ── useOnboardingStatus — tracks if user has completed onboarding ────────── */
function useOnboardingStatus() {
  const [done, setDone] = useState(() => {
    try { return !!localStorage.getItem(ONBOARD_KEY); } catch { return false; }
  });

  const complete = useCallback(() => {
    setDone(true);
    try { localStorage.setItem(ONBOARD_KEY, "1"); } catch {}
  }, []);

  return { onboarded: done, completeOnboarding: complete };
}

/* ════════════════════════════════════════════════════════════════════════════
   GLOBAL STYLE — fonts, keyframes, hover states. Mounted once at the app root.
   This is the same visual language as V3, with the ghost-drift animation
   rebuilt so login/loading truths actually float as bodies (horizontal +
   vertical wander, depth blur), plus a few reused micro-interactions.
   ════════════════════════════════════════════════════════════════════════════ */

function GlobalStyle() {
  return (
    <style>{`
      ::placeholder { color: ${C.faint}; opacity: 1; }

      /* entrance rise — used on truths, requests, modals */
      .mtp-rise { animation: mtpRise ${RISE_MS}ms ${EASE} both; }
      @keyframes mtpRise {
        from { opacity: 0; transform: translateY(18px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      /* ── GHOSTLY BODIES ──────────────────────────────────────────────────
         The login + loading background truths. Each line is its own drifting
         body: it crosses the screen horizontally while bobbing vertically,
         softly blurred so it reads as a memory, not a label. Multiple speeds
         and offsets are applied inline per-line for parallax depth. */
      .mtp-ghost {
        position: absolute;
        white-space: nowrap;
        pointer-events: none;
        font-family: ${SERIF};
        font-style: italic;
        color: ${C.ink};
        will-change: transform, opacity;
        animation-name: mtpGhostFloat;
        animation-timing-function: linear;
        animation-iteration-count: infinite;
        left: 100%;
      }
      @keyframes mtpGhostFloat {
        0%   { transform: translate(0, 0); }
        25%  { transform: translate(-26vw, -1.4rem); }
        50%  { transform: translate(-52vw, 0.8rem); }
        75%  { transform: translate(-78vw, -0.9rem); }
        100% { transform: translate(calc(-100vw - 100%), 0); }
      }
      /* a slow breathing of opacity so bodies fade in and out as they pass */
      .mtp-ghost-breathe { animation-name: mtpGhostFloat, mtpGhostBreathe; }
      @keyframes mtpGhostBreathe {
        0%, 100% { opacity: 0.04; }
        50%      { opacity: 0.11; }
      }

      /* loading screen: a single truth surfaces, holds, then sinks */
      .mtp-surface { animation: mtpSurface 5.5s ${EASE} both; }
      @keyframes mtpSurface {
        0%   { opacity: 0; transform: translateY(14px); filter: blur(6px); }
        18%  { opacity: 1; transform: translateY(0);    filter: blur(0); }
        78%  { opacity: 1; transform: translateY(0);    filter: blur(0); }
        100% { opacity: 0; transform: translateY(-12px); filter: blur(6px); }
      }

      /* notices */
      .mtp-notice { animation: mtpNotice 240ms ${EASE} both; }
      @keyframes mtpNotice {
        from { opacity: 0; transform: translateY(10px) scale(0.98); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }

      /* skeleton shimmer — shown while feed loads */
      @keyframes mtpShimmer {
        0%   { background-position: -400px 0; }
        100% { background-position: 400px 0; }
      }
      .mtp-skel {
        background: linear-gradient(90deg, rgba(245,239,230,0.06) 0%, rgba(245,239,230,0.13) 50%, rgba(245,239,230,0.06) 100%);
        background-size: 800px 100%;
        animation: mtpShimmer 1.4s ease infinite;
        border-radius: 4px;
      }

      /* reaction icon pop on click */
      @keyframes mtpRxPop {
        0%   { transform: scale(1); }
        35%  { transform: scale(1.55); }
        65%  { transform: scale(0.88); }
        100% { transform: scale(1); }
      }
      .mtp-rx-popping .mtp-rx-icon {
        animation: mtpRxPop 360ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
      }
      .mtp-rx-active .mtp-rx-icon {
        filter: drop-shadow(0 0 5px currentColor);
      }

      /* hover micro-interactions (pointer devices only) */
      @media (hover: hover) {
        .mtp-rx:hover { color: ${C.ink} !important; }
        .mtp-connect:hover:not(:disabled) { box-shadow: 0 0 24px ${C.ember}40; }
        .mtp-cta:hover { box-shadow: 0 0 56px ${C.ember}70; }
        .mtp-soft:hover:not(:disabled) { border-color: ${C.lineStrong} !important; }
        .mtp-scrolltop:hover { background: ${C.ember} !important; color: ${C.bg} !important; }
      }

      /* visible keyboard focus everywhere */
      .mtp-focusable:focus-visible {
        outline: 2px solid ${C.ember};
        outline-offset: 2px;
        border-radius: 6px;
      }
      button:focus-visible, a:focus-visible, textarea:focus-visible, input:focus-visible {
        outline: 2px solid ${C.ember}aa;
        outline-offset: 2px;
      }

      /* scrollbars, kept dark to match the paper */
      .mtp-scroll::-webkit-scrollbar { width: 8px; }
      .mtp-scroll::-webkit-scrollbar-thumb {
        background: ${C.line}; border-radius: 8px;
      }

      /* reading progress bar */
      .mtp-progress {
        position: fixed; top: 0; left: 0; right: 0;
        height: 2px;
        background: ${C.ember};
        transform-origin: left center;
        pointer-events: none;
        z-index: 200;
        transition: transform 80ms linear;
      }

      /* pull-to-refresh spinner */
      @keyframes mtpSpin { to { transform: rotate(360deg); } }
      .mtp-spin { animation: mtpSpin 700ms linear infinite; }

      /* long-press context menu */
      @keyframes mtpCtxIn {
        from { opacity: 0; transform: scale(0.92); }
        to   { opacity: 1; transform: scale(1); }
      }
      .mtp-ctx { animation: mtpCtxIn 140ms ${EASE} both; }

      /* confetti particle fall */
      @keyframes mtpConfetti {
        0%   { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
        100% { transform: translateY(110px) rotate(540deg) scale(0.6); opacity: 0; }
      }

      /* fresh badge pulse */
      @keyframes mtpPulse {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.55; }
      }
      .mtp-fresh { animation: mtpPulse 2s ease infinite; }

      /* mood bar segment grow */
      .mtp-mood-seg { transition: flex 600ms ${EASE}; }

      /* ── Confession Booth ─────────────────────────────────────────────────── */
      @keyframes mtpBoothOpen {
        from { opacity: 0; transform: scale(0.97); }
        to   { opacity: 1; transform: scale(1); }
      }
      .mtp-booth { animation: mtpBoothOpen 280ms ${EASE} both; }

      /* ── Swipe discover card ───────────────────────────────────────────────── */
      @keyframes mtpSwipeLeft {
        to { transform: translateX(-140%) rotate(-18deg); opacity: 0; }
      }
      @keyframes mtpSwipeRight {
        to { transform: translateX(140%) rotate(18deg); opacity: 0; }
      }
      @keyframes mtpSwipeUp {
        to { transform: translateY(-130%) scale(0.9); opacity: 0; }
      }
      .mtp-swipe-left  { animation: mtpSwipeLeft  320ms ${EASE} both; }
      .mtp-swipe-right { animation: mtpSwipeRight 320ms ${EASE} both; }
      .mtp-swipe-up    { animation: mtpSwipeUp    300ms ${EASE} both; }

      /* ── Drawers / sheets slide up ─────────────────────────────────────────── */
      @keyframes mtpSlideUp {
        from { transform: translateY(100%); }
        to   { transform: translateY(0); }
      }
      @keyframes mtpSlideDown {
        from { transform: translateY(0); }
        to   { transform: translateY(100%); }
      }
      .mtp-drawer  { animation: mtpSlideUp 320ms ${EASE} both; }

      /* ── Overlay backdrop fade ─────────────────────────────────────────────── */
      @keyframes mtpFadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      .mtp-backdrop { animation: mtpFadeIn 200ms ease both; }

      /* ── Achievement unlock pop ────────────────────────────────────────────── */
      @keyframes mtpAchievePop {
        0%   { transform: scale(0.5) rotate(-12deg); opacity: 0; }
        60%  { transform: scale(1.18) rotate(3deg); opacity: 1; }
        100% { transform: scale(1) rotate(0deg); opacity: 1; }
      }
      .mtp-achieve-pop { animation: mtpAchievePop 480ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }

      /* ── Typing indicator dots ─────────────────────────────────────────────── */
      @keyframes mtpTypingDot {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
        30%            { transform: translateY(-5px); opacity: 1; }
      }
      .mtp-typing-dot { animation: mtpTypingDot 1.1s ease infinite; }

      /* ── Mood calendar cell fill ───────────────────────────────────────────── */
      .mtp-cal-cell {
        width: 16px; height: 16px; border-radius: 3px;
        transition: transform 120ms ease;
      }
      .mtp-cal-cell:hover { transform: scale(1.35); }

      /* ── Toggle switch ─────────────────────────────────────────────────────── */
      .mtp-toggle {
        position: relative; width: 46px; height: 26px; cursor: pointer;
        background: transparent; border: none; padding: 0; flex-shrink: 0;
      }
      .mtp-toggle-track {
        position: absolute; inset: 0; border-radius: 999px;
        transition: background 200ms ease;
      }
      .mtp-toggle-thumb {
        position: absolute; top: 3px; width: 20px; height: 20px;
        border-radius: 50%; background: white;
        transition: transform 200ms ${EASE};
        box-shadow: 0 1px 4px rgba(0,0,0,0.4);
      }

      /* ── Onboarding step dot ───────────────────────────────────────────────── */
      @keyframes mtpDotExpand {
        from { width: 6px; }
        to   { width: 20px; }
      }

      /* ── Search overlay slide ──────────────────────────────────────────────── */
      @keyframes mtpSearchIn {
        from { opacity: 0; transform: translateY(-12px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .mtp-search-in { animation: mtpSearchIn 200ms ${EASE} both; }

      /* ── Swipe card stack base (non-animated) ──────────────────────────────── */
      .mtp-swipe-card {
        position: absolute; inset: 0;
        will-change: transform;
        touch-action: none;
        cursor: grab;
      }
      .mtp-swipe-card:active { cursor: grabbing; }

      @media (prefers-reduced-motion: reduce) {
        .mtp-rise, .mtp-ghost, .mtp-surface, .mtp-notice, .mtp-skel,
        .mtp-spin, .mtp-ctx, .mtp-fresh, .mtp-mood-seg,
        .mtp-booth, .mtp-drawer, .mtp-backdrop, .mtp-achieve-pop,
        .mtp-swipe-left, .mtp-swipe-right, .mtp-swipe-up, .mtp-search-in {
          animation: none !important;
          transition: none !important;
        }
        .mtp-ghost { opacity: 0.07 !important; }
      }
    `}</style>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   ATOMS — the smallest reusable pieces. Identical look to V3; consolidated so
   every screen draws an avatar, a mood tag, a reaction the same way.
   ════════════════════════════════════════════════════════════════════════════ */

function Avatar({ name = "?", hue, size = 34, photoURL = null }) {
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={name}
        className="rounded-full shrink-0 object-cover"
        style={{ width: size, height: size, border: `1px solid ${hue}50` }}
        loading="lazy"
        draggable={false}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center rounded-full shrink-0 select-none"
      aria-hidden
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 30%, ${hue}40, ${hue}14)`,
        border: `1px solid ${hue}50`,
        color: hue,
        fontFamily: UI,
        fontWeight: 700,
        fontSize: size * 0.4,
      }}
    >
      {name?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

function Mood({ mood }) {
  const m = moodOf(mood);
  return (
    <span
      style={{
        fontFamily: UI,
        fontWeight: 700,
        fontSize: "0.62rem",
        letterSpacing: "0.22em",
        color: m.color,
      }}
    >
      {m.label}
    </span>
  );
}

function Eyebrow({ children, color = C.dim }) {
  return (
    <div
      style={{
        fontFamily: UI,
        fontWeight: 700,
        fontSize: "0.62rem",
        letterSpacing: "0.3em",
        color,
      }}
    >
      {children}
    </div>
  );
}

/* ── PWA install prompt ─────────────────────────────────────────────────────
   Captures the browser's beforeinstallprompt event so we can show our own UI
   instead of the default browser banner, then saves the user's choice to their
   Firestore profile so we never ask twice. */
function usePwaInstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredEvent(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  return deferredEvent;
}

function PwaInstallBanner({ uid }) {
  const deferredEvent = usePwaInstallPrompt();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (deferredEvent) setVisible(true);
  }, [deferredEvent]);

  if (!visible) return null;

  const save = (choice) => {
    updateUserProfile(uid, { pwaInstall: choice, pwaPromptedAt: serverTimestamp() });
    setVisible(false);
  };

  const handleInstall = async () => {
    deferredEvent.prompt();
    const { outcome } = await deferredEvent.userChoice;
    save(outcome === "accepted" ? "accepted" : "dismissed");
  };

  return (
    <div
      className="mtp-rise"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        padding: "1rem 1.1rem",
        marginBottom: "0.25rem",
        borderBottom: `1px solid ${C.line}`,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 9,
          background: C.ember,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontFamily: SERIF,
          fontStyle: "italic",
          fontSize: "1.3rem",
          color: "#0E0B12",
          fontWeight: 700,
        }}
      >
        M
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.82rem", color: C.ink }}>
          Install App
        </div>
        <div style={{ fontFamily: UI, fontSize: "0.72rem", color: C.dim, marginTop: 2 }}>
          Opens like a real app, no browser bar.
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
        <button
          onClick={() => save("dismissed")}
          style={{
            fontFamily: UI,
            fontSize: "0.72rem",
            fontWeight: 600,
            color: C.dim,
            background: "none",
            border: `1px solid ${C.line}`,
            borderRadius: "999px",
            padding: "5px 11px",
            cursor: "pointer",
          }}
        >
          Not now
        </button>
        <button
          onClick={handleInstall}
          style={{
            fontFamily: UI,
            fontSize: "0.72rem",
            fontWeight: 700,
            color: "#0E0B12",
            background: C.ember,
            border: "none",
            borderRadius: "999px",
            padding: "5px 13px",
            cursor: "pointer",
          }}
        >
          Install
        </button>
      </div>
    </div>
  );
}

function Rx({ label, icon, activeIcon, count, color, active, onClick, readOnly = false }) {
  const [popping, setPopping] = useState(false);

  const handleClick = () => {
    if (readOnly || !onClick) return;
    if (navigator.vibrate) navigator.vibrate(8);
    setPopping(false);
    requestAnimationFrame(() => {
      setPopping(true);
      setTimeout(() => setPopping(false), 400);
    });
    onClick();
  };

  const displayIcon = active && activeIcon ? activeIcon : icon;
  const classes = [
    "mtp-focusable",
    !readOnly && "mtp-rx",
    popping && "mtp-rx-popping",
    active && "mtp-rx-active",
  ].filter(Boolean).join(" ");

  return (
    <button
      onClick={readOnly ? undefined : handleClick}
      disabled={readOnly}
      className={classes}
      aria-pressed={active}
      style={{
        fontFamily: UI,
        fontWeight: active ? 700 : 500,
        fontSize: "0.8rem",
        color: active ? color : C.dim,
        background: "none",
        border: "none",
        padding: "4px 0",
        borderBottom: `1px solid ${active ? color : "transparent"}`,
        cursor: readOnly ? "default" : "pointer",
        transition: "color 160ms ease, border-color 160ms ease",
        display: "flex",
        alignItems: "center",
        gap: "0.3em",
      }}
    >
      {displayIcon && (
        <span className="mtp-rx-icon" style={{ fontSize: "1.1em", lineHeight: 1, display: "inline-block" }}>
          {displayIcon}
        </span>
      )}
      {label} <span style={{ opacity: 0.75 }}>{count}</span>
    </button>
  );
}

function QuotedTruth({ truth, compact = false }) {
  const m = moodOf(truth.mood);
  return (
    <div
      style={{
        borderLeft: `2px solid ${m.color}66`,
        paddingLeft: "0.9rem",
        margin: compact ? "0.4rem 0" : "0.6rem 0",
      }}
    >
      <p
        style={{
          fontFamily: SERIF,
          fontStyle: "italic",
          fontSize: compact ? "0.95rem" : "1.1rem",
          lineHeight: 1.35,
          color: C.ink,
          opacity: 0.85,
          margin: 0,
        }}
      >
        "{truth.text}"
      </p>
    </div>
  );
}

function Pill({ children, color = C.dim, onClick, active = false, disabled = false, title }) {
  const interactive = !!onClick && !disabled;
  return (
    <button
      onClick={interactive ? onClick : undefined}
      disabled={disabled}
      title={title}
      className="mtp-focusable"
      style={{
        fontFamily: UI,
        fontWeight: 700,
        fontSize: "0.72rem",
        letterSpacing: "0.1em",
        color: active ? C.bg : color,
        background: active ? color : "transparent",
        border: `1px solid ${active ? color : color + "66"}`,
        borderRadius: "999px",
        padding: "8px 18px",
        cursor: interactive ? "pointer" : "default",
        transition: "all 180ms ease",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function UnreadBadge({ count }) {
  if (!count) return null;
  return (
    <span
      style={{
        background: C.ember,
        color: C.bg,
        fontFamily: UI,
        fontWeight: 800,
        fontSize: "0.62rem",
        borderRadius: "999px",
        padding: "2px 8px",
        flexShrink: 0,
      }}
    >
      {count}
    </span>
  );
}

function Divider({ label, color = C.dim }) {
  return (
    <div className="flex items-center gap-3" style={{ margin: "0.4rem 0" }}>
      {label && <Eyebrow color={color}>{label}</Eyebrow>}
      <div style={{ flex: 1, height: 1, background: C.line }} />
    </div>
  );
}

/* ── Save / Bookmark button ──────────────────────────────────────────────── */
function SaveButton({ saved, onToggle, size = 28 }) {
  const [popping, setPopping] = useState(false);

  const handle = (e) => {
    e.stopPropagation();
    if (navigator.vibrate) navigator.vibrate(8);
    setPopping(true);
    setTimeout(() => setPopping(false), 400);
    onToggle?.();
  };

  return (
    <button
      onClick={handle}
      aria-label={saved ? "Remove bookmark" : "Save truth"}
      aria-pressed={saved}
      className="mtp-focusable"
      style={{
        width: size,
        height: size,
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: saved ? C.amber : C.faint,
        transition: "color 160ms ease",
        transform: popping ? "scale(1.4)" : "scale(1)",
        transitionProperty: "color, transform",
        transitionDuration: "160ms, 240ms",
      }}
    >
      <svg
        width={size * 0.6}
        height={size * 0.6}
        viewBox="0 0 24 24"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v17l-7-4-7 4V4z" />
      </svg>
    </button>
  );
}

/* ── Achievement badge chip ──────────────────────────────────────────────── */
function AchievementBadge({ achievement, earned = false, size = "md" }) {
  const sm = size === "sm";
  return (
    <div
      title={achievement.desc}
      style={{
        display: "flex",
        flexDirection: sm ? "row" : "column",
        alignItems: "center",
        gap: sm ? "0.4rem" : "0.35rem",
        opacity: earned ? 1 : 0.3,
        transition: "opacity 200ms ease",
      }}
    >
      <span
        className={earned ? "mtp-achieve-pop" : ""}
        style={{
          fontSize: sm ? "1rem" : "1.4rem",
          lineHeight: 1,
          filter: earned ? `drop-shadow(0 0 6px ${C.amber}88)` : "none",
        }}
      >
        {achievement.icon}
      </span>
      <div style={{ textAlign: sm ? "left" : "center" }}>
        <div
          style={{
            fontFamily: UI,
            fontWeight: 700,
            fontSize: sm ? "0.64rem" : "0.62rem",
            letterSpacing: "0.12em",
            color: earned ? C.amber : C.faint,
          }}
        >
          {achievement.name.toUpperCase()}
        </div>
        {!sm && (
          <div
            style={{
              fontFamily: UI,
              fontSize: "0.58rem",
              color: C.faint,
              marginTop: "0.15rem",
              lineHeight: 1.3,
              maxWidth: "6rem",
            }}
          >
            {achievement.desc}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Daily challenge widget ──────────────────────────────────────────────── */
function ChallengeWidget({ challenge, onAccept, compact = false }) {
  if (!challenge) return null;
  if (compact) {
    return (
      <button
        onClick={onAccept}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          fontFamily: UI,
          fontWeight: 700,
          fontSize: "0.6rem",
          letterSpacing: "0.18em",
          color: C.teal,
          background: `${C.teal}14`,
          border: `1px solid ${C.teal}44`,
          borderRadius: "999px",
          padding: "4px 10px",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontSize: "0.75rem" }}>◈</span>
        CHALLENGE
      </button>
    );
  }
  return (
    <div
      style={{
        borderLeft: `2px solid ${C.teal}`,
        paddingLeft: "0.9rem",
        margin: "0.8rem 0",
      }}
    >
      <div style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.58rem", letterSpacing: "0.2em", color: C.teal, marginBottom: "0.3rem" }}>
        THIS WEEK'S CHALLENGE · {challenge.tag}
      </div>
      <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "1rem", color: C.ink, margin: 0, lineHeight: 1.4 }}>
        {challenge.prompt}
      </p>
      <button
        onClick={onAccept}
        style={{
          marginTop: "0.6rem",
          fontFamily: UI,
          fontWeight: 700,
          fontSize: "0.64rem",
          letterSpacing: "0.14em",
          color: C.teal,
          background: "none",
          border: `1px solid ${C.teal}55`,
          borderRadius: "999px",
          padding: "5px 13px",
          cursor: "pointer",
        }}
      >
        WRITE THIS
      </button>
    </div>
  );
}

/* ── Toggle switch atom ──────────────────────────────────────────────────── */
function Toggle({ on, onToggle, label }) {
  return (
    <div className="flex items-center justify-between" style={{ gap: "1rem" }}>
      {label && (
        <span style={{ fontFamily: UI, fontSize: "0.88rem", color: C.ink, flex: 1 }}>
          {label}
        </span>
      )}
      <button
        role="switch"
        aria-checked={on}
        onClick={onToggle}
        className="mtp-toggle"
        aria-label={label}
      >
        <div
          className="mtp-toggle-track"
          style={{ background: on ? C.ember : C.faint + "44" }}
        />
        <div
          className="mtp-toggle-thumb"
          style={{ transform: on ? "translateX(23px)" : "translateX(3px)" }}
        />
      </button>
    </div>
  );
}

/* ── Typing indicator three dots ─────────────────────────────────────────── */
function TypingDots({ color = C.dim }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "2px 4px" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="mtp-typing-dot"
          style={{
            display: "inline-block",
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: color,
            animationDelay: `${i * 0.18}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   GHOST FIELD — the fix. Public truths drift across the screen as faint,
   italic, floating "bodies." Each line gets its own size, vertical lane,
   speed, delay, and depth-blur so the background reads like a room full of
   half-heard confessions rather than a static list. Reused by the login
   overlay and the loading screen.
   ════════════════════════════════════════════════════════════════════════════ */

function GhostField({ lines, density = 1, opacity = 1 }) {
  /* Build a stable, varied lane assignment for each ghost so they don't stack.
     Memoized on the line content so they don't reshuffle every render. */
  const ghosts = useMemo(() => {
    const source = (lines && lines.length ? lines : FALLBACK_GHOSTS).slice(0, 10);
    return source.map((text, i) => {
      const lane = (i * 17 + 8) % 86; // vertical position, spread across height
      const sizeRem = 1 + ((i * 7) % 3) * 0.38; // three size tiers
      const duration = 30 + ((i * 11) % 7) * 5; // 30s–60s crossings
      const delay = -(i * 9) % 60; // negative delays so they're mid-flight at load
      const blur = ((i * 5) % 3) * 0.6; // 0, 0.6, 1.2px depth blur
      const baseOpacity = (0.05 + ((i * 3) % 3) * 0.02) * opacity;
      return { text, lane, sizeRem, duration, delay, blur, baseOpacity, key: i };
    });
  }, [lines, opacity]);

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
      {ghosts.map((g) => (
        <div
          key={g.key}
          className="mtp-ghost mtp-ghost-breathe"
          style={{
            top: `${g.lane}%`,
            fontSize: `${g.sizeRem * density}rem`,
            animationDuration: `${g.duration}s, ${g.duration}s`,
            animationDelay: `${g.delay}s, ${g.delay}s`,
            filter: g.blur ? `blur(${g.blur}px)` : "none",
            opacity: g.baseOpacity,
          }}
        >
          "{g.text}"
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   LOADING SCREEN — the wordmark holds while a single public truth surfaces,
   lingers, and sinks beneath it. The ghost field drifts behind. This is the
   "wording going / loading box in a ghostly body" the founder asked for.
   ════════════════════════════════════════════════════════════════════════════ */

function LoadingScreen() {
  const dbGhosts = usePublicGhosts(8);
  const ghosts = dbGhosts.length > 0 ? dbGhosts : FALLBACK_GHOSTS;
  const [idx, setIdx] = useState(0);

  // rotate the surfacing truth in time with the surface animation
  useEffect(() => {
    const t = setInterval(() => setIdx((n) => (n + 1) % ghosts.length), 5500);
    return () => clearInterval(t);
  }, [ghosts.length]);

  const surfacing = ghosts[idx % ghosts.length];

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6 relative overflow-hidden"
      style={{ background: `radial-gradient(900px 700px at 50% 110%, #1C1426 0%, ${C.bg} 62%)` }}
    >
      <GhostField lines={ghosts} density={0.95} opacity={0.85} />

      <div className="relative text-center px-8">
        <div
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: "clamp(2rem, 8vw, 2.8rem)",
            color: C.ink,
            opacity: 0.92,
            textShadow: `0 0 40px ${C.ember}33`,
          }}
        >
          My True<span style={{ color: C.ember }}> Post</span>
        </div>

        {/* the surfacing truth — a real one when we have it */}
        <div style={{ height: "3.4rem", marginTop: "1.1rem" }} className="flex items-center justify-center">
          <p
            key={idx}
            className="mtp-surface"
            style={{
              fontFamily: SERIF,
              fontStyle: "italic",
              color: C.dim,
              fontSize: "1.15rem",
              lineHeight: 1.3,
              maxWidth: "30rem",
              margin: 0,
            }}
          >
            "{surfacing}"
          </p>
        </div>

        <span
          style={{
            fontFamily: UI,
            fontWeight: 700,
            fontSize: "0.6rem",
            letterSpacing: "0.34em",
            color: C.faint,
          }}
        >
          GATHERING TRUTHS…
        </span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   LOGIN OVERLAY — the front door. Same card, same copy, same coral wordmark.
   The background is now the real GhostField: public truths floating as bodies.
   Sign-up validates name + age (18+); errors speak in the app's voice.
   ════════════════════════════════════════════════════════════════════════════ */

function LoginOverlay() {
  const dbGhosts = usePublicGhosts(8);
  const ghosts = dbGhosts.length > 0 ? dbGhosts : FALLBACK_GHOSTS;

  const [isLogin, setIsLogin] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const firstFieldRef = useRef(null);

  // when toggling between login/signup, move focus to the first relevant field
  useEffect(() => {
    const id = setTimeout(() => firstFieldRef.current?.focus(), 60);
    return () => clearTimeout(id);
  }, [isLogin]);

  const validate = () => {
    if (!email || !password) return "Email and password — then come in.";
    if (!isLogin) {
      if (!displayName.trim()) return "Tell us your name first.";
      const a = Number(age);
      if (!age) return "Add your age.";
      if (!Number.isInteger(a) || a < 18 || a > 120) return "Enter a real age (18–120).";
    }
    return "";
  };

  const submit = async () => {
    setError("");
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setBusy(true);
    try {
      if (isLogin) await signIn(email.trim(), password);
      else await signUp(email.trim(), password, displayName.trim(), age);
      // useAuthState lifts the user; this overlay unmounts on its own
    } catch (e) {
      setError(prettyAuthError(e.code) || e.message || "That didn't work. Try again.");
      setBusy(false);
    }
  };

  const inputStyle = {
    fontFamily: UI,
    fontSize: "0.9rem",
    color: C.ink,
    background: "rgba(245,239,230,0.04)",
    border: `1px solid ${C.line}`,
    borderRadius: "2px",
    padding: "13px 16px",
    outline: "none",
    width: "100%",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 overflow-hidden"
      style={{ background: `radial-gradient(900px 700px at 50% 110%, #1C1426 0%, ${C.bg} 60%)` }}
    >
      {/* ── the ghostly bodies, drifting ── */}
      <GhostField lines={ghosts} density={1} opacity={1} />

      <div className="w-full max-w-sm relative">
        <div className="text-center mb-9">
          <div
            style={{
              fontFamily: UI,
              fontWeight: 700,
              fontSize: "0.6rem",
              letterSpacing: "0.42em",
              color: C.dim,
              marginBottom: "1rem",
            }}
          >
            NO FILTERS · NO HIGHLIGHT REELS
          </div>
          <h1
            style={{
              fontFamily: SERIF,
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: "clamp(2.8rem, 11vw, 3.6rem)",
              lineHeight: 0.95,
              color: C.ink,
              margin: 0,
            }}
          >
            My True
            <br />
            <span style={{ color: C.ember, textShadow: `0 0 50px ${C.ember}55` }}>Post</span>
          </h1>
          <p
            className="mt-4"
            style={{ fontFamily: SERIF, fontStyle: "italic", color: C.dim, fontSize: "1.05rem" }}
          >
            Say the true thing. See who feels it.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {!isLogin && (
            <>
              <input
                ref={firstFieldRef}
                type="text"
                placeholder="Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={inputStyle}
                autoComplete="nickname"
              />
              <input
                type="number"
                min="18"
                max="120"
                placeholder="Age"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                style={inputStyle}
                autoComplete="off"
              />
            </>
          )}
          <input
            ref={isLogin ? firstFieldRef : null}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            autoComplete="email"
          />
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              style={{ ...inputStyle, paddingRight: "4.2rem" }}
              autoComplete={isLogin ? "current-password" : "new-password"}
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                fontFamily: UI,
                fontWeight: 700,
                fontSize: "0.6rem",
                letterSpacing: "0.12em",
                color: C.dim,
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? "HIDE" : "SHOW"}
            </button>
          </div>

          {error ? (
            <p style={{ fontFamily: UI, fontSize: "0.8rem", color: C.ember, margin: 0 }}>{error}</p>
          ) : null}

          <button
            onClick={submit}
            disabled={busy}
            className="mtp-cta"
            style={{
              fontFamily: UI,
              fontWeight: 700,
              fontSize: "0.78rem",
              letterSpacing: "0.2em",
              color: C.bg,
              background: C.ember,
              border: "none",
              borderRadius: "2px",
              padding: "14px",
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.7 : 1,
              boxShadow: `0 0 36px ${C.ember}40`,
              transition: "all 200ms ease",
            }}
          >
            {busy ? "…" : isLogin ? "COME IN" : "CREATE ACCOUNT"}
          </button>

          {!isLogin && (
            <p
              style={{
                fontFamily: UI,
                fontSize: "0.7rem",
                color: C.faint,
                textAlign: "center",
                margin: "0.2rem 0 0",
                lineHeight: 1.5,
              }}
            >
              Your first confession is on us. After that it's ${TRUTH_PRICE}.
            </p>
          )}
        </div>

        <p className="text-center mt-6" style={{ fontFamily: UI, fontSize: "0.82rem", color: C.dim }}>
          {isLogin ? "First time here?" : "Already confessing?"}{" "}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
            }}
            style={{
              color: C.lav,
              fontWeight: 700,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: UI,
              fontSize: "0.82rem",
            }}
          >
            {isLogin ? "Sign up" : "Log in"}
          </button>
        </p>
      </div>
    </div>
  );
}

function BuriedTruth({ post, me, connectState, onConnect, onReact, onViewConnects, index, noAnim = false }) {
  const [revealed, setRevealed] = useState(false);
  if (revealed) {
    return (
      <Truth
        post={post}
        index={index}
        me={me}
        connectState={connectState}
        onConnect={onConnect}
        onReact={onReact}
        onViewConnects={onViewConnects}
        noAnim={noAnim}
      />
    );
  }
  return (
    <div
      style={{
        borderBottom: `1px solid ${C.line}`,
        padding: "1rem 0",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
      }}
    >
      <span style={{ fontSize: "1rem", opacity: 0.5 }}>👎</span>
      <span style={{ fontFamily: SERIF, fontStyle: "italic", color: C.faint, fontSize: "0.95rem", flex: 1 }}>
        The community pushed this down ({post.nah} nah)
      </span>
      <button
        onClick={() => setRevealed(true)}
        style={{
          background: "none",
          border: `1px solid ${C.line}`,
          borderRadius: "1rem",
          padding: "0.25rem 0.75rem",
          fontSize: "0.78rem",
          color: C.faint,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        Show
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   TRUTH — a single confession in the feed. Same composition as V3: the giant
   ghost-quote mark, mood-tinted glow, author row, connect action, and the
   three reactions. Reaction logic is centralized through the helpers above so
   the "one reaction per user, persisted on the doc" rule lives in one place.
   ════════════════════════════════════════════════════════════════════════════ */

function Truth({ post, big = false, index = 0, me, connectState, onConnect, onReact, onViewConnects, noAnim = false, onSave, savedIds = [], onAuthorTap, onEcho, onShareCard }) {
  const m = moodOf(post.mood);
  const hue = hueFor(post.uid);
  const myUid = me?.uid;
  const isOwn = post.uid === myUid;
  const notify = useNotice();
  const isSaved = savedIds.includes(post.id);

  const voted = votedState(post, myUid);
  const [pending, setPending] = useState({});
  const [localVotes, setLocalVotes] = useState({});
  const glowing = hasGlow(post.message);

  // Optimistic voted state — local overrides win until Firestore confirms
  const effectiveVoted = { ...voted, ...localVotes };

  // Once Firestore reflects the change, clear local overrides
  useEffect(() => { setLocalVotes({}); }, [post.felt, post.same, post.brave, post.nah]);

  const countFor = (key) => {
    const base = post[key] || 0;
    if (!(key in localVotes)) return base;
    const flipped = localVotes[key] !== voted[key];
    return flipped ? (localVotes[key] ? base + 1 : base - 1) : base;
  };

  const fire = async (key) => {
    if (isOwn || pending[key]) return;
    const isUnvote = effectiveVoted[key];
    setLocalVotes((lv) => ({ ...lv, [key]: !isUnvote }));
    setPending((p) => ({ ...p, [key]: true }));
    try {
      await onReact(post.id, key);
      notify(
        isUnvote ? `Vote removed.` : `You marked this "${REACTION_META[key].label}."`,
        "neutral",
        1800
      );
    } catch (e) {
      console.warn("react failed:", e.message);
      setLocalVotes((lv) => ({ ...lv, [key]: isUnvote }));
      notify("That reaction didn't land. Try again.", "warn");
    } finally {
      setPending((p) => ({ ...p, [key]: false }));
    }
  };

  const connectLabel =
    connectState === "pending"
      ? "SENT ✓"
      : connectState === "accept"
      ? "IN CHAT ♥"
      : connectState === "decline"
      ? "PASSED"
      : "CONNECT";

  const total = reactionTotal(post);
  const connectCount = (post.connect || []).length;

  const [ctxMenu, setCtxMenu] = useState(null);
  const longPress = useLongPress((pos) => setCtxMenu(pos));

  return (
    <article
      className={noAnim ? "relative" : "mtp-rise relative"}
      style={{
        padding: big ? "2.5rem 0 2.75rem" : "2.25rem 0 2.5rem",
        borderBottom: `1px solid ${C.line}`,
        ...(noAnim ? {} : { animationDelay: `${Math.min(index, 2) * RISE_STAGGER_MS}ms` }),
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
      {...longPress}
    >
      {ctxMenu && (
        <TruthContextMenu
          pos={ctxMenu}
          post={post}
          onClose={() => setCtxMenu(null)}
          onSave={onSave}
          isSaved={isSaved}
          onEcho={!isOwn && onEcho ? () => { onEcho(post); setCtxMenu(null); } : null}
          onShareCard={onShareCard ? () => { onShareCard(post); setCtxMenu(null); } : null}
        />
      )}
      {/* mood glow */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          inset: "-10% -20%",
          background: `radial-gradient(55% 65% at ${big ? "50%" : "18%"} 38%, ${m.color}${
            glowing ? (big ? "40" : "30") : big ? "1c" : "12"
          }, transparent 70%)`,
          filter: "none",
        }}
      />
      {/* oversized opening quote */}
      <div
        aria-hidden
        className="absolute select-none pointer-events-none"
        style={{
          fontFamily: SERIF,
          fontStyle: "italic",
          fontSize: big ? "9rem" : "6.5rem",
          lineHeight: 1,
          color: m.color,
          opacity: 0.14,
          top: big ? "0.5rem" : "0.9rem",
          left: "-0.5rem",
        }}
      >
        "
      </div>

      <div className="relative">
        {big && (
          <div className="mb-4">
            <Eyebrow color={m.color}>{loudestLabel()}</Eyebrow>
          </div>
        )}

        <p
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: big
              ? "clamp(1.9rem, 6vw, 2.6rem)"
              : "clamp(1.4rem, 4.5vw, 1.7rem)",
            lineHeight: 1.28,
            color: glowing ? "#FFFFFF" : C.ink,
            letterSpacing: "-0.01em",
            textShadow: glowing
              ? `0 0 10px rgba(255,255,255,0.95), 0 0 28px rgba(255,255,255,0.6), 0 0 60px ${m.color}55`
              : `0 0 60px ${m.color}26`,
            margin: 0,
          }}
        >
          {post.message}
        </p>

        <div className="flex items-center gap-3 mt-6 flex-wrap">
          <Avatar name={post.displayName} hue={hue} photoURL={post.photoURL} />
          <div className="flex-1 min-w-0">
            <button
              onClick={() => !isOwn && onAuthorTap?.(post)}
              style={{
                fontFamily: UI,
                fontWeight: 600,
                fontSize: "0.86rem",
                color: C.ink,
                background: "none",
                border: "none",
                padding: 0,
                cursor: !isOwn && onAuthorTap ? "pointer" : "default",
                textAlign: "left",
              }}
            >
              {post.displayName}
              {post.age ? `, ${post.age}` : ""}
              {isOwn && <OwnPostChip />}
            </button>
            <div
              style={{
                fontFamily: UI,
                fontSize: "0.7rem",
                color: C.dim,
                letterSpacing: "0.06em",
              }}
            >
              {timeAgo(post.createdAt)} · <Mood mood={post.mood} />
              <FreshBadge createdAt={post.createdAt} />
              {big && total > 0 && (
                <span style={{ color: C.faint }}> · {total} felt it</span>
              )}
            </div>
          </div>

          {onSave && (
            <SaveButton
              saved={isSaved}
              onToggle={() => {
                onSave(post);
                notify(isSaved ? "Removed from saved." : "Saved.", "neutral", 1400);
              }}
            />
          )}

          {!isOwn && (
            <button
              onClick={() => { if (navigator.vibrate) navigator.vibrate(8); onConnect(); }}
              disabled={!!connectState}
              className="mtp-connect mtp-focusable"
              style={{
                fontFamily: UI,
                fontWeight: 700,
                fontSize: "0.74rem",
                letterSpacing: "0.1em",
                color: connectState ? C.bg : C.ember,
                background: connectState ? C.ember : "transparent",
                border: `1px solid ${C.ember}66`,
                borderRadius: "999px",
                padding: "7px 16px",
                cursor: connectState ? "default" : "pointer",
                transition: "all 180ms ease",
              }}
            >
              {connectLabel}
            </button>
          )}

          {isOwn && connectCount > 0 && (
            <button
              onClick={onViewConnects}
              className="mtp-focusable"
              style={{
                fontFamily: UI,
                fontWeight: 700,
                fontSize: "0.74rem",
                letterSpacing: "0.1em",
                color: C.lav,
                background: "transparent",
                border: `1px solid ${C.lav}66`,
                borderRadius: "999px",
                padding: "7px 16px",
                cursor: "pointer",
                transition: "all 180ms ease",
              }}
            >
              {connectCount} CONNECTED
            </button>
          )}
        </div>

        <div className="flex gap-6 mt-4 items-center">
          {REACTION_KEYS.map((key) => (
            <Rx
              key={key}
              label={REACTION_META[key].label}
              icon={REACTION_META[key].icon}
              activeIcon={REACTION_META[key].activeIcon}
              count={countFor(key)}
              color={REACTION_META[key].color}
              active={effectiveVoted[key]}
              onClick={() => fire(key)}
              readOnly={isOwn}
            />
          ))}
          <div
            style={{
              width: 1,
              height: "1rem",
              background: C.line,
              flexShrink: 0,
            }}
            aria-hidden
          />
          <Rx
            label="Nah"
            icon={REACTION_META.nah.icon}
            activeIcon={REACTION_META.nah.activeIcon}
            count={countFor("nah")}
            color={REACTION_META.nah.color}
            active={effectiveVoted.nah}
            onClick={() => fire("nah")}
            readOnly={isOwn}
          />
        </div>
      </div>
    </article>
  );
}

function TruthSkeleton({ big = false }) {
  return (
    <article
      aria-hidden
      className="relative"
      style={{
        padding: big ? "2.5rem 0 2.75rem" : "2.25rem 0 2.5rem",
        borderBottom: `1px solid ${C.line}`,
      }}
    >
      <div className="relative">
        {big && (
          <div className="mtp-skel" style={{ width: "4.5rem", height: "0.65rem", marginBottom: "1.1rem" }} />
        )}
        <div className="mtp-skel" style={{ width: "92%", height: big ? "2.2rem" : "1.6rem", marginBottom: "0.7rem" }} />
        <div className="mtp-skel" style={{ width: "78%", height: big ? "2.2rem" : "1.6rem", marginBottom: "0.7rem" }} />
        <div className="mtp-skel" style={{ width: "52%", height: big ? "2.2rem" : "1.6rem" }} />
        <div className="flex items-center gap-3 mt-6 flex-wrap">
          <div className="mtp-skel shrink-0" style={{ width: 34, height: 34, borderRadius: "50%" }} />
          <div className="flex-1 min-w-0">
            <div className="mtp-skel" style={{ width: "7rem", height: "0.75rem", marginBottom: "0.38rem" }} />
            <div className="mtp-skel" style={{ width: "4.5rem", height: "0.6rem" }} />
          </div>
          <div className="mtp-skel" style={{ width: "5.5rem", height: "2rem", borderRadius: "999px" }} />
        </div>
        <div className="flex gap-6 mt-4 items-center">
          <div className="mtp-skel" style={{ width: "2.4rem", height: "0.9rem" }} />
          <div className="mtp-skel" style={{ width: "2.4rem", height: "0.9rem" }} />
          <div className="mtp-skel" style={{ width: "2.4rem", height: "0.9rem" }} />
          <div style={{ width: 1, height: "1rem", background: C.line, flexShrink: 0 }} aria-hidden />
          <div className="mtp-skel" style={{ width: "2.4rem", height: "0.9rem" }} />
        </div>
      </div>
    </article>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   COMPOSER — the act of telling. Collapsed, it's a provocation. Open, it's a
   serif writing surface with mood selection and a live character meter that
   guides toward a tight, postable truth without ever blocking a long one.
   The submit copy reflects whether this one is free or paid.
   ════════════════════════════════════════════════════════════════════════════ */

const DRAFT_KEY = "mtp-draft";

function Composer({ onSubmit, freePost = false, forceOpen = false, onOpened, onOpenBooth, draftCount = 0, onOpenDrafts, challenge, onAcceptChallenge }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [mood, setMood] = useState("raw");
  const [hasDraft, setHasDraft] = useState(false);
  const [prompt] = useState(() => randomPrompt());
  const textRef = useRef(null);

  // Restore draft when opening
  useEffect(() => {
    if (open) {
      try {
        const saved = localStorage.getItem(DRAFT_KEY);
        if (saved) {
          const { text: t, mood: m } = JSON.parse(saved);
          if (t) { setText(t); setMood(m || "raw"); setHasDraft(true); }
        }
      } catch {}
    }
  }, [open]);

  // Save draft as user types
  useEffect(() => {
    if (!open) return;
    if (text.trim()) {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ text, mood })); } catch {}
    } else {
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      setHasDraft(false);
    }
  }, [text, mood, open]);

  // Allow parent to imperatively open the composer (keyboard shortcut)
  useEffect(() => {
    if (forceOpen && !open) { setOpen(true); onOpened?.(); }
  }, [forceOpen]); // eslint-disable-line

  const trimmed = text.trim();
  const len = trimmed.length;
  const overSoft = len > TRUTH_SOFT_LIMIT;
  const atHard = len >= TRUTH_HARD_LIMIT;
  const canPost = len > 0 && !atHard;

  const postColor = freePost ? C.teal : C.ember;

  const clearDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setHasDraft(false);
  };

  const submit = () => {
    if (!canPost) return;
    clearDraft();
    onSubmit(trimmed, mood);
    setText("");
    setOpen(false);
    setMood("raw");
  };

  const close = () => {
    setOpen(false);
    // keep text in localStorage so draft survives — don't clear
    setText("");
  };

  useEscape(open, close);

  // soft auto-grow for the textarea
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [text, open]);

  if (!open) {
    return (
      <div style={{ borderBottom: `1px solid ${C.line}` }}>
        <button
          onClick={() => setOpen(true)}
          className="w-full text-left mtp-focusable"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "2.2rem 0 1.2rem",
          }}
        >
          <span
            style={{
              fontFamily: SERIF,
              fontStyle: "italic",
              fontSize: "clamp(1.3rem, 4vw, 1.6rem)",
              color: C.faint,
            }}
          >
            {prompt}
          </span>
          <div className="flex items-center gap-3 mt-2">
            <span
              style={{
                fontFamily: UI,
                fontWeight: 700,
                fontSize: "0.66rem",
                letterSpacing: "0.25em",
                color: C.ember,
              }}
            >
              TAP TO TELL IT →
            </span>
            {freePost && (
              <span
                style={{
                  fontFamily: UI,
                  fontWeight: 700,
                  fontSize: "0.62rem",
                  letterSpacing: "0.18em",
                  color: C.teal,
                }}
              >
                1 FREE CONFESS
              </span>
            )}
          </div>
        </button>

        {/* challenge widget + booth/drafts shortcuts */}
        {challenge && (
          <ChallengeWidget challenge={challenge} onAccept={() => onAcceptChallenge?.(challenge.prompt)} />
        )}

        <div className="flex items-center gap-3 pb-3 flex-wrap">
          {onOpenBooth && (
            <button
              onClick={onOpenBooth}
              style={{
                fontFamily: UI,
                fontWeight: 700,
                fontSize: "0.6rem",
                letterSpacing: "0.16em",
                color: C.lav,
                background: `${C.lav}14`,
                border: `1px solid ${C.lav}44`,
                borderRadius: "999px",
                padding: "4px 12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
              }}
            >
              ◈ CONFESSION BOOTH
            </button>
          )}
          {onOpenDrafts && draftCount > 0 && (
            <button
              onClick={onOpenDrafts}
              style={{
                fontFamily: UI,
                fontWeight: 700,
                fontSize: "0.6rem",
                letterSpacing: "0.16em",
                color: C.faint,
                background: "transparent",
                border: `1px solid ${C.line}`,
                borderRadius: "999px",
                padding: "4px 12px",
                cursor: "pointer",
              }}
            >
              {draftCount} DRAFT{draftCount !== 1 ? "S" : ""}
            </button>
          )}
        </div>
      </div>
    );
  }

  const meterColor = atHard ? C.ember : overSoft ? C.amber : C.faint;

  return (
    <div style={{ padding: "2rem 0 2.2rem", borderBottom: `1px solid ${C.line}` }}>
      <div className="mb-3 flex items-center gap-4 flex-wrap">
        <Eyebrow>{prompt.toUpperCase()}</Eyebrow>
        {freePost && (
          <span
            style={{
              fontFamily: UI,
              fontWeight: 700,
              fontSize: "0.62rem",
              letterSpacing: "0.18em",
              color: C.teal,
            }}
          >
            FREE CONFESS
          </span>
        )}
      </div>

      <textarea
        ref={textRef}
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, TRUTH_HARD_LIMIT))}
        rows={3}
        placeholder="Write it like no one follows you…"
        className="w-full resize-none outline-none mtp-scroll"
        style={{
          fontFamily: SERIF,
          fontStyle: "italic",
          fontSize: "clamp(1.5rem, 5vw, 1.9rem)",
          lineHeight: 1.3,
          color: C.ink,
          background: "transparent",
          border: "none",
          caretColor: postColor,
          overflow: "hidden",
        }}
      />

      {/* mood hint + character meter */}
      <div className="flex items-center justify-between mt-1" style={{ minHeight: "1.1rem" }}>
        <span style={{ fontFamily: UI, fontSize: "0.66rem", color: C.faint, letterSpacing: "0.04em" }}>
          {moodOf(mood).hint}
        </span>
        <span style={{ fontFamily: UI, fontSize: "0.66rem", color: meterColor, letterSpacing: "0.06em" }}>
          {len}
          {overSoft ? ` / ${TRUTH_HARD_LIMIT}` : ""}
        </span>
      </div>

      <TruthLengthBar length={len} />

      <div className="flex items-center justify-between flex-wrap gap-3 mt-4">
        <div className="flex gap-4">
          {MOOD_ORDER.map((k) => {
            const mm = MOODS[k];
            return (
              <button
                key={k}
                onClick={() => setMood(k)}
                className="mtp-focusable"
                aria-pressed={mood === k}
                style={{
                  fontFamily: UI,
                  fontWeight: 700,
                  fontSize: "0.62rem",
                  letterSpacing: "0.2em",
                  padding: "4px 0",
                  color: mood === k ? mm.color : C.faint,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  borderBottom: `1px solid ${mood === k ? mm.color : "transparent"}`,
                  transition: "all 160ms ease",
                }}
              >
                {mm.label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-3 items-center">
          <button
            onClick={close}
            style={{
              fontFamily: UI,
              fontSize: "0.74rem",
              color: C.dim,
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            Not tonight
          </button>
          <button
            onClick={submit}
            disabled={!canPost}
            style={{
              fontFamily: UI,
              fontWeight: 700,
              fontSize: "0.74rem",
              letterSpacing: "0.12em",
              color: canPost ? C.bg : C.faint,
              background: canPost ? postColor : "transparent",
              border: `1px solid ${canPost ? postColor : C.line}`,
              borderRadius: "999px",
              padding: "8px 18px",
              cursor: canPost ? "pointer" : "default",
              transition: "all 180ms ease",
            }}
          >
            {freePost ? "POST FREE" : `POST · $${TRUTH_PRICE}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   INBOX — three sections: people who felt your truth (incoming connects),
   live conversations, and the truths you reached out on. Each row reads the
   live chat doc so unread counts and last messages never go stale against a
   cached conversations list.
   ════════════════════════════════════════════════════════════════════════════ */

function ChatCardMenu({ feedId, chatId, myUid, otherUid }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const menuRef = useRef(null);
  const notify = useNotice();

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!menuRef.current?.contains(e.target)) {
        setOpen(false);
        setConfirming(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirming) { setConfirming(true); return; }
    setOpen(false);
    setConfirming(false);
    try {
      await deleteChat(feedId, chatId, myUid);
      notify("Chat deleted.", "neutral");
    } catch {
      notify("Couldn't delete. Try again.", "warn");
    }
  };

  const handleReport = async (e) => {
    e.stopPropagation();
    setOpen(false);
    try {
      await reportChat(feedId, chatId, myUid, otherUid);
      notify("Reported. We'll look into it.", "neutral");
    } catch {
      notify("Couldn't send report. Try again.", "warn");
    }
  };

  const handleBlock = async (e) => {
    e.stopPropagation();
    setOpen(false);
    try {
      await blockUser(feedId, chatId, myUid, otherUid);
      notify("User blocked.", "neutral");
    } catch {
      notify("Couldn't block. Try again.", "warn");
    }
  };

  const itemStyle = (color) => ({
    display: "block",
    width: "100%",
    textAlign: "left",
    background: "none",
    border: "none",
    borderBottom: `1px solid ${C.line}`,
    cursor: "pointer",
    fontFamily: UI,
    fontWeight: 600,
    fontSize: "0.84rem",
    color,
    padding: "12px 16px",
  });

  return (
    <div
      ref={menuRef}
      style={{ position: "relative", flexShrink: 0 }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); setConfirming(false); }}
        aria-label="Chat options"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: C.dim,
          fontFamily: UI,
          fontWeight: 700,
          fontSize: "1.1rem",
          padding: "4px 8px",
          borderRadius: "6px",
          lineHeight: 1,
          letterSpacing: "0.06em",
        }}
      >
        •••
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            background: "rgba(20,17,26,0.97)",
            border: `1px solid ${C.lineStrong}`,
            borderRadius: "12px",
            overflow: "hidden",
            minWidth: "160px",
            zIndex: 99,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}
        >
          <button onClick={handleDelete} style={itemStyle(confirming ? C.ember : C.ink)}>
            {confirming ? "Confirm delete?" : "Delete Chat"}
          </button>
          <button onClick={handleReport} style={itemStyle(C.ink)}>Report</button>
          <button onClick={handleBlock} style={{ ...itemStyle(C.rose), borderBottom: "none" }}>Block</button>
        </div>
      )}
    </div>
  );
}

function ConnectRequest({ feed, connector, onAccept, onPass, onOpenChat, unread = 0, lastMessage = null, myUid = null }) {
  const hue = hueFor(connector.uid);
  const accepted = connector.flag === "accept";
  const clickable = accepted && !!onOpenChat;
  return (
    <div
      className="mtp-rise"
      onClick={clickable ? onOpenChat : undefined}
      style={{
        padding: "1.8rem 0",
        borderBottom: `1px solid ${C.line}`,
        cursor: clickable ? "pointer" : "default",
      }}
    >
      <div className="flex items-center gap-3">
        <Avatar name={connector.displayName} hue={hue} size={42} photoURL={connector.photoURL} />
        <div className="flex-1 min-w-0">
          <div style={{ fontFamily: UI, fontWeight: 600, fontSize: "0.92rem", color: C.ink }}>
            {connector.displayName}
            {connector.age ? `, ${connector.age}` : ""}
          </div>
          <div
            style={{
              fontFamily: UI,
              fontSize: "0.7rem",
              color: accepted ? C.teal : C.dim,
              letterSpacing: "0.06em",
            }}
          >
            {accepted ? "chatting with you ♥" : "felt your truth enough to reach out"}
          </div>
        </div>
        {accepted && <UnreadBadge count={unread} />}
        {accepted && !unread && (
          <span
            style={{
              fontFamily: UI,
              fontWeight: 700,
              fontSize: "0.62rem",
              letterSpacing: "0.14em",
              color: C.teal,
            }}
          >
            ACCEPTED
          </span>
        )}
        {clickable && <ChatCardMenu feedId={feed.id} chatId={connector.uid} myUid={myUid} otherUid={connector.uid} />}
      </div>

      <div className="mt-3">
        <QuotedTruth truth={{ text: feed.message, mood: feed.mood }} compact />
      </div>

      {accepted && lastMessage && (
        <p
          className="truncate"
          style={{
            fontFamily: UI,
            fontSize: "0.8rem",
            color: unread > 0 ? C.ink : C.dim,
            fontWeight: unread > 0 ? 600 : 400,
            margin: "0.5rem 0 0",
          }}
        >
          {lastMessage.senderUid === myUid ? "You: " : ""}
          {lastMessage.text}
        </p>
      )}

      {!accepted && (
        <div className="flex gap-3 mt-4">
          <button
            onClick={(e) => { e.stopPropagation(); onAccept(); }}
            className="mtp-focusable"
            style={{
              fontFamily: UI,
              fontWeight: 700,
              fontSize: "0.72rem",
              letterSpacing: "0.12em",
              color: C.bg,
              background: C.ember,
              border: `1px solid ${C.ember}`,
              borderRadius: "999px",
              padding: "8px 20px",
              cursor: "pointer",
            }}
          >
            ACCEPT & CHAT
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onPass(); }}
            className="mtp-soft mtp-focusable"
            style={{
              fontFamily: UI,
              fontWeight: 500,
              fontSize: "0.72rem",
              letterSpacing: "0.08em",
              color: C.dim,
              background: "none",
              border: `1px solid ${C.line}`,
              borderRadius: "999px",
              padding: "8px 18px",
              cursor: "pointer",
            }}
          >
            Quietly pass
          </button>
        </div>
      )}
    </div>
  );
}

function SentConnect({ feed, myUid, onOpenChat, unread = 0, lastMessage = null }) {
  const mine = (feed.connect || []).find((c) => c.uid === myUid);
  const accepted = mine?.flag === "accept";
  const declined = mine?.flag === "decline";
  const clickable = accepted && !!onOpenChat;
  return (
    <div
      onClick={clickable ? onOpenChat : undefined}
      style={{
        padding: "1.1rem 0",
        borderBottom: `1px solid ${C.line}`,
        cursor: clickable ? "pointer" : "default",
      }}
    >
      <div className="flex items-center gap-3">
        <Avatar name={feed.displayName} hue={hueFor(feed.uid)} photoURL={feed.photoURL} />
        <div className="flex-1 min-w-0">
          <div style={{ fontFamily: UI, fontWeight: 600, fontSize: "0.86rem", color: C.ink }}>
            {feed.displayName}
            {feed.age ? `, ${feed.age}` : ""}
          </div>
          <p
            className="truncate"
            style={{
              fontFamily: SERIF,
              fontStyle: "italic",
              fontSize: "0.85rem",
              color: C.dim,
              margin: 0,
            }}
          >
            "{feed.message}"
          </p>
        </div>
        <span
          style={{
            fontFamily: UI,
            fontWeight: 700,
            fontSize: "0.62rem",
            letterSpacing: "0.14em",
            color: accepted ? C.teal : C.faint,
            flexShrink: 0,
          }}
        >
          {accepted ? "ACCEPTED ♥" : declined ? "PASSED" : "WAITING…"}
        </span>
        {accepted && <UnreadBadge count={unread} />}
        {clickable && <ChatCardMenu feedId={feed.id} chatId={myUid} myUid={myUid} otherUid={feed.uid} />}
      </div>

      {accepted && lastMessage && (
        <p
          className="truncate"
          style={{
            fontFamily: UI,
            fontSize: "0.8rem",
            color: unread > 0 ? C.ink : C.dim,
            fontWeight: unread > 0 ? 600 : 400,
            margin: "0.5rem 0 0",
          }}
        >
          {lastMessage.senderUid === myUid ? "You: " : ""}
          {lastMessage.text}
        </p>
      )}
    </div>
  );
}

/* Conversation row that reads its own live unread count off the chat doc. */
function ChatRowLive({ chat, myUid, onOpen }) {
  const liveDoc = useChatDoc(chat.feedId, chat.id);
  const unread = (liveDoc ?? chat)?.[`unreadCounts.${myUid}`] || 0;
  return <ChatRow chat={chat} myUid={myUid} onOpen={onOpen} unread={unread} />;
}

function ChatRow({ chat, myUid, onOpen, unread = 0 }) {
  const other = chat.author?.uid === myUid ? chat.connector : chat.author;
  const last = chat.lastMessage;
  return (
    <div
      onClick={onOpen}
      className="flex items-center gap-3"
      style={{
        cursor: "pointer",
        padding: "1.2rem 0",
        borderBottom: `1px solid ${C.line}`,
      }}
    >
      <Avatar name={other?.displayName} hue={hueFor(other?.uid)} size={42} photoURL={other?.photoURL} />
      <div className="flex-1 min-w-0">
        <div style={{ fontFamily: UI, fontWeight: 600, fontSize: "0.92rem", color: C.ink }}>
          {other?.displayName}
          {other?.age ? `, ${other.age}` : ""}
        </div>
        <p
          className="truncate"
          style={{
            fontFamily: UI,
            fontSize: "0.8rem",
            color: unread > 0 ? C.ink : C.dim,
            fontWeight: unread > 0 ? 600 : 400,
            margin: "2px 0 0",
          }}
        >
          {last ? (last.senderUid === myUid ? "You: " : "") + last.text : "Say the first true thing."}
        </p>
      </div>
      {unread > 0 && (
        <span
          style={{
            background: C.ember,
            color: C.bg,
            fontFamily: UI,
            fontWeight: 700,
            fontSize: "0.6rem",
            borderRadius: "999px",
            padding: "2px 7px",
            flexShrink: 0,
          }}
        >
          {unread}
        </span>
      )}
      <ChatCardMenu feedId={chat.feedId} chatId={chat.id} myUid={myUid} otherUid={other?.uid} />
    </div>
  );
}

/* Incoming-connect row: resolves the live chat doc, falls back to a synthesized
   chat object so OPEN CHAT works the instant a connect is accepted. */
function ConnectRequestRow({ feed, connector, myUid, conversations, onAccept, onPass, onOpenChat }) {
  const liveDoc = useChatDoc(feed.id, connector.uid);
  const chat =
    conversations.find(
      (ch) => ch.feedId === feed.id && ch.participants?.includes(connector.uid)
    ) ??
    liveDoc ?? {
      id: connector.uid,
      feedId: feed.id,
      participants: [feed.uid, connector.uid],
      author: {
        uid: feed.uid,
        displayName: feed.displayName,
        age: feed.age ?? null,
        photoURL: feed.photoURL ?? null,
      },
      connector: {
        uid: connector.uid,
        displayName: connector.displayName,
        age: connector.age ?? null,
        photoURL: connector.photoURL ?? null,
      },
      truth: { text: feed.message, mood: feed.mood },
      lastMessage: null,
    };
  // always prefer liveDoc for unread so the conversations cache never hides a fresh count
  const liveOrChat = liveDoc ?? chat;
  const unread = liveOrChat?.[`unreadCounts.${myUid}`] || 0;
  const lastMessage = liveOrChat.lastMessage ?? null;
  return (
    <ConnectRequest
      feed={feed}
      connector={connector}
      myUid={myUid}
      onAccept={() => onAccept(feed, connector)}
      onPass={() => onPass(feed, connector)}
      onOpenChat={connector.flag === "accept" ? () => onOpenChat(chat) : null}
      unread={unread}
      lastMessage={lastMessage}
    />
  );
}

/* Outgoing-connect row: same live-doc resolution from the reacher's side. */
function SentConnectRow({ feed, myUid, conversations, onOpenChat }) {
  const mine = (feed.connect || []).find((c) => c.uid === myUid);
  const liveDoc = useChatDoc(feed.id, myUid);
  const chat =
    conversations.find(
      (ch) => ch.feedId === feed.id && ch.participants?.includes(myUid)
    ) ??
    liveDoc ?? {
      id: myUid,
      feedId: feed.id,
      participants: [feed.uid, myUid],
      author: {
        uid: feed.uid,
        displayName: feed.displayName,
        age: feed.age ?? null,
        photoURL: feed.photoURL ?? null,
      },
      connector: {
        uid: myUid,
        displayName: mine?.displayName ?? null,
        age: mine?.age ?? null,
        photoURL: mine?.photoURL ?? null,
      },
      truth: { text: feed.message, mood: feed.mood },
      lastMessage: null,
    };
  const liveOrChat = liveDoc ?? chat;
  const unread = liveOrChat?.[`unreadCounts.${myUid}`] || 0;
  const lastMessage = liveOrChat.lastMessage ?? null;
  return (
    <SentConnect
      feed={feed}
      myUid={myUid}
      onOpenChat={mine?.flag === "accept" ? () => onOpenChat(chat) : null}
      unread={unread}
      lastMessage={lastMessage}
    />
  );
}

/* ── InboxSearch: real-time filter bar shown above inbox content ────────── */
function InboxSearch({ value, onChange, onClear, count }) {
  const inputRef = useRef(null);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.75rem 1.4rem",
        borderBottom: `1px solid ${C.line}`,
      }}
    >
      <span style={{ color: C.faint, fontSize: "0.85rem" }}>⌕</span>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search conversations…"
        style={{
          flex: 1,
          fontFamily: UI,
          fontSize: "0.85rem",
          color: C.ink,
          background: "transparent",
          border: "none",
          outline: "none",
          caretColor: C.ember,
        }}
      />
      {value && (
        <button
          onClick={onClear}
          style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.7rem", color: C.faint, background: "none", border: "none", cursor: "pointer" }}
        >
          ✕
        </button>
      )}
      {count !== undefined && (
        <span style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.58rem", letterSpacing: "0.14em", color: C.dim }}>
          {count}
        </span>
      )}
    </div>
  );
}

/* ── InboxFilterPills: tab-like filter buttons for inbox views ───────────── */
function InboxFilterPills({ active, onChange, counts }) {
  const options = [
    { key: "all",     label: "ALL" },
    { key: "pending", label: "PENDING" },
    { key: "chats",   label: "CHATS" },
    { key: "sent",    label: "SENT" },
  ];
  return (
    <div
      style={{
        display: "flex",
        borderBottom: `1px solid ${C.line}`,
        overflowX: "auto",
        padding: "0 1rem",
      }}
    >
      {options.map((o) => {
        const isActive = active === o.key;
        const cnt = counts?.[o.key];
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            style={{
              fontFamily: UI,
              fontWeight: 700,
              fontSize: "0.58rem",
              letterSpacing: "0.16em",
              color: isActive ? C.ember : C.faint,
              background: "none",
              border: "none",
              borderBottom: `2px solid ${isActive ? C.ember : "transparent"}`,
              cursor: "pointer",
              padding: "0.75rem 0.9rem",
              whiteSpace: "nowrap",
              transition: "all 140ms ease",
              marginBottom: "-1px",
            }}
          >
            {o.label}{cnt != null && cnt > 0 ? ` · ${cnt}` : ""}
          </button>
        );
      })}
    </div>
  );
}

function InboxTab({ myFeeds, reachedOutFeeds, conversations, myUid, onAccept, onPass, onOpenChat }) {
  const [inboxFilter, setInboxFilter] = useState("all");
  const [inboxQuery, setInboxQuery] = useState("");

  const incoming = [];
  myFeeds.forEach((feed) =>
    (feed.connect || [])
      .filter((c) => c.flag === "pending" || c.flag === "accept")
      .forEach((connector) => incoming.push({ feed, connector }))
  );

  const pendingItems  = incoming.filter((it) => it.connector.flag === "pending");
  const acceptedItems = incoming.filter((it) => it.connector.flag === "accept");

  // apply text search to conversations
  const filteredConversations = useMemo(() => {
    if (!inboxQuery) return conversations;
    const q = inboxQuery.toLowerCase();
    return conversations.filter((ch) => {
      const other = ch.author?.uid === myUid ? ch.connector : ch.author;
      return (
        (other?.displayName || "").toLowerCase().includes(q) ||
        (ch.truth?.text || "").toLowerCase().includes(q)
      );
    });
  }, [conversations, inboxQuery, myUid]);

  const filteredPending = useMemo(() => {
    if (!inboxQuery) return pendingItems;
    const q = inboxQuery.toLowerCase();
    return pendingItems.filter(({ feed, connector }) =>
      (connector.displayName || "").toLowerCase().includes(q) ||
      (feed.message || "").toLowerCase().includes(q)
    );
  }, [pendingItems, inboxQuery]);

  const filteredSent = useMemo(() => {
    if (!inboxQuery) return reachedOutFeeds;
    const q = inboxQuery.toLowerCase();
    return reachedOutFeeds.filter((f) => (f.message || "").toLowerCase().includes(q));
  }, [reachedOutFeeds, inboxQuery]);

  const counts = {
    all:     pendingItems.length + conversations.length + reachedOutFeeds.length,
    pending: pendingItems.length,
    chats:   conversations.length,
    sent:    reachedOutFeeds.length,
  };

  const showPending      = (inboxFilter === "all" || inboxFilter === "pending");
  const showConversations = (inboxFilter === "all" || inboxFilter === "chats");
  const showSent         = (inboxFilter === "all" || inboxFilter === "sent");

  const visiblePending = showPending ? filteredPending : [];
  const visibleChats   = showConversations ? filteredConversations : [];
  const visibleSent    = showSent ? filteredSent : [];

  const empty = visiblePending.length === 0 && visibleChats.length === 0 && visibleSent.length === 0;

  return (
    <div>
      <InboxFilterPills active={inboxFilter} onChange={setInboxFilter} counts={counts} />
      {counts.all > 3 && (
        <InboxSearch
          value={inboxQuery}
          onChange={setInboxQuery}
          onClear={() => setInboxQuery("")}
          count={inboxQuery ? (visiblePending.length + visibleChats.length + visibleSent.length) : undefined}
        />
      )}
      <div className="pt-2">
      {empty && (
        <div className="text-center pt-24">
          <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "1.5rem", color: C.ink }}>
            {inboxQuery ? "No matches found." : "Nothing yet. Post a truth worth feeling."}
          </p>
          <p
            className="mt-3"
            style={{ fontFamily: UI, fontSize: "0.82rem", color: C.dim, letterSpacing: "0.02em" }}
          >
            {inboxQuery ? "Try a different name or phrase." : "When someone reaches out, they'll land here first."}
          </p>
        </div>
      )}

      {visiblePending.length > 0 && (
        <section className="pt-6">
          <Eyebrow color={C.ember}>THEY FELT YOUR TRUTH · {visiblePending.length}</Eyebrow>
          {visiblePending.map(({ feed, connector }) => (
            <ConnectRequestRow
              key={feed.id + connector.uid}
              feed={feed}
              connector={connector}
              myUid={myUid}
              conversations={conversations}
              onAccept={onAccept}
              onPass={onPass}
              onOpenChat={onOpenChat}
            />
          ))}
        </section>
      )}

      {acceptedItems.length > 0 && inboxFilter !== "pending" && (
        <section className="pt-6">
          <Eyebrow color={C.teal}>ACCEPTED · {acceptedItems.length}</Eyebrow>
          {acceptedItems.map(({ feed, connector }) => (
            <ConnectRequestRow
              key={feed.id + connector.uid + "a"}
              feed={feed}
              connector={connector}
              myUid={myUid}
              conversations={conversations}
              onAccept={onAccept}
              onPass={onPass}
              onOpenChat={onOpenChat}
            />
          ))}
        </section>
      )}

      {visibleChats.length > 0 && (
        <section className="pt-8">
          <Eyebrow>CONVERSATIONS · {visibleChats.length}</Eyebrow>
          {visibleChats.map((ch) => (
            <ChatRowLive key={ch.feedId + ch.id} chat={ch} myUid={myUid} onOpen={() => onOpenChat(ch)} />
          ))}
        </section>
      )}

      {visibleSent.length > 0 && (
        <section className="pt-8">
          <Eyebrow>YOU REACHED OUT · {visibleSent.length}</Eyebrow>
          {visibleSent.map((feed) => (
            <SentConnectRow
              key={feed.id}
              feed={feed}
              myUid={myUid}
              conversations={conversations}
              onOpenChat={onOpenChat}
            />
          ))}
        </section>
      )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   CHAT SCREEN — a private 1-on-1 anchored to the truth that started it. The
   originating confession is pinned at the top so the conversation never loses
   its reason. Read receipts use the live chat doc's lastReadAt with a sensible
   "they replied after, so they've read it" fallback. Esc returns to the inbox.
   ════════════════════════════════════════════════════════════════════════════ */

function MessageReactionBar({ msg, mine, onReact }) {
  const [open, setOpen] = useState(false);
  const QUICK_REACTS = ["♥", "🔥", "🙌", "😂", "✦"];
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: C.faint,
          fontSize: "0.65rem",
          padding: "2px 4px",
          opacity: 0.55,
          transition: "opacity 140ms ease",
        }}
        aria-label="React to message"
      >
        ···
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "120%",
            [mine ? "right" : "left"]: 0,
            display: "flex",
            gap: "0.3rem",
            background: "rgba(22,16,28,0.97)",
            backdropFilter: "blur(16px)",
            border: `1px solid ${C.lineStrong}`,
            borderRadius: "999px",
            padding: "5px 10px",
            zIndex: 10,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            animation: `mtpCtxIn 120ms ease both`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {QUICK_REACTS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => { onReact?.(msg.id, emoji); setOpen(false); }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "1.15rem",
                lineHeight: 1,
                padding: "2px",
                transition: "transform 120ms ease",
              }}
              onMouseEnter={(e) => { e.target.style.transform = "scale(1.3)"; }}
              onMouseLeave={(e) => { e.target.style.transform = "scale(1)"; }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatScreen({ chat, me, onBack, onOpenInfo }) {
  const m = moodOf(chat.truth?.mood);
  const other = chat.author?.uid === me.uid ? chat.connector : chat.author;
  const messages = useChatMessages(chat.feedId, chat.id);
  const liveChat = useChatDoc(chat.feedId, chat.id);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [msgReactions, setMsgReactions] = useState({});
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimerRef = useRef(null);
  const notify = useNotice();

  useBodyLock(true);
  useEscape(true, onBack);

  // mark read whenever new messages arrive while this screen is open
  useEffect(() => {
    if (messages.length > 0) markChatRead(chat.feedId, chat.id, me.uid);
  }, [messages.length, chat.feedId, chat.id, me.uid]);

  // keep the latest line in view
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // focus the composer when the chat opens
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(id);
  }, []);

  const otherLastRead = liveChat?.lastReadAt?.[other?.uid];
  const lastMySentIdx = messages.reduce(
    (last, msg, i) => (msg.senderUid === me.uid ? i : last),
    -1
  );
  // fallback: if the other person replied after my last sent message, they've read it
  const otherRepliedAfter =
    lastMySentIdx >= 0 &&
    messages.slice(lastMySentIdx + 1).some((mm) => mm.senderUid !== me.uid);

  const send = async () => {
    const v = draft.trim();
    if (!v || busy) return;
    setBusy(true);
    setDraft("");
    try {
      await sendMessage(chat.feedId, chat.id, me, v);
    } catch (e) {
      console.warn("send failed:", e.message);
      setDraft(v); // give the line back so nothing is lost
      notify("That message didn't send. Try again.", "warn");
    } finally {
      setBusy(false);
    }
  };

  // auto-grow the chat input
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [draft]);

  // local typing indicator — shows a pulsing dot in the composer while the
  // user has unsent text. Not cross-user (would require Firestore writes).
  const handleDraftChange = (val) => {
    setDraft(val);
    setIsTyping(val.trim().length > 0);
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => setIsTyping(false), 3000);
  };

  const handleReactToMessage = (msgId, emoji) => {
    setMsgReactions((prev) => {
      const existing = prev[msgId] || [];
      const alreadyReacted = existing.some((r) => r.emoji === emoji && r.uid === me.uid);
      if (alreadyReacted) {
        return { ...prev, [msgId]: existing.filter((r) => !(r.emoji === emoji && r.uid === me.uid)) };
      }
      return { ...prev, [msgId]: [...existing, { emoji, uid: me.uid }] };
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: C.bg }}>
      <header
        className="shrink-0"
        style={{
          background: "rgba(14,11,18,0.92)",
          backdropFilter: "blur(14px)",
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        <div className="mx-auto max-w-2xl px-5 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="mtp-focusable"
            style={{
              fontFamily: UI,
              fontWeight: 700,
              fontSize: "1.1rem",
              color: C.dim,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 8px",
            }}
            aria-label="Back to inbox"
          >
            ←
          </button>
          <Avatar name={other?.displayName} hue={hueFor(other?.uid)} photoURL={other?.photoURL} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: UI, fontWeight: 600, fontSize: "0.92rem", color: C.ink }}>
              {other?.displayName}
              {other?.age ? `, ${other.age}` : ""}
            </div>
          </div>
          {onOpenInfo && (
            <button
              onClick={() => onOpenInfo(chat)}
              aria-label="Conversation info"
              style={{
                fontFamily: UI,
                fontWeight: 700,
                fontSize: "1rem",
                color: C.faint,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 8px",
                letterSpacing: "0.06em",
              }}
            >
              ⋯
            </button>
          )}
        </div>
      </header>

      {/* the truth that started this — pinned context */}
      <div className="shrink-0" style={{ borderBottom: `1px solid ${C.line}`, background: `${m.color}0a` }}>
        <div className="mx-auto max-w-2xl px-5 py-3">
          <Eyebrow color={m.color}>THE TRUTH THAT STARTED THIS</Eyebrow>
          <p
            style={{
              fontFamily: SERIF,
              fontStyle: "italic",
              fontSize: "1.05rem",
              lineHeight: 1.35,
              color: C.ink,
              opacity: 0.9,
              margin: "0.4rem 0 0",
            }}
          >
            "{chat.truth?.text}"
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto mtp-scroll">
        <div className="mx-auto max-w-2xl px-5 py-6 flex flex-col gap-3">
          {messages.length === 0 && (
            <p
              className="text-center py-10"
              style={{ fontFamily: SERIF, fontStyle: "italic", color: C.faint, fontSize: "1rem" }}
            >
              No one's spoken yet. Say the first true thing.
            </p>
          )}
          {messages.map((msg, idx) => {
            const mine = msg.senderUid === me.uid;
            const isLastSent = mine && idx === lastMySentIdx;
            const isRead =
              isLastSent &&
              (otherRepliedAfter ||
                (otherLastRead &&
                  msg.createdAt &&
                  otherLastRead.toMillis() > msg.createdAt.toMillis()));
            const reactions = msgReactions[msg.id] || [];
            const reactionGroups = reactions.reduce((acc, r) => {
              acc[r.emoji] = (acc[r.emoji] || 0) + 1;
              return acc;
            }, {});
            return (
              <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div style={{ maxWidth: "78%" }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: "0.3rem", flexDirection: mine ? "row-reverse" : "row" }}>
                    <div
                      style={{
                        fontFamily: UI,
                        fontSize: "0.92rem",
                        lineHeight: 1.45,
                        color: mine ? C.bg : C.ink,
                        background: mine ? C.ember : "rgba(245,239,230,0.06)",
                        border: mine ? "none" : `1px solid ${C.line}`,
                        borderRadius: mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                        padding: "10px 14px",
                        wordBreak: "break-word",
                      }}
                    >
                      {msg.text}
                    </div>
                    <MessageReactionBar msg={msg} mine={mine} onReact={handleReactToMessage} />
                  </div>

                  {/* emoji reactions on this message */}
                  {Object.keys(reactionGroups).length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        gap: "0.25rem",
                        marginTop: "0.3rem",
                        justifyContent: mine ? "flex-end" : "flex-start",
                        flexWrap: "wrap",
                      }}
                    >
                      {Object.entries(reactionGroups).map(([emoji, count]) => (
                        <button
                          key={emoji}
                          onClick={() => handleReactToMessage(msg.id, emoji)}
                          style={{
                            fontFamily: UI,
                            fontSize: "0.72rem",
                            background: `${C.line}`,
                            border: `1px solid ${C.lineStrong}`,
                            borderRadius: "999px",
                            padding: "2px 7px",
                            cursor: "pointer",
                            color: C.dim,
                          }}
                        >
                          {emoji} {count > 1 ? count : ""}
                        </button>
                      ))}
                    </div>
                  )}

                  <div
                    style={{
                      fontFamily: UI,
                      fontSize: "0.6rem",
                      color: C.faint,
                      marginTop: 4,
                      textAlign: mine ? "right" : "left",
                    }}
                  >
                    {clockTime(msg.createdAt)}
                    {isLastSent && (
                      <span style={{ marginLeft: "6px", color: isRead ? C.teal : C.faint }}>
                        {isRead ? "· Read" : "· Sent"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* typing indicator — shows when you have unsent text */}
          {isTyping && (
            <div className="flex justify-end" style={{ opacity: 0.6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "6px 12px", background: `${C.ember}22`, borderRadius: "12px 12px 4px 12px" }}>
                <TypingDots color={C.ember} />
                <span style={{ fontFamily: UI, fontSize: "0.6rem", color: C.dim, letterSpacing: "0.04em" }}>composing</span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div
        className="shrink-0"
        style={{ borderTop: `1px solid ${C.line}`, background: "rgba(14,11,18,0.92)" }}
      >
        <div className="mx-auto max-w-2xl px-5 py-3 flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                setIsTyping(false);
                send();
              }
            }}
            rows={1}
            placeholder="Say the true thing…"
            className="flex-1 resize-none outline-none mtp-scroll"
            style={{
              fontFamily: UI,
              fontSize: "0.95rem",
              color: C.ink,
              background: "rgba(245,239,230,0.05)",
              border: `1px solid ${C.line}`,
              borderRadius: "14px",
              padding: "11px 15px",
              caretColor: C.ember,
              overflow: "hidden",
            }}
          />
          <button
            onClick={send}
            disabled={!draft.trim() || busy}
            style={{
              fontFamily: UI,
              fontWeight: 700,
              fontSize: "0.72rem",
              letterSpacing: "0.1em",
              color: draft.trim() ? C.bg : C.faint,
              background: draft.trim() ? C.ember : "transparent",
              border: `1px solid ${draft.trim() ? C.ember : C.line}`,
              borderRadius: "999px",
              padding: "11px 18px",
              cursor: draft.trim() && !busy ? "pointer" : "default",
              transition: "all 160ms ease",
            }}
          >
            SEND
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PROFILE — photo, name, age, email, and the account. Same fields as V3, with
   in-line save state and avatar upload guarded on type and size.
   ════════════════════════════════════════════════════════════════════════════ */

function ProfileTab({ me, email, createdAt, confesses = 0, onSaved, myFeeds = [], achievements = [], analytics, onOpenAnalytics, onOpenJournal, onOpenAchievements, onOpenSettings }) {
  const hue = hueFor(me.uid);
  const [name, setName] = useState(me.displayName || "");
  const [age, setAge] = useState(me.age ?? "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const [bookingOpen, setBookingOpen] = useState(false);
  const fileRef = useRef(null);
  const notify = useNotice();

  // Compute lifetime stats from the user's own feed posts
  const totalPosts = myFeeds.length;
  const totalReactions = myFeeds.reduce(
    (s, f) => s + (f.felt || 0) + (f.same || 0) + (f.brave || 0),
    0
  );
  const totalConnects = myFeeds.reduce(
    (s, f) => s + (f.connect || []).filter((c) => c.flag === "accept").length,
    0
  );
  const totalFelt = myFeeds.reduce((s, f) => s + (f.felt || 0), 0);

  const dirty =
    name.trim() !== (me.displayName || "") || String(age) !== String(me.age ?? "");

  const pickPhoto = () => fileRef.current?.click();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMsg("That's not an image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMsg("Keep it under 5 MB.");
      return;
    }
    setUploading(true);
    setMsg("");
    try {
      await uploadAvatar(me.uid, file);
      onSaved?.();
      notify("Photo updated.", "good");
    } catch (err) {
      setMsg(err.message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!dirty || busy) return;
    const a = Number(age);
    if (!Number.isInteger(a) || a < 18 || a > 120) {
      setMsg("Enter a real age (18–120).");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      await updateUserProfile(me.uid, { displayName: name.trim(), age: a });
      onSaved?.();
      setMsg("Saved.");
      notify("Changes saved.", "good");
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  const since = monthYear(createdAt);

  const label = {
    fontFamily: UI,
    fontWeight: 700,
    fontSize: "0.62rem",
    letterSpacing: "0.2em",
    color: C.dim,
  };
  const field = {
    fontFamily: UI,
    fontSize: "0.95rem",
    color: C.ink,
    background: "rgba(245,239,230,0.04)",
    border: `1px solid ${C.line}`,
    borderRadius: "2px",
    padding: "12px 14px",
    outline: "none",
    width: "100%",
    marginTop: "0.5rem",
  };

  return (
    <div className="pt-10">
      {/* photo */}
      <div
        className="flex flex-col items-center"
        style={{ paddingBottom: "2.2rem", borderBottom: `1px solid ${C.line}` }}
      >
        <div
          className="relative"
          style={{ opacity: uploading ? 0.5 : 1, transition: "opacity 200ms ease" }}
        >
          <Avatar name={me.displayName} hue={hue} size={104} photoURL={me.photoURL} />
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
        <button
          onClick={pickPhoto}
          disabled={uploading}
          className="mtp-focusable"
          style={{
            fontFamily: UI,
            fontWeight: 700,
            fontSize: "0.7rem",
            letterSpacing: "0.14em",
            color: C.ember,
            background: "none",
            border: `1px solid ${C.ember}66`,
            borderRadius: "999px",
            padding: "8px 18px",
            marginTop: "1.1rem",
            cursor: uploading ? "default" : "pointer",
          }}
        >
          {uploading ? "UPLOADING…" : me.photoURL ? "CHANGE PHOTO" : "ADD A PHOTO"}
        </button>
      </div>

      {/* confess balance */}
      {confesses > 0 && (
        <div
          className="flex items-center justify-between"
          style={{ padding: "1.4rem 0", borderBottom: `1px solid ${C.line}` }}
        >
          <div>
            <div style={label}>ON THE HOUSE</div>
            <p
              style={{
                fontFamily: SERIF,
                fontStyle: "italic",
                color: C.teal,
                fontSize: "1.05rem",
                margin: "0.5rem 0 0",
              }}
            >
              {confesses} free {confesses === 1 ? "confession" : "confessions"} waiting.
            </p>
          </div>
        </div>
      )}

      {confesses === 0 && (
        <div style={{ padding: "1.4rem 0", borderBottom: `1px solid ${C.line}` }}>
          {bookingOpen ? (
            <>
              <div className="flex items-center justify-between" style={{ marginBottom: "1.1rem" }}>
                <span style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.62rem", letterSpacing: "0.2em", color: C.dim }}>
                  CONFESSING BALANCE
                </span>
                <button
                  onClick={() => setBookingOpen(false)}
                  className="mtp-focusable"
                  style={{
                    fontFamily: UI,
                    fontSize: "0.7rem",
                    color: C.faint,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "2px 0",
                  }}
                >
                  CANCEL
                </button>
              </div>
              <ConfessingBooking me={me} onDone={() => setBookingOpen(false)} />
            </>
          ) : (
            <button
              onClick={() => setBookingOpen(true)}
              className="mtp-focusable"
              style={{
                fontFamily: UI,
                fontWeight: 700,
                fontSize: "0.74rem",
                letterSpacing: "0.14em",
                color: C.ember,
                background: "rgba(255,112,89,0.07)",
                border: `1px solid ${C.ember}55`,
                borderRadius: "999px",
                padding: "11px 22px",
                cursor: "pointer",
              }}
            >
              BUY MORE CONFESSING
            </button>
          )}
        </div>
      )}

      {/* lifetime stats */}
      {totalPosts > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "0.5rem",
            padding: "1.4rem 0",
            borderBottom: `1px solid ${C.line}`,
          }}
        >
          {[
            { value: totalPosts, label: "TRUTHS" },
            { value: totalReactions, label: "REACTIONS" },
            { value: totalFelt, label: "FELT IT" },
            { value: totalConnects, label: "CONNECTS" },
          ].map(({ value, label: lbl }) => (
            <div key={lbl} className="flex flex-col items-center gap-1">
              <span
                style={{
                  fontFamily: SERIF,
                  fontStyle: "italic",
                  fontSize: "clamp(1.4rem, 4vw, 1.8rem)",
                  color: C.ink,
                  lineHeight: 1,
                }}
              >
                {value}
              </span>
              <span
                style={{
                  fontFamily: UI,
                  fontWeight: 700,
                  fontSize: "0.52rem",
                  letterSpacing: "0.18em",
                  color: C.faint,
                  textAlign: "center",
                }}
              >
                {lbl}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* activity sparkline */}
      {myFeeds.length >= 2 && <ActivitySpark myFeeds={myFeeds} />}

      {/* achievement mini-bar */}
      {achievements.length > 0 && (
        <div
          style={{ padding: "1.4rem 0", borderBottom: `1px solid ${C.line}` }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <div style={label}>ACHIEVEMENTS</div>
            {onOpenAchievements && (
              <button onClick={onOpenAchievements} style={{ fontFamily: UI, fontSize: "0.68rem", color: C.amber, background: "none", border: "none", cursor: "pointer" }}>
                View all →
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.75rem", overflow: "hidden", flexWrap: "wrap" }}>
            {achievements.filter((a) => a.earned).slice(0, 5).map((a) => (
              <AchievementBadge key={a.id} achievement={a} earned size="sm" />
            ))}
            {achievements.filter((a) => a.earned).length === 0 && (
              <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "0.85rem", color: C.faint }}>
                Post your first truth to earn achievements.
              </span>
            )}
          </div>
        </div>
      )}

      {/* feature shortcut buttons */}
      <div style={{ padding: "1.4rem 0", borderBottom: `1px solid ${C.line}`, display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        {onOpenAnalytics && (
          <button
            onClick={onOpenAnalytics}
            style={{
              fontFamily: UI, fontWeight: 700, fontSize: "0.64rem", letterSpacing: "0.12em",
              color: C.sky, background: `${C.sky}14`, border: `1px solid ${C.sky}44`,
              borderRadius: "999px", padding: "7px 14px", cursor: "pointer",
            }}
          >
            ◎ ANALYTICS
          </button>
        )}
        {onOpenJournal && (
          <button
            onClick={onOpenJournal}
            style={{
              fontFamily: UI, fontWeight: 700, fontSize: "0.64rem", letterSpacing: "0.12em",
              color: C.lav, background: `${C.lav}14`, border: `1px solid ${C.lav}44`,
              borderRadius: "999px", padding: "7px 14px", cursor: "pointer",
            }}
          >
            ◑ MOOD JOURNAL
          </button>
        )}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            style={{
              fontFamily: UI, fontWeight: 700, fontSize: "0.64rem", letterSpacing: "0.12em",
              color: C.dim, background: "transparent", border: `1px solid ${C.line}`,
              borderRadius: "999px", padding: "7px 14px", cursor: "pointer",
            }}
          >
            ⚙ SETTINGS
          </button>
        )}
      </div>

      {/* fields */}
      <section style={{ paddingTop: "2rem" }}>
        <div style={label}>NAME</div>
        <input value={name} onChange={(e) => setName(e.target.value)} style={field} />

        <div style={{ ...label, marginTop: "1.4rem" }}>AGE</div>
        <input type="number" min="18" max="120" value={age} onChange={(e) => setAge(e.target.value)} style={field} />

        <div style={{ ...label, marginTop: "1.4rem" }}>EMAIL</div>
        <div style={{ ...field, color: C.dim, background: "transparent" }}>{email || "—"}</div>

        {msg ? (
          <p
            style={{
              fontFamily: UI,
              fontSize: "0.8rem",
              color: msg === "Saved." ? C.teal : C.ember,
              marginTop: "1rem",
            }}
          >
            {msg}
          </p>
        ) : null}

        <button
          onClick={save}
          disabled={!dirty || busy}
          style={{
            fontFamily: UI,
            fontWeight: 700,
            fontSize: "0.74rem",
            letterSpacing: "0.14em",
            color: dirty ? C.bg : C.faint,
            background: dirty ? C.ember : "transparent",
            border: `1px solid ${dirty ? C.ember : C.line}`,
            borderRadius: "999px",
            padding: "11px 22px",
            marginTop: "1.6rem",
            cursor: dirty && !busy ? "pointer" : "default",
            transition: "all 180ms ease",
          }}
        >
          {busy ? "SAVING…" : "SAVE CHANGES"}
        </button>
      </section>

      {/* account */}
      <section
        style={{ paddingTop: "2.4rem", marginTop: "2rem", borderTop: `1px solid ${C.line}` }}
      >
        <div style={label}>ACCOUNT</div>
        {since && (
          <p
            style={{
              fontFamily: SERIF,
              fontStyle: "italic",
              color: C.dim,
              fontSize: "1rem",
              margin: "0.8rem 0 1.2rem",
            }}
          >
            Confessing since {since}.
          </p>
        )}
        <button
          onClick={logOut}
          className="mtp-soft mtp-focusable"
          style={{
            fontFamily: UI,
            fontWeight: 600,
            fontSize: "0.74rem",
            letterSpacing: "0.1em",
            color: C.dim,
            background: "none",
            border: `1px solid ${C.line}`,
            borderRadius: "999px",
            padding: "10px 20px",
            cursor: "pointer",
          }}
        >
          LOG OUT
        </button>
      </section>

      {/* mood streak widget */}
      {myFeeds.length >= 2 && <MoodStreakWidget myFeeds={myFeeds} />}

      {/* truth insight + timeline */}
      {myFeeds.length > 0 && (
        <>
          <TruthInsightCard myFeeds={myFeeds} analytics={analytics} />
          <TruthTimeline myFeeds={myFeeds} />
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   TRUTH PAYMENT — $1 to post (the one controllable price, TRUTH_PRICE). Card
   via Stripe Elements, or Cash App via a Stripe redirect. The truth is written
   to Firestore first by the payment hooks; the doc flips to "paid" on success.
   Visual language unchanged from V3.
   ════════════════════════════════════════════════════════════════════════════ */

const CARD_STYLE = {
  style: {
    base: {
      color: C.ink,
      fontFamily: "'Outfit', sans-serif",
      fontSize: "15px",
      "::placeholder": { color: C.faint },
      iconColor: C.ember,
    },
    invalid: { color: C.ember, iconColor: C.ember },
  },
};

/* ════════════════════════════════════════════════════════════════════════════
   CONFESSING BOOKING — inline package picker + card / Cash App payment for
   buying truth credits. Shown in ProfileTab when confesses === 0.
   ════════════════════════════════════════════════════════════════════════════ */

function ConfessingCardForm({ me, pkg, onSuccess, onError }) {
  const {
    loading, error, complete, focused,
    setComplete, setError, setFocused, handleSubmit,
  } = useCardConfessingPayment({
    me,
    packageCents: pkg.cents,
    truthsToAdd: pkg.truths,
    onSuccess,
    onError,
  });

  if (complete) {
    return (
      <p style={{ fontFamily: SERIF, fontStyle: "italic", color: C.teal, fontSize: "1rem", margin: 0 }}>
        {pkg.truths} truths added to your balance.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div
        style={{
          border: `1px solid ${error ? C.ember : focused ? C.ember : C.line}`,
          borderRadius: "10px",
          padding: "14px 16px",
          background: "rgba(245,239,230,0.04)",
          transition: "border-color 160ms ease",
        }}
      >
        <CardElement
          options={CARD_STYLE}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            setComplete(e.complete);
            setError(e.error?.message || "");
          }}
        />
      </div>
      {error ? (
        <p style={{ fontFamily: UI, fontSize: "0.8rem", color: C.ember, margin: 0 }}>{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={!complete || loading}
        style={{
          fontFamily: UI,
          fontWeight: 700,
          fontSize: "0.78rem",
          letterSpacing: "0.16em",
          color: complete && !loading ? C.bg : C.faint,
          background: complete && !loading ? C.ember : "transparent",
          border: `1px solid ${complete && !loading ? C.ember : C.line}`,
          borderRadius: "999px",
          padding: "13px",
          width: "100%",
          cursor: complete && !loading ? "pointer" : "default",
          transition: "all 180ms ease",
        }}
      >
        {loading ? "PROCESSING…" : `PAY $${pkg.cents / 100} WITH CARD`}
      </button>
      <p style={{ fontFamily: UI, fontSize: "0.66rem", color: C.faint, textAlign: "center", margin: 0 }}>
        Secured by Stripe
      </p>
    </form>
  );
}

function ConfessingCashAppButton({ me, pkg, onError }) {
  const { loading, preparing, error, handleCashApp } = useCashAppConfessingPayment({
    me,
    packageCents: pkg.cents,
    truthsToAdd: pkg.truths,
    onError,
  });

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p style={{ fontFamily: UI, fontSize: "0.8rem", color: C.ember, margin: 0 }}>{error}</p>
      ) : null}
      <button
        onClick={handleCashApp}
        disabled={loading}
        style={{
          fontFamily: UI,
          fontWeight: 700,
          fontSize: "0.78rem",
          letterSpacing: "0.16em",
          color: C.bg,
          background: "#00D632",
          border: "none",
          borderRadius: "999px",
          padding: "13px",
          width: "100%",
          cursor: loading ? "default" : "pointer",
          opacity: loading ? 0.7 : 1,
          transition: "all 180ms ease",
        }}
      >
        {preparing
          ? "GETTING READY…"
          : loading
          ? "OPENING CASH APP…"
          : `PAY $${pkg.cents / 100} WITH CASH APP`}
      </button>
    </div>
  );
}

function ConfessingBooking({ me, onDone }) {
  const [selected, setSelected] = useState(null);
  const notify = useNotice();

  const handleSuccess = useCallback(
    (truthsToAdd) => {
      notify(`${truthsToAdd} truths added to your balance.`, "good");
      onDone?.();
    },
    [notify, onDone]
  );

  return (
    <div>
      <p
        style={{
          fontFamily: SERIF,
          fontStyle: "italic",
          color: C.dim,
          fontSize: "0.9rem",
          margin: "0 0 1.1rem",
        }}
      >
        Prepaid truths · no subscription · never expires
      </p>

      <div className="flex flex-col gap-2">
        {CONFESSING_PACKAGES.map((pkg, i) => {
          const active = selected === i;
          return (
            <button
              key={pkg.cents}
              onClick={() => setSelected(active ? null : i)}
              className="mtp-focusable"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontFamily: UI,
                background: active ? "rgba(255,112,89,0.08)" : "rgba(245,239,230,0.03)",
                border: `1px solid ${active ? C.ember : C.line}`,
                borderRadius: "10px",
                padding: "12px 16px",
                cursor: "pointer",
                transition: "all 160ms ease",
                textAlign: "left",
                width: "100%",
              }}
            >
              <div>
                <span style={{ fontWeight: 700, fontSize: "1rem", color: active ? C.ember : C.ink }}>
                  ${pkg.cents / 100}
                </span>
                <span style={{ fontSize: "0.85rem", color: C.dim, marginLeft: "0.5rem" }}>
                  → {pkg.truths} truths · {pkg.per}
                </span>
              </div>
              {pkg.tag ? (
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: "0.6rem",
                    letterSpacing: "0.14em",
                    color: pkg.tag === "BEST VALUE" ? C.teal : C.amber,
                    border: `1px solid ${pkg.tag === "BEST VALUE" ? C.teal : C.amber}`,
                    borderRadius: "999px",
                    padding: "3px 8px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {pkg.tag}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <div style={{ marginTop: "1.4rem" }} className="flex flex-col gap-4">
          <ConfessingCardForm
            me={me}
            pkg={CONFESSING_PACKAGES[selected]}
            onSuccess={handleSuccess}
            onError={() => {}}
          />
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
            <div style={{ flex: 1, height: "1px", background: C.line }} />
            <span style={{ fontFamily: UI, fontSize: "0.7rem", color: C.faint }}>or</span>
            <div style={{ flex: 1, height: "1px", background: C.line }} />
          </div>
          <ConfessingCashAppButton
            me={me}
            pkg={CONFESSING_PACKAGES[selected]}
            onError={() => {}}
          />
        </div>
      )}
    </div>
  );
}

function TruthPreview({ truth }) {
  const m = moodOf(truth.mood);
  return (
    <div style={{ borderLeft: `2px solid ${m.color}`, paddingLeft: "1rem", margin: "0 0 1.5rem" }}>
      <p
        style={{
          fontFamily: SERIF,
          fontStyle: "italic",
          fontSize: "1.3rem",
          lineHeight: 1.3,
          color: C.ink,
          margin: 0,
        }}
      >
        "{truth.message}"
      </p>
      <div className="mt-2">
        <Mood mood={truth.mood} />
      </div>
    </div>
  );
}

function StripeTruthCardForm({ me, truth, onSuccess, onError }) {
  const {
    loading,
    error,
    complete,
    focused,
    setComplete,
    setError,
    setFocused,
    handleSubmit,
  } = useTruthCardPayment({ me, message: truth.message, mood: truth.mood, onSuccess, onError });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div
        style={{
          border: `1px solid ${error ? C.ember : focused ? C.ember : C.line}`,
          borderRadius: "10px",
          padding: "14px 16px",
          background: "rgba(245,239,230,0.04)",
          transition: "border-color 160ms ease",
        }}
      >
        <CardElement
          options={CARD_STYLE}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            setComplete(e.complete);
            setError(e.error?.message || "");
          }}
        />
      </div>
      {error ? (
        <p style={{ fontFamily: UI, fontSize: "0.8rem", color: C.ember, margin: 0 }}>{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={!complete || loading}
        style={{
          fontFamily: UI,
          fontWeight: 700,
          fontSize: "0.78rem",
          letterSpacing: "0.16em",
          color: complete && !loading ? C.bg : C.faint,
          background: complete && !loading ? C.ember : "transparent",
          border: `1px solid ${complete && !loading ? C.ember : C.line}`,
          borderRadius: "999px",
          padding: "13px",
          cursor: complete && !loading ? "pointer" : "default",
          transition: "all 180ms ease",
        }}
      >
        {loading ? "PROCESSING…" : `PAY $${TRUTH_PRICE} · POST IT`}
      </button>
      <p
        style={{
          fontFamily: UI,
          fontSize: "0.66rem",
          color: C.faint,
          textAlign: "center",
          margin: 0,
        }}
      >
        Secured by Stripe
      </p>
    </form>
  );
}

function CashAppTruthPanel({ me, truth, onError }) {
  const { loading, preparing, error, handleCashApp } = useTruthCashAppPayment({
    me,
    message: truth.message,
    mood: truth.mood,
    onError,
  });
  return (
    <div className="flex flex-col gap-4">
      {preparing ? (
        <p style={{ fontFamily: UI, fontSize: "0.82rem", color: C.dim, lineHeight: 1.5, margin: 0 }}>
          Getting ready…
        </p>
      ) : (
        <p style={{ fontFamily: UI, fontSize: "0.82rem", color: C.dim, lineHeight: 1.5, margin: 0 }}>
          You'll be sent to Cash App to confirm ${TRUTH_PRICE}. Your truth goes live the moment it clears.
        </p>
      )}
      {error ? (
        <p style={{ fontFamily: UI, fontSize: "0.8rem", color: C.ember, margin: 0 }}>{error}</p>
      ) : null}
      <button
        onClick={handleCashApp}
        disabled={loading}
        style={{
          fontFamily: UI,
          fontWeight: 700,
          fontSize: "0.78rem",
          letterSpacing: "0.16em",
          color: C.bg,
          background: "#00D632",
          border: "none",
          borderRadius: "999px",
          padding: "13px",
          cursor: loading ? "default" : "pointer",
          opacity: loading ? 0.7 : 1,
          transition: "all 180ms ease",
        }}
      >
        {preparing
          ? "GETTING READY…"
          : loading
          ? "OPENING CASH APP…"
          : `CONTINUE TO CASH APP · $${TRUTH_PRICE}`}
      </button>
    </div>
  );
}

/* ── Cash App return overlay ──────────────────────────────────────────────────
   Rendered for every redirect_status Stripe can return:
     succeeded → polls Firestore until paymentStatus == "paid", then success
     failed    → payment declined or errored in Cash App
     canceled  → user backed out of Cash App without paying
   onRetry fetches the original truth and reopens the payment modal. */
function CashAppReturnOverlay({ feedId, status, onRetry, onDone }) {
  const paymentStatus = useFeedPaymentStatus(feedId);
  const [timedOut, setTimedOut] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useBodyLock(true);

  useEffect(() => {
    if (status !== "succeeded") return;
    const t = setTimeout(() => setTimedOut(true), CASHAPP_CONFIRM_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [status]);

  const paid = status === "succeeded" && paymentStatus === "paid";

  const btnPrimary = {
    fontFamily: UI,
    fontWeight: 700,
    fontSize: "0.74rem",
    letterSpacing: "0.16em",
    color: C.bg,
    background: C.ember,
    border: "none",
    borderRadius: "999px",
    padding: "12px 26px",
    cursor: "pointer",
    marginTop: "1.6rem",
  };
  const btnSecondary = {
    fontFamily: UI,
    fontWeight: 600,
    fontSize: "0.74rem",
    letterSpacing: "0.1em",
    color: C.dim,
    background: "none",
    border: `1px solid ${C.line}`,
    borderRadius: "999px",
    padding: "11px 22px",
    cursor: "pointer",
    marginTop: "0.8rem",
  };
  const bigText = (txt, color = C.dim) => (
    <p
      style={{
        fontFamily: SERIF,
        fontStyle: "italic",
        fontSize: "1.4rem",
        lineHeight: 1.3,
        color,
        margin: 0,
      }}
    >
      {txt}
    </p>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(14,11,18,0.97)" }}
    >
      <div
        className="w-full max-w-sm text-center flex flex-col items-center"
        style={{ animation: `mtpRise 400ms ${EASE} both` }}
      >
        {/* succeeded: waiting for Firestore to flip */}
        {status === "succeeded" && !paid && !timedOut && bigText("Checking payment…")}

        {/* succeeded: confirmed paid */}
        {paid && (
          <>
            <div
              style={{
                fontFamily: SERIF,
                fontStyle: "italic",
                fontSize: "2.4rem",
                color: C.ember,
                textShadow: `0 0 40px ${C.ember}55`,
                marginBottom: "0.4rem",
              }}
            >
              ♥
            </div>
            <h2 style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "1.9rem", color: C.ink, margin: 0 }}>
              It's live.
            </h2>
            <p className="mt-3" style={{ fontFamily: UI, fontSize: "0.82rem", color: C.dim }}>
              Your truth is out there. See who feels it.
            </p>
            <button onClick={onDone} style={btnPrimary}>
              DONE
            </button>
          </>
        )}

        {/* succeeded but timed out waiting */}
        {status === "succeeded" && timedOut && !paid && (
          <>
            {bigText("Payment is still clearing — check back in a moment.")}
            <button onClick={onDone} style={btnSecondary}>
              OK
            </button>
          </>
        )}

        {/* failed: something went wrong in Cash App */}
        {status === "failed" && (
          <>
            {bigText("Cash App couldn't complete the payment.", C.ember)}
            <p className="mt-3" style={{ fontFamily: UI, fontSize: "0.82rem", color: C.dim }}>
              It happens. Your truth is still waiting — try again or use a card.
            </p>
            <button
              onClick={async () => {
                setRetrying(true);
                await onRetry(feedId);
                setRetrying(false);
              }}
              disabled={retrying}
              style={{ ...btnPrimary, opacity: retrying ? 0.7 : 1 }}
            >
              {retrying ? "…" : "TRY AGAIN"}
            </button>
            <button onClick={onDone} style={btnSecondary}>
              Not tonight
            </button>
          </>
        )}

        {/* canceled: user backed out */}
        {status !== "succeeded" && status !== "failed" && (
          <>
            {bigText("Changed your mind?")}
            <p className="mt-3" style={{ fontFamily: UI, fontSize: "0.82rem", color: C.dim }}>
              Your truth is still here. Come back when you're ready.
            </p>
            <button
              onClick={async () => {
                setRetrying(true);
                await onRetry(feedId);
                setRetrying(false);
              }}
              disabled={retrying}
              style={{ ...btnPrimary, opacity: retrying ? 0.7 : 1 }}
            >
              {retrying ? "…" : "POST IT"}
            </button>
            <button onClick={onDone} style={btnSecondary}>
              Not tonight
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function TruthPaymentFlow({ me, truth, onClose, onPosted }) {
  const [stage, setStage] = useState("method"); // method | card | cashapp | done
  const [, setErr] = useState("");
  const notify = useNotice();

  useBodyLock(true);
  useEscape(stage !== "done", onClose);

  const onSuccess = () => setStage("done");
  const onError = (m) => {
    setErr(m);
    if (m) notify(m, "warn");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 overflow-hidden"
      style={{ background: "rgba(14,11,18,0.92)", backdropFilter: "blur(8px)" }}
    >
      <div className="w-full max-w-sm relative" style={{ animation: `mtpRise 400ms ${EASE} both` }}>
        {stage !== "done" && (
          <button
            onClick={onClose}
            aria-label="Cancel"
            style={{
              position: "absolute",
              top: -36,
              right: 0,
              fontFamily: UI,
              fontSize: "0.72rem",
              letterSpacing: "0.12em",
              color: C.dim,
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            CANCEL
          </button>
        )}

        {stage === "done" ? (
          <div className="text-center">
            <div
              style={{
                fontFamily: SERIF,
                fontStyle: "italic",
                fontSize: "2rem",
                color: C.ember,
                textShadow: `0 0 40px ${C.ember}55`,
                marginBottom: "0.5rem",
              }}
            >
              ♥
            </div>
            <h2 style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "1.8rem", color: C.ink, margin: 0 }}>
              It's live.
            </h2>
            <p className="mt-3" style={{ fontFamily: UI, fontSize: "0.82rem", color: C.dim }}>
              Your truth is out there. See who feels it.
            </p>
            <button
              onClick={onPosted}
              style={{
                marginTop: "1.6rem",
                fontFamily: UI,
                fontWeight: 700,
                fontSize: "0.74rem",
                letterSpacing: "0.16em",
                color: C.bg,
                background: C.ember,
                border: "none",
                borderRadius: "999px",
                padding: "12px 26px",
                cursor: "pointer",
              }}
            >
              DONE
            </button>
          </div>
        ) : (
          <>
            <div className="mb-1">
              <Eyebrow color={C.ember}>POST YOUR TRUTH · ${TRUTH_PRICE}</Eyebrow>
            </div>
            <div className="mt-4">
              <TruthPreview truth={truth} />
            </div>

            {stage === "method" && (
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setErr("");
                    setStage("card");
                  }}
                  style={{
                    fontFamily: UI,
                    fontWeight: 700,
                    fontSize: "0.78rem",
                    letterSpacing: "0.14em",
                    color: C.bg,
                    background: C.ember,
                    border: "none",
                    borderRadius: "999px",
                    padding: "13px",
                    cursor: "pointer",
                  }}
                >
                  PAY WITH CARD
                </button>
                <button
                  onClick={() => {
                    setErr("");
                    setStage("cashapp");
                  }}
                  style={{
                    fontFamily: UI,
                    fontWeight: 700,
                    fontSize: "0.78rem",
                    letterSpacing: "0.14em",
                    color: C.ink,
                    background: "transparent",
                    border: `1px solid ${C.line}`,
                    borderRadius: "999px",
                    padding: "13px",
                    cursor: "pointer",
                  }}
                >
                  PAY WITH CASH APP
                </button>
              </div>
            )}

            {stage === "card" && (
              <StripeTruthCardForm me={me} truth={truth} onSuccess={onSuccess} onError={onError} />
            )}

            {stage === "cashapp" && (
              <CashAppTruthPanel me={me} truth={truth} onError={onError} />
            )}

            {stage !== "method" && (
              <button
                onClick={() => {
                  setErr("");
                  setStage("method");
                }}
                style={{
                  marginTop: "1rem",
                  fontFamily: UI,
                  fontSize: "0.72rem",
                  letterSpacing: "0.12em",
                  color: C.dim,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                ← Other payment method
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PASS CONFIRM — a quiet guard so a connection is never dropped by a stray tap.
   In-aesthetic, dismissible, and the destructive choice is the muted one.
   ════════════════════════════════════════════════════════════════════════════ */

function PassConfirm({ name, onConfirm, onCancel }) {
  useEscape(true, onCancel);
  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center p-6"
      style={{ background: "rgba(14,11,18,0.9)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="w-full max-w-xs text-center"
        style={{ animation: `mtpRise 320ms ${EASE} both` }}
      >
        <p
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: "1.5rem",
            color: C.ink,
            lineHeight: 1.3,
            margin: 0,
          }}
        >
          Quietly pass on {name || "this person"}?
        </p>
        <p className="mt-3" style={{ fontFamily: UI, fontSize: "0.8rem", color: C.dim, lineHeight: 1.5 }}>
          They won't be told. The truth that connected you stays where it is.
        </p>
        <div className="flex flex-col gap-2 mt-6">
          <button
            onClick={onConfirm}
            style={{
              fontFamily: UI,
              fontWeight: 700,
              fontSize: "0.74rem",
              letterSpacing: "0.12em",
              color: C.dim,
              background: "none",
              border: `1px solid ${C.line}`,
              borderRadius: "999px",
              padding: "11px",
              cursor: "pointer",
            }}
          >
            YES, PASS
          </button>
          <button
            onClick={onCancel}
            style={{
              fontFamily: UI,
              fontWeight: 700,
              fontSize: "0.74rem",
              letterSpacing: "0.12em",
              color: C.bg,
              background: C.ember,
              border: "none",
              borderRadius: "999px",
              padding: "11px",
              cursor: "pointer",
            }}
          >
            KEEP IT OPEN
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   NAVIGATION — the floating capsule. Confess · Discover · Inbox · You. The
   inbox carries a badge for pending connects + unread messages.
   ════════════════════════════════════════════════════════════════════════════ */

const NAV = [
  { id: "feed", label: "Confess" },
  { id: "discover", label: "Discover" },
  { id: "inbox", label: "Inbox" },
  { id: "profile", label: "You" },
];

function CapsuleNav({ tab, setTab, badge }) {
  return (
    <nav className="fixed bottom-5 left-0 right-0 z-40 flex justify-center px-6 pointer-events-none">
      <div
        className="flex pointer-events-auto"
        style={{
          background: "rgba(14,11,18,0.85)",
          backdropFilter: "blur(16px)",
          border: `1px solid ${C.line}`,
          borderRadius: "999px",
          padding: "5px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
        }}
      >
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => setTab(n.id)}
            className="relative mtp-focusable"
            aria-current={tab === n.id ? "page" : undefined}
            style={{
              fontFamily: UI,
              fontWeight: 700,
              fontSize: "0.72rem",
              letterSpacing: "0.1em",
              color: tab === n.id ? C.bg : C.dim,
              background: tab === n.id ? C.ember : "transparent",
              border: "none",
              borderRadius: "999px",
              padding: "9px 18px",
              cursor: "pointer",
              transition: "all 200ms ease",
            }}
          >
            {n.label}
            {n.id === "inbox" && badge > 0 && tab !== "inbox" && (
              <span
                className="absolute"
                style={{
                  top: 2,
                  right: 6,
                  background: C.ember,
                  color: C.bg,
                  fontFamily: UI,
                  fontWeight: 700,
                  fontSize: "0.55rem",
                  borderRadius: "999px",
                  padding: "1px 5px",
                  border: `1.5px solid ${C.bg}`,
                }}
              >
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}

/* Scroll-to-top — appears once the feed runs long. Sits clear of the nav. */
function ScrollTop({ visible }) {
  if (!visible) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="mtp-scrolltop fixed z-40 mtp-focusable"
      aria-label="Back to the top"
      style={{
        right: "1.4rem",
        bottom: "5.6rem",
        width: 42,
        height: 42,
        borderRadius: "999px",
        background: "rgba(14,11,18,0.85)",
        backdropFilter: "blur(16px)",
        border: `1px solid ${C.line}`,
        color: C.dim,
        fontFamily: UI,
        fontWeight: 700,
        fontSize: "1rem",
        cursor: "pointer",
        boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
        transition: "all 180ms ease",
      }}
    >
      ↑
    </button>
  );
}

/* Reusable empty / end-of-feed lines so the feed always has a closing note. */
function FeedNote({ children }) {
  return (
    <div
      className="text-center py-12"
      style={{ fontFamily: SERIF, fontStyle: "italic", color: C.faint, fontSize: "1rem" }}
    >
      {children}
    </div>
  );
}

function OfflineBanner() {
  const online = useOnlineStatus();
  const [wasOffline, setWasOffline] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!online) {
      setWasOffline(true);
      setShowBack(false);
    } else if (wasOffline) {
      setShowBack(true);
      timerRef.current = setTimeout(() => { setShowBack(false); setWasOffline(false); }, 2200);
    }
    return () => clearTimeout(timerRef.current);
  }, [online, wasOffline]);

  if (online && !showBack) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        textAlign: "center",
        padding: "9px 16px",
        fontFamily: UI,
        fontWeight: 700,
        fontSize: "0.7rem",
        letterSpacing: "0.14em",
        background: showBack ? C.teal : "rgba(20,6,6,0.96)",
        backdropFilter: "blur(12px)",
        color: showBack ? C.bg : C.rose,
        borderBottom: `1px solid ${showBack ? C.teal : C.rose}44`,
        transition: "background 400ms ease, color 400ms ease",
      }}
    >
      {showBack ? "BACK ONLINE" : "NO CONNECTION · UPDATES PAUSED"}
    </div>
  );
}

/* ── Pull-to-refresh visual indicator ─────────────────────────────────────── */
function PullIndicator({ pullY, refreshing }) {
  if (pullY <= 0 && !refreshing) return null;
  const progress = Math.min(pullY / 68, 1);
  const size = 24;
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 90,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
        height: Math.max(pullY, refreshing ? 52 : 0),
        overflow: "hidden",
        pointerEvents: "none",
        transition: refreshing ? "height 200ms ease" : "none",
        paddingBottom: "10px",
      }}
    >
      <div
        className={refreshing ? "mtp-spin" : ""}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: `2.5px solid ${C.ember}28`,
          borderTopColor: `${C.ember}${Math.round(progress * 255).toString(16).padStart(2, "0")}`,
          opacity: Math.max(progress, refreshing ? 1 : 0),
          transform: refreshing ? undefined : `rotate(${progress * 240}deg)`,
          transition: "opacity 120ms ease",
        }}
      />
    </div>
  );
}

/* ── Thin reading progress bar at the top of the viewport ─────────────────── */
function ReadingProgressBar() {
  const progress = useReadingProgress();
  if (progress < 0.005) return null;
  return (
    <div
      aria-hidden
      className="mtp-progress"
      style={{ transform: `scaleX(${progress})` }}
    />
  );
}

/* ── Mood filter pill bar ──────────────────────────────────────────────────── */
const FEED_FILTERS = ["all", "raw", "soft", "spicy", "late"];

function MoodFilterBar({ active, onChange, counts }) {
  return (
    <div
      className="flex gap-2 overflow-x-auto"
      style={{
        padding: "0.9rem 0 0.75rem",
        borderBottom: `1px solid ${C.line}`,
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {FEED_FILTERS.map((f) => {
        const m = f !== "all" ? MOODS[f] : null;
        const isActive = active === f;
        const color = m?.color || C.ember;
        const cnt = f === "all" ? counts?.total : counts?.[f];
        return (
          <button
            key={f}
            onClick={() => onChange(f)}
            className="mtp-focusable shrink-0"
            aria-pressed={isActive}
            style={{
              fontFamily: UI,
              fontWeight: 700,
              fontSize: "0.6rem",
              letterSpacing: "0.22em",
              padding: "5px 13px",
              borderRadius: "999px",
              border: `1px solid ${isActive ? color : C.line}`,
              color: isActive ? color : C.dim,
              background: isActive ? `${color}18` : "transparent",
              cursor: "pointer",
              transition: "all 160ms ease",
              display: "flex",
              alignItems: "center",
              gap: "0.4em",
            }}
          >
            {f.toUpperCase()}
            {cnt != null && cnt > 0 && (
              <span style={{ opacity: 0.55, fontWeight: 500 }}>{cnt}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── Mood distribution bar — shows today's mood split as a colored strip ───── */
function MoodDistributionStrip({ posts }) {
  if (!posts || posts.length < 4) return null;

  const counts = { raw: 0, soft: 0, spicy: 0, late: 0 };
  posts.forEach((p) => { if (p.mood in counts) counts[p.mood]++; });
  const total = posts.length;

  const segs = MOOD_ORDER
    .map((k) => ({ key: k, color: MOODS[k].color, label: MOODS[k].label, pct: (counts[k] / total) * 100 }))
    .filter((s) => s.pct > 0);

  return (
    <div style={{ paddingTop: "1.2rem", paddingBottom: "0.4rem" }}>
      <div
        style={{
          fontFamily: UI,
          fontSize: "0.58rem",
          letterSpacing: "0.18em",
          color: C.faint,
          marginBottom: "0.55rem",
          fontWeight: 700,
        }}
      >
        TODAY'S MOOD
      </div>
      <div className="flex overflow-hidden" style={{ height: 5, borderRadius: 3, gap: 2 }}>
        {segs.map((s) => (
          <div
            key={s.key}
            className="mtp-mood-seg"
            title={`${s.label} — ${Math.round(s.pct)}%`}
            style={{ flex: s.pct, background: s.color, borderRadius: 2 }}
          />
        ))}
      </div>
      <div className="flex gap-4 mt-2 flex-wrap">
        {segs.map((s) => (
          <span
            key={s.key}
            style={{
              fontFamily: UI,
              fontSize: "0.58rem",
              letterSpacing: "0.1em",
              color: s.color,
              fontWeight: 600,
            }}
          >
            {s.label.toUpperCase()} {Math.round(s.pct)}%
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Fresh badge — pulses on posts less than 3 minutes old ────────────────── */
function FreshBadge({ createdAt }) {
  const [fresh, setFresh] = useState(false);

  useEffect(() => {
    if (!createdAt) return;
    const ts = createdAt?.toMillis ? createdAt.toMillis() : Number(createdAt);
    const ageMs = Date.now() - ts;
    const freshWindow = 3 * 60 * 1000;
    if (ageMs < freshWindow) {
      setFresh(true);
      const remaining = freshWindow - ageMs;
      const t = setTimeout(() => setFresh(false), remaining);
      return () => clearTimeout(t);
    }
  }, [createdAt]);

  if (!fresh) return null;

  return (
    <span
      className="mtp-fresh"
      style={{
        fontFamily: UI,
        fontWeight: 700,
        fontSize: "0.5rem",
        letterSpacing: "0.22em",
        color: C.teal,
        border: `1px solid ${C.teal}55`,
        borderRadius: "999px",
        padding: "2px 7px",
        verticalAlign: "middle",
        marginLeft: "0.45rem",
        display: "inline-block",
      }}
    >
      FRESH
    </span>
  );
}

/* ── Long-press context menu on Truth cards ───────────────────────────────── */
function TruthContextMenu({ pos, post, onClose, onSave, isSaved, onEcho, onShareCard }) {
  const notify = useNotice();

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const actions = [
    onSave
      ? {
          label: isSaved ? "Remove bookmark" : "Save truth",
          icon: "✦",
          action: () => {
            onSave(post);
            notify(isSaved ? "Removed from saved." : "Saved.", "neutral", 1400);
            onClose();
          },
        }
      : null,
    onEcho
      ? {
          label: "Echo this truth",
          icon: "◎",
          action: () => {
            onEcho();
          },
        }
      : null,
    {
      label: "Copy text",
      icon: "⎘",
      action: () => {
        navigator.clipboard?.writeText(post.message)
          .then(() => notify("Copied to clipboard.", "neutral", 1600))
          .catch(() => notify("Couldn't copy — try selecting the text.", "warn"));
        onClose();
      },
    },
    typeof navigator !== "undefined" && navigator.share
      ? {
          label: "Share",
          icon: "↗",
          action: () => {
            navigator.share({ text: post.message, title: "My True Post" }).catch(() => {});
            onClose();
          },
        }
      : null,
    onShareCard
      ? {
          label: "Share as card",
          icon: "⊡",
          action: () => { onShareCard(post); onClose(); },
        }
      : null,
  ].filter(Boolean);

  const safeX = Math.min(pos.x + 8, (typeof window !== "undefined" ? window.innerWidth : 400) - 180);
  const safeY = Math.min(pos.y - 8, (typeof window !== "undefined" ? window.innerHeight : 700) - (actions.length * 52 + 16));

  return (
    <>
      <div
        className="fixed inset-0 z-50"
        onClick={onClose}
        style={{ touchAction: "none" }}
      />
      <div
        className="mtp-ctx"
        style={{
          position: "fixed",
          left: safeX,
          top: Math.max(safeY, 60),
          zIndex: 51,
          background: "rgba(22,16,28,0.97)",
          backdropFilter: "blur(22px)",
          border: `1px solid ${C.lineStrong}`,
          borderRadius: "14px",
          overflow: "hidden",
          minWidth: 168,
          boxShadow: "0 12px 48px rgba(0,0,0,0.65)",
        }}
      >
        {actions.map((item, i) => (
          <button
            key={item.label}
            onClick={item.action}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.8rem",
              width: "100%",
              padding: "13px 16px",
              fontFamily: UI,
              fontWeight: 600,
              fontSize: "0.85rem",
              color: C.ink,
              background: "none",
              border: "none",
              borderBottom: i < actions.length - 1 ? `1px solid ${C.line}` : "none",
              cursor: "pointer",
              textAlign: "left",
              transition: "background 120ms ease",
            }}
          >
            <span style={{ fontSize: "1rem", opacity: 0.55, minWidth: "1.2rem" }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}

/* ── Connect celebration — confetti burst when a connect is accepted ────────── */
function ConnectCelebration({ onDone }) {
  const COLORS = [C.ember, C.lav, C.teal, C.amber, C.rose, C.sky];
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    color: COLORS[i % COLORS.length],
    left: `${10 + Math.random() * 80}%`,
    delay: `${Math.random() * 400}ms`,
    duration: `${700 + Math.random() * 600}ms`,
    size: 6 + Math.round(Math.random() * 6),
    shape: Math.random() > 0.5 ? "50%" : "2px",
  }));

  useEffect(() => {
    const t = setTimeout(onDone, 1400);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      aria-hidden
      style={{ position: "fixed", inset: 0, zIndex: 200, pointerEvents: "none", overflow: "hidden" }}
    >
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            top: "30%",
            left: p.left,
            width: p.size,
            height: p.size,
            borderRadius: p.shape,
            background: p.color,
            animationName: "mtpConfetti",
            animationDuration: p.duration,
            animationDelay: p.delay,
            animationTimingFunction: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            animationFillMode: "both",
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          top: "38%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontFamily: SERIF,
          fontStyle: "italic",
          fontSize: "clamp(1.4rem, 5vw, 2rem)",
          color: C.ember,
          textShadow: `0 0 40px ${C.ember}66`,
          textAlign: "center",
          animation: `mtpRise 400ms ${EASE} both`,
        }}
      >
        Connected ♥
      </div>
    </div>
  );
}

/* ── Keyboard shortcut overlay ─────────────────────────────────────────────── */
function KeyboardHelpOverlay({ onClose }) {
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const shortcuts = [
    { key: "N", desc: "Open composer" },
    { key: "1", desc: "Feed" },
    { key: "2", desc: "Discover" },
    { key: "3", desc: "Inbox" },
    { key: "4", desc: "Profile" },
    { key: "S", desc: "Search truths" },
    { key: "B", desc: "Open Confession Booth" },
    { key: "V", desc: "View saved truths" },
    { key: "I", desc: "Open notifications" },
    { key: "?", desc: "Toggle this help" },
    { key: "Esc", desc: "Close overlays" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(14,11,18,0.85)", backdropFilter: "blur(10px)" }}
      onClick={onClose}
    >
      <div
        className="mtp-rise"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "rgba(22,16,28,0.98)",
          border: `1px solid ${C.lineStrong}`,
          borderRadius: "18px",
          padding: "1.6rem",
          maxWidth: "340px",
          width: "100%",
        }}
      >
        <div style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.62rem", letterSpacing: "0.2em", color: C.faint, marginBottom: "1.2rem" }}>
          KEYBOARD SHORTCUTS
        </div>
        <div className="flex flex-col gap-3">
          {shortcuts.map(({ key, desc }) => (
            <div key={key} className="flex items-center justify-between">
              <span style={{ fontFamily: UI, fontSize: "0.85rem", color: C.dim }}>{desc}</span>
              <kbd
                style={{
                  fontFamily: UI,
                  fontWeight: 700,
                  fontSize: "0.72rem",
                  color: C.ink,
                  background: "rgba(245,239,230,0.08)",
                  border: `1px solid ${C.lineStrong}`,
                  borderRadius: "6px",
                  padding: "3px 9px",
                  minWidth: "2rem",
                  textAlign: "center",
                }}
              >
                {key}
              </kbd>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          style={{
            marginTop: "1.4rem",
            width: "100%",
            fontFamily: UI,
            fontWeight: 700,
            fontSize: "0.7rem",
            letterSpacing: "0.16em",
            color: C.dim,
            background: "none",
            border: `1px solid ${C.line}`,
            borderRadius: "999px",
            padding: "9px",
            cursor: "pointer",
          }}
        >
          CLOSE
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   TRUTH ECHO MODAL — lets users "echo" another person's truth with their own
   voice: write a response that acknowledges the original and adds their
   perspective. Echoes are posted as new truths with a quoted reference.
   ════════════════════════════════════════════════════════════════════════════ */

function TruthEchoModal({ original, me, onSubmit, onClose, freePost = false }) {
  const [text, setText] = useState("");
  const [mood, setMood] = useState(original?.mood || "raw");
  const textRef = useRef(null);
  const m = moodOf(mood);
  const origM = moodOf(original?.mood);
  const postColor = freePost ? C.teal : C.ember;

  useBodyLock(true);
  useEscape(true, onClose);

  useEffect(() => {
    setTimeout(() => textRef.current?.focus(), 80);
  }, []);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 280)}px`;
  }, [text]);

  const trimmed = text.trim();
  const canPost = trimmed.length > 0 && trimmed.length <= TRUTH_HARD_LIMIT;
  const echoMessage = `"${original?.message}" — ${trimmed}`;

  return (
    <div
      className="fixed inset-0 z-[66] flex items-end justify-center"
      style={{ background: "rgba(14,11,18,0.85)", backdropFilter: "blur(10px)" }}
    >
      <div
        className="mtp-drawer w-full"
        style={{
          background: "rgba(18,13,22,0.98)",
          borderTop: `1px solid ${C.lineStrong}`,
          borderRadius: "20px 20px 0 0",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          maxWidth: "640px",
          margin: "0 auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "0.7rem 0 0" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: C.line }} />
        </div>

        {/* header */}
        <div className="flex items-center justify-between" style={{ padding: "0.75rem 1.4rem 0.5rem" }}>
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "1rem", color: C.ink }}>
            Echo this truth
          </div>
          <button onClick={onClose} style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.7rem", color: C.dim, background: "none", border: "none", cursor: "pointer" }}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto mtp-scroll" style={{ padding: "0 1.4rem 1.4rem" }}>
          {/* original truth quote */}
          <div
            style={{
              borderLeft: `2px solid ${origM.color}`,
              paddingLeft: "0.9rem",
              marginBottom: "1.4rem",
              opacity: 0.75,
            }}
          >
            <div style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.56rem", letterSpacing: "0.2em", color: origM.color, marginBottom: "0.3rem" }}>
              ECHOING · {original?.displayName?.toUpperCase()}
            </div>
            <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "0.95rem", color: C.ink, margin: 0, lineHeight: 1.4 }}>
              "{original?.message}"
            </p>
          </div>

          {/* compose response */}
          <div style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.58rem", letterSpacing: "0.2em", color: C.dim, marginBottom: "0.6rem" }}>
            YOUR ECHO
          </div>
          <textarea
            ref={textRef}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, TRUTH_HARD_LIMIT))}
            placeholder={`Say what this brings up for you…`}
            rows={3}
            className="w-full resize-none outline-none mtp-scroll"
            style={{
              fontFamily: SERIF,
              fontStyle: "italic",
              fontSize: "clamp(1.2rem, 4vw, 1.6rem)",
              lineHeight: 1.4,
              color: C.ink,
              background: "transparent",
              border: "none",
              caretColor: m.color,
              overflow: "hidden",
              width: "100%",
            }}
          />

          <div style={{ height: "1px", background: C.line, margin: "0.75rem 0" }} />

          {/* mood + submit row */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-4">
              {MOOD_ORDER.map((k) => {
                const mm = MOODS[k];
                return (
                  <button
                    key={k}
                    onClick={() => setMood(k)}
                    style={{
                      fontFamily: UI,
                      fontWeight: 700,
                      fontSize: "0.6rem",
                      letterSpacing: "0.2em",
                      padding: "3px 0",
                      color: mood === k ? mm.color : C.faint,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      borderBottom: `1px solid ${mood === k ? mm.color : "transparent"}`,
                      transition: "all 160ms ease",
                    }}
                  >
                    {mm.label}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3 items-center">
              <button
                onClick={onClose}
                style={{ fontFamily: UI, fontSize: "0.72rem", color: C.dim, background: "none", border: "none", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={() => canPost && onSubmit(echoMessage, mood)}
                disabled={!canPost}
                style={{
                  fontFamily: UI,
                  fontWeight: 700,
                  fontSize: "0.72rem",
                  letterSpacing: "0.1em",
                  color: canPost ? C.bg : C.faint,
                  background: canPost ? postColor : "transparent",
                  border: `1px solid ${canPost ? postColor : C.line}`,
                  borderRadius: "999px",
                  padding: "7px 16px",
                  cursor: canPost ? "pointer" : "default",
                  transition: "all 180ms ease",
                }}
              >
                {freePost ? "ECHO FREE" : `ECHO · $${TRUTH_PRICE}`}
              </button>
            </div>
          </div>

          <p style={{ fontFamily: UI, fontSize: "0.64rem", color: C.faint, marginTop: "0.8rem", lineHeight: 1.5 }}>
            Your echo will be posted as a new truth. The original will be quoted at the start.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   CHAT INFO OVERLAY — view the details of a conversation: who you're talking
   to, the originating truth, and options to report or block.
   ════════════════════════════════════════════════════════════════════════════ */

function ChatInfoOverlay({ chat, me, onBlock, onReport, onClose }) {
  const other = chat.author?.uid === me.uid ? chat.connector : chat.author;
  const hue = hueFor(other?.uid);
  const m = moodOf(chat.truth?.mood);
  const messages = useChatMessages(chat.feedId, chat.id);
  const [confirmBlock, setConfirmBlock] = useState(false);

  useBodyLock(true);
  useEscape(true, onClose);

  const wordCount = messages.reduce((n, msg) => n + (msg.text?.split(/\s+/).length || 0), 0);
  const duration = (() => {
    if (messages.length < 2) return null;
    const first = toDate(messages[0].createdAt);
    const last  = toDate(messages[messages.length - 1].createdAt);
    if (!first || !last) return null;
    const diffMs = last.getTime() - first.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return "today";
    if (diffDays === 1) return "1 day";
    return `${diffDays} days`;
  })();

  return (
    <div
      className="fixed inset-0 z-[66] flex flex-col mtp-rise"
      style={{ background: C.bg }}
    >
      <header
        className="shrink-0"
        style={{
          background: "rgba(14,11,18,0.92)",
          backdropFilter: "blur(14px)",
          borderBottom: `1px solid ${C.line}`,
          padding: "0.9rem 1.4rem",
          display: "flex",
          alignItems: "center",
          gap: "0.8rem",
        }}
      >
        <button onClick={onClose} style={{ fontFamily: UI, fontWeight: 700, fontSize: "1.1rem", color: C.dim, background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}>
          ←
        </button>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "1.1rem", color: C.ink }}>
          Conversation Info
        </div>
      </header>

      <div className="flex-1 overflow-y-auto mtp-scroll">
        <div className="mx-auto px-6 py-8" style={{ maxWidth: "42rem" }}>
          {/* person */}
          <div className="flex flex-col items-center" style={{ paddingBottom: "2rem", borderBottom: `1px solid ${C.line}` }}>
            <Avatar name={other?.displayName} hue={hue} size={72} photoURL={other?.photoURL} />
            <div style={{ fontFamily: UI, fontWeight: 600, fontSize: "1rem", color: C.ink, marginTop: "0.8rem" }}>
              {other?.displayName}{other?.age ? `, ${other.age}` : ""}
            </div>
            <div style={{ fontFamily: UI, fontSize: "0.7rem", color: C.dim, marginTop: "0.2rem" }}>
              Connected through a confession
            </div>
          </div>

          {/* originating truth */}
          <div style={{ padding: "1.5rem 0", borderBottom: `1px solid ${C.line}` }}>
            <Eyebrow color={m.color}>THE TRUTH THAT STARTED THIS</Eyebrow>
            <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "1.05rem", color: C.ink, lineHeight: 1.4, margin: "0.6rem 0 0" }}>
              "{chat.truth?.text}"
            </p>
          </div>

          {/* conversation stats */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "1px",
              background: C.line,
              borderRadius: "12px",
              overflow: "hidden",
              margin: "1.5rem 0",
            }}
          >
            {[
              { n: messages.length, label: "MESSAGES" },
              { n: wordCount, label: "WORDS" },
              { n: duration || "—", label: "DURATION" },
            ].map(({ n, label }) => (
              <div key={label} style={{ textAlign: "center", padding: "1.2rem 0.5rem", background: C.bg }}>
                <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "1.4rem", color: C.ink, lineHeight: 1 }}>{n}</div>
                <div style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.5rem", letterSpacing: "0.16em", color: C.faint, marginTop: "0.25rem" }}>{label}</div>
              </div>
            ))}
          </div>

          {/* actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <button
              onClick={onReport}
              style={{
                fontFamily: UI,
                fontWeight: 600,
                fontSize: "0.8rem",
                color: C.dim,
                background: "none",
                border: `1px solid ${C.line}`,
                borderRadius: "10px",
                padding: "14px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              Report this conversation
            </button>

            {confirmBlock ? (
              <div style={{ border: `1px solid ${C.rose}55`, borderRadius: "10px", padding: "1rem" }}>
                <p style={{ fontFamily: UI, fontSize: "0.8rem", color: C.dim, margin: "0 0 0.75rem" }}>
                  Block {other?.displayName}? They won't be able to connect with you again.
                </p>
                <div style={{ display: "flex", gap: "0.6rem" }}>
                  <button
                    onClick={onBlock}
                    style={{
                      fontFamily: UI, fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.1em",
                      color: C.bg, background: C.rose, border: "none", borderRadius: "999px",
                      padding: "8px 18px", cursor: "pointer",
                    }}
                  >
                    BLOCK
                  </button>
                  <button
                    onClick={() => setConfirmBlock(false)}
                    style={{
                      fontFamily: UI, fontSize: "0.72rem", color: C.dim, background: "none",
                      border: `1px solid ${C.line}`, borderRadius: "999px", padding: "8px 16px", cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmBlock(true)}
                style={{
                  fontFamily: UI,
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  color: C.rose,
                  background: "none",
                  border: `1px solid ${C.rose}44`,
                  borderRadius: "10px",
                  padding: "14px",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                Block {other?.displayName}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PUBLIC FEED STATS — a quiet strip at the top of the feed showing today's
   overall truth stats: total truths, reactions, and dominant mood. This data
   is derived from the live feed, so it updates as new truths appear.
   ════════════════════════════════════════════════════════════════════════════ */

function PublicFeedStats({ posts }) {
  const stats = useMemo(() => {
    if (!posts || posts.length < 3) return null;
    const total = posts.length;
    const totalReactions = posts.reduce((s, p) => s + reactionTotal(p), 0);
    const totalConnects  = posts.reduce((s, p) => s + (p.connect || []).filter((c) => c.flag === "accept").length, 0);

    const moodCounts = {};
    MOOD_ORDER.forEach((k) => { moodCounts[k] = posts.filter((p) => p.mood === k).length; });
    const topMood = MOOD_ORDER.reduce((best, k) => (moodCounts[k] > (moodCounts[best] || 0) ? k : best), MOOD_ORDER[0]);

    return { total, totalReactions, totalConnects, topMood };
  }, [posts]);

  if (!stats) return null;

  const m = MOODS[stats.topMood];

  return (
    <div
      style={{
        display: "flex",
        gap: "0",
        borderBottom: `1px solid ${C.line}`,
        overflow: "hidden",
      }}
    >
      {[
        { n: stats.total, label: "TRUTHS TODAY", color: C.ink },
        { n: stats.totalReactions, label: "REACTIONS", color: C.ember },
        { n: stats.totalConnects, label: "CONNECTED", color: C.teal },
        { n: m.label, label: "TOP MOOD", color: m.color },
      ].map(({ n, label, color }, i) => (
        <div
          key={label}
          style={{
            flex: 1,
            textAlign: "center",
            padding: "0.85rem 0.25rem",
            borderRight: i < 3 ? `1px solid ${C.line}` : "none",
          }}
        >
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "1.1rem", color, lineHeight: 1 }}>{n}</div>
          <div style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.48rem", letterSpacing: "0.14em", color: C.faint, marginTop: "0.2rem", lineHeight: 1.3 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   TRUTH TIMELINE — groups a user's own truths by calendar month. Used on the
   profile tab to give a reading of their journey over time.
   ════════════════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════════════════
   USE MOOD STREAK — calculates how many consecutive days the user has posted,
   and which mood has dominated their last 7 posts. Returns the streak count
   and the dominant mood key.
   ════════════════════════════════════════════════════════════════════════════ */

const STREAK_KEY = "mtp-streak-v1";

function useMoodStreak(myFeeds) {
  return useMemo(() => {
    if (!myFeeds || myFeeds.length === 0) return { streak: 0, dominantMood: null };

    // Build a set of ISO dates on which the user posted
    const postDates = new Set(
      myFeeds.map((f) => {
        const d = toDate(f.createdAt);
        return d ? d.toISOString().slice(0, 10) : null;
      }).filter(Boolean)
    );

    // Count streak from today backwards
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (postDates.has(key)) {
        streak++;
      } else if (i > 0) {
        break; // gap
      }
    }

    // Dominant mood in last 7 posts
    const recent = [...myFeeds]
      .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0))
      .slice(0, 7);
    const moodCount = {};
    recent.forEach((f) => { moodCount[f.mood] = (moodCount[f.mood] || 0) + 1; });
    const dominantMood = Object.entries(moodCount).sort(([, a], [, b]) => b - a)[0]?.[0] || null;

    return { streak, dominantMood };
  }, [myFeeds]);
}

/* ════════════════════════════════════════════════════════════════════════════
   MOOD STREAK WIDGET — shown in ProfileTab below the stats bar. Displays the
   current posting streak (days) and the dominant mood from recent posts.
   ════════════════════════════════════════════════════════════════════════════ */

function MoodStreakWidget({ myFeeds }) {
  const { streak, dominantMood } = useMoodStreak(myFeeds);
  const m = moodOf(dominantMood || "raw");

  if (!myFeeds || myFeeds.length === 0) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "1px",
        background: C.line,
        borderRadius: "14px",
        overflow: "hidden",
        margin: "1.2rem 0",
      }}
    >
      {/* streak */}
      <div style={{ background: C.bg, padding: "1.1rem 1.2rem" }}>
        <div style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.52rem", letterSpacing: "0.16em", color: C.faint, marginBottom: "0.35rem" }}>
          POSTING STREAK
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.3rem" }}>
          <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "2rem", color: streak > 0 ? C.amber : C.dim, lineHeight: 1 }}>
            {streak}
          </span>
          <span style={{ fontFamily: UI, fontSize: "0.7rem", color: C.dim }}>
            {streak === 1 ? "day" : "days"}
          </span>
        </div>
        {streak >= 7 && (
          <div style={{ fontFamily: UI, fontSize: "0.6rem", color: C.amber, marginTop: "0.3rem" }}>
            🔥 On a roll
          </div>
        )}
      </div>

      {/* dominant mood */}
      <div style={{ background: C.bg, padding: "1.1rem 1.2rem" }}>
        <div style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.52rem", letterSpacing: "0.16em", color: C.faint, marginBottom: "0.35rem" }}>
          RECENT MOOD
        </div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "1.4rem", color: m.color, lineHeight: 1 }}>
          {m.label}
        </div>
        <div style={{ fontFamily: UI, fontSize: "0.6rem", color: C.dim, marginTop: "0.3rem" }}>
          last 7 truths
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   USE SESSION STATS — tracks lightweight per-session reading behavior using
   module-level counters that reset with each page load. This is deliberately
   NOT stored anywhere — it's a moment-in-time reading signal, not a metric.
   ════════════════════════════════════════════════════════════════════════════ */

let _sessionTruthsSeen = 0;
let _sessionReactionsFired = 0;

function useSessionStats() {
  const [seen, setSeen] = useState(_sessionTruthsSeen);
  const [reactions, setReactions] = useState(_sessionReactionsFired);

  const trackSeen = useCallback(() => {
    _sessionTruthsSeen += 1;
    setSeen(_sessionTruthsSeen);
  }, []);

  const trackReaction = useCallback(() => {
    _sessionReactionsFired += 1;
    setReactions(_sessionReactionsFired);
  }, []);

  return { seen, reactions, trackSeen, trackReaction };
}

/* ════════════════════════════════════════════════════════════════════════════
   TRUTH SHARE CARD — a visual card format that can be screenshot-shared to
   social media. Renders the truth message, the poster's anonymous name, and
   the mood in the app's visual language. Hidden until explicitly triggered.
   ════════════════════════════════════════════════════════════════════════════ */

function TruthShareCard({ post, onClose }) {
  const m = moodOf(post?.mood);
  useBodyLock(true);
  useEscape(true, onClose);

  if (!post) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center"
      style={{ background: "rgba(14,11,18,0.9)", backdropFilter: "blur(14px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(400px, 90vw)",
          aspectRatio: "1",
          background: C.bg,
          border: `1px solid ${C.lineStrong}`,
          borderRadius: "24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2.5rem",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* mood glow */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(60% 60% at 50% 40%, ${m.color}22, transparent 70%)`,
            pointerEvents: "none",
          }}
        />

        {/* brand */}
        <div style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.55rem", letterSpacing: "0.25em", color: C.faint, marginBottom: "1.8rem" }}>
          MY TRUE POST
        </div>

        {/* the truth */}
        <p
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: "clamp(1.1rem, 4vw, 1.4rem)",
            lineHeight: 1.4,
            color: C.ink,
            textAlign: "center",
            margin: "0 0 1.8rem",
          }}
        >
          "{post.message}"
        </p>

        {/* mood chip */}
        <div
          style={{
            fontFamily: UI,
            fontWeight: 700,
            fontSize: "0.56rem",
            letterSpacing: "0.2em",
            color: m.color,
            background: `${m.color}18`,
            border: `1px solid ${m.color}40`,
            borderRadius: "999px",
            padding: "4px 12px",
            marginBottom: "1rem",
          }}
        >
          {m.label}
        </div>

        {/* prompt to visit */}
        <div style={{ fontFamily: UI, fontSize: "0.65rem", color: C.faint }}>
          mytruepost.com
        </div>

        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            fontFamily: UI,
            fontWeight: 700,
            fontSize: "0.7rem",
            color: C.faint,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px 8px",
          }}
        >
          ✕
        </button>
      </div>

      <p
        style={{
          position: "absolute",
          bottom: "2rem",
          fontFamily: UI,
          fontSize: "0.7rem",
          color: C.dim,
          textAlign: "center",
        }}
      >
        Screenshot to share
      </p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   TRUTH INSIGHT CARD — a single personalized sentence synthesized from the
   user's posting history. Shown in the profile tab just above the timeline.
   Pure derivation — no network calls, no state.
   ════════════════════════════════════════════════════════════════════════════ */

function TruthInsightCard({ myFeeds, analytics }) {
  const insight = useMemo(() => {
    if (!myFeeds || myFeeds.length === 0) return null;

    const count = myFeeds.length;
    const m = moodOf(analytics?.bestMood);
    const bestMoodLabel = m?.label?.toLowerCase() || "raw";
    const bestPost = analytics?.bestPost;
    const avgReact = analytics?.avgReactions || 0;

    if (count < 3) return `You've posted ${count} truth${count === 1 ? "" : "s"}. Keep going.`;
    if (avgReact > 20) return `Your truths land hard. ${avgReact.toFixed(0)} avg reactions. People feel you.`;
    if (analytics?.bestMood) return `Most of your truths come from a ${bestMoodLabel} place. That tracks.`;
    if (bestPost) return `Your most resonant truth came from a quiet moment. That one stays with people.`;
    return `${count} truths posted. You've been honest. That matters.`;
  }, [myFeeds, analytics]);

  if (!insight) return null;

  const m = moodOf(analytics?.bestMood || "raw");

  return (
    <div
      style={{
        margin: "1.2rem 0",
        padding: "1rem 1.2rem",
        border: `1px solid ${m.color}30`,
        borderLeft: `3px solid ${m.color}`,
        borderRadius: "0 12px 12px 0",
        background: `${m.color}08`,
      }}
    >
      <div style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.55rem", letterSpacing: "0.18em", color: m.color, marginBottom: "0.4rem" }}>
        YOUR TRUTH PATTERN
      </div>
      <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "0.95rem", color: C.ink, margin: 0, lineHeight: 1.45 }}>
        {insight}
      </p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   USE HAPTIC FEEDBACK — wraps navigator.vibrate for mobile devices. Provides
   a soft, contextual vibration for key interactions (reactions, connects, sends).
   No-ops silently on desktop or when the API is unavailable.
   ════════════════════════════════════════════════════════════════════════════ */

function useHapticFeedback() {
  const vibrate = useCallback((pattern = 8) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (_) {}
    }
  }, []);

  return {
    tap:       () => vibrate(8),
    softTap:   () => vibrate(4),
    doubleTap: () => vibrate([6, 30, 6]),
    success:   () => vibrate([8, 40, 16]),
    error:     () => vibrate([12, 30, 12, 30, 12]),
    send:      () => vibrate([4, 20, 8]),
  };
}

/* ════════════════════════════════════════════════════════════════════════════
   TRUTH LENGTH BAR — a minimal visual indicator below the composer textarea
   that fills from left to right as the user approaches TRUTH_HARD_LIMIT.
   Transitions from teal to amber to ember as the limit approaches.
   ════════════════════════════════════════════════════════════════════════════ */

function TruthLengthBar({ length, max = TRUTH_HARD_LIMIT }) {
  const pct = Math.min(length / max, 1);
  const nearLimit = pct > 0.8;
  const atLimit   = pct >= 1;
  const color = atLimit ? C.rose : nearLimit ? C.ember : C.teal;
  const remaining = max - length;

  if (length === 0) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.4rem" }}>
      <div
        style={{
          flex: 1,
          height: 2,
          background: C.line,
          borderRadius: 1,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct * 100}%`,
            height: "100%",
            background: color,
            borderRadius: 1,
            transition: "width 80ms ease, background 200ms ease",
          }}
        />
      </div>
      {nearLimit && (
        <span
          style={{
            fontFamily: UI,
            fontWeight: 700,
            fontSize: "0.58rem",
            color,
            letterSpacing: "0.06em",
            transition: "color 200ms ease",
          }}
        >
          {remaining}
        </span>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   OFFLINE BANNER — shown at the top of the app when the device loses network
   access. Fades in on disconnect, fades out on reconnect, then shows a brief
   "Back online" confirmation. Relies on useOnlineStatus hook.
   ════════════════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════════════════
   SPARK LINE — a lightweight inline SVG sparkline for showing activity trends
   over time. Used in ProfileTab to visualize posting frequency. Renders as a
   small path on a transparent background, purely decorative.
   ════════════════════════════════════════════════════════════════════════════ */

function SparkLine({ values, width = 80, height = 28, color = C.ember, strokeWidth = 1.5 }) {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - (v / max) * (height - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const d = `M${pts.join(" L")}`;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", overflow: "visible" }}
      aria-hidden
    >
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
    </svg>
  );
}

function ActivitySpark({ myFeeds, days = 14 }) {
  const values = useMemo(() => {
    const buckets = Array(days).fill(0);
    const now = Date.now();
    const dayMs = 86400000;
    myFeeds.forEach((f) => {
      const d = toDate(f.createdAt);
      if (!d) return;
      const daysAgo = Math.floor((now - d.getTime()) / dayMs);
      if (daysAgo >= 0 && daysAgo < days) buckets[days - 1 - daysAgo] += 1;
    });
    return buckets;
  }, [myFeeds, days]);

  const hasActivity = values.some((v) => v > 0);
  if (!hasActivity) return null;

  const m = moodOf(null);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.5rem" }}>
      <SparkLine values={values} color={C.lav} />
      <span style={{ fontFamily: UI, fontSize: "0.58rem", color: C.faint }}>
        last {days}d
      </span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   FEED FOOTER — a minimal closing note shown at the very bottom of the feed,
   after all truths have loaded. Reinforces the brand voice and shows a live
   count of total truths in the current session's feed.
   ════════════════════════════════════════════════════════════════════════════ */

function FeedFooter({ postCount }) {
  return (
    <div
      style={{
        padding: "3rem 1.5rem 5rem",
        textAlign: "center",
        borderTop: `1px solid ${C.line}`,
      }}
    >
      <div
        style={{
          fontFamily: SERIF,
          fontStyle: "italic",
          fontSize: "1.1rem",
          color: C.faint,
          lineHeight: 1.5,
          marginBottom: "1rem",
        }}
      >
        {postCount > 0
          ? `${postCount} truth${postCount !== 1 ? "s" : ""} live right now.`
          : "Be the first truth tonight."}
      </div>
      <div
        style={{
          fontFamily: UI,
          fontWeight: 700,
          fontSize: "0.52rem",
          letterSpacing: "0.22em",
          color: C.faint,
          opacity: 0.5,
        }}
      >
        MY TRUE POST · ANONYMOUS · HONEST · REAL
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   COMPOSE HINT BAR — a subtle rotating prompt bar shown above the Composer
   when no draft is open. Cycles through PROMPTS every few seconds so there's
   always something to react to, even for users who aren't sure what to say.
   ════════════════════════════════════════════════════════════════════════════ */

function ComposeHintBar({ onAccept }) {
  const [promptIndex, setPromptIndex] = useState(() => Math.floor(Math.random() * PROMPTS.length));
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const tick = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setPromptIndex((i) => (i + 1) % PROMPTS.length);
        setFading(false);
      }, 350);
    }, 5000);
    return () => clearInterval(tick);
  }, []);

  const prompt = PROMPTS[promptIndex];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.7rem 1.4rem",
        borderBottom: `1px solid ${C.line}`,
        cursor: "pointer",
        transition: "background 160ms ease",
      }}
      onClick={() => onAccept?.(prompt)}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      role="button"
      aria-label="Use this prompt"
    >
      <div
        style={{
          fontFamily: UI,
          fontWeight: 700,
          fontSize: "0.52rem",
          letterSpacing: "0.18em",
          color: C.ember,
          flexShrink: 0,
        }}
      >
        TODAY
      </div>
      <p
        style={{
          fontFamily: SERIF,
          fontStyle: "italic",
          fontSize: "0.88rem",
          color: C.dim,
          margin: 0,
          flex: 1,
          lineHeight: 1.3,
          opacity: fading ? 0 : 1,
          transition: "opacity 300ms ease",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {prompt}
      </p>
      <div
        style={{
          fontFamily: UI,
          fontWeight: 700,
          fontSize: "0.58rem",
          color: C.faint,
          flexShrink: 0,
        }}
      >
        →
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   FEED WELCOME HEADER — shown to users who haven't posted yet. Guides them
   toward their first truth without being pushy or transactional.
   ════════════════════════════════════════════════════════════════════════════ */

function FeedWelcomeHeader({ onCompose }) {
  return (
    <div
      style={{
        padding: "2.5rem 1.5rem 2rem",
        borderBottom: `1px solid ${C.line}`,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: SERIF,
          fontStyle: "italic",
          fontSize: "clamp(1.4rem, 5vw, 2rem)",
          color: C.ink,
          lineHeight: 1.3,
          marginBottom: "0.8rem",
        }}
      >
        This is where truths live.
      </div>
      <p
        style={{
          fontFamily: UI,
          fontSize: "0.8rem",
          color: C.dim,
          lineHeight: 1.6,
          maxWidth: "28rem",
          margin: "0 auto 1.5rem",
        }}
      >
        Anonymous. Honest. Real. Post what you've been carrying and see who else has been carrying it too.
      </p>
      {onCompose && (
        <button
          onClick={onCompose}
          style={{
            fontFamily: UI,
            fontWeight: 700,
            fontSize: "0.72rem",
            letterSpacing: "0.12em",
            color: C.bg,
            background: C.ember,
            border: "none",
            borderRadius: "999px",
            padding: "12px 28px",
            cursor: "pointer",
          }}
        >
          SAY SOMETHING TRUE
        </button>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   USE TYPING EFFECT — animates a prompt string character by character. Used in
   the Composer placeholder to cycle through prompts with a soft typewriter feel.
   Falls back instantly if the user prefers reduced motion.
   ════════════════════════════════════════════════════════════════════════════ */

function useTypingEffect(texts, { speed = 38, pause = 2200, enabled = true } = {}) {
  const [displayText, setDisplayText] = useState(texts[0] || "");
  const [textIndex, setTextIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [phase, setPhase] = useState("typing"); // "typing" | "pausing" | "erasing"
  const prefersReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!enabled || prefersReduced || texts.length === 0) {
      setDisplayText(texts[0] || "");
      return;
    }

    let timer;
    const current = texts[textIndex];

    if (phase === "typing") {
      if (charIndex < current.length) {
        timer = setTimeout(() => {
          setDisplayText(current.slice(0, charIndex + 1));
          setCharIndex((c) => c + 1);
        }, speed);
      } else {
        timer = setTimeout(() => setPhase("pausing"), pause);
      }
    } else if (phase === "pausing") {
      timer = setTimeout(() => setPhase("erasing"), 400);
    } else if (phase === "erasing") {
      if (charIndex > 0) {
        timer = setTimeout(() => {
          setDisplayText(current.slice(0, charIndex - 1));
          setCharIndex((c) => c - 1);
        }, speed * 0.6);
      } else {
        const nextIndex = (textIndex + 1) % texts.length;
        setTextIndex(nextIndex);
        setPhase("typing");
      }
    }
    return () => clearTimeout(timer);
  }, [enabled, prefersReduced, texts, textIndex, charIndex, phase, speed, pause]);

  return displayText;
}

/* ════════════════════════════════════════════════════════════════════════════
   OWN-POST INDICATOR — a subtle chip shown on a Truth when me.uid matches
   post.uid, so the user knows which ones are theirs in the feed.
   ════════════════════════════════════════════════════════════════════════════ */

function OwnPostChip() {
  return (
    <span
      style={{
        fontFamily: UI,
        fontWeight: 700,
        fontSize: "0.48rem",
        letterSpacing: "0.18em",
        color: C.lav,
        background: `${C.lav}18`,
        border: `1px solid ${C.lav}35`,
        borderRadius: "999px",
        padding: "2px 7px",
        verticalAlign: "middle",
        marginLeft: "0.5rem",
      }}
    >
      YOURS
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   TRUTH TIMELINE — groups a user's own truths by calendar month.
   ════════════════════════════════════════════════════════════════════════════ */

function TruthTimeline({ myFeeds, onPostTap }) {
  const grouped = useMemo(() => {
    if (!myFeeds.length) return [];
    const map = {};
    myFeeds.forEach((f) => {
      const d = toDate(f.createdAt);
      if (!d) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      if (!map[key]) map[key] = { key, label, posts: [] };
      map[key].posts.push(f);
    });
    return Object.values(map)
      .sort((a, b) => b.key.localeCompare(a.key))
      .map((g) => ({ ...g, posts: g.posts.sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0)) }));
  }, [myFeeds]);

  if (!grouped.length) return null;

  return (
    <div style={{ marginTop: "2.5rem" }}>
      <Eyebrow>YOUR TRUTH TIMELINE</Eyebrow>
      <div style={{ marginTop: "1rem" }}>
        {grouped.map((g) => (
          <div key={g.key} style={{ marginBottom: "1.8rem" }}>
            {/* month header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                marginBottom: "0.6rem",
              }}
            >
              <div style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.62rem", letterSpacing: "0.2em", color: C.dim, whiteSpace: "nowrap" }}>
                {g.label.toUpperCase()}
              </div>
              <div style={{ flex: 1, height: "1px", background: C.line }} />
              <div style={{ fontFamily: UI, fontSize: "0.58rem", color: C.faint }}>
                {g.posts.length} truth{g.posts.length !== 1 ? "s" : ""}
              </div>
            </div>

            {/* posts in that month */}
            {g.posts.map((post) => {
              const m = moodOf(post.mood);
              const reactions = reactionTotal(post);
              return (
                <button
                  key={post.id}
                  onClick={() => onPostTap?.(post)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                    width: "100%",
                    background: "none",
                    border: "none",
                    cursor: onPostTap ? "pointer" : "default",
                    padding: "0.6rem 0",
                    borderBottom: `1px solid ${C.line}`,
                    textAlign: "left",
                  }}
                >
                  {/* mood dot */}
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: m.color, flexShrink: 0, marginTop: "0.5rem" }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "0.95rem", color: C.ink, margin: 0, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      "{post.message}"
                    </p>
                    <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.3rem", flexWrap: "wrap" }}>
                      <span style={{ fontFamily: UI, fontSize: "0.6rem", color: C.faint }}>{timeAgo(post.createdAt)}</span>
                      {reactions > 0 && (
                        <span style={{ fontFamily: UI, fontSize: "0.6rem", color: C.dim }}>{reactions} reaction{reactions !== 1 ? "s" : ""}</span>
                      )}
                      {(post.connect || []).filter((c) => c.flag === "accept").length > 0 && (
                        <span style={{ fontFamily: UI, fontSize: "0.6rem", color: C.teal }}>
                          {(post.connect || []).filter((c) => c.flag === "accept").length} connected
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ flexShrink: 0, fontFamily: UI, fontWeight: 700, fontSize: "0.58rem", letterSpacing: "0.14em", color: m.color, marginTop: "0.3rem" }}>
                    {moodOf(post.mood).label}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   QUICK ACTION BAR — a compact floating row of frequently-used V5 features.
   Sits above the nav capsule when on the feed tab and visible after scrolling.
   ════════════════════════════════════════════════════════════════════════════ */

function QuickActionBar({ onOpenBooth, onOpenSaved, savedCount, onOpenSearch, visible }) {
  if (!visible) return null;
  return (
    <div
      className="fixed z-[39] mtp-rise"
      style={{
        bottom: "5.4rem",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: "0.45rem",
        pointerEvents: "auto",
      }}
    >
      {[
        { label: "◈ BOOTH", color: C.lav, action: onOpenBooth },
        {
          label: savedCount > 0 ? `✦ SAVED · ${savedCount}` : "✦ SAVED",
          color: C.amber,
          action: onOpenSaved,
        },
        { label: "⌕ SEARCH", color: C.dim, action: onOpenSearch },
      ].map(({ label, color, action }) => (
        <button
          key={label}
          onClick={action}
          style={{
            fontFamily: UI,
            fontWeight: 700,
            fontSize: "0.56rem",
            letterSpacing: "0.14em",
            color,
            background: "rgba(14,11,18,0.88)",
            backdropFilter: "blur(16px)",
            border: `1px solid ${color}44`,
            borderRadius: "999px",
            padding: "6px 11px",
            cursor: "pointer",
            whiteSpace: "nowrap",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   ONBOARDING FLOW — shown once to new users. Three slides explain the thesis,
   the mechanics, and the cost. Stored in localStorage so it never repeats.
   ════════════════════════════════════════════════════════════════════════════ */

const ONBOARD_SLIDES = [
  {
    icon: "✦",
    title: "Truth creates connection.",
    body: "My True Post is the only place where you say the real thing — not the highlight reel version. Other people feel it. Connections form from honesty.",
    cta: "NEXT",
  },
  {
    icon: "♥",
    title: "Post it. See who feels it.",
    body: "Write something true. React to other people's truths. When someone's truth moves you, reach out. They'll see your request in their inbox.",
    cta: "NEXT",
  },
  {
    icon: "◈",
    title: "Your first truth is on us.",
    body: "One free confession to start. After that, each truth is $" + TRUTH_PRICE + ". No subscriptions, no algorithms, no ads — just the truth and whoever needs to hear it.",
    cta: "START CONFESSING",
  },
];

function OnboardingFlow({ onDone }) {
  const [slide, setSlide] = useState(0);
  const current = ONBOARD_SLIDES[slide];
  const isLast = slide === ONBOARD_SLIDES.length - 1;

  useBodyLock(true);

  const advance = () => {
    if (isLast) { onDone(); return; }
    setSlide((s) => s + 1);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-6"
      style={{ background: `radial-gradient(900px 700px at 50% 110%, #1C1426 0%, ${C.bg} 60%)` }}
    >
      <div
        key={slide}
        className="mtp-rise w-full max-w-sm text-center flex flex-col items-center gap-6"
      >
        {/* icon */}
        <div
          style={{
            fontFamily: SERIF,
            fontSize: "3.5rem",
            lineHeight: 1,
            color: C.ember,
            textShadow: `0 0 60px ${C.ember}66`,
          }}
        >
          {current.icon}
        </div>

        {/* heading */}
        <h2
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: "clamp(1.7rem, 7vw, 2.2rem)",
            lineHeight: 1.15,
            color: C.ink,
            margin: 0,
          }}
        >
          {current.title}
        </h2>

        {/* body */}
        <p
          style={{
            fontFamily: UI,
            fontSize: "0.92rem",
            lineHeight: 1.65,
            color: C.dim,
            margin: 0,
            maxWidth: "24rem",
          }}
        >
          {current.body}
        </p>

        {/* step dots */}
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {ONBOARD_SLIDES.map((_, i) => (
            <div
              key={i}
              onClick={() => setSlide(i)}
              style={{
                width: i === slide ? 20 : 6,
                height: 6,
                borderRadius: 999,
                background: i === slide ? C.ember : C.faint,
                cursor: "pointer",
                transition: "all 300ms ease",
              }}
            />
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={advance}
          style={{
            fontFamily: UI,
            fontWeight: 700,
            fontSize: "0.76rem",
            letterSpacing: "0.2em",
            color: C.bg,
            background: C.ember,
            border: "none",
            borderRadius: "999px",
            padding: "13px 32px",
            cursor: "pointer",
            boxShadow: `0 0 40px ${C.ember}55`,
            transition: "all 200ms ease",
          }}
        >
          {current.cta}
        </button>

        {/* skip */}
        {!isLast && (
          <button
            onClick={onDone}
            style={{
              fontFamily: UI,
              fontSize: "0.72rem",
              color: C.faint,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   CONFESSION BOOTH — full-screen immersive writing experience. Invoked from
   the Composer when the user wants a distraction-free canvas. The ghost field
   drifts softly behind. Mood, anon-mode, and submit live at the bottom.
   ════════════════════════════════════════════════════════════════════════════ */

function BoothMoodPicker({ mood, onChange }) {
  return (
    <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
      {MOOD_ORDER.map((k) => {
        const m = MOODS[k];
        const active = mood === k;
        return (
          <button
            key={k}
            onClick={() => onChange(k)}
            aria-pressed={active}
            style={{
              fontFamily: UI,
              fontWeight: 700,
              fontSize: "0.62rem",
              letterSpacing: "0.2em",
              padding: "6px 13px",
              borderRadius: "999px",
              border: `1px solid ${active ? m.color : m.color + "40"}`,
              color: active ? C.bg : m.color,
              background: active ? m.color : "transparent",
              cursor: "pointer",
              transition: "all 160ms ease",
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

function ConfessionBooth({ me, onSubmit, onClose, freePost = false, initialText = "", initialMood = "raw" }) {
  const [text, setText] = useState(initialText);
  const [mood, setMood] = useState(initialMood);
  const [anon, setAnon] = useState(false);
  const textRef = useRef(null);
  const notify = useNotice();

  useBodyLock(true);
  useEscape(true, onClose);

  const trimmed = text.trim();
  const len     = trimmed.length;
  const overSoft = len > TRUTH_SOFT_LIMIT;
  const atHard   = len >= TRUTH_HARD_LIMIT;
  const canPost  = len > 0 && !atHard;
  const m        = moodOf(mood);
  const postColor = freePost ? C.teal : C.ember;

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 420)}px`;
  }, [text]);

  useEffect(() => {
    setTimeout(() => textRef.current?.focus(), 80);
  }, []);

  const handleSubmit = () => {
    if (!canPost) return;
    const finalText = trimmed;
    const author = anon
      ? { ...me, displayName: randomAnonName(), photoURL: null, anonymous: true }
      : me;
    onSubmit(finalText, mood, author);
    onClose();
  };

  const meterColor = atHard ? C.ember : overSoft ? C.amber : C.faint;
  const ghosts = usePublicGhosts ? undefined : FALLBACK_GHOSTS;

  return (
    <div
      className="fixed inset-0 z-[65] flex flex-col mtp-booth"
      style={{
        background: `radial-gradient(1000px 800px at 50% 100%, ${m.color}18 0%, ${C.bg} 55%)`,
      }}
    >
      {/* drifting ghost field for ambience */}
      <GhostField lines={ghosts || FALLBACK_GHOSTS} density={0.9} opacity={0.5} />

      {/* top bar */}
      <div
        className="shrink-0 relative"
        style={{
          padding: "1rem 1.4rem",
          borderBottom: `1px solid ${C.line}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(14,11,18,0.6)",
          backdropFilter: "blur(16px)",
        }}
      >
        <div
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: "1.05rem",
            color: m.color,
          }}
        >
          Confession Booth
        </div>
        <button
          onClick={onClose}
          style={{
            fontFamily: UI,
            fontSize: "0.7rem",
            letterSpacing: "0.14em",
            color: C.dim,
            background: "none",
            border: `1px solid ${C.line}`,
            borderRadius: "999px",
            padding: "5px 14px",
            cursor: "pointer",
          }}
        >
          CLOSE
        </button>
      </div>

      {/* main writing area */}
      <div className="flex-1 overflow-y-auto relative px-6 py-8 flex flex-col" style={{ maxWidth: "44rem", margin: "0 auto", width: "100%" }}>
        {/* big mood-colored quote mark */}
        <div
          aria-hidden
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: "8rem",
            lineHeight: 1,
            color: m.color,
            opacity: 0.1,
            position: "absolute",
            top: "1.5rem",
            left: "1.2rem",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          "
        </div>

        <textarea
          ref={textRef}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, TRUTH_HARD_LIMIT))}
          placeholder="Write it like the lights are off and no one is listening…"
          rows={6}
          className="w-full resize-none outline-none mtp-scroll relative"
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: "clamp(1.5rem, 5vw, 2rem)",
            lineHeight: 1.4,
            color: C.ink,
            background: "transparent",
            border: "none",
            caretColor: m.color,
            overflow: "hidden",
            flex: 1,
            paddingTop: "0.5rem",
          }}
        />

        {/* char meter — only visible near the limit */}
        {len > TRUTH_SOFT_LIMIT && (
          <div
            style={{
              fontFamily: UI,
              fontSize: "0.66rem",
              color: meterColor,
              letterSpacing: "0.06em",
              textAlign: "right",
              marginTop: "0.5rem",
            }}
          >
            {len} / {TRUTH_HARD_LIMIT}
          </div>
        )}
      </div>

      {/* bottom bar */}
      <div
        className="shrink-0 relative"
        style={{
          borderTop: `1px solid ${C.line}`,
          background: "rgba(14,11,18,0.88)",
          backdropFilter: "blur(16px)",
          padding: "1rem 1.4rem",
        }}
      >
        <div className="mx-auto" style={{ maxWidth: "44rem" }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <BoothMoodPicker mood={mood} onChange={setMood} />

            <div className="flex items-center gap-3">
              <button
                onClick={() => setAnon((a) => !a)}
                title={anon ? "Posting anonymously" : "Post with your name"}
                style={{
                  fontFamily: UI,
                  fontWeight: 700,
                  fontSize: "0.6rem",
                  letterSpacing: "0.16em",
                  color: anon ? C.lav : C.faint,
                  background: anon ? `${C.lav}18` : "transparent",
                  border: `1px solid ${anon ? C.lav : C.line}`,
                  borderRadius: "999px",
                  padding: "5px 12px",
                  cursor: "pointer",
                  transition: "all 160ms ease",
                }}
              >
                {anon ? "ANON" : "NAMED"}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div style={{ fontFamily: UI, fontSize: "0.72rem", color: C.faint }}>
              {moodOf(mood).hint}
            </div>
            <button
              onClick={handleSubmit}
              disabled={!canPost}
              style={{
                fontFamily: UI,
                fontWeight: 700,
                fontSize: "0.76rem",
                letterSpacing: "0.14em",
                color: canPost ? C.bg : C.faint,
                background: canPost ? postColor : "transparent",
                border: `1px solid ${canPost ? postColor : C.line}`,
                borderRadius: "999px",
                padding: "10px 24px",
                cursor: canPost ? "pointer" : "default",
                transition: "all 180ms ease",
                boxShadow: canPost ? `0 0 28px ${postColor}44` : "none",
              }}
            >
              {freePost ? "POST FREE" : `POST · $${TRUTH_PRICE}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   DRAFT MANAGER OVERLAY — browse, load, and delete named drafts. Slides up
   from the bottom like a sheet. Integrates with useDraftManager hook.
   ════════════════════════════════════════════════════════════════════════════ */

function DraftManagerOverlay({ drafts, onLoad, onDelete, onClearAll, onClose }) {
  useBodyLock(true);
  useEscape(true, onClose);

  const isEmpty = drafts.length === 0;

  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 z-[62] mtp-backdrop"
        style={{ background: "rgba(14,11,18,0.75)", backdropFilter: "blur(8px)" }}
        onClick={onClose}
      />
      {/* drawer */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[63] mtp-drawer"
        style={{
          background: "rgba(18,13,22,0.98)",
          borderTop: `1px solid ${C.lineStrong}`,
          borderRadius: "20px 20px 0 0",
          maxHeight: "72vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "0.7rem 0 0" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: C.line }} />
        </div>

        {/* header */}
        <div className="flex items-center justify-between" style={{ padding: "0.8rem 1.4rem 0.5rem" }}>
          <Eyebrow>SAVED DRAFTS · {drafts.length}</Eyebrow>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            {!isEmpty && (
              <button
                onClick={onClearAll}
                style={{ fontFamily: UI, fontSize: "0.68rem", color: C.faint, background: "none", border: "none", cursor: "pointer" }}
              >
                Clear all
              </button>
            )}
            <button
              onClick={onClose}
              style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.68rem", letterSpacing: "0.1em", color: C.dim, background: "none", border: "none", cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* list */}
        <div className="flex-1 overflow-y-auto mtp-scroll" style={{ padding: "0 1.4rem 2rem" }}>
          {isEmpty ? (
            <p style={{ fontFamily: SERIF, fontStyle: "italic", color: C.faint, fontSize: "1rem", textAlign: "center", padding: "2rem 0" }}>
              No saved drafts yet.
            </p>
          ) : (
            drafts.map((d) => (
              <div
                key={d.id}
                style={{
                  borderBottom: `1px solid ${C.line}`,
                  padding: "1rem 0",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.8rem",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                    <Mood mood={d.mood} />
                    <span style={{ fontFamily: UI, fontSize: "0.6rem", color: C.faint }}>{timeAgo(d.savedAt)}</span>
                  </div>
                  <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "0.95rem", color: C.ink, margin: 0, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    "{d.text}"
                  </p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0, paddingTop: "0.15rem" }}>
                  <button
                    onClick={() => { onLoad(d); onClose(); }}
                    style={{
                      fontFamily: UI,
                      fontWeight: 700,
                      fontSize: "0.64rem",
                      letterSpacing: "0.1em",
                      color: C.ember,
                      background: `${C.ember}14`,
                      border: `1px solid ${C.ember}44`,
                      borderRadius: "999px",
                      padding: "4px 11px",
                      cursor: "pointer",
                    }}
                  >
                    LOAD
                  </button>
                  <button
                    onClick={() => onDelete(d.id)}
                    style={{
                      fontFamily: UI,
                      fontSize: "0.72rem",
                      color: C.faint,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px 6px",
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   SEARCH OVERLAY — real-time search over currently-loaded posts. Filters by
   text match and optional mood. No new network requests — scans local state.
   ════════════════════════════════════════════════════════════════════════════ */

function SearchOverlay({ posts, me, onConnect, onReact, onClose }) {
  const [query, setQuery] = useState("");
  const [moodF, setMoodF] = useState("all");
  const inputRef = useRef(null);

  useBodyLock(true);
  useEscape(true, onClose);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 60);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      const textMatch = !q || p.message?.toLowerCase().includes(q);
      const moodMatch = moodF === "all" || p.mood === moodF;
      return textMatch && moodMatch;
    });
  }, [posts, query, moodF]);

  return (
    <div className="fixed inset-0 z-[64] flex flex-col" style={{ background: C.bg }}>
      {/* header */}
      <div
        className="shrink-0 mtp-search-in"
        style={{
          background: "rgba(14,11,18,0.96)",
          backdropFilter: "blur(16px)",
          borderBottom: `1px solid ${C.line}`,
          padding: "0.75rem 1.2rem",
        }}
      >
        <div className="flex items-center gap-3 mx-auto" style={{ maxWidth: "42rem" }}>
          <span style={{ fontFamily: UI, fontSize: "1rem", color: C.faint }}>⌕</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search truths…"
            style={{
              flex: 1,
              fontFamily: SERIF,
              fontStyle: "italic",
              fontSize: "1.15rem",
              color: C.ink,
              background: "transparent",
              border: "none",
              outline: "none",
              caretColor: C.ember,
            }}
          />
          <button
            onClick={onClose}
            style={{
              fontFamily: UI,
              fontWeight: 700,
              fontSize: "0.7rem",
              letterSpacing: "0.1em",
              color: C.dim,
              background: "none",
              border: `1px solid ${C.line}`,
              borderRadius: "999px",
              padding: "5px 13px",
              cursor: "pointer",
            }}
          >
            CLOSE
          </button>
        </div>

        {/* mood filter pills */}
        <div className="flex gap-2 overflow-x-auto mx-auto mt-2" style={{ maxWidth: "42rem", scrollbarWidth: "none" }}>
          {["all", ...MOOD_ORDER].map((k) => {
            const m = k !== "all" ? MOODS[k] : null;
            const active = moodF === k;
            const color = m?.color || C.ember;
            return (
              <button
                key={k}
                onClick={() => setMoodF(k)}
                className="shrink-0"
                style={{
                  fontFamily: UI,
                  fontWeight: 700,
                  fontSize: "0.58rem",
                  letterSpacing: "0.2em",
                  padding: "4px 11px",
                  borderRadius: "999px",
                  border: `1px solid ${active ? color : C.line}`,
                  color: active ? color : C.dim,
                  background: active ? `${color}18` : "transparent",
                  cursor: "pointer",
                  transition: "all 140ms ease",
                }}
              >
                {k === "all" ? "ALL" : MOODS[k].label}
              </button>
            );
          })}
        </div>
      </div>

      {/* results */}
      <div className="flex-1 overflow-y-auto mtp-scroll">
        <div className="mx-auto px-6" style={{ maxWidth: "42rem" }}>
          {query.trim() === "" && moodF === "all" ? (
            <p style={{ fontFamily: SERIF, fontStyle: "italic", color: C.faint, textAlign: "center", padding: "3rem 0", fontSize: "1rem" }}>
              Start typing to search truths.
            </p>
          ) : results.length === 0 ? (
            <p style={{ fontFamily: SERIF, fontStyle: "italic", color: C.faint, textAlign: "center", padding: "3rem 0", fontSize: "1rem" }}>
              Nothing matching. Try different words.
            </p>
          ) : (
            results.map((post, i) => (
              <Truth
                key={post.id}
                post={post}
                index={i}
                me={me}
                connectState={(post.connect || []).find((c) => c.uid === me?.uid)?.flag || null}
                onConnect={() => onConnect(post)}
                onReact={onReact}
                onViewConnects={() => {}}
                noAnim={true}
              />
            ))
          )}
          {results.length > 0 && (
            <p style={{ fontFamily: UI, fontSize: "0.72rem", color: C.faint, textAlign: "center", padding: "1.5rem 0" }}>
              {results.length} {results.length === 1 ? "truth" : "truths"} found
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   SAVED TRUTHS DRAWER — a bottom sheet showing the user's bookmarked truths.
   ════════════════════════════════════════════════════════════════════════════ */

function SavedTruthsDrawer({ savedList, savedIds, onUnsave, onClose, me, onReact }) {
  useBodyLock(true);
  useEscape(true, onClose);

  const isEmpty = savedList.length === 0;

  return (
    <>
      <div
        className="fixed inset-0 z-[62] mtp-backdrop"
        style={{ background: "rgba(14,11,18,0.75)", backdropFilter: "blur(8px)" }}
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-[63] mtp-drawer"
        style={{
          background: "rgba(18,13,22,0.98)",
          borderTop: `1px solid ${C.lineStrong}`,
          borderRadius: "20px 20px 0 0",
          maxHeight: "78vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", padding: "0.7rem 0 0" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: C.line }} />
        </div>

        <div className="flex items-center justify-between" style={{ padding: "0.8rem 1.4rem 0.5rem" }}>
          <Eyebrow color={C.amber}>SAVED TRUTHS · {savedList.length}</Eyebrow>
          <button onClick={onClose} style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.7rem", color: C.dim, background: "none", border: "none", cursor: "pointer" }}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto mtp-scroll" style={{ padding: "0 1.4rem 2rem" }}>
          {isEmpty ? (
            <div style={{ textAlign: "center", padding: "2.5rem 0" }}>
              <div style={{ fontFamily: SERIF, fontStyle: "italic", color: C.faint, fontSize: "1rem", marginBottom: "0.5rem" }}>
                No saved truths yet.
              </div>
              <p style={{ fontFamily: UI, fontSize: "0.78rem", color: C.faint, lineHeight: 1.5 }}>
                Long-press any truth in the feed to save it, or tap the bookmark icon.
              </p>
            </div>
          ) : (
            savedList.map((post) => {
              const m = moodOf(post.mood);
              const hue = hueFor(post.uid);
              return (
                <div
                  key={post.id}
                  style={{
                    borderBottom: `1px solid ${C.line}`,
                    padding: "1.2rem 0",
                    position: "relative",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem" }}>
                    <div
                      style={{
                        width: 3,
                        alignSelf: "stretch",
                        background: m.color,
                        borderRadius: 2,
                        flexShrink: 0,
                        minHeight: "2rem",
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "1.05rem", color: C.ink, margin: 0, lineHeight: 1.4 }}>
                        "{post.message}"
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
                        <Avatar name={post.displayName} hue={hue} size={22} photoURL={post.photoURL} />
                        <span style={{ fontFamily: UI, fontSize: "0.72rem", color: C.dim }}>{post.displayName}</span>
                        <span style={{ fontFamily: UI, fontSize: "0.6rem", color: C.faint }}>· <Mood mood={post.mood} /></span>
                        <span style={{ fontFamily: UI, fontSize: "0.6rem", color: C.faint }}>· {timeAgo(post.createdAt)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => onUnsave(post.id)}
                      title="Remove bookmark"
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: C.amber,
                        fontSize: "0.85rem",
                        padding: "2px 4px",
                        flexShrink: 0,
                      }}
                    >
                      ✦
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   SETTINGS SHEET — privacy, display, and notification settings. Wraps all
   preferences in a consistent Toggle atom. Saves to localStorage + Firestore.
   ════════════════════════════════════════════════════════════════════════════ */

function SettingsSheet({ settings, updateSetting, onClose }) {
  useBodyLock(true);
  useEscape(true, onClose);

  const sections = [
    {
      title: "WRITING",
      items: [
        { key: "boothMode", label: "Open Confession Booth by default", desc: "Full-screen writing experience instead of the inline composer." },
        { key: "anonymousMode", label: "Post anonymously by default", desc: "Your name is replaced with a poetic stand-in. You can still toggle per-post." },
        { key: "showChallenge", label: "Show weekly writing challenge", desc: "A rotating prompt appears in the feed to spark new truths." },
      ],
    },
    {
      title: "PROFILE",
      items: [
        { key: "hideAge", label: "Hide age from profile", desc: "Your age won't appear next to your name in the feed or inbox." },
        { key: "compactFeed", label: "Compact feed", desc: "Slightly smaller card padding — fits more on screen at once." },
      ],
    },
    {
      title: "NOTIFICATIONS",
      items: [
        { key: "notifReactions", label: "Reaction notifications", desc: "In-app alert when someone reacts to your truth." },
        { key: "notifConnects", label: "Connect request notifications", desc: "In-app alert when someone reaches out on your truth." },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-[65] flex flex-col" style={{ background: C.bg }}>
      {/* header */}
      <header
        className="shrink-0"
        style={{
          background: "rgba(14,11,18,0.92)",
          backdropFilter: "blur(14px)",
          borderBottom: `1px solid ${C.line}`,
          padding: "1rem 1.4rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "1.2rem", color: C.ink }}>
          Settings
        </div>
        <button
          onClick={onClose}
          style={{
            fontFamily: UI,
            fontWeight: 700,
            fontSize: "0.7rem",
            letterSpacing: "0.1em",
            color: C.dim,
            background: "none",
            border: `1px solid ${C.line}`,
            borderRadius: "999px",
            padding: "5px 13px",
            cursor: "pointer",
          }}
        >
          DONE
        </button>
      </header>

      {/* body */}
      <div className="flex-1 overflow-y-auto mtp-scroll">
        <div className="mx-auto px-6 pb-16" style={{ maxWidth: "42rem" }}>
          {sections.map((section) => (
            <section key={section.title} style={{ paddingTop: "2rem" }}>
              <Eyebrow>{section.title}</Eyebrow>
              <div style={{ marginTop: "1.2rem", display: "flex", flexDirection: "column", gap: "1.4rem" }}>
                {section.items.map((item) => (
                  <div key={item.key}>
                    <Toggle
                      on={!!settings[item.key]}
                      onToggle={() => updateSetting(item.key, !settings[item.key])}
                      label={item.label}
                    />
                    <p style={{ fontFamily: UI, fontSize: "0.75rem", color: C.faint, marginTop: "0.3rem", lineHeight: 1.5, paddingLeft: "0" }}>
                      {item.desc}
                    </p>
                    <div style={{ height: "1px", background: C.line, marginTop: "1.2rem" }} />
                  </div>
                ))}
              </div>
            </section>
          ))}

          <div style={{ paddingTop: "2.5rem", paddingBottom: "1rem" }}>
            <p style={{ fontFamily: UI, fontSize: "0.72rem", color: C.faint, lineHeight: 1.6 }}>
              Settings are stored locally on this device. Some preferences also sync to your account when you're online.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   USER PROFILE OVERLAY — view another user's public truths. Opens when the
   user taps a poster's name in the feed or inbox.
   ════════════════════════════════════════════════════════════════════════════ */

function UserProfileOverlay({ targetUid, displayName, age, photoURL, posts, me, onConnect, onReact, onClose }) {
  const hue = hueFor(targetUid);
  const theirPosts = useMemo(() => posts.filter((p) => p.uid === targetUid), [posts, targetUid]);
  const totalReactions = theirPosts.reduce((s, p) => s + reactionTotal(p), 0);
  const totalConnects  = theirPosts.reduce((s, p) => s + (p.connect || []).filter((c) => c.flag === "accept").length, 0);

  useBodyLock(true);
  useEscape(true, onClose);

  return (
    <div className="fixed inset-0 z-[65] flex flex-col" style={{ background: C.bg }}>
      {/* header */}
      <header
        className="shrink-0"
        style={{
          background: "rgba(14,11,18,0.92)",
          backdropFilter: "blur(14px)",
          borderBottom: `1px solid ${C.line}`,
          padding: "0.9rem 1.4rem",
          display: "flex",
          alignItems: "center",
          gap: "0.8rem",
        }}
      >
        <button
          onClick={onClose}
          style={{ fontFamily: UI, fontWeight: 700, fontSize: "1.1rem", color: C.dim, background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}
          aria-label="Close"
        >
          ←
        </button>
        <Avatar name={displayName} hue={hue} size={38} photoURL={photoURL} />
        <div>
          <div style={{ fontFamily: UI, fontWeight: 600, fontSize: "0.92rem", color: C.ink }}>
            {displayName}{age ? `, ${age}` : ""}
          </div>
          <div style={{ fontFamily: UI, fontSize: "0.64rem", color: C.dim, letterSpacing: "0.06em" }}>
            {theirPosts.length} {theirPosts.length === 1 ? "truth" : "truths"} · {totalReactions} reactions
          </div>
        </div>
        {totalConnects > 0 && (
          <span style={{ marginLeft: "auto", fontFamily: UI, fontWeight: 700, fontSize: "0.6rem", letterSpacing: "0.14em", color: C.teal }}>
            {totalConnects} CONNECTED
          </span>
        )}
      </header>

      {/* stats strip */}
      <div
        className="shrink-0"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          borderBottom: `1px solid ${C.line}`,
          background: `${hue}08`,
        }}
      >
        {[
          { n: theirPosts.length, label: "TRUTHS" },
          { n: totalReactions, label: "REACTIONS" },
          { n: totalConnects, label: "CONNECTS" },
        ].map(({ n, label }) => (
          <div key={label} style={{ textAlign: "center", padding: "1rem 0", borderRight: `1px solid ${C.line}` }}>
            <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "1.5rem", color: C.ink, lineHeight: 1 }}>{n}</div>
            <div style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.52rem", letterSpacing: "0.18em", color: C.faint, marginTop: "0.2rem" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* their truths */}
      <div className="flex-1 overflow-y-auto mtp-scroll">
        <div className="mx-auto px-6" style={{ maxWidth: "42rem" }}>
          {theirPosts.length === 0 ? (
            <p style={{ fontFamily: SERIF, fontStyle: "italic", color: C.faint, textAlign: "center", padding: "3rem 0", fontSize: "1rem" }}>
              No truths from this person yet.
            </p>
          ) : (
            theirPosts.map((post, i) => (
              <Truth
                key={post.id}
                post={post}
                index={i}
                me={me}
                connectState={(post.connect || []).find((c) => c.uid === me?.uid)?.flag || null}
                onConnect={() => onConnect(post)}
                onReact={onReact}
                onViewConnects={() => {}}
                noAnim={true}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MOOD JOURNAL OVERLAY — a 30-day visual mood calendar derived from the user's
   own truths. Color-coded squares (like a contribution graph) show when they
   posted and what mood. Summary stats below the calendar.
   ════════════════════════════════════════════════════════════════════════════ */

function MoodJournalOverlay({ myFeeds, onClose }) {
  useBodyLock(true);
  useEscape(true, onClose);

  const today = new Date();
  const dayMs = 86400000;

  // Build a 30-day grid — each day may have 0 or more posts
  const days = useMemo(() => {
    const arr = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getTime() - i * dayMs);
      const key = d.toISOString().slice(0, 10);
      const dayPosts = myFeeds.filter((f) => {
        const pd = toDate(f.createdAt);
        return pd && pd.toISOString().slice(0, 10) === key;
      });
      const dominantMood = dayPosts.length > 0
        ? MOOD_ORDER.reduce((best, k) => {
            const cnt = dayPosts.filter((p) => p.mood === k).length;
            return cnt > (dayPosts.filter((p) => p.mood === best).length) ? k : best;
          }, dayPosts[0].mood)
        : null;
      arr.push({ key, d, posts: dayPosts, mood: dominantMood, count: dayPosts.length });
    }
    return arr;
  }, [myFeeds]);

  // Stats
  const totalDays = days.filter((d) => d.count > 0).length;
  const bestDay   = [...days].sort((a, b) => b.count - a.count)[0];
  const moodBreak = {};
  MOOD_ORDER.forEach((k) => { moodBreak[k] = myFeeds.filter((f) => f.mood === k).length; });
  const topMood = MOOD_ORDER.reduce((best, k) => (moodBreak[k] > (moodBreak[best] || 0) ? k : best), MOOD_ORDER[0]);

  return (
    <div className="fixed inset-0 z-[65] flex flex-col" style={{ background: C.bg }}>
      <header
        className="shrink-0"
        style={{
          background: "rgba(14,11,18,0.92)",
          backdropFilter: "blur(14px)",
          borderBottom: `1px solid ${C.line}`,
          padding: "1rem 1.4rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <Eyebrow color={C.lav}>MOOD JOURNAL</Eyebrow>
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "1.2rem", color: C.ink, marginTop: "0.2rem" }}>
            Your last 30 days
          </div>
        </div>
        <button onClick={onClose} style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.7rem", letterSpacing: "0.1em", color: C.dim, background: "none", border: `1px solid ${C.line}`, borderRadius: "999px", padding: "5px 13px", cursor: "pointer" }}>
          CLOSE
        </button>
      </header>

      <div className="flex-1 overflow-y-auto mtp-scroll">
        <div className="mx-auto px-6 py-8" style={{ maxWidth: "42rem" }}>
          {myFeeds.length === 0 ? (
            <p style={{ fontFamily: SERIF, fontStyle: "italic", color: C.faint, textAlign: "center", padding: "2rem 0" }}>
              Post your first truth to start your mood journal.
            </p>
          ) : (
            <>
              {/* Calendar grid — 5 cols × 6 rows */}
              <div>
                <Eyebrow>ACTIVITY</Eyebrow>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(10, 1fr)",
                    gap: "4px",
                    marginTop: "1rem",
                  }}
                >
                  {days.map((day) => {
                    const m = day.mood ? MOODS[day.mood] : null;
                    const alpha = day.count === 0 ? "" : day.count === 1 ? "88" : day.count === 2 ? "bb" : "ff";
                    const bg = day.count === 0 ? `${C.line}` : `${m.color}${alpha}`;
                    const isToday = day.key === today.toISOString().slice(0, 10);
                    return (
                      <div
                        key={day.key}
                        className="mtp-cal-cell"
                        title={`${day.key}: ${day.count} truth${day.count !== 1 ? "s" : ""}${day.mood ? ` (${MOODS[day.mood].label})` : ""}`}
                        style={{
                          background: bg,
                          outline: isToday ? `2px solid ${C.ink}` : "none",
                          outlineOffset: "1px",
                        }}
                      />
                    );
                  })}
                </div>
                {/* mood legend */}
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
                  {MOOD_ORDER.map((k) => (
                    <span key={k} style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontFamily: UI, fontSize: "0.58rem", color: MOODS[k].color }}>
                      <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: MOODS[k].color }} />
                      {MOODS[k].label}
                    </span>
                  ))}
                  <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontFamily: UI, fontSize: "0.58rem", color: C.faint }}>
                    <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: C.line }} />
                    QUIET
                  </span>
                </div>
              </div>

              {/* Stats row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "1px",
                  background: C.line,
                  borderRadius: "12px",
                  overflow: "hidden",
                  marginTop: "2.5rem",
                }}
              >
                {[
                  { n: totalDays, label: "DAYS POSTED" },
                  { n: myFeeds.length, label: "TOTAL TRUTHS" },
                  { n: moodBreak[topMood] || 0, label: `TOP MOOD: ${topMood?.toUpperCase()}` },
                ].map(({ n, label }) => (
                  <div key={label} style={{ textAlign: "center", padding: "1.2rem 0.5rem", background: C.bg }}>
                    <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "1.6rem", color: C.ink }}>{n}</div>
                    <div style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.5rem", letterSpacing: "0.16em", color: C.faint, marginTop: "0.2rem", lineHeight: 1.3 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Best day */}
              {bestDay?.count > 0 && (
                <div style={{ marginTop: "2rem" }}>
                  <Eyebrow>BEST DAY</Eyebrow>
                  <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "1.05rem", color: C.ink, marginTop: "0.5rem" }}>
                    {new Date(bestDay.key).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} — {bestDay.count} {bestDay.count === 1 ? "truth" : "truths"}
                  </p>
                </div>
              )}

              {/* Mood breakdown */}
              <div style={{ marginTop: "2rem" }}>
                <Eyebrow>MOOD BREAKDOWN</Eyebrow>
                <div style={{ marginTop: "0.8rem", display: "flex", flexDirection: "column", gap: "0.7rem" }}>
                  {MOOD_ORDER.map((k) => {
                    const pct = myFeeds.length > 0 ? Math.round((moodBreak[k] / myFeeds.length) * 100) : 0;
                    return (
                      <div key={k}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                          <span style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.64rem", color: MOODS[k].color, letterSpacing: "0.12em" }}>{MOODS[k].label}</span>
                          <span style={{ fontFamily: UI, fontSize: "0.64rem", color: C.faint }}>{moodBreak[k]} · {pct}%</span>
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: C.line, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: MOODS[k].color, borderRadius: 3, transition: "width 600ms ease" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   TRUTH ANALYTICS OVERLAY — post performance dashboard. Shows the user's best
   truth, reaction totals, and mood analysis. All derived from myFeeds.
   ════════════════════════════════════════════════════════════════════════════ */

function TruthAnalyticsOverlay({ myFeeds, analytics, onClose }) {
  useBodyLock(true);
  useEscape(true, onClose);

  const { bestPost, avgReactions, bestMood, totalReach, reactionBreakdown, moodBreakdown, last30Count } = analytics;

  const totalPosts   = myFeeds.length;
  const totalFelt    = reactionBreakdown?.felt || 0;
  const totalSame    = reactionBreakdown?.same || 0;
  const totalBrave   = reactionBreakdown?.brave || 0;
  const totalNah     = reactionBreakdown?.nah || 0;

  const topReaction = totalFelt >= totalSame && totalFelt >= totalBrave
    ? { key: "felt", n: totalFelt, label: "Felt", color: C.ember }
    : totalSame >= totalBrave
    ? { key: "same", n: totalSame, label: "Same", color: C.lav }
    : { key: "brave", n: totalBrave, label: "Brave", color: C.amber };

  return (
    <div className="fixed inset-0 z-[65] flex flex-col" style={{ background: C.bg }}>
      <header
        className="shrink-0"
        style={{
          background: "rgba(14,11,18,0.92)",
          backdropFilter: "blur(14px)",
          borderBottom: `1px solid ${C.line}`,
          padding: "1rem 1.4rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <Eyebrow color={C.sky}>TRUTH ANALYTICS</Eyebrow>
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "1.2rem", color: C.ink, marginTop: "0.2rem" }}>
            How your truths land
          </div>
        </div>
        <button onClick={onClose} style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.7rem", letterSpacing: "0.1em", color: C.dim, background: "none", border: `1px solid ${C.line}`, borderRadius: "999px", padding: "5px 13px", cursor: "pointer" }}>
          CLOSE
        </button>
      </header>

      <div className="flex-1 overflow-y-auto mtp-scroll">
        <div className="mx-auto px-6 py-8" style={{ maxWidth: "42rem" }}>
          {totalPosts === 0 ? (
            <p style={{ fontFamily: SERIF, fontStyle: "italic", color: C.faint, textAlign: "center", padding: "2rem 0" }}>
              Post your first truth to see your analytics.
            </p>
          ) : (
            <>
              {/* headline stats */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "1px",
                  background: C.line,
                  borderRadius: "12px",
                  overflow: "hidden",
                }}
              >
                {[
                  { n: totalPosts, label: "TRUTHS POSTED", color: C.ink },
                  { n: totalReach, label: "TOTAL REACTIONS", color: C.ember },
                  { n: avgReactions, label: "AVG PER TRUTH", color: C.lav },
                  { n: last30Count || 0, label: "LAST 30 DAYS", color: C.teal },
                ].map(({ n, label, color }) => (
                  <div key={label} style={{ textAlign: "center", padding: "1.4rem 0.5rem", background: C.bg }}>
                    <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "2rem", color, lineHeight: 1 }}>{n}</div>
                    <div style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.52rem", letterSpacing: "0.18em", color: C.faint, marginTop: "0.35rem" }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* reaction breakdown */}
              <div style={{ marginTop: "2.5rem" }}>
                <Eyebrow>REACTION BREAKDOWN</Eyebrow>
                <div style={{ marginTop: "0.8rem", display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                  {[
                    { key: "felt", n: totalFelt, label: "Felt", icon: "♥", color: C.ember },
                    { key: "same", n: totalSame, label: "Same", icon: "🙌", color: C.lav },
                    { key: "brave", n: totalBrave, label: "Brave", icon: "🔥", color: C.amber },
                    { key: "nah", n: totalNah, label: "Nah", icon: "✕", color: C.rose },
                  ].map(({ key, n, label, icon, color }) => {
                    const pct = totalReach + totalNah > 0 ? Math.round((n / (totalReach + totalNah)) * 100) : 0;
                    return (
                      <div key={key}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                          <span style={{ fontFamily: UI, fontSize: "0.8rem", color: C.dim }}>
                            <span style={{ marginRight: "0.4rem" }}>{icon}</span>{label}
                          </span>
                          <span style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.72rem", color }}>{n} · {pct}%</span>
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: C.line, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 600ms ease" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* best truth */}
              {bestPost && (
                <div style={{ marginTop: "2.5rem" }}>
                  <Eyebrow color={C.ember}>YOUR MOST RESONANT TRUTH</Eyebrow>
                  <div
                    style={{
                      marginTop: "0.9rem",
                      padding: "1.2rem",
                      borderLeft: `3px solid ${moodOf(bestPost.mood).color}`,
                      background: `${moodOf(bestPost.mood).color}08`,
                      borderRadius: "0 8px 8px 0",
                    }}
                  >
                    <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "1.1rem", color: C.ink, margin: 0, lineHeight: 1.4 }}>
                      "{bestPost.message}"
                    </p>
                    <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
                      <span style={{ fontFamily: UI, fontSize: "0.7rem", color: C.dim }}><Mood mood={bestPost.mood} /></span>
                      <span style={{ fontFamily: UI, fontSize: "0.7rem", color: C.ember }}>♥ {bestPost.felt || 0}</span>
                      <span style={{ fontFamily: UI, fontSize: "0.7rem", color: C.lav }}>🙌 {bestPost.same || 0}</span>
                      <span style={{ fontFamily: UI, fontSize: "0.7rem", color: C.amber }}>🔥 {bestPost.brave || 0}</span>
                      <span style={{ fontFamily: UI, fontSize: "0.7rem", color: C.faint }}>{timeAgo(bestPost.createdAt)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* top mood insight */}
              {bestMood && (
                <div style={{ marginTop: "2.5rem" }}>
                  <Eyebrow>MOOD INSIGHT</Eyebrow>
                  <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "1.05rem", color: C.ink, marginTop: "0.5rem", lineHeight: 1.5 }}>
                    You write most in <span style={{ color: MOODS[bestMood].color }}>{MOODS[bestMood].label.toLowerCase()}</span> — {MOODS[bestMood].hint}.
                  </p>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
                    {MOOD_ORDER.map((k) => (
                      <span
                        key={k}
                        style={{
                          fontFamily: UI,
                          fontWeight: 700,
                          fontSize: "0.58rem",
                          letterSpacing: "0.14em",
                          color: k === bestMood ? MOODS[k].color : C.faint,
                          background: k === bestMood ? `${MOODS[k].color}18` : "transparent",
                          border: `1px solid ${k === bestMood ? MOODS[k].color : C.line}`,
                          borderRadius: "999px",
                          padding: "3px 9px",
                        }}
                      >
                        {MOODS[k].label} {moodBreakdown?.[k] || 0}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   NOTIFICATION DRAWER — in-app notification history. Populated when reactions
   and connect events are processed by the app shell. Slides up from bottom.
   ════════════════════════════════════════════════════════════════════════════ */

const NOTIF_ICONS = {
  reaction_felt:  { icon: "♥",   color: C.ember },
  reaction_same:  { icon: "🙌",  color: C.lav },
  reaction_brave: { icon: "🔥",  color: C.amber },
  connect_new:    { icon: "⟵⟶", color: C.teal },
  connect_accept: { icon: "♥",   color: C.teal },
  truth_posted:   { icon: "✦",   color: C.lav },
};

function NotificationDrawer({ notifications, unreadCount, onMarkAllRead, onClearAll, onClose }) {
  useBodyLock(true);
  useEscape(true, onClose);

  const isEmpty = notifications.length === 0;

  const handleOpen = () => {
    onMarkAllRead?.();
  };

  useEffect(() => {
    handleOpen();
  }, []); // eslint-disable-line

  return (
    <>
      <div
        className="fixed inset-0 z-[62] mtp-backdrop"
        style={{ background: "rgba(14,11,18,0.75)", backdropFilter: "blur(8px)" }}
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-[63] mtp-drawer"
        style={{
          background: "rgba(18,13,22,0.98)",
          borderTop: `1px solid ${C.lineStrong}`,
          borderRadius: "20px 20px 0 0",
          maxHeight: "72vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", padding: "0.7rem 0 0" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: C.line }} />
        </div>

        <div className="flex items-center justify-between" style={{ padding: "0.8rem 1.4rem 0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <Eyebrow>NOTIFICATIONS</Eyebrow>
            {unreadCount > 0 && (
              <span style={{ background: C.ember, color: C.bg, fontFamily: UI, fontWeight: 700, fontSize: "0.55rem", borderRadius: "999px", padding: "2px 6px" }}>
                {unreadCount}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            {!isEmpty && (
              <button onClick={onClearAll} style={{ fontFamily: UI, fontSize: "0.68rem", color: C.faint, background: "none", border: "none", cursor: "pointer" }}>
                Clear all
              </button>
            )}
            <button onClick={onClose} style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.7rem", color: C.dim, background: "none", border: "none", cursor: "pointer" }}>✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto mtp-scroll" style={{ padding: "0 1.4rem 2rem" }}>
          {isEmpty ? (
            <div style={{ textAlign: "center", padding: "2.5rem 0" }}>
              <p style={{ fontFamily: SERIF, fontStyle: "italic", color: C.faint, fontSize: "1rem" }}>
                Nothing yet. Post a truth and see who feels it.
              </p>
            </div>
          ) : (
            notifications.map((n) => {
              const meta = NOTIF_ICONS[n.type] || { icon: "✦", color: C.lav };
              return (
                <div
                  key={n.id}
                  style={{
                    borderBottom: `1px solid ${C.line}`,
                    padding: "0.9rem 0",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                  }}
                >
                  <span style={{ fontSize: "1.15rem", lineHeight: 1, color: meta.color, flexShrink: 0, marginTop: "0.1rem" }}>{meta.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: UI, fontSize: "0.82rem", color: C.ink, margin: 0, lineHeight: 1.4 }}>{n.text}</p>
                    <span style={{ fontFamily: UI, fontSize: "0.6rem", color: C.faint }}>{timeAgo(n.createdAt)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   ACHIEVEMENTS OVERLAY — milestone badges earned through activity. Grid of
   all 12 defined achievements, earned vs locked. Animated on first unlock.
   ════════════════════════════════════════════════════════════════════════════ */

function AchievementsOverlay({ achievements, onClose }) {
  useBodyLock(true);
  useEscape(true, onClose);

  const earned = achievements.filter((a) => a.earned);
  const locked = achievements.filter((a) => !a.earned);

  return (
    <div className="fixed inset-0 z-[65] flex flex-col" style={{ background: C.bg }}>
      <header
        className="shrink-0"
        style={{
          background: "rgba(14,11,18,0.92)",
          backdropFilter: "blur(14px)",
          borderBottom: `1px solid ${C.line}`,
          padding: "1rem 1.4rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <Eyebrow color={C.amber}>ACHIEVEMENTS</Eyebrow>
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "1.2rem", color: C.ink, marginTop: "0.2rem" }}>
            {earned.length} / {achievements.length} unlocked
          </div>
        </div>
        <button onClick={onClose} style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.7rem", letterSpacing: "0.1em", color: C.dim, background: "none", border: `1px solid ${C.line}`, borderRadius: "999px", padding: "5px 13px", cursor: "pointer" }}>
          CLOSE
        </button>
      </header>

      <div className="flex-1 overflow-y-auto mtp-scroll">
        <div className="mx-auto px-6 py-8" style={{ maxWidth: "42rem" }}>
          {earned.length === 0 && (
            <p style={{ fontFamily: SERIF, fontStyle: "italic", color: C.faint, textAlign: "center", padding: "1rem 0 2rem" }}>
              No achievements yet. Post your first truth to start.
            </p>
          )}

          {earned.length > 0 && (
            <div style={{ marginBottom: "2.5rem" }}>
              <Eyebrow color={C.amber}>EARNED</Eyebrow>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                  gap: "1.2rem",
                  marginTop: "1.2rem",
                }}
              >
                {earned.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      padding: "1rem 0.75rem",
                      borderRadius: "12px",
                      border: `1px solid ${C.amber}44`,
                      background: `${C.amber}08`,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "0.4rem",
                      textAlign: "center",
                    }}
                  >
                    <span style={{ fontSize: "1.8rem", lineHeight: 1, filter: `drop-shadow(0 0 8px ${C.amber}88)` }}>
                      {a.icon}
                    </span>
                    <span style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.62rem", letterSpacing: "0.12em", color: C.amber }}>
                      {a.name.toUpperCase()}
                    </span>
                    <span style={{ fontFamily: UI, fontSize: "0.58rem", color: C.faint, lineHeight: 1.3 }}>
                      {a.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {locked.length > 0 && (
            <div>
              <Eyebrow>LOCKED</Eyebrow>
              <div style={{ marginTop: "1.2rem", display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                {locked.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.8rem",
                      padding: "0.8rem 0",
                      borderBottom: `1px solid ${C.line}`,
                      opacity: 0.45,
                    }}
                  >
                    <span style={{ fontSize: "1.3rem", lineHeight: 1, flexShrink: 0 }}>{a.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.64rem", letterSpacing: "0.1em", color: C.dim }}>
                        {a.name.toUpperCase()}
                      </div>
                      <div style={{ fontFamily: UI, fontSize: "0.72rem", color: C.faint, marginTop: "0.15rem" }}>
                        {a.desc}
                      </div>
                    </div>
                    {/* progress bar */}
                    <div style={{ width: 44, height: 4, borderRadius: 2, background: C.line, overflow: "hidden", flexShrink: 0 }}>
                      <div style={{ height: "100%", width: `${Math.round(a.progress * 100)}%`, background: C.faint, borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   SWIPE DISCOVER STACK — Tinder-style card deck for the discover tab. Each
   card shows a truth full-screen; swipe right to connect, left to pass,
   up to save. Built with pointer + touch events for smooth feel.
   ════════════════════════════════════════════════════════════════════════════ */

function SwipeCard({ post, me, onConnect, onPass, onSave, onReact, isTop, stackIndex }) {
  const m = moodOf(post.mood);
  const hue = hueFor(post.uid);
  const glowing = hasGlow(post.message);
  const cardRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [exiting, setExiting] = useState(null); // "left"|"right"|"up"
  const startPos = useRef({ x: 0, y: 0 });
  const notify = useNotice();

  const rotation = offset.x * 0.08;
  const connectAlpha = Math.min(Math.max(offset.x / 80, 0), 1);
  const passAlpha    = Math.min(Math.max(-offset.x / 80, 0), 1);
  const saveAlpha    = Math.min(Math.max(-offset.y / 80, 0), 1);

  const settle = (dx, dy) => {
    const threshold = 80;
    if (dx > threshold) {
      setExiting("right");
      setTimeout(() => { onConnect(); }, 260);
    } else if (dx < -threshold) {
      setExiting("left");
      setTimeout(() => { onPass(); }, 260);
    } else if (dy < -threshold) {
      setExiting("up");
      setTimeout(() => { onSave(); notify("Saved.", "good"); }, 260);
    } else {
      setOffset({ x: 0, y: 0 });
    }
  };

  const onPointerDown = (e) => {
    if (!isTop) return;
    if (e.target.tagName === "BUTTON") return;
    cardRef.current?.setPointerCapture(e.pointerId);
    startPos.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
  };
  const onPointerMove = (e) => {
    if (!dragging) return;
    setOffset({
      x: e.clientX - startPos.current.x,
      y: e.clientY - startPos.current.y,
    });
  };
  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    settle(offset.x, offset.y);
  };

  const exitClass = exiting === "right" ? "mtp-swipe-right" : exiting === "left" ? "mtp-swipe-left" : exiting === "up" ? "mtp-swipe-up" : "";

  return (
    <div
      ref={cardRef}
      className={`mtp-swipe-card ${exitClass}`}
      style={{
        transform: `translateX(${offset.x}px) translateY(${offset.y * 0.4}px) rotate(${rotation}deg)`,
        transition: dragging ? "none" : "transform 280ms cubic-bezier(0.2, 0.7, 0.2, 1)",
        zIndex: 10 - stackIndex,
        background: `radial-gradient(800px 600px at 50% 110%, ${m.color}28 0%, ${C.bg} 60%)`,
        padding: "0",
        overflow: "hidden",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        scale: stackIndex === 0 ? 1 : `${1 - stackIndex * 0.04}`,
        borderRadius: "20px",
        border: `1px solid ${C.lineStrong}`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* intent labels */}
      {connectAlpha > 0.1 && (
        <div style={{ position: "absolute", top: "1.5rem", left: "1.5rem", zIndex: 2, opacity: connectAlpha, fontFamily: UI, fontWeight: 700, fontSize: "1.1rem", letterSpacing: "0.2em", color: C.teal, border: `3px solid ${C.teal}`, borderRadius: "8px", padding: "6px 14px", transform: "rotate(-12deg)" }}>
          CONNECT
        </div>
      )}
      {passAlpha > 0.1 && (
        <div style={{ position: "absolute", top: "1.5rem", right: "1.5rem", zIndex: 2, opacity: passAlpha, fontFamily: UI, fontWeight: 700, fontSize: "1.1rem", letterSpacing: "0.2em", color: C.rose, border: `3px solid ${C.rose}`, borderRadius: "8px", padding: "6px 14px", transform: "rotate(12deg)" }}>
          PASS
        </div>
      )}
      {saveAlpha > 0.1 && (
        <div style={{ position: "absolute", top: "1.5rem", left: "50%", transform: `translateX(-50%) rotate(0deg)`, zIndex: 2, opacity: saveAlpha, fontFamily: UI, fontWeight: 700, fontSize: "1rem", letterSpacing: "0.2em", color: C.amber, border: `3px solid ${C.amber}`, borderRadius: "8px", padding: "6px 14px" }}>
          SAVE
        </div>
      )}

      {/* card content */}
      <div style={{ padding: "2.5rem 2rem", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        {/* mood tag */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Mood mood={post.mood} />
          <span style={{ fontFamily: UI, fontSize: "0.62rem", color: C.faint }}>{timeAgo(post.createdAt)}</span>
        </div>

        {/* truth text */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "2rem 0" }}>
          <p style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: "clamp(1.5rem, 5vw, 2rem)",
            lineHeight: 1.3,
            color: glowing ? "#FFFFFF" : C.ink,
            textShadow: glowing ? `0 0 10px rgba(255,255,255,0.95), 0 0 28px rgba(255,255,255,0.6), 0 0 60px ${m.color}55` : `0 0 60px ${m.color}26`,
            margin: 0,
          }}>
            "{post.message}"
          </p>
        </div>

        {/* author + reactions */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.2rem" }}>
            <Avatar name={post.displayName} hue={hue} size={32} photoURL={post.photoURL} />
            <span style={{ fontFamily: UI, fontWeight: 600, fontSize: "0.84rem", color: C.ink }}>
              {post.displayName}{post.age ? `, ${post.age}` : ""}
            </span>
          </div>
          {/* reaction tally */}
          <div style={{ display: "flex", gap: "1rem" }}>
            {REACTION_KEYS.map((k) => (
              <span key={k} style={{ fontFamily: UI, fontSize: "0.72rem", color: REACTION_META[k].color }}>
                {REACTION_META[k].icon} {post[k] || 0}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SwipeDiscoverStack({ posts, me, onConnect, onPass, onSave, onReact, onEmpty }) {
  const [seen, setSeen] = useState(new Set());
  const deck = useMemo(() => posts.filter((p) => !seen.has(p.id) && p.uid !== me?.uid), [posts, seen, me]);

  const handleConnect = useCallback((post) => {
    setSeen((s) => new Set([...s, post.id]));
    onConnect(post);
  }, [onConnect]);

  const handlePass = useCallback((post) => {
    setSeen((s) => new Set([...s, post.id]));
  }, []);

  const handleSave = useCallback((post) => {
    setSeen((s) => new Set([...s, post.id]));
    onSave?.(post);
  }, [onSave]);

  const topThree = deck.slice(0, 3);

  if (deck.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "4rem 2rem" }}>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "1.6rem", color: C.ink, marginBottom: "0.5rem" }}>
          That's all for now.
        </div>
        <p style={{ fontFamily: UI, fontSize: "0.82rem", color: C.faint, marginBottom: "1.5rem" }}>
          You've seen all current truths. Come back later when new ones surface.
        </p>
        {seen.size > 0 && (
          <button
            onClick={() => setSeen(new Set())}
            style={{
              fontFamily: UI,
              fontWeight: 700,
              fontSize: "0.7rem",
              letterSpacing: "0.14em",
              color: C.ember,
              background: `${C.ember}14`,
              border: `1px solid ${C.ember}55`,
              borderRadius: "999px",
              padding: "9px 20px",
              cursor: "pointer",
            }}
          >
            START OVER
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* hint */}
      <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem", padding: "0.8rem 0", marginBottom: "0.5rem" }}>
        {[
          { dir: "←", color: C.rose, label: "PASS" },
          { dir: "↑", color: C.amber, label: "SAVE" },
          { dir: "→", color: C.teal, label: "CONNECT" },
        ].map(({ dir, color, label }) => (
          <span key={dir} style={{ fontFamily: UI, fontWeight: 700, fontSize: "0.58rem", letterSpacing: "0.14em", color, display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.9rem" }}>{dir}</span> {label}
          </span>
        ))}
      </div>

      {/* card stack */}
      <div style={{ position: "relative", height: "clamp(420px, 68vh, 600px)", marginBottom: "1rem" }}>
        {[...topThree].reverse().map((post, i) => {
          const stackIndex = topThree.length - 1 - i;
          return (
            <SwipeCard
              key={post.id}
              post={post}
              me={me}
              isTop={stackIndex === 0}
              stackIndex={stackIndex}
              onConnect={() => handleConnect(post)}
              onPass={() => handlePass(post)}
              onSave={() => handleSave(post)}
              onReact={onReact}
            />
          );
        })}
      </div>

      {/* remaining count */}
      <p style={{ textAlign: "center", fontFamily: UI, fontSize: "0.64rem", color: C.faint, letterSpacing: "0.12em" }}>
        {deck.length} truth{deck.length !== 1 ? "s" : ""} remaining
      </p>

      {/* manual action buttons for accessibility */}
      <div style={{ display: "flex", justifyContent: "center", gap: "1.2rem", marginTop: "0.8rem" }}>
        <button
          onClick={() => handlePass(deck[0])}
          style={{
            width: 50, height: 50, borderRadius: "50%",
            background: "transparent",
            border: `2px solid ${C.rose}66`,
            color: C.rose, fontFamily: UI, fontWeight: 700, fontSize: "1.1rem",
            cursor: "pointer",
            transition: "all 160ms ease",
          }}
          aria-label="Pass"
        >
          ✕
        </button>
        <button
          onClick={() => handleSave(deck[0])}
          style={{
            width: 50, height: 50, borderRadius: "50%",
            background: "transparent",
            border: `2px solid ${C.amber}66`,
            color: C.amber, fontFamily: UI, fontWeight: 700, fontSize: "1.1rem",
            cursor: "pointer",
            transition: "all 160ms ease",
          }}
          aria-label="Save"
        >
          ✦
        </button>
        <button
          onClick={() => handleConnect(deck[0])}
          style={{
            width: 50, height: 50, borderRadius: "50%",
            background: "transparent",
            border: `2px solid ${C.teal}66`,
            color: C.teal, fontFamily: UI, fontWeight: 700, fontSize: "1.3rem",
            cursor: "pointer",
            transition: "all 160ms ease",
          }}
          aria-label="Connect"
        >
          ♥
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   APP — the shell. Owns the tab, the open chat, the pending truth awaiting
   payment, and the Cash App return. Subscribes to the live feed, the user's
   own truths, the truths they reached out on, conversations, and unread counts.
   Everything below is the same data flow as V3, with the new pass-confirm,
   scroll-to-top, notices, and Esc handling threaded through.
   ════════════════════════════════════════════════════════════════════════════ */

function MyTruePostAppInner() {
  const { uid } = useAuthContext();
  const { user, profile, loading } = useAuthState();
  useViews(uid);
  useRelativeClock(); // keeps "3m"/"2h" honest across the whole tree
  const notify = useNotice();

  const me = profile
    ? {
        uid: profile.uid,
        displayName: profile.displayName,
        age: profile.age,
        photoURL: profile.photoURL ?? null,
      }
    : user
    ? { uid: user.uid, displayName: user.email, age: null, photoURL: null }
    : null;

  const [tab, setTab] = useState("feed");
  const [openChat, setOpenChat] = useState(null);
  const [pendingTruth, setPendingTruth] = useState(null);
  const [cashAppReturn, setCashAppReturn] = useState(null);
  const [passTarget, setPassTarget] = useState(null);
  const [moodFilter, setMoodFilter] = useState("all");
  const [celebrating, setCelebrating] = useState(false);
  const [composerForced, setComposerForced] = useState(false);

  // ── V5 overlay state ──────────────────────────────────────────────────────
  const [boothOpen, setBoothOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [savedDrawerOpen, setSavedDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
  const [draftsDrawerOpen, setDraftsDrawerOpen] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [echoPost, setEchoPost] = useState(null);     // post to echo
  const [sharePost, setSharePost] = useState(null);   // post to share as screenshot card
  const [chatInfoOpen, setChatInfoOpen] = useState(null); // chat for info overlay
  const [discoverMode, setDiscoverMode] = useState("swipe"); // "swipe" | "list"

  // ── V5 hooks ──────────────────────────────────────────────────────────────
  const { savedIds, savedList, isSaved, toggle: toggleSave } = useSavedTruths(uid);
  const { drafts, saveDraft, deleteDraft, clearAll: clearDrafts } = useDraftManager();
  const { settings, updateSetting } = useSettings(uid);
  const { notifications, unreadCount: notifUnread, addNotification, markAllRead, clearAll: clearNotifs } = useNotificationCenter(uid);
  const { onboarded, completeOnboarding } = useOnboardingStatus();
  const dailyChallenge = useDailyChallenge();

  const scrolledPast = useScrolledPast(700);
  const online = useOnlineStatus();

  const [posts, feedReady] = useFeed(uid);

  const [acknowledgedPostCount, setAcknowledgedPostCount] = useState(0);
  useEffect(() => {
    if (feedReady && acknowledgedPostCount === 0 && posts.length > 0) {
      setAcknowledgedPostCount(posts.length);
    }
  }, [feedReady, posts.length, acknowledgedPostCount]);
  const newPostCount = feedReady && acknowledgedPostCount > 0
    ? Math.max(0, posts.length - acknowledgedPostCount)
    : 0;
  const [myFeeds, myFeedsReady] = useMyFeeds(uid);
  const [reachedOutFeedsRaw, reachedOutReady] = useFeedsIConnected(uid);
  const reachedOutFeeds = reachedOutFeedsRaw.filter((f) => f.uid !== uid);
  const conversations = useMyConversations(uid);
  const discover = useDiscover(uid, tab === "discover");
  usePendingCreditsCheck(uid);
  usePendingTruthsCheck(uid);

  // ── V5 derived state ──────────────────────────────────────────────────────
  const analytics    = useTruthAnalytics(myFeeds);
  const achievements = useAchievements(myFeeds, conversations);

  // keyboard nav — tab switching + composer hotkey + "?" help overlay + V5 shortcuts
  const { showHelp, setShowHelp } = useKeyboardNav(
    setTab,
    () => setComposerForced(true),
    {
      openSearch: () => setSearchOpen(true),
      openBooth:  () => setBoothOpen(true),
      openSaved:  () => setSavedDrawerOpen(true),
      openNotifs: () => setNotifDrawerOpen(true),
    }
  );

  // remember + restore scroll position per-tab (feed keeps its place)
  useScrollRestore(tab);

  // Handle every Cash App return: succeeded, failed, or canceled.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clientSecret = params.get("payment_intent_client_secret");
    const status = params.get("redirect_status");
    if (!clientSecret || !status) return;
    window.history.replaceState({}, "", window.location.pathname);
    getStripe().then(async (stripe) => {
      if (!stripe) return;
      const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);
      const feedId = paymentIntent?.metadata?.feedId;
      if (!feedId) return;
      if (status === "succeeded" && paymentIntent.status === "succeeded") {
        markTruthPaid(feedId, paymentIntent.id).catch(() => {});
      } else {
        markTruthFailed(feedId).catch(() => {});
      }
      setCashAppReturn({ feedId, status });
    });
  }, []);

  const handleCashAppRetry = useCallback(async (feedId) => {
    const feed = await getFeedData(feedId);
    setCashAppReturn(null);
    if (feed?.message) setPendingTruth({ message: feed.message, mood: feed.mood ?? "raw" });
  }, []);

  const dl = useMemo(() => dateline(), []);
  const confesses = profile?.confesses ?? 0;

  /* Posting a truth: spend a free confess if one exists, else open payment. */
  const startTruth = useCallback(
    async (message, mood, author) => {
      const poster = author || me;
      if ((profile?.confesses ?? 0) > 0) {
        try {
          await createTruthWithConfess(poster, message, mood);
          notify("Posted — that one was on us.", "good");
          addNotification("truth_posted", "Your truth is live. See who feels it.");
          return;
        } catch {
          // race condition — fall through to payment
        }
      }
      setPendingTruth({ message, mood });
    },
    [me, profile, notify, addNotification]
  );

  // ── Reaction notifier: watch own posts for new reactions ────────────────
  const prevReactionTotals = useRef({});
  useEffect(() => {
    if (!myFeeds || !myFeeds.length) return;
    myFeeds.forEach((feed) => {
      const total = reactionTotal(feed);
      const prev  = prevReactionTotals.current[feed.id] ?? total;
      if (total > prev) {
        const delta = total - prev;
        addNotification({
          id: `react_${feed.id}_${Date.now()}`,
          type: "reaction",
          text: `${delta} new reaction${delta > 1 ? "s" : ""} on your truth.`,
          ts: Date.now(),
          read: false,
        });
      }
      prevReactionTotals.current[feed.id] = total;
    });
  }, [myFeeds, addNotification]);

  // ── Connect notifier: watch own posts for new pending connects ───────────
  const prevPendingCounts = useRef({});
  useEffect(() => {
    if (!myFeeds || !myFeeds.length) return;
    myFeeds.forEach((feed) => {
      const pending = (feed.connect || []).filter((c) => c.flag === "request").length;
      const prev    = prevPendingCounts.current[feed.id] ?? pending;
      if (pending > prev) {
        addNotification({
          id: `conn_${feed.id}_${Date.now()}`,
          type: "connect",
          text: `Someone wants to connect with you.`,
          ts: Date.now(),
          read: false,
        });
      }
      prevPendingCounts.current[feed.id] = pending;
    });
  }, [myFeeds, addNotification]);

  /* V5 — handle challenge acceptance: pre-fill the composer with the challenge. */
  const [challengeText, setChallengeText] = useState("");
  const handleAcceptChallenge = useCallback((promptText) => {
    setChallengeText(promptText + " ");
    setComposerForced(true);
  }, []);

  /* V5 — handle booth submit */
  const handleBoothSubmit = useCallback((message, mood, author) => {
    setBoothOpen(false);
    startTruth(message, mood, author);
  }, [startTruth]);

  /* V5 — toggle save on a post */
  const handleToggleSave = useCallback((post) => {
    toggleSave(post);
  }, [toggleSave]);

  /* V5 — open another user's profile */
  const handleAuthorTap = useCallback((post) => {
    if (post.uid === me?.uid) { setTab("profile"); return; }
    setViewingProfile({ uid: post.uid, displayName: post.displayName, age: post.age, photoURL: post.photoURL });
  }, [me]);

  /* V5 — echo a truth */
  const handleEchoPost = useCallback((post) => {
    setEchoPost(post);
  }, []);

  /* V5 — submit an echo */
  const handleEchoSubmit = useCallback((message, mood) => {
    startTruth(message, mood, me?.displayName || "Anonymous");
    setEchoPost(null);
    addNotification({
      id: `echo_${Date.now()}`,
      type: "echo",
      text: `You echoed a truth.`,
      ts: Date.now(),
      read: false,
    });
  }, [me, addNotification]);

  /* V5 — open chat info */
  const handleOpenChatInfo = useCallback((chat) => {
    setChatInfoOpen(chat);
  }, []);

  const onConnect = useCallback(
    (feed) => {
      sendConnect(feed, me);
      notify("Reached out. They'll see it in their inbox.", "neutral");
    },
    [me, notify]
  );

  const onReact = useCallback((feedId, key) => react(feedId, key, uid), [uid]);

  const onAccept = useCallback(
    async (feed, connector) => {
      const chat = await acceptConnect(feed, connector, me); // returns chat w/ id = connector.uid
      setCelebrating(true);
      addNotification({
        id: `connected_${Date.now()}`,
        type: "connect",
        text: `You connected with ${connector?.displayName || "someone"}. Say something real.`,
        ts: Date.now(),
        read: false,
      });
      setOpenChat(chat);
    },
    [me, addNotification]
  );

  /* Passing now routes through a confirm so it's never accidental. */
  const requestPass = useCallback((feed, connector) => {
    setPassTarget({ feed, connector });
  }, []);

  const confirmPass = useCallback(() => {
    if (!passTarget) return;
    const { feed, connector } = passTarget;
    declineConnect(feed, connector.uid);
    setPassTarget(null);
    notify("Passed, quietly.", "neutral");
  }, [passTarget, notify]);

  const connectStateFor = (post) => {
    const mine = (post.connect || []).find((c) => c.uid === uid);
    return mine ? mine.flag : null;
  };

  /* Feed ranking: the loudest truth is featured, the rest follow in feed order. */
  const ranked = useMemo(() => rankTruths(posts), [posts]);
  const featured = ranked[0];
  const rest = useMemo(() => posts.filter((p) => p.id !== featured?.id), [posts, featured]);

  const pendingIn = myFeeds.reduce(
    (s, f) => s + (f.connect || []).filter((c) => c.flag === "pending").length,
    0
  );
  const unreadMessages = useAllChatUnreads(uid, myFeeds, reachedOutFeeds);
  const inboxBadge = pendingIn + unreadMessages;

  const dataReady = feedReady && myFeedsReady && reachedOutReady;

  /* ── gates ── */
  if (loading) {
    return <LoadingScreen />;
  }
  if (!user) {
    return <LoginOverlay />;
  }

  /* ── the app ── */
  return (
    <div className="min-h-screen" style={{ background: C.bg }}>
      <OfflineBanner />

      {tab === "feed" && newPostCount > 0 && (
        <button
          className="mtp-rise"
          onClick={() => {
            setAcknowledgedPostCount(posts.length);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          style={{
            position: "fixed",
            top: "4.8rem",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 35,
            fontFamily: UI,
            fontWeight: 700,
            fontSize: "0.7rem",
            letterSpacing: "0.12em",
            color: C.bg,
            background: C.ember,
            border: "none",
            borderRadius: "999px",
            padding: "8px 20px",
            cursor: "pointer",
            boxShadow: `0 4px 24px ${C.ember}55`,
            whiteSpace: "nowrap",
          }}
        >
          ↑ {newPostCount} new {newPostCount === 1 ? "truth" : "truths"}
        </button>
      )}

      {/* ── V5 overlays ──────────────────────────────────────────────────────── */}
      {!onboarded && me && <OnboardingFlow onDone={completeOnboarding} />}

      {boothOpen && me && (
        <ConfessionBooth
          me={me}
          onSubmit={handleBoothSubmit}
          onClose={() => setBoothOpen(false)}
          freePost={confesses > 0}
        />
      )}

      {searchOpen && (
        <SearchOverlay
          posts={posts}
          me={me}
          onConnect={(p) => { onConnect(p); setSearchOpen(false); }}
          onReact={onReact}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {savedDrawerOpen && (
        <SavedTruthsDrawer
          savedList={savedList}
          savedIds={savedIds}
          onUnsave={handleToggleSave}
          onClose={() => setSavedDrawerOpen(false)}
          me={me}
          onReact={onReact}
        />
      )}

      {settingsOpen && (
        <SettingsSheet
          settings={settings}
          updateSetting={updateSetting}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {analyticsOpen && (
        <TruthAnalyticsOverlay
          myFeeds={myFeeds}
          analytics={analytics}
          onClose={() => setAnalyticsOpen(false)}
        />
      )}

      {journalOpen && (
        <MoodJournalOverlay
          myFeeds={myFeeds}
          onClose={() => setJournalOpen(false)}
        />
      )}

      {achievementsOpen && (
        <AchievementsOverlay
          achievements={achievements}
          onClose={() => setAchievementsOpen(false)}
        />
      )}

      {notifDrawerOpen && (
        <NotificationDrawer
          notifications={notifications}
          unreadCount={notifUnread}
          onMarkAllRead={markAllRead}
          onClearAll={clearNotifs}
          onClose={() => setNotifDrawerOpen(false)}
        />
      )}

      {draftsDrawerOpen && (
        <DraftManagerOverlay
          drafts={drafts}
          onLoad={(d) => { setChallengeText(d.text); setComposerForced(true); }}
          onDelete={deleteDraft}
          onClearAll={clearDrafts}
          onClose={() => setDraftsDrawerOpen(false)}
        />
      )}

      {viewingProfile && (
        <UserProfileOverlay
          targetUid={viewingProfile.uid}
          displayName={viewingProfile.displayName}
          age={viewingProfile.age}
          photoURL={viewingProfile.photoURL}
          posts={posts}
          me={me}
          onConnect={(p) => { onConnect(p); setViewingProfile(null); }}
          onReact={onReact}
          onClose={() => setViewingProfile(null)}
        />
      )}

      {openChat && <ChatScreen chat={openChat} me={me} onBack={() => setOpenChat(null)} onOpenInfo={handleOpenChatInfo} />}

      {chatInfoOpen && (
        <ChatInfoOverlay
          chat={chatInfoOpen}
          me={me}
          onBlock={() => {
            setChatInfoOpen(null);
            setOpenChat(null);
            notify("Blocked. You won't see them again.", "neutral");
          }}
          onReport={() => {
            setChatInfoOpen(null);
            notify("Report submitted. Thank you.", "neutral");
          }}
          onClose={() => setChatInfoOpen(null)}
        />
      )}

      {sharePost && (
        <TruthShareCard post={sharePost} onClose={() => setSharePost(null)} />
      )}

      {echoPost && (
        <TruthEchoModal
          original={echoPost}
          me={me}
          freePost={freePost}
          onSubmit={handleEchoSubmit}
          onClose={() => setEchoPost(null)}
        />
      )}

      {passTarget && (
        <PassConfirm
          name={passTarget.connector?.displayName}
          onConfirm={confirmPass}
          onCancel={() => setPassTarget(null)}
        />
      )}

      {cashAppReturn && (
        <CashAppReturnOverlay
          feedId={cashAppReturn.feedId}
          status={cashAppReturn.status}
          onRetry={handleCashAppRetry}
          onDone={() => {
            setCashAppReturn(null);
            setTab("feed");
          }}
        />
      )}

      {me && pendingTruth && (
        <TruthPaymentFlow
          me={me}
          truth={pendingTruth}
          onClose={() => setPendingTruth(null)}
          onPosted={() => {
            setPendingTruth(null);
            setTab("feed");
          }}
        />
      )}

      <header
        className="sticky top-0 z-30"
        style={{
          background: "rgba(14,11,18,0.88)",
          backdropFilter: "blur(14px)",
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        <div className="mx-auto max-w-2xl px-6 py-4 flex items-end justify-between">
          <div>
            <Eyebrow>{dl}</Eyebrow>
            <div
              style={{
                fontFamily: SERIF,
                fontStyle: "italic",
                fontSize: "1.5rem",
                color: C.ink,
                lineHeight: 1.1,
              }}
            >
              My True Post
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {/* notification bell */}
            {user && (
              <button
                onClick={() => setNotifDrawerOpen(true)}
                style={{
                  position: "relative",
                  background: "none",
                  border: `1px solid ${C.line}`,
                  borderRadius: "999px",
                  padding: "6px 10px",
                  cursor: "pointer",
                  color: notifUnread > 0 ? C.ember : C.dim,
                  fontFamily: UI,
                  fontSize: "0.8rem",
                  transition: "all 160ms ease",
                }}
                aria-label="Notifications"
              >
                ◎
                {notifUnread > 0 && (
                  <span style={{
                    position: "absolute", top: 1, right: 2,
                    width: 7, height: 7, borderRadius: "50%",
                    background: C.ember, border: `1.5px solid ${C.bg}`,
                  }} />
                )}
              </button>
            )}
            {/* search button */}
            {user && (
              <button
                onClick={() => setSearchOpen(true)}
                className="mtp-soft mtp-focusable"
                style={{
                  fontFamily: UI,
                  fontSize: "0.8rem",
                  color: C.dim,
                  background: "none",
                  border: `1px solid ${C.line}`,
                  borderRadius: "999px",
                  padding: "6px 10px",
                  cursor: "pointer",
                }}
                aria-label="Search truths"
              >
                ⌕
              </button>
            )}
            {user && (
              <button
                onClick={logOut}
                className="mtp-soft mtp-focusable"
                style={{
                  fontFamily: UI,
                  fontWeight: 600,
                  fontSize: "0.68rem",
                  letterSpacing: "0.1em",
                  color: C.dim,
                  background: "none",
                  border: `1px solid ${C.line}`,
                  borderRadius: "999px",
                  padding: "6px 14px",
                  cursor: "pointer",
                }}
              >
                LOG OUT
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 pb-32">
        {tab === "feed" && (
          <>
            {uid && profile && !profile.pwaInstall && <PwaInstallBanner uid={uid} />}
            {feedReady && posts.length >= 3 && <PublicFeedStats posts={posts} />}
            {!feedReady ? (
              <TruthSkeleton big />
            ) : featured ? (
              <Truth
                post={featured}
                big
                index={0}
                me={me}
                connectState={connectStateFor(featured)}
                onConnect={() => onConnect(featured)}
                onReact={onReact}
                onViewConnects={() => setTab("inbox")}
                noAnim={false}
                onSave={handleToggleSave}
                savedIds={savedIds}
                onAuthorTap={handleAuthorTap}
                onEcho={handleEchoPost}
                onShareCard={setSharePost}
              />
            ) : null}
            {feedReady && myFeeds.length === 0 && (
              <ComposeHintBar onAccept={(p) => { setChallengeText(p + " "); setComposerForced(true); }} />
            )}
            <Composer
              onSubmit={startTruth}
              freePost={confesses > 0}
              forceOpen={composerForced}
              onOpened={() => setComposerForced(false)}
              onOpenBooth={() => setBoothOpen(true)}
              draftCount={drafts.length}
              onOpenDrafts={() => setDraftsDrawerOpen(true)}
              challenge={settings.showChallenge ? dailyChallenge : null}
              onAcceptChallenge={handleAcceptChallenge}
            />
            {!feedReady ? (
              <>
                <TruthSkeleton />
                <TruthSkeleton />
                <TruthSkeleton />
              </>
            ) : (
              <>
                {rest.map((p, i) =>
                  isBuried(p) ? (
                    <BuriedTruth
                      key={p.id}
                      post={p}
                      index={i + 1}
                      me={me}
                      connectState={connectStateFor(p)}
                      onConnect={() => onConnect(p)}
                      onReact={onReact}
                      onViewConnects={() => setTab("inbox")}
                      noAnim={true}
                    />
                  ) : (
                    <Truth
                      key={p.id}
                      post={p}
                      index={i + 1}
                      me={me}
                      connectState={connectStateFor(p)}
                      onConnect={() => onConnect(p)}
                      onReact={onReact}
                      onViewConnects={() => setTab("inbox")}
                      noAnim={true}
                      onSave={handleToggleSave}
                      savedIds={savedIds}
                      onAuthorTap={handleAuthorTap}
                      onEcho={handleEchoPost}
                      onShareCard={setSharePost}
                    />
                  )
                )}
                <FeedFooter postCount={posts.length} />
              </>
            )}
          </>
        )}

        {tab === "inbox" && (
          <InboxTab
            myFeeds={myFeeds}
            reachedOutFeeds={reachedOutFeeds}
            conversations={conversations}
            myUid={uid}
            onAccept={onAccept}
            onPass={requestPass}
            onOpenChat={(ch) => setOpenChat(ch)}
          />
        )}

        {tab === "profile" && me && (
          <ProfileTab
            me={me}
            email={profile?.email || user?.email}
            createdAt={profile?.createdAt}
            confesses={confesses}
            myFeeds={myFeeds}
            achievements={achievements}
            analytics={analytics}
            onOpenAnalytics={() => setAnalyticsOpen(true)}
            onOpenJournal={() => setJournalOpen(true)}
            onOpenAchievements={() => setAchievementsOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}

        {tab === "discover" && (
          <>
            <div className="pt-8 pb-2 flex items-end justify-between">
              <div>
                <Eyebrow color={C.lav}>TRUTHS THAT SOUND LIKE YOURS</Eyebrow>
                <p
                  className="mt-2"
                  style={{
                    fontFamily: SERIF,
                    fontStyle: "italic",
                    fontSize: "clamp(1.4rem, 4.5vw, 1.8rem)",
                    color: C.ink,
                    lineHeight: 1.3,
                  }}
                >
                  People whose truths sound like yours.
                </p>
              </div>
              {/* mode toggle: swipe / list */}
              <button
                onClick={() => setDiscoverMode((m) => m === "swipe" ? "list" : "swipe")}
                style={{
                  fontFamily: UI,
                  fontWeight: 700,
                  fontSize: "0.6rem",
                  letterSpacing: "0.14em",
                  color: C.dim,
                  background: "none",
                  border: `1px solid ${C.line}`,
                  borderRadius: "999px",
                  padding: "5px 12px",
                  cursor: "pointer",
                  flexShrink: 0,
                  alignSelf: "flex-end",
                  marginBottom: "0.2rem",
                }}
              >
                {discoverMode === "swipe" ? "LIST VIEW" : "SWIPE VIEW"}
              </button>
            </div>

            {discoverMode === "swipe" && discover.length > 0 ? (
              <SwipeDiscoverStack
                posts={discover}
                me={me}
                onConnect={(p) => onConnect(p)}
                onPass={() => {}}
                onSave={handleToggleSave}
                onReact={onReact}
              />
            ) : (
              <>
                {discover.map((p, i) => (
                  <Truth
                    key={p.id}
                    post={p}
                    index={i}
                    me={me}
                    connectState={connectStateFor(p)}
                    onConnect={() => onConnect(p)}
                    onReact={onReact}
                    onViewConnects={() => setTab("inbox")}
                    onSave={handleToggleSave}
                    savedIds={savedIds}
                    onAuthorTap={handleAuthorTap}
                  />
                ))}
                {discover.length === 0 && (
                  <div
                    className="text-center py-16"
                    style={{ fontFamily: SERIF, fontStyle: "italic", color: C.faint, fontSize: "1.05rem" }}
                  >
                    No echoes yet. Post a truth and we'll find the people who feel it too.
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {celebrating && <ConnectCelebration onDone={() => setCelebrating(false)} />}
      {showHelp && <KeyboardHelpOverlay onClose={() => setShowHelp(false)} />}
      <ReadingProgressBar />
      <ScrollTop visible={tab === "feed" && scrolledPast} />
      <QuickActionBar
        visible={tab === "feed" && scrolledPast}
        onOpenBooth={() => setBoothOpen(true)}
        onOpenSaved={() => setSavedDrawerOpen(true)}
        savedCount={savedIds.length}
        onOpenSearch={() => setSearchOpen(true)}
      />
      <CapsuleNav tab={tab} setTab={setTab} badge={inboxBadge} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   ROOT — Stripe Elements wraps the tree so card hooks work; the NoticeProvider
   gives every screen the in-brand confirmation layer; the ErrorBoundary keeps
   one bad render from blanking the night; GlobalStyle mounts the fonts and
   keyframes once.
   ════════════════════════════════════════════════════════════════════════════ */

export default function MyTruePostApp() {
  return (
    <ErrorBoundary>
      <GlobalStyle />
      <Elements stripe={getStripe()}>
        <NoticeProvider>
          <MyTruePostAppInner />
        </NoticeProvider>
      </Elements>
    </ErrorBoundary>
  );
}