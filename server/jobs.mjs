export function initialJobStatus(settings, input) {
  if (settings.requireReview) return 'review'
  return input.publishNow ? 'queued' : 'scheduled'
}
