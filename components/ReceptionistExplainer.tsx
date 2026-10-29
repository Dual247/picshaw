const walkthrough = [
  ['A call comes in', 'A customer calls while your team is on another job. Your approved unanswered or after-hours routing passes the enquiry to the AI receptionist. Carrier support and routing are checked before launch.'],
  ['AI introduces itself', 'The assistant says: “Hi, I’m the AI assistant for your plumbing team. How can I help?” The video shows this greeting as text; it contains no voice recording.'],
  ['Understand the job', 'In this fictional example, a caller wants a quote to replace a kitchen tap. The assistant asks which area the property is in, then captures a name and callback details.'],
  ['Create a useful summary', 'The sample summary shows Alex (an example caller), tap replacement, Culver City and “Callback requested”. These are illustrative details, not a real customer enquiry.'],
  ['Your team takes over', 'The agreed handover process sends the request to your team to review and follow up. A callback request is not a confirmed appointment or a guaranteed response time.'],
  ['Scope, test, then launch', 'Picshaw agrees the business information and call-handling rules, tests realistic scenarios with you and activates the workflow only after the necessary checks and approvals. The final screen invites you to explore the pricing and request a tailored demo.'],
] as const

export function ReceptionistExplainer() {
  return <div id="explainer" className="min-w-0 scroll-mt-28">
    <figure className="overflow-hidden rounded-2xl border border-border bg-[#121511] shadow-2xl shadow-black/20">
      <figcaption className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 text-xs">
        <span className="font-medium tracking-wide text-foreground">From call to follow-up</span>
        <span className="text-muted-foreground">42 seconds · Silent explainer · Example only</span>
      </figcaption>
      <video id="receptionist-explainer-video" controls playsInline preload="none" width={1280} height={720} poster="/media/receptionist-poster.jpg" aria-label="How the Picshaw AI receptionist workflow works" aria-describedby="explainer-disclosure" className="aspect-video h-auto w-full rounded-none bg-[#121511]">
        <source src="/media/receptionist-walkthrough.mp4" type="video/mp4" />
        <track kind="captions" src="/media/receptionist-walkthrough.vtt" srcLang="en" label="English scene descriptions" />
        Your browser cannot play this video. Read the full text walkthrough below.
      </video>
      <p id="explainer-disclosure" className="border-t border-border px-5 py-4 text-xs leading-6 text-muted-foreground">An illustrated workflow, not a real customer call or a live demo. No audio or voice-quality claim. Request a tailored demo to hear and test an agreed setup.</p>
    </figure>
    <details id="walkthrough-text" className="mt-4 rounded-lg border border-border bg-card/40 p-4 text-sm">
      <summary className="cursor-pointer font-medium underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">Read the full walkthrough</summary>
      <ol className="mt-5 space-y-4 text-sm leading-7 text-muted-foreground">{walkthrough.map(([title, description], index) => <li key={title}><strong className="font-medium text-foreground">{index + 1}. {title}.</strong> {description}</li>)}</ol>
    </details>
  </div>
}
