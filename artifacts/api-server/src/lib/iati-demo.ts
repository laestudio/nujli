import * as cheerio from "cheerio";
import { randomUUID } from "node:crypto";
import { SaveProjectBody } from "@workspace/api-zod";
import { validateEvidence, type Revision } from "./projects";

export const IATI_DATASET = "https://aidstream.s3.us-west-2.amazonaws.com/xml/irw-activities.xml";
export const IATI_REGISTRY = "https://iatiregistry.org/dataset/irw-activity";
export const ACTIVITY_ID = "GB-CHC-328158-MYA25-2";
export const DEMO_DISCLOSURE = "Independent demonstration built from Islamic Relief's public IATI data. Not reviewed or endorsed by Islamic Relief.";

/** Fixed publisher adapter. It never interprets XML as instructions or resolves external entities. */
export function extractIatiDemo(xml: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("External entities and DTDs are not accepted.");
  const $ = cheerio.load(xml, { xmlMode: true });
  const activity = $("iati-activity").filter((_, el) => $(el).children("iati-identifier").text().trim() === ACTIVITY_ID);
  if (activity.length !== 1) throw new Error("Expected exactly one selected IATI activity.");
  if (activity.children("reporting-org").attr("ref") !== "GB-CHC-328158") throw new Error("Publisher reference mismatch.");
  const countries = activity.children("recipient-country");
  if (countries.length !== 1 || countries.attr("code") !== "MM") throw new Error("Selected activity location changed; review required.");
  const title = activity.children("title").find("narrative").first().text().trim();
  const overview = activity.children('description[type="1"]').find("narrative").first().text().trim();
  const sourceUpdatedAt = activity.attr("last-updated-datetime") ?? "";
  if (!title || !overview || !Number.isFinite(Date.parse(sourceUpdatedAt))) throw new Error("Incomplete activity identity.");
  const claims: Revision["claims"] = [], statistics: Revision["statistics"] = [], updates: Revision["updates"] = [];
  const currencyDefault = activity.attr("default-currency");
  activity.children("budget,transaction").each((_, el) => {
    const entry = $(el);
    const v = entry.children("value");
    const value = v.text().trim();
    const unit = v.attr("currency") ?? currencyDefault ?? "";
    const date = entry.children("transaction-date").attr("iso-date") ?? v.attr("value-date") ?? "";
    const quote = $.xml(el);
    const label = el.tagName === "budget" ? "budget" : (entry.attr("ref") ?? "transaction").trim();
    if (!/^-?\d+(\.\d+)?$/.test(value) || !/^[A-Z]{3}$/.test(unit) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Financial record lacks a valid amount, currency, or reporting date.");
    // Requiring explicit currency in the quote avoids disguising inherited metadata as a quotation.
    if (!v.attr("currency")) throw new Error("Inherited currency requires manual review.");
    const id = randomUUID();
    claims.push({ id, text: quote, quote, sourceUrl: IATI_DATASET, label: "Organization Reported", reviews: [] });
    statistics.push({ id: randomUUID(), label, value, unit, asOf: date, claimId: id, quote, sourceUrl: IATI_DATASET });
    updates.push({ id: randomUUID(), title: el.tagName === "budget" ? "Reported budget (not spending or delivered impact)" : label, date, body: quote, quote, sourceUrl: IATI_DATASET });
  });
  if (!statistics.length) throw new Error("No dated financial evidence found.");
  if (activity.children("result").length) throw new Error("New result indicators require review before updating this demonstration.");
  const corpus = [title, overview, ...claims.map(c => c.quote)].join("\n\n");
  const revision = SaveProjectBody.parse({
    title, overview, cause: "Earthquake recovery",
    locationName: "Myanmar — approximate country-level marker, not a project site",
    latitude: 22, longitude: 96,
    claims, statistics, updates, media: [],
  });
  validateEvidence(revision, corpus, IATI_DATASET);
  return {
    revision, corpus,
    demonstration: {
      disclosure: DEMO_DISCLOSURE, attribution: "Data: Islamic Relief Worldwide via IATI Registry",
      registryUrl: IATI_REGISTRY, activityId: ACTIVITY_ID,
      license: "Attribution-based license (Registry: other-at)", sourceUpdatedAt,
    },
    warnings: [
      "This is a nujli. demonstration, not an organization-approved customer project. No Islamic Relief endorsement or approval is claimed.",
      "All evidence is Organization Reported, not independently verified. Financial figures are not proof of delivered humanitarian outcomes.",
      "No structured result indicators are present in this activity. No authorized media attached yet.",
      "The marker is a rounded country-level cartographic reference (22°N, 96°E), not coordinates reported by IATI or an exact project location.",
      "Budget statistics use value-date. Transaction statistics and the donation-date filter use transaction-date; value-date is separately preserved in the source excerpt. These dates can differ.",
      "The source mixes financial-year/quarter wording in transaction references. Original references are retained without correcting or inferring accounting periods.",
      "The source reports activity-status 2 (implementation) alongside an actual end date of 2026-09-30. This inconsistency is not resolved by nujli.",
      "Evidence excerpts preserve the actual XML financial entries. Amounts are individual records, not summed totals; incoming funds, disbursements, expenditure, and budgets must not be added together.",
      "This record does not establish that any donor's gift funded a transaction. The date filter compares reported dates, not individual donation allocation.",
    ],
  };
}
