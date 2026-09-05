export function isUsableRealtimeResponse(response: Response): boolean {
  const contentType = response.headers.get("content-type") ?? "";
  return response.ok && contentType.includes("application/json");
}
