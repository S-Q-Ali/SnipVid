/**
 * Shared request-level validation for identifiers we hand out to clients.
 *
 * Both the job polling route and the file serving route take a job ID straight
 * from the URL, and they had drifted into different rules. Keep one strict
 * check so an ID the API refuses to poll cannot still be used to fetch a file.
 */
const UUID_PATTERN =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

/** True only for a canonical UUID, which is all `randomUUID()` ever produces. */
export function isJobId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
