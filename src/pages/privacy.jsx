import Head from "next/head";

export default function PrivacyPolicy() {
  return (
    <>
      <Head>
        <title>CallTelo — Privacy Policy</title>
        <meta name="description" content="CallTelo Privacy Policy - Learn how we protect your privacy and data" />
      </Head>

      <main className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="mb-6 text-3xl font-bold">Privacy Policy</h1>
          <p className="mb-6 text-sm text-gray-600">
            Last updated: January 9, 2026 • Effective Date: January 9, 2026
          </p>

          {/* Introduction */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">1. Introduction</h2>
            <div className="space-y-3 text-gray-700">
              <p>
                Welcome to CallTelo ("we," "our," "us," or "Platform"). We are committed to protecting 
                your privacy and being transparent about how we collect, use, and protect your personal 
                information.
              </p>
              <p>
                This Privacy Policy explains what information we collect, why we collect it, how we use it, 
                and your rights regarding your data. By using CallTelo, you agree to the collection and use 
                of information as described in this policy.
              </p>
              <p className="font-semibold">
                If you do not agree with this Privacy Policy, please do not use CallTelo.
              </p>
            </div>
          </section>

          {/* Information We Collect */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">2. Information We Collect</h2>
            
            <div className="space-y-4 text-gray-700">
              <div>
                <h3 className="mb-2 text-lg font-semibold">2.1 Information You Provide Directly</h3>
                <p className="mb-2">When you create an account or use CallTelo, you provide:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Account Information:</strong> Name, email address, phone number, profile photo</li>
                  <li><strong>Profile Information:</strong> Age, city/location, bio/message, preferences</li>
                  <li><strong>Payment Information:</strong> Credit card details, Cash App information (processed securely by Stripe and other payment processors—we do not store full payment card numbers)</li>
                  <li><strong>Communications:</strong> Messages you send to our support team, feedback, or reports</li>
                  <li><strong>Identity Verification:</strong> Information needed to verify your identity if required</li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">2.2 Information Collected Automatically</h3>
                <p className="mb-2">When you use CallTelo, we automatically collect:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Call Metadata:</strong> Call duration, timestamps, call status (answered/missed), caller and receiver IDs (internal system IDs, not phone numbers)</li>
                  <li><strong>Usage Data:</strong> Features you use, posts you view, time spent on platform, pages visited</li>
                  <li><strong>Device Information:</strong> Device type, operating system, browser type, IP address, unique device identifiers</li>
                  <li><strong>Location Data:</strong> Approximate location based on IP address (city/state level, not precise GPS)</li>
                  <li><strong>Cookies and Similar Technologies:</strong> We use cookies, web beacons, and similar technologies to enhance your experience and analyze platform usage</li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">2.3 Information from Third Parties</h3>
                <p className="mb-2">We may receive information from:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Payment Processors:</strong> Transaction confirmations, fraud alerts from Stripe, Cash App</li>
                  <li><strong>Analytics Providers:</strong> Aggregated usage statistics from Google Analytics, Firebase</li>
                  <li><strong>Social Media:</strong> If you choose to sign in with Google or Apple, we receive basic profile information</li>
                  <li><strong>Public Sources:</strong> Information from public databases for fraud prevention or verification</li>
                </ul>
              </div>

              <div className="rounded-lg bg-blue-50 border-2 border-blue-200 p-4">
                <p className="font-semibold text-blue-800 mb-2">🔒 Your Privacy is Protected</p>
                <p className="text-blue-700 text-sm">
                  <strong>Your real phone number is NEVER displayed to other users.</strong> All calls are 
                  routed through our secure proxy system. Other users see a CallTelo number, not your personal 
                  phone number.
                </p>
              </div>
            </div>
          </section>

          {/* How We Use Information */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">3. How We Use Your Information</h2>
            <div className="space-y-4 text-gray-700">
              <p>We use the information we collect for the following purposes:</p>

              <div>
                <h3 className="mb-2 text-lg font-semibold">3.1 To Provide and Improve the Service</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Create and maintain your account</li>
                  <li>Connect callers with posters securely and privately</li>
                  <li>Route calls through our proxy system to protect phone numbers</li>
                  <li>Display your profile to potential callers (name, age, city, photo, message)</li>
                  <li>Calculate call durations and charges</li>
                  <li>Process payments and distribute earnings</li>
                  <li>Improve platform features, functionality, and user experience</li>
                  <li>Develop new features and services</li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">3.2 For Security and Fraud Prevention</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Detect and prevent fraud, abuse, or illegal activity</li>
                  <li>Monitor for prohibited content (adult content, illegal services)</li>
                  <li>Enforce our Terms of Service and content policies</li>
                  <li>Verify user identity when necessary</li>
                  <li>Investigate reported violations or suspicious activity</li>
                  <li>Protect the safety of our users and platform</li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">3.3 For Communication and Support</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Send transactional emails (account creation, password resets, payment confirmations)</li>
                  <li>Send service notifications (post expiring, call received, earnings available)</li>
                  <li>Respond to your support requests and inquiries</li>
                  <li>Send marketing emails about new features or promotions (you can opt out)</li>
                  <li>Collect feedback to improve the service</li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">3.4 For Analytics and Business Operations</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Analyze platform usage patterns and trends</li>
                  <li>Generate aggregated, anonymized statistics</li>
                  <li>Measure effectiveness of marketing campaigns</li>
                  <li>Understand user behavior to improve the platform</li>
                  <li>Create internal reports and analytics</li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">3.5 For Legal Compliance</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Comply with applicable laws, regulations, and legal processes</li>
                  <li>Respond to lawful requests from law enforcement or government authorities</li>
                  <li>Enforce our legal rights and defend against legal claims</li>
                  <li>Fulfill tax reporting obligations (e.g., 1099 forms for earnings)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Call Privacy */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">4. Call Privacy and Content</h2>
            <div className="space-y-3 text-gray-700">
              <div className="rounded-lg bg-green-50 border-2 border-green-200 p-4 mb-4">
                <p className="font-semibold text-green-800 mb-2">🔐 We Do NOT Record Your Calls</p>
                <p className="text-green-700">
                  CallTelo does <strong>NOT</strong> listen to, monitor, or record the actual content of your 
                  calls. Your conversations are private between you and the other party.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">4.1 What We Collect About Calls</h3>
                <p className="mb-2">We only collect call metadata necessary for platform operation:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Call start time and end time</li>
                  <li>Call duration (for billing purposes)</li>
                  <li>Caller and receiver (internal user IDs, not phone numbers)</li>
                  <li>Call status (answered, missed, ended)</li>
                  <li>Call charges and earnings calculations</li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">4.2 How Your Phone Number is Protected</h3>
                <p className="mb-2">Your privacy is our top priority:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Your real phone number is <strong>NEVER</strong> shown to other users</li>
                  <li>All calls are routed through our secure proxy number system</li>
                  <li>Callers see the CallTelo number (+1 727-607-7771), not your number</li>
                  <li>You see a caller ID from CallTelo's system, not the caller's real number</li>
                  <li>When you delete your account, your phone number is permanently removed</li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">4.3 User Responsibility for Call Content</h3>
                <p className="mb-2">Important reminders:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>CallTelo cannot prevent users from recording calls on their own devices</li>
                  <li>Be aware that the other party may record the conversation (state laws vary)</li>
                  <li>Do not share sensitive personal information during calls</li>
                  <li>You are responsible for the content of your conversations</li>
                  <li>Report any harassment, abuse, or illegal activity immediately</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Data Sharing */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">5. How We Share Your Information</h2>
            <div className="space-y-4 text-gray-700">
              <div className="rounded-lg bg-yellow-50 border-2 border-yellow-200 p-4 mb-4">
                <p className="font-semibold text-yellow-800 mb-2">⚠️ We Do NOT Sell Your Data</p>
                <p className="text-yellow-700">
                  We <strong>NEVER</strong> sell, rent, or trade your personal information to third parties 
                  for their marketing purposes. Period.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">5.1 Information Visible to Other Users</h3>
                <p className="mb-2">When you post on CallTelo, the following information is publicly visible:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Your name (as entered in your profile)</li>
                  <li>Your age</li>
                  <li>Your city/location (if provided)</li>
                  <li>Your profile photo</li>
                  <li>Your bio/message</li>
                  <li>Your online/offline status</li>
                  <li>Your ratings and reviews from past calls</li>
                </ul>
                <p className="mt-2"><strong>NOT visible:</strong> Your phone number, email, payment info, earnings</p>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">5.2 Service Providers and Business Partners</h3>
                <p className="mb-2">We share information with trusted third parties who help us operate CallTelo:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Payment Processors:</strong> Stripe, Cash App (for payment processing and fraud prevention)</li>
                  <li><strong>Cloud Hosting:</strong> Google Cloud Platform, Firebase (for data storage and infrastructure)</li>
                  <li><strong>Telephony Providers:</strong> Twilio (for routing calls through our proxy system)</li>
                  <li><strong>Email Services:</strong> SendGrid (for sending transactional and marketing emails)</li>
                  <li><strong>Analytics Services:</strong> Google Analytics, Firebase Analytics (for usage statistics)</li>
                  <li><strong>Customer Support:</strong> Support ticket systems (for handling your inquiries)</li>
                  <li><strong>Security Services:</strong> Fraud detection and prevention tools</li>
                </ul>
                <p className="mt-2 italic text-sm">
                  These service providers are contractually required to protect your data and use it only 
                  for the purposes we specify.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">5.3 Legal Requirements and Safety</h3>
                <p className="mb-2">We may disclose your information when required by law or to protect safety:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>In response to valid legal process (subpoenas, court orders, warrants)</li>
                  <li>To comply with applicable laws and regulations</li>
                  <li>To respond to lawful requests from law enforcement or government agencies</li>
                  <li>To protect our rights, property, or safety, or that of our users or the public</li>
                  <li>To prevent or investigate fraud, security issues, or illegal activity</li>
                  <li>To enforce our Terms of Service or other policies</li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">5.4 Business Transfers</h3>
                <p>
                  If CallTelo is involved in a merger, acquisition, sale of assets, bankruptcy, or similar 
                  business transaction, your information may be transferred to the acquiring entity. We will 
                  notify you via email and/or prominent notice on the platform before your information is 
                  transferred and becomes subject to a different privacy policy.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">5.5 Aggregated and Anonymized Data</h3>
                <p>
                  We may share aggregated, anonymized data that cannot identify you personally. For example, 
                  we might share statistics like "CallTelo has 1,000 active users" or "average call duration 
                  is 8 minutes." This data does not contain any personal information.
                </p>
              </div>
            </div>
          </section>

          {/* Data Security */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">6. Data Security</h2>
            <div className="space-y-3 text-gray-700">
              <p>
                We take the security of your personal information seriously and implement industry-standard 
                security measures to protect your data.
              </p>

              <div>
                <h3 className="mb-2 text-lg font-semibold">6.1 Security Measures We Use</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Encryption:</strong> All data transmitted between your device and our servers uses TLS/SSL encryption</li>
                  <li><strong>Secure Storage:</strong> Data at rest is encrypted using industry-standard encryption</li>
                  <li><strong>Payment Security:</strong> Payment information is processed by PCI-DSS compliant payment processors (Stripe); we do not store full credit card numbers</li>
                  <li><strong>Access Controls:</strong> Strict access controls limit who can access your data internally</li>
                  <li><strong>Monitoring:</strong> We monitor systems for security vulnerabilities and unauthorized access</li>
                  <li><strong>Regular Audits:</strong> We conduct regular security audits and updates</li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">6.2 Your Responsibility</h3>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Choose a strong, unique password for your account</li>
                  <li>Do not share your password with anyone</li>
                  <li>Log out of your account when using shared devices</li>
                  <li>Enable two-factor authentication if available</li>
                  <li>Report any suspicious activity or security concerns immediately</li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">6.3 No Guarantee of Absolute Security</h3>
                <p>
                  While we implement strong security measures, no system is 100% secure. The internet and 
                  electronic storage are inherently vulnerable to unauthorized access, hardware or software 
                  failures, and other factors beyond our control. We cannot guarantee absolute security of 
                  your data.
                </p>
                <p className="mt-2 font-semibold">
                  If we become aware of a data breach that affects your personal information, we will notify 
                  you as required by law.
                </p>
              </div>
            </div>
          </section>

          {/* Data Retention */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">7. Data Retention</h2>
            <div className="space-y-3 text-gray-700">
              <p>
                We retain your personal information for as long as necessary to provide our services and 
                fulfill the purposes described in this Privacy Policy.
              </p>

              <div>
                <h3 className="mb-2 text-lg font-semibold">7.1 Active Accounts</h3>
                <p>While your account is active, we retain all your information to provide the service.</p>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">7.2 Deleted Accounts</h3>
                <p className="mb-2">When you delete your account:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Your profile is immediately removed from public view</li>
                  <li>Your phone number is permanently deleted</li>
                  <li>Most personal information is deleted within 30 days</li>
                  <li>Some data may be retained longer for legal, financial, or security reasons</li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">7.3 Information We May Retain</h3>
                <p className="mb-2">Even after account deletion, we may retain:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Transaction records (for tax and financial reporting - 7 years)</li>
                  <li>Information needed to comply with legal obligations</li>
                  <li>Information needed to resolve disputes or enforce agreements</li>
                  <li>Information needed to prevent fraud or abuse</li>
                  <li>Aggregated, anonymized data that cannot identify you</li>
                  <li>Backup copies for a limited time (deleted within 90 days)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Your Rights */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">8. Your Privacy Rights</h2>
            <div className="space-y-4 text-gray-700">
              <p>You have the following rights regarding your personal information:</p>

              <div>
                <h3 className="mb-2 text-lg font-semibold">8.1 Access and Portability</h3>
                <p>
                  You have the right to request a copy of the personal information we hold about you. 
                  We will provide this in a structured, commonly used, machine-readable format.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">8.2 Correction</h3>
                <p>
                  You have the right to correct inaccurate or incomplete information. You can update most 
                  information directly in your account settings.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">8.3 Deletion</h3>
                <p>
                  You have the right to request deletion of your personal information. You can delete your 
                  account at any time through account settings. Note that some information may be retained 
                  as described in Section 7.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">8.4 Objection and Restriction</h3>
                <p>
                  You can object to certain uses of your information or request that we restrict processing 
                  of your data. This may limit your ability to use certain features.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">8.5 Marketing Opt-Out</h3>
                <p className="mb-2">You can opt out of marketing communications:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Click "unsubscribe" in any marketing email</li>
                  <li>Adjust email preferences in account settings</li>
                  <li>Contact support@calltelo.com</li>
                </ul>
                <p className="mt-2 italic text-sm">
                  Note: You cannot opt out of transactional emails (payment confirmations, password resets, 
                  security alerts) as these are necessary for the service.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">8.6 Cookie Controls</h3>
                <p>
                  You can control cookies through your browser settings. However, disabling cookies may 
                  affect platform functionality.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">8.7 How to Exercise Your Rights</h3>
                <p className="mb-2">To exercise any of these rights, contact us at:</p>
                <ul className="list-none space-y-1">
                  <li><strong>Email:</strong> <a href="mailto:privacy@calltelo.com" className="text-blue-600 underline">privacy@calltelo.com</a></li>
                  <li><strong>Subject Line:</strong> "Privacy Rights Request"</li>
                </ul>
                <p className="mt-2">
                  We will respond to your request within 30 days. We may need to verify your identity before 
                  processing your request.
                </p>
              </div>
            </div>
          </section>

          {/* Children's Privacy */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">9. Children's Privacy</h2>
            <div className="space-y-3 text-gray-700">
              <p className="font-semibold">
                CallTelo is not intended for children under 18 years of age.
              </p>
              <p>
                We do not knowingly collect personal information from anyone under 18. If you are under 18, 
                do not use CallTelo or provide any information to us.
              </p>
              <p>
                If we learn that we have collected personal information from a child under 18, we will delete 
                that information immediately. If you believe we have collected information from a child under 
                18, please contact us at support@calltelo.com.
              </p>
            </div>
          </section>

          {/* International Users */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">10. International Users and Data Transfers</h2>
            <div className="space-y-3 text-gray-700">
              <p>
                CallTelo is based in the United States. If you access CallTelo from outside the United States, 
                your information will be transferred to, stored, and processed in the United States.
              </p>
              <p>
                The United States may have different data protection laws than your country. By using CallTelo, 
                you consent to the transfer of your information to the United States.
              </p>
              <p>
                We comply with applicable data protection laws, including GDPR for European users and CCPA 
                for California residents.
              </p>
            </div>
          </section>

          {/* California Privacy Rights */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">11. California Privacy Rights (CCPA)</h2>
            <div className="space-y-3 text-gray-700">
              <p>If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Right to Know:</strong> Request information about what personal information we collect, use, disclose, and sell</li>
                <li><strong>Right to Delete:</strong> Request deletion of your personal information</li>
                <li><strong>Right to Opt-Out:</strong> Opt out of the "sale" of your personal information (Note: We do NOT sell personal information)</li>
                <li><strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising your CCPA rights</li>
              </ul>
              <p className="mt-3">
                To exercise these rights, contact us at privacy@calltelo.com with "California Privacy Rights" 
                in the subject line.
              </p>
            </div>
          </section>

          {/* EU Privacy Rights */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">12. European Privacy Rights (GDPR)</h2>
            <div className="space-y-3 text-gray-700">
              <p>If you are in the European Economic Area (EEA), you have rights under the General Data Protection Regulation (GDPR):</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Legal Basis:</strong> We process your data based on consent, contract performance, legal obligations, and legitimate interests</li>
                <li><strong>Data Protection Officer:</strong> Contact privacy@calltelo.com for data protection inquiries</li>
                <li><strong>Right to Lodge Complaint:</strong> You may file a complaint with your local data protection authority</li>
                <li><strong>International Transfers:</strong> We use standard contractual clauses for data transfers outside the EEA</li>
              </ul>
            </div>
          </section>

          {/* Third-Party Links */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">13. Third-Party Links and Services</h2>
            <div className="space-y-3 text-gray-700">
              <p>
                CallTelo may contain links to third-party websites, services, or applications (e.g., social 
                media platforms, payment processors). This Privacy Policy does not apply to those third parties.
              </p>
              <p>
                We are not responsible for the privacy practices of third parties. We encourage you to read 
                the privacy policies of any third-party services you use.
              </p>
            </div>
          </section>

          {/* Changes to Policy */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">14. Changes to This Privacy Policy</h2>
            <div className="space-y-3 text-gray-700">
              <p>
                We may update this Privacy Policy from time to time to reflect changes in our practices, 
                technology, legal requirements, or other factors.
              </p>
              <p>
                When we make changes, we will update the "Last Updated" date at the top of this page. For 
                material changes, we will provide notice through the platform, via email, or by other means 
                at least 30 days before the changes take effect.
              </p>
              <p>
                Your continued use of CallTelo after changes take effect constitutes acceptance of the updated 
                Privacy Policy. We encourage you to review this page periodically.
              </p>
            </div>
          </section>

          {/* Contact */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold">15. Contact Us</h2>
            <div className="space-y-3 text-gray-700">
              <p>If you have questions, concerns, or requests regarding this Privacy Policy or your personal information:</p>
              <ul className="list-none space-y-1">
                <li><strong>General Inquiries:</strong> <a href="mailto:support@calltelo.com" className="text-blue-600 underline">support@calltelo.com</a></li>
                <li><strong>Privacy Matters:</strong> <a href="mailto:privacy@calltelo.com" className="text-blue-600 underline">privacy@calltelo.com</a></li>
                <li><strong>Website:</strong> <a href="https://calltelo.com" className="text-blue-600 underline">https://calltelo.com</a></li>
              </ul>
              <p className="mt-3">We will respond to your inquiry within 30 days.</p>
            </div>
          </section>

          {/* Acknowledgment */}
          <section className="rounded-lg bg-blue-50 border-2 border-blue-200 p-6">
            <h2 className="mb-3 text-xl font-semibold text-blue-900">Acknowledgment</h2>
            <p className="text-blue-800">
              BY USING CALLTELO, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO THIS PRIVACY 
              POLICY. IF YOU DO NOT AGREE, PLEASE DO NOT USE THE PLATFORM.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}