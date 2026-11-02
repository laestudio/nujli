import { ReplitConnectors } from "@replit/connectors-sdk";
import { HttpError } from "./errors";

// The connector injects credentials server-side; no API key enters app code or the browser.
const connectors = new ReplitConnectors();
export function getWhopClient() {
  return {
    async request(path: string, method = "GET", body?: unknown): Promise<any> {
      const response = await connectors.proxy("whop", `/api/v1${path}`, {
        method,
        headers: { "Content-Type": "application/json", "Api-Version-Date": "2025-01-01" },
        ...(body ? {body: JSON.stringify(body)} : {}),
      });
      if (!response.ok) {
        if(response.status===403) throw new HttpError(503,path.startsWith("/plans") ? "Whop denied plan access. The connected key needs plan:basic:read and access to the existing nujli. product." : "Whop denied this operation. The connected key needs permission for checkout creation or membership verification on the existing product.");
        if(response.status===401) throw new HttpError(503,"The connected Whop credential was rejected. Update the Whop connection.");
        throw new HttpError(503, "Whop is unavailable or could not verify this request. Paid access remains locked.");
      }
      return response.json();
    },
  };
}
