import express from "express";
import cors from "cors";
import dns from "dns/promises";
import fetch from "node-fetch";
import whois from "whois-json";

const app = express();
app.use(cors());
app.use(express.json());

const cache = new Map();

/* ---------- Helpers ---------- */
async function checkHttps(domain) {
  try {
    const res = await fetch(`https://${domain}`, {
      method: "HEAD",
      redirect: "follow",
      timeout: 4000,
    });
    return res.ok;
  } catch {
    return false;
  }
}

function calculateRisk({ https, domainAgeDays }) {
  if (!https) return { risk: "HIGH", status: "SUSPICIOUS", confidence: 20 };
  if (domainAgeDays < 180) return { risk: "MEDIUM", status: "REAL", confidence: 60 };
  return { risk: "LOW", status: "REAL", confidence: 90 };
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
  try {
    const url = input.startsWith("http") ? input : `https://${input}`;
    const parsed = new URL(url);
    const domain = parsed.hostname.replace("www.", "");

    if (cache.has(domain)) return cache.get(domain);

    // DNS
    const dnsResult = await dns.lookup(domain);
    const ip = dnsResult.address;

    // HTTPS
    const https = await checkHttps(domain);

    // WHOIS
    let created = null;
    let updated = null;
    try {
      const whoisData = await whois(domain);
      created =
        whoisData.creationDate ||
        whoisData.created ||
        whoisData.registered ||
        null;
      updated =
        whoisData.updatedDate ||
        whoisData.modified ||
        null;
    } catch {}

    let domainAgeDays = 0;
    if (created) {
      domainAgeDays = Math.floor(
        (Date.now() - new Date(created)) / (1000 * 60 * 60 * 24)
      );
    }

    const { risk, status, confidence } = calculateRisk({
      https,
      domainAgeDays,
    });

    const result = {
      site: domain,
      status,
      risk,
      confidence,
      domainCreated: created
        ? new Date(created).toISOString().split("T")[0]
        : null,
      lastUpdated: updated
        ? new Date(updated).toISOString().split("T")[0]
        : null,
      deployment: inferDeployment(ip),
      explanation:
        risk === "LOW"
          ? "Established domain with HTTPS and stable hosting"
          : risk === "MEDIUM"
          ? "Relatively new domain, verify carefully"
          : "High risk: HTTPS missing or unstable domain",
    };

    cache.set(domain, result);
    return result;
  } catch {
    return {
      site: input,
      status: "FAKE",
      risk: "HIGH",
      confidence: 10,
      domainCreated: null,
      lastUpdated: null,
      deployment: "Unknown",
      explanation: "Domain not found or DNS failed",
    };
  }
}

/* ---------- API ---------- */
app.post("/analyze", async (req, res) => {
  const { urls = [] } = req.body;
  const results = await Promise.all(urls.map(analyzeDomain));
  res.json(results);
});

app.listen(5000, () =>
  console.log("Backend running at http://localhost:5000")
);
