import { lookup } from "node:dns/promises";
import https from "node:https";
import ipaddr from "ipaddr.js";
import * as cheerio from "cheerio";
import { HttpError } from "./errors";

export function publicAddress(address: string): boolean {
  try {
    const parsed = ipaddr.process(address);
    return parsed.range() === "unicast";
  } catch { return false; }
}
export function safeUrl(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new HttpError(400, "Enter a valid public HTTPS URL."); }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") ||
      url.hostname.length > 253 || !url.hostname.includes(".") ||
      /(^|\.)(localhost|local|internal|test|invalid|onion)$/.test(url.hostname) ||
      (ipaddr.isValid(url.hostname.replace(/^\[|\]$/g, "")) && !publicAddress(url.hostname.replace(/^\[|\]$/g, "")))) {
    throw new HttpError(400, "Only public HTTPS URLs on port 443 are allowed.");
  }
  url.hash = "";
  return url;
}
// Pin a previously validated DNS address into the TLS connection: prevents DNS rebinding.
export async function fetchPublic(raw: string, redirects = 0, allowMedia = false): Promise<{url: string; html: string; mediaType?:"image"|"video"}> {
  if (redirects > 4) throw new HttpError(422, "The source redirects too many times.");
  const url = safeUrl(raw);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = await lookup(hostname, { all: true, verbatim: true }).catch(() => {
    throw new HttpError(422, "The source hostname could not be resolved.");
  });
  if (!addresses.length || addresses.some(a => !publicAddress(a.address))) throw new HttpError(400, "Private or reserved network addresses are blocked.");
  const address = addresses[0]!;
  const result = await new Promise<{status: number; location?: string; html: string; mediaType?:"image"|"video"}>((resolve, reject) => {
    const req = https.request(url, {
      method: "GET",
      headers: { "User-Agent": "nujli-evidence-reader/1.0", Accept: "text/html,text/plain", "Accept-Encoding": "identity" },
      lookup: (_host, options, callback) => {
        if (options.all) (callback as any)(null, [address]);
        else callback(null, address.address, address.family);
      },
    }, res => {
      const status = res.statusCode ?? 500;
      if (status >= 300 && status < 400) { res.resume(); resolve({status, location: res.headers.location, html: ""}); return; }
      if (status !== 200) { res.resume(); reject(new HttpError(422, `Source returned HTTP ${status}. No project was generated.`)); return; }
      const type = res.headers["content-type"] ?? "";
      if(allowMedia && /^(image\/(jpeg|png|webp|gif|avif)|video\/(mp4|webm|ogg))(;|$)/i.test(type)){
        resolve({status,html:"",mediaType:type.startsWith("image/")?"image":"video"});
        res.destroy();return;
      }
      if (!/^(text\/html|text\/plain|application\/xhtml\+xml)/i.test(type)) {
        res.resume(); reject(new HttpError(422, "Source must be a public HTML or text page.")); return;
      }
      let bytes = 0;
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > 2_000_000) req.destroy(new HttpError(422, "Source exceeds the 2 MB safety limit."));
        else chunks.push(chunk);
      });
      res.on("end", () => resolve({status, html: Buffer.concat(chunks).toString("utf8")}));
      res.on("error", reject);
    });
    const timer = setTimeout(() => req.destroy(new HttpError(422, "Source request timed out.")), 15000);
    req.on("close", () => clearTimeout(timer));
    req.on("error", reject);
    req.end();
  });
  if (result.status >= 300 && result.status < 400) {
    if (!result.location) throw new HttpError(422, "Source sent an invalid redirect.");
    return fetchPublic(new URL(result.location, url).toString(), redirects + 1,allowMedia);
  }
  return {url: url.toString(), html: result.html,...(result.mediaType?{mediaType:result.mediaType}:{})};
}
export function extractSource(html: string, url: string) {
  const $ = cheerio.load(html);
  $("script,style,noscript,iframe,form,nav,footer,header,[hidden]").remove();
  const media: { url: string; type: "image" | "video"; caption: string }[] = [];
  $("img[src],video[src],video source[src]").each((_, el) => {
    try {
      const src = safeUrl(new URL($(el).attr("src")!, url).toString()).toString();
      if (!/\.(svg|html?)(\?|$)/i.test(src)) media.push({url: src, type: el.tagName === "img" ? "image" : "video", caption: $(el).attr("alt") ?? ""});
    } catch { /* Unsafe candidate is excluded, never fetched. */ }
  });
  return {text: $("body").text().replace(/\s+/g, " ").trim().slice(0, 65000), media: media.slice(0, 30)};
}
