import Head from "next/head";

export default function TermsOfService() {
  return (
    <>
      <Head>
        <title>CallTelo — Terms of Service</title>
        <meta name="description" content="CallTelo Terms of Service - Read our platform rules and policies" />
      </Head>

      <main className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="mb-6 text-3xl font-bold">Terms of Service</h1>
          <p className="mb-6 text-sm text-gray-600">
            Last updated: January 9, 2026 • Effective Date: January 9, 2026
          </p>

          {/* Introduction */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">1. Acceptance of Terms</h2>
            <p className="mb-3 text-gray-700">
              Welcome to CallTelo ("we," "our," "us," or "Platform"). By accessing or using CallTelo, 
              you ("User," "you," or "your") agree to be bound by these Terms of Service ("Terms"), 
              our Privacy Policy, and all applicable laws and regulations.
            </p>
            <p className="text-gray-700">
              <strong>IF YOU DO NOT AGREE TO THESE TERMS, DO NOT USE CALLTELO.</strong>
            </p>
          </section>

          {/* Eligibility */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">2. Eligibility and Account Requirements</h2>
            <div className="space-y-3 text-gray-700">
              <p><strong>2.1 Age Requirement:</strong> You must be at least 18 years of age to use CallTelo. 
              By creating an account, you represent and warrant that you are 18 or older.</p>
              
              <p><strong>2.2 Account Security:</strong> You are responsible for maintaining the confidentiality 
              of your account credentials. You agree to notify us immediately of any unauthorized access or 
              security breach.</p>
              
              <p><strong>2.3 Accurate Information:</strong> You agree to provide accurate, current, and complete 
              information during registration and to update such information to keep it accurate and current.</p>
              
              <p><strong>2.4 One Account Per Person:</strong> You may only maintain one active account. 
              Creating multiple accounts to circumvent platform rules or abuse promotions is prohibited.</p>
            </div>
          </section>

          {/* How CallTelo Works */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">3. How CallTelo Works</h2>
            <div className="space-y-3 text-gray-700">
              <p><strong>3.1 Platform Purpose:</strong> CallTelo is a marketplace connecting people who want 
              to talk ("Callers") with people willing to receive paid calls ("Posters").</p>
              
              <p><strong>3.2 Posting:</strong> Posters pay a fee to list their availability for calls. 
              Your real phone number remains private and is never displayed to Callers.</p>
              
              <p><strong>3.3 Calling:</strong> Callers pay to connect with Posters. All calls are routed 
              through CallTelo's secure system to protect both parties' privacy.</p>
              
              <p><strong>3.4 No Guarantee:</strong> We do not guarantee that Posters will receive calls 
              or that Callers will reach their desired Poster. Availability depends on user activity.</p>
            </div>
          </section>

          {/* Payments and Fees */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">4. Payments, Fees, and Earnings</h2>
            <div className="space-y-3 text-gray-700">
              <p><strong>4.1 Posting Fee:</strong> Posting your phone number costs $1.00 per 24-hour listing 
              unless otherwise indicated. This fee is charged immediately upon posting.</p>
              
              <p><strong>4.2 Calling Fee:</strong> Callers pay $1.00 to initiate a call. If the call exceeds 
              60 seconds, additional charges apply at $0.01 per second ($0.60 per minute).</p>
              
              <p><strong>4.3 Poster Earnings:</strong> Posters earn 80% of call revenue for calls exceeding 
              60 seconds. Calls under 60 seconds generate no earnings for Posters.</p>
              
              <p><strong>4.4 Payment Processing:</strong> All payments are processed through Stripe, Cash App, 
              or other third-party payment processors. You agree to their respective terms of service.</p>
              
              <p><strong>4.5 Non-Refundable:</strong> All fees are non-refundable once charged, except as 
              required by law or at our sole discretion in cases of technical error.</p>
              
              <p><strong>4.6 Payout Timing:</strong> Earnings are typically available immediately after calls 
              end. We reserve the right to hold funds for up to 7 days for security or fraud prevention.</p>
              
              <p><strong>4.7 Minimum Payout:</strong> There is no minimum payout threshold. You can withdraw 
              earnings at any time.</p>
              
              <p><strong>4.8 Taxes:</strong> You are solely responsible for reporting and paying all applicable 
              taxes on earnings. We may report your earnings to tax authorities as required by law.</p>
              
              <p><strong>4.9 Failed Payments:</strong> If a payment fails due to insufficient funds, expired 
              cards, or other reasons, your access may be suspended until payment is resolved.</p>
            </div>
          </section>

          {/* Prohibited Content */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">5. Prohibited Content and Conduct</h2>
            <div className="mb-4 rounded-lg bg-red-50 border-2 border-red-200 p-4">
              <p className="font-semibold text-red-800 mb-2">⚠️ ZERO TOLERANCE POLICY</p>
              <p className="text-red-700 text-sm">
                Violation of these content policies will result in immediate account termination, 
                forfeiture of all earnings, and permanent ban from the platform.
              </p>
            </div>
            
            <div className="space-y-3 text-gray-700">
              <p><strong>5.1 Sexually Explicit Content - STRICTLY PROHIBITED:</strong></p>
              <ul className="list-disc pl-6 space-y-1 mb-3">
                <li>Nudity, partial nudity, or sexually suggestive imagery</li>
                <li>Pornographic, obscene, or sexually explicit photos or text</li>
                <li>Profile photos showing underwear, lingerie, or swimwear in sexual contexts</li>
                <li>Provocative poses or gestures of a sexual nature</li>
                <li>Text or descriptions that sexualize the service or suggest adult services</li>
                <li>Any content that could be construed as solicitation for sexual services</li>
              </ul>
              
              <p><strong>5.2 Illegal Activities - STRICTLY PROHIBITED:</strong></p>
              <ul className="list-disc pl-6 space-y-1 mb-3">
                <li>Prostitution, escort services, or sex work of any kind</li>
                <li>Drug sales, trafficking, or promotion of illegal substances</li>
                <li>Money laundering or fraudulent financial schemes</li>
                <li>Human trafficking or exploitation</li>
                <li>Sale of illegal goods or services</li>
                <li>Gambling or betting services</li>
              </ul>
              
              <p><strong>5.3 Harmful or Abusive Content - PROHIBITED:</strong></p>
              <ul className="list-disc pl-6 space-y-1 mb-3">
                <li>Harassment, bullying, threats, or intimidation</li>
                <li>Hate speech, discrimination, or content promoting violence</li>
                <li>Impersonation of others or fraudulent representations</li>
                <li>Spam, phishing, or other deceptive practices</li>
                <li>Content promoting self-harm or suicide</li>
                <li>Child exploitation or endangerment of any kind</li>
              </ul>
              
              <p><strong>5.4 Acceptable Content:</strong></p>
              <ul className="list-disc pl-6 space-y-1 mb-3">
                <li>Regular photos of yourself (fully clothed, non-sexual)</li>
                <li>Professional headshots or casual photos</li>
                <li>Photos you would show to family members</li>
                <li>Honest descriptions of conversation topics you're interested in</li>
                <li>Respectful communication during calls</li>
              </ul>
              
              <p><strong>5.5 Platform Misuse - PROHIBITED:</strong></p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Using CallTelo for any purpose other than legitimate conversations</li>
                <li>Attempting to exchange contact information to circumvent platform fees</li>
                <li>Sharing or posting others' personal information without consent</li>
                <li>Manipulating the rating or review system</li>
                <li>Using automated systems, bots, or scripts</li>
                <li>Reverse engineering, copying, or scraping the platform</li>
              </ul>
            </div>
          </section>

          {/* Why We Have These Rules */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">6. Why These Content Rules Exist</h2>
            <div className="space-y-3 text-gray-700">
              <p>Our strict content policies are not arbitrary. They exist because:</p>
              
              <p><strong>6.1 Legal Requirements:</strong> Federal law (18 U.S.C. § 2257) requires age 
              verification and record-keeping for any platform hosting sexually explicit content. 
              We do not have systems in place for this compliance.</p>
              
              <p><strong>6.2 Payment Processor Requirements:</strong> Stripe, Cash App, and all major 
              payment processors strictly prohibit adult content, escort services, and sexually explicit 
              material. Violations result in immediate account termination and loss of payment processing.</p>
              
              <p><strong>6.3 App Store Compliance:</strong> Apple App Store and Google Play Store prohibit 
              adult content. Violations prevent us from offering mobile apps.</p>
              
              <p><strong>6.4 User Safety:</strong> These policies protect all users by maintaining a 
              safe, respectful environment focused on genuine conversations.</p>
              
              <p className="font-semibold">We cannot and will not make exceptions to these policies, 
              regardless of user status, tenure, or contribution to the platform.</p>
            </div>
          </section>

          {/* Content Moderation */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">7. Content Moderation and Enforcement</h2>
            <div className="space-y-3 text-gray-700">
              <p><strong>7.1 Automated Systems:</strong> We use automated systems (including AI and 
              image recognition) to detect prohibited content. These systems may flag your content 
              for review or automatically remove it.</p>
              
              <p><strong>7.2 Human Review:</strong> Flagged content may be reviewed by our moderation team. 
              We reserve the right to remove any content at our discretion.</p>
              
              <p><strong>7.3 User Reports:</strong> Users can report prohibited content. We investigate 
              all reports and take appropriate action.</p>
              
              <p><strong>7.4 Immediate Removal:</strong> Content that violates these Terms may be removed 
              immediately without notice. Serious violations result in immediate account termination.</p>
              
              <p><strong>7.5 No Appeals for Adult Content:</strong> Bans for sexually explicit content, 
              nudity, or escort services are permanent and not subject to appeal.</p>
            </div>
          </section>

          {/* Call Responsibility */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">8. Call Conduct and Responsibility</h2>
            <div className="space-y-3 text-gray-700">
              <p><strong>8.1 No Monitoring:</strong> CallTelo does not monitor, record, or review the 
              content of calls made through the platform. Calls are private between participants.</p>
              
              <p><strong>8.2 User Responsibility:</strong> You are solely responsible for the content, 
              legality, and appropriateness of your calls. Exercise good judgment and respect.</p>
              
              <p><strong>8.3 Hang Up Anytime:</strong> Either party may end a call at any time for any reason. 
              You are not obligated to continue uncomfortable or inappropriate calls.</p>
              
              <p><strong>8.4 Report Abuse:</strong> If you experience harassment, abuse, or illegal activity 
              during a call, report it immediately to support@calltelo.com.</p>
              
              <p><strong>8.5 Emergency Services:</strong> CallTelo is not intended for emergency communications. 
              Dial 911 or your local emergency number for emergencies.</p>
            </div>
          </section>

          {/* Privacy */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">9. Privacy and Data Protection</h2>
            <div className="space-y-3 text-gray-700">
              <p><strong>9.1 Phone Number Privacy:</strong> Your real phone number is never displayed to 
              other users. All calls are routed through our secure system using a proxy number.</p>
              
              <p><strong>9.2 Data Collection:</strong> We collect information necessary to provide the service, 
              including your name, phone number, email, payment information, and usage data. See our Privacy 
              Policy for details.</p>
              
              <p><strong>9.3 No Recording:</strong> CallTelo does not record calls. However, we cannot prevent 
              users from recording calls on their own devices. Be aware that the other party may be recording.</p>
              
              <p><strong>9.4 Information Sharing:</strong> Do not share personal information (email, social media, 
              other phone numbers) with other users during calls. We are not responsible for information you 
              voluntarily share.</p>
            </div>
          </section>

          {/* Account Termination */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">10. Account Suspension and Termination</h2>
            <div className="space-y-3 text-gray-700">
              <p><strong>10.1 Our Right to Terminate:</strong> We reserve the right to suspend or terminate 
              any account at any time, for any reason, including but not limited to:</p>
              <ul className="list-disc pl-6 space-y-1 mb-3">
                <li>Violation of these Terms of Service</li>
                <li>Posting prohibited content</li>
                <li>Engaging in fraudulent or illegal activity</li>
                <li>Abusing other users or the platform</li>
                <li>Chargebacks or payment disputes</li>
                <li>Creating multiple accounts</li>
                <li>At our sole discretion if we determine you pose a risk</li>
              </ul>
              
              <p><strong>10.2 Effect of Termination:</strong> Upon termination:</p>
              <ul className="list-disc pl-6 space-y-1 mb-3">
                <li>Your account access is immediately revoked</li>
                <li>Any pending earnings may be forfeited (except as required by law)</li>
                <li>You may not create a new account without our permission</li>
                <li>Paid posting fees are not refunded</li>
              </ul>
              
              <p><strong>10.3 Your Right to Terminate:</strong> You may delete your account at any time 
              through account settings or by contacting support@calltelo.com. Deletion is permanent and 
              cannot be undone.</p>
              
              <p><strong>10.4 Survival:</strong> Sections related to payments, liability, indemnification, 
              and dispute resolution survive account termination.</p>
            </div>
          </section>

          {/* Disclaimers */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">11. Disclaimers and Limitations of Liability</h2>
            <div className="space-y-3 text-gray-700">
              <p><strong>11.1 "AS IS" Service:</strong> CallTelo is provided "AS IS" and "AS AVAILABLE" 
              without warranties of any kind, either express or implied, including but not limited to 
              warranties of merchantability, fitness for a particular purpose, or non-infringement.</p>
              
              <p><strong>11.2 No Guarantee of Service:</strong> We do not guarantee that:</p>
              <ul className="list-disc pl-6 space-y-1 mb-3">
                <li>The service will be uninterrupted, secure, or error-free</li>
                <li>Posters will receive calls or earn income</li>
                <li>Callers will reach their desired Poster</li>
                <li>Call quality will meet your expectations</li>
                <li>Technical issues will not occur</li>
              </ul>
              
              <p><strong>11.3 Limitation of Liability:</strong> TO THE FULLEST EXTENT PERMITTED BY LAW, 
              CALLTELO AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY 
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT 
              LIMITED TO LOST PROFITS, LOST REVENUE, LOST DATA, OR LOSS OF GOODWILL, ARISING FROM:</p>
              <ul className="list-disc pl-6 space-y-1 mb-3">
                <li>Your use or inability to use the service</li>
                <li>Technical issues, bugs, or outages</li>
                <li>Actions or content of other users</li>
                <li>Unauthorized access to your account</li>
                <li>Any other matter relating to the service</li>
              </ul>
              
              <p><strong>11.4 Maximum Liability:</strong> Our total liability to you for all claims 
              arising from your use of CallTelo shall not exceed the amount you paid us in the 12 months 
              before the claim arose, or $100, whichever is less.</p>
              
              <p><strong>11.5 User Interactions:</strong> We are not responsible for interactions between 
              users. Users interact at their own risk.</p>
            </div>
          </section>

          {/* Indemnification */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">12. Indemnification</h2>
            <div className="space-y-3 text-gray-700">
              <p>You agree to indemnify, defend, and hold harmless CallTelo, its affiliates, officers, 
              directors, employees, agents, and partners from and against any claims, liabilities, damages, 
              losses, costs, or expenses (including reasonable attorneys' fees) arising from:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Your violation of these Terms</li>
                <li>Your violation of any law or regulation</li>
                <li>Your violation of any third-party rights</li>
                <li>Content you post or calls you make/receive</li>
                <li>Your use or misuse of the platform</li>
                <li>Any fraud or illegal activity you engage in</li>
              </ul>
            </div>
          </section>

          {/* Dispute Resolution */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">13. Dispute Resolution and Arbitration</h2>
            <div className="space-y-3 text-gray-700">
              <p><strong>13.1 Informal Resolution:</strong> Before filing a claim, you agree to contact us 
              at support@calltelo.com and attempt to resolve the dispute informally for at least 30 days.</p>
              
              <p><strong>13.2 Binding Arbitration:</strong> If we cannot resolve a dispute informally, 
              you agree that any dispute will be resolved through binding arbitration rather than in court, 
              except where prohibited by law.</p>
              
              <p><strong>13.3 Class Action Waiver:</strong> You agree to resolve disputes on an individual 
              basis only. You waive any right to participate in a class action lawsuit or class-wide arbitration.</p>
              
              <p><strong>13.4 Governing Law:</strong> These Terms are governed by the laws of [YOUR STATE], 
              without regard to conflict of law principles.</p>
            </div>
          </section>

          {/* Promotions */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">14. Promotions and Special Offers</h2>
            <div className="space-y-3 text-gray-700">
              <p><strong>14.1 First 1,000 Users Promotion:</strong> The first 1,000 users to create accounts 
              receive free automatic reposting for life (a $30/month value). This promotion:</p>
              <ul className="list-disc pl-6 space-y-1 mb-3">
                <li>Is a pricing benefit only</li>
                <li>Does not exempt users from content policies or Terms of Service</li>
                <li>May be revoked if account is terminated for violations</li>
                <li>Cannot be transferred to other accounts</li>
              </ul>
              
              <p><strong>14.2 Promotion Terms:</strong> All promotions are subject to availability and may 
              be modified or terminated at any time. Promotions cannot be combined unless explicitly stated.</p>
            </div>
          </section>

          {/* Changes to Terms */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">15. Changes to Terms</h2>
            <div className="space-y-3 text-gray-700">
              <p><strong>15.1 Right to Modify:</strong> We may update these Terms at any time. When we do, 
              we will update the "Last Updated" date at the top of this page.</p>
              
              <p><strong>15.2 Notice of Changes:</strong> For material changes, we will provide notice through 
              the platform, via email, or by other means at least 30 days before the changes take effect.</p>
              
              <p><strong>15.3 Continued Use:</strong> Your continued use of CallTelo after changes take effect 
              constitutes acceptance of the updated Terms. If you do not agree to the changes, you must stop 
              using the platform and delete your account.</p>
            </div>
          </section>

          {/* Miscellaneous */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">16. Miscellaneous</h2>
            <div className="space-y-3 text-gray-700">
              <p><strong>16.1 Entire Agreement:</strong> These Terms, together with our Privacy Policy, 
              constitute the entire agreement between you and CallTelo.</p>
              
              <p><strong>16.2 Severability:</strong> If any provision of these Terms is found to be invalid 
              or unenforceable, the remaining provisions will remain in full force and effect.</p>
              
              <p><strong>16.3 No Waiver:</strong> Our failure to enforce any right or provision of these 
              Terms does not constitute a waiver of such right or provision.</p>
              
              <p><strong>16.4 Assignment:</strong> You may not assign or transfer your rights under these 
              Terms without our written consent. We may assign our rights and obligations without restriction.</p>
              
              <p><strong>16.5 Force Majeure:</strong> We are not liable for any failure or delay in performance 
              due to circumstances beyond our reasonable control.</p>
            </div>
          </section>

          {/* Contact */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">17. Contact Information</h2>
            <div className="space-y-3 text-gray-700">
              <p>If you have questions about these Terms of Service, please contact us:</p>
              <ul className="list-none space-y-1">
                <li><strong>Email:</strong> <a href="mailto:support@calltelo.com" className="text-blue-600 underline">support@calltelo.com</a></li>
                <li><strong>Website:</strong> <a href="https://calltelo.com" className="text-blue-600 underline">https://calltelo.com</a></li>
              </ul>
            </div>
          </section>

          {/* Acknowledgment */}
          <section className="mb-8 rounded-lg bg-blue-50 border-2 border-blue-200 p-6">
            <h2 className="mb-3 text-xl font-semibold text-blue-900">Acknowledgment</h2>
            <p className="text-blue-800">
              BY USING CALLTELO, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND 
              BY THESE TERMS OF SERVICE. IF YOU DO NOT AGREE, YOU MUST NOT USE THE PLATFORM.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}