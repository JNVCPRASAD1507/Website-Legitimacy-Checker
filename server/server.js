import express from "express";
import cors from "cors";
import dns from "dns/promises";
import puppeteer from "puppeteer";
import whois from "whois-json";

const app = express();
app.use(cors());
app.use(express.json());

const PLATFORM_DOMAINS = ["vercel.app", "netlify.app", "github.io"];
const cache = new Map();

/* ---------- Helpers ---------- */

function isSuspiciousSubdomain(domain) {
  const parts = domain.split(".");
  if (parts.length < 3) return false;
  const sub = parts.slice(0, -2).join("");
  return sub.length < 5 || /^[a-z0-9]+$/.test(sub);
}

async function checkHttps(domain) {
  try {
    const res = await fetch(`https://${domain}`, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function puppeteerCheck(url) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    const response = await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 15000,
    });

    await browser.close();
    return { reachable: true, status: response.status() };
  } catch (err) {
    await browser.close();
    return { reachable: false, error: err.message };
  }
}

function inferDeployment(ip) {
  if (!ip) return "Unknown";
  if (ip.startsWith("34.") || ip.startsWith("35.")) return "Google Cloud";
  if (ip.startsWith("52.") || ip.startsWith("54.")) return "AWS";
  if (ip.startsWith("104.")) return "Cloudflare";
  return "Private / Unknown";
}

/* ---------- Analyzer ---------- */

async function analyzeDomain(input) {
  const url = input.startsWith("http") ? input : `https://${input}`;
  const domain = new URL(url).hostname.replace("www.", "");

  if (cache.has(domain)) return cache.get(domain);

  /* Platform subdomain rule */
  if (PLATFORM_DOMAINS.some((p) => domain.endsWith(p))) {
    if (isSuspiciousSubdomain(domain)) {
      const result = {
        site: domain,
        status: "UNVERIFIED",
        risk: "MEDIUM",
        trustLevel: "LOW",
        explanation: "Random platform subdomain (can host anything)",
        publishedOn: "Platform Hosting",
      };
      cache.set(domain, result);
      return result;
    }
  }

  try {
    // DNS
    const dnsResult = await dns.lookup(domain);
    const ip = dnsResult.address;

    // HTTPS
    const https = await checkHttps(domain);

    // WHOIS
    let created = null;
    try {
      const whoisData = await whois(domain);
      created =
        whoisData.creationDate ||
        whoisData.created ||
        whoisData.registered ||
        null;
    } catch {}

    let domainAgeDays = 0;
    if (created) {
      domainAgeDays = Math.floor(
        (Date.now() - new Date(created)) / (1000 * 60 * 60 * 24)
      );
    }

    // Puppeteer live test
    const live = await puppeteerCheck(url);

    let risk = "LOW";
    let status = "REAL";

    if (!https || !live.reachable) {
      risk = "HIGH";
      status = "SUSPICIOUS";
    } else if (domainAgeDays < 180) {
      risk = "MEDIUM";
    }

    const result = {
      site: domain,
      status,
      risk,
      https: https ? "Enabled" : "Disabled",
      domainAgeDays,
      deployment: inferDeployment(ip),
      browserTest: live.reachable ? "Loaded Successfully" : "Failed",
      explanation:
        risk === "LOW"
          ? "Stable domain with HTTPS and browser verification"
          : risk === "MEDIUM"
          ? "New domain – verify authenticity"
          : "High risk – browser or security checks failed",
    };

    cache.set(domain, result);
    return result;
  } catch {
    return {
      site: domain,
      status: "FAKE",
      risk: "HIGH",
      explanation: "DNS lookup failed or domain not found",
    };
  }
}

/* ---------- API ---------- */

app.post("/analyze", async (req, res) => {
  const { domain } = req.body;
  if (!domain) {
    return res.status(400).json({ error: "Domain is required" });
  }

  const result = await analyzeDomain(domain);
  res.json(result);
});

/* ---------- Server ---------- */

app.listen(4000, () => {
  console.log("Backend running on http://localhost:4000");
});
