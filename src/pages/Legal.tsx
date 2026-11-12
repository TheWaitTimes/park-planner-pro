import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/logo.png";

const UPDATED = "November 12, 2026";
const CONTACT = "thewaittimesnewsletter@gmail.com";

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="Bay Lake Insights Co." className="h-10 w-auto" />
          </Link>
          <Link to="/" className="flex items-center gap-1 text-sm font-body hover:underline">
            <ArrowLeft className="w-4 h-4" /> Back to site
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-10 font-body leading-relaxed space-y-6 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_a]:underline">
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">Last updated {UPDATED}</p>
        {children}
        <p className="pt-6 text-sm text-muted-foreground">
          See also: <Link to="/privacy">Privacy Policy</Link> · <Link to="/terms">Terms of Service</Link>
        </p>
      </main>
    </div>
  );
}

export function PrivacyPolicy() {
  return (
    <Shell title="Privacy Policy">
      <p>This policy explains what information Bay Lake Insights Co. ("we", "us") collects when you use this website, how we use it, and the choices you have.</p>

      <h2>Accounts and sign-in</h2>
      <p>If you create an account, we store your email address and a secure sign-in record. You can sign in with email and password or with Google; if you use Google, Google shares your name and email address with us. Our hosting and database provider stores this information and keeps a sign-in token in your browser so you stay logged in.</p>

      <h2>Payments</h2>
      <p>Pro plans are processed by Stripe. Card details go directly to Stripe and are never stored by us. Stripe shares your email, plan, payment status and billing dates with us so we can unlock Pro tools. Stripe's handling of your data is described in <a href="https://stripe.com/privacy" target="_blank" rel="noreferrer">Stripe's privacy policy</a>.</p>

      <h2>Visitor analytics</h2>
      <p>We use Lovable's built-in visitor analytics to understand how the site is used. It uses no cookies, stores nothing on your device, doesn't keep IP addresses and doesn't identify visitors. Lovable collects this data for us. <a href="https://lovable.dev/privacy" target="_blank" rel="noreferrer">Lovable's privacy policy</a> explains how it handles it.</p>
      <p>It records the pages visited, where visitors came from, their country, browser, operating system and device type, how long they stay, how fast pages load, errors, and which buttons and links are clicked. Detailed data is kept for 90 days and daily summaries for a year. This is recorded for every visitor, without cookies and without identifying anyone.</p>

      <h2>Information stored in your browser</h2>
      <p>To keep the site fast, we save recently loaded wait times, park hours and weather in your browser's local storage for up to 30 minutes. This data is not personal and is not sent to us.</p>

      <h2>Third-party services</h2>
      <ul>
        <li><strong>Google Fonts</strong> — fonts are loaded from Google, which receives your IP address and browser details when the page loads.</li>
        <li><strong>Substack</strong> — the Blog page shows our Substack posts and an embedded Substack subscribe form. If you subscribe, Substack receives your email under <a href="https://substack.com/privacy" target="_blank" rel="noreferrer">its privacy policy</a>.</li>
        <li><strong>themeparks.wiki and Open-Meteo</strong> — wait times, park hours and weather are fetched from these services; they receive standard request details such as your IP address.</li>
        <li><strong>Social media</strong> — footer links open X, Instagram, TikTok or YouTube, which apply their own policies.</li>
      </ul>

      <h2>How we use information</h2>
      <p>We use your information only to run your account, provide Pro access, answer your messages and improve the site. We do not sell your personal information.</p>

      <h2>Your choices</h2>
      <p>You can update payment details or cancel your plan from My Pro. To access or delete your account data, email us at <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. Stripe may keep payment records as required by law.</p>

      <h2>Children</h2>
      <p>This site is not directed to children under 13, and we do not knowingly collect their information.</p>

      <h2>Changes</h2>
      <p>We may update this policy. The date at the top shows when it last changed.</p>

      <h2>Contact</h2>
      <p>Questions? Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
    </Shell>
  );
}

export function TermsOfService() {
  return (
    <Shell title="Terms of Service">
      <p>By using Bay Lake Insights Co. (the "Service"), you agree to these terms.</p>

      <h2>Not affiliated with Disney</h2>
      <p>Bay Lake Insights Co. is an independent fan project. It is not affiliated with, endorsed by, or sponsored by The Walt Disney Company. Park, attraction and product names belong to their owners.</p>

      <h2>Information is an estimate</h2>
      <p>Wait times, crowd scores, itineraries, Lightning Lane details, park hours and weather come from third-party sources and our own models. They can be wrong or out of date. Always confirm with the official park app before making plans. We are not responsible for decisions made using this information.</p>

      <h2>Accounts</h2>
      <p>You are responsible for keeping your login secure and for activity under your account. We may suspend accounts that misuse the Service.</p>

      <h2>Pro plans and billing</h2>
      <ul>
        <li>Monthly ($1.99/month) and Yearly ($20/year) plans renew automatically until cancelled.</li>
        <li>Lifetime ($35) is a one-time payment for Pro access for as long as the Service operates.</li>
        <li>You can cancel anytime from My Pro. You keep access until the end of the period you paid for.</li>
        <li>Payments are non-refundable except where required by law. Contact us if you believe you were charged in error.</li>
        <li>We may change prices with notice; changes apply at your next renewal.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>Don't scrape, overload, reverse-engineer or resell the Service, share paid access, or use it for anything unlawful.</p>

      <h2>Content</h2>
      <p>The site's design, tools, models and writing belong to Bay Lake Insights Co. Rankings you create are for personal use.</p>

      <h2>Disclaimer and liability</h2>
      <p>The Service is provided "as is" without warranties of any kind. To the fullest extent allowed by law, our total liability for any claim is limited to the amount you paid us in the 12 months before the claim.</p>

      <h2>Changes and termination</h2>
      <p>We may update these terms or change or discontinue features. Continuing to use the Service means you accept the updated terms.</p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of the State of Florida, USA.</p>

      <h2>Contact</h2>
      <p>Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
    </Shell>
  );
}
