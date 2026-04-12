import TelemetrySessionDetailClient from "@/components/organisms/telemetry/TelemetrySessionDetailClient"

export default async function TelemetrySessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  return (
    <section className="content-wrapper w-full min-w-full max-w-full shrink-0 px-0">
      <TelemetrySessionDetailClient key={sessionId} sessionId={sessionId} />
    </section>
  )
}
