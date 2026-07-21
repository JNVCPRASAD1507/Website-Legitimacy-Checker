import React, { useState } from "react";
import {
  Container,
  Typography,
  TextField,
  Button,
  Box,
  Paper,
  CircularProgress,
  Skeleton,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Checkbox,
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  useMediaQuery,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { useTheme } from "@mui/material/styles";

/* ================= Helpers ================= */
const getColor = (value, type) => {
  if (!value) return "default";
  const v = value.toUpperCase();
  if (type === "status")
    return v === "REAL" ? "success" : v === "FAKE" ? "error" : "warning";
  if (type === "risk")
    return v === "LOW" ? "success" : v === "HIGH" ? "error" : "warning";
  if (type === "trust")
    return v === "HIGH" ? "success" : v === "LOW" ? "error" : "warning";
  return "default";
};

const StatusChip = ({ label, type }) => (
  <Chip label={label} color={getColor(label, type)} size="small" sx={{ fontWeight: 600 }} />
);

/* ================= Column Selector ================= */
function ColumnSelector({ columns, setColumns }) {
  const [anchorEl, setAnchorEl] = useState(null);

  return (
    <Box mt={2}>
      <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
        <MenuIcon />
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {Object.keys(columns).map((key) => (
          <MenuItem key={key}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={columns[key]}
                  onChange={(e) => setColumns((prev) => ({ ...prev, [key]: e.target.checked }))}
                />
              }
              label={key}
            />
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}

/* ================= Platform Subdomain Check ================= */
const PLATFORM_DOMAINS = ["vercel.app", "netlify.app", "github.io"];

function isSuspiciousSubdomain(domain) {
  const parts = domain.split(".");
  const sub = parts.slice(0, -2).join(""); // subdomain before platform
  // flag if subdomain is short/random (like less than 5 chars or numeric-heavy)
  return sub.length < 5 || /^[a-z0-9]{5,}$/.test(sub);
}

/* ================= MAIN APP ================= */
export default function App() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [input, setInput] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const [columns, setColumns] = useState({
    site: true,
    status: true,
    risk: true,
    trustLevel: true,
    securityLevel: true,
    credibilityMismatch: true,
    publishedOn: true,
    explanation: true,
    browserNote: true,
  });

  const cleanDomain = (url) => url.replace(/^https?:\/\//, "").replace("www.", "").trim();

  /* ================= Domain Analysis ================= */
  const analyzeDomain = async (domain) => {
    try {
      // Platform subdomain check
      if (PLATFORM_DOMAINS.some((p) => domain.endsWith(p))) {
        if (isSuspiciousSubdomain(domain)) {
          return {
            site: domain,
            status: "FAKE",
            risk: "HIGH",
            trustLevel: "LOW",
            securityLevel: "HTTPS Enabled",
            credibilityMismatch: "Yes",
            publishedOn: "Unknown",
            explanation: "Suspicious platform subdomain – likely fake site",
            browserNote: "Avoid this website",
          };
        } else {
          return {
            site: domain,
            status: "REAL",
            risk: "LOW",
            trustLevel: "HIGH",
            securityLevel: "HTTPS Enabled",
            credibilityMismatch: "No",
            publishedOn: "Platform Subdomain",
            explanation: "Known safe platform subdomain",
            browserNote: "Safe to visit",
          };
        }
      }

      // DNS check
      const dns = await fetch(`https://dns.google/resolve?name=${domain}&type=A`).then((r) =>
        r.json(),
      );
      const hasDNS = dns.Answer?.length > 0;

      // HTTPS check
      let https = false;
      try {
        await fetch(`https://${domain}`, { mode: "no-cors" });
        https = true;
      } catch {}

      if (!https) {
        return {
          site: domain,
          status: "FAKE",
          risk: "HIGH",
          trustLevel: "LOW",
          securityLevel: "No HTTPS",
          credibilityMismatch: domain.includes("login") || domain.includes("bank") ? "Yes" : "No",
          publishedOn: "Unknown",
          explanation: "No HTTPS detected – site likely unsafe",
          browserNote: "Avoid this website",
        };
      }

      // RDAP / WHOIS
      let created = "Unknown";
      try {
        const rdap = await fetch(`https://rdap.org/domain/${domain}`).then((r) => r.json());
        const event = rdap.events?.find((e) => e.eventAction === "registration");
        created = event?.eventDate?.split("T")[0] || "Unknown";
      } catch {}

      // Risk assessment
      let status = "REAL",
        risk = "LOW",
        trustLevel = "HIGH";

      if (!hasDNS) {
        status = "FAKE";
        risk = "HIGH";
        trustLevel = "LOW";
      } else if (!https || created === "Unknown") {
        status = "SUSPICIOUS";
        risk = "MEDIUM";
        trustLevel = "MEDIUM";
      }

      return {
        site: domain,
        status,
        risk,
        trustLevel,
        securityLevel: https ? "HTTPS Enabled" : "No HTTPS",
        credibilityMismatch: domain.includes("login") || domain.includes("bank") ? "Yes" : "No",
        publishedOn: created,
        explanation:
          risk === "LOW"
            ? "Valid DNS, HTTPS, and established domain"
            : risk === "MEDIUM"
            ? "Limited trust signals or new domain"
            : "Domain not found or invalid DNS",
        browserNote:
          risk === "LOW"
            ? "Safe to visit"
            : risk === "MEDIUM"
            ? "Proceed with caution"
            : "Avoid this website",
      };
    } catch {
      return {
        site: domain,
        status: "FAKE",
        risk: "HIGH",
        trustLevel: "LOW",
        securityLevel: "Unknown",
        credibilityMismatch: "Yes",
        publishedOn: "Unknown",
        explanation: "Domain analysis failed",
        browserNote: "Avoid this website",
      };
    }
  };

  /* ================= CSV EXPORT ================= */
  const exportToCSV = () => {
    if (!results.length) return;

    const activeCols = Object.keys(columns).filter((c) => columns[c]);
    const rows = [
      activeCols.join(","),
      ...results.map((r) =>
        activeCols.map((c) => `"${(r[c] ?? "").replace(/"/g, '""')}"`).join(","),
      ),
    ];

    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "website_legitimacy_report.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const checkSites = async () => {
    if (!input.trim()) return;
    setLoading(true);

    const domains = input.split("\n").map(cleanDomain).filter(Boolean);
    const analyzed = await Promise.all(domains.map(analyzeDomain));

    setResults((prev) => {
      const map = new Map(prev.map((p) => [p.site, p]));
      analyzed.forEach((r) => map.set(r.site, r));
      return Array.from(map.values());
    });

    setInput("");
    setLoading(false);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" align="center" gutterBottom>
        Website Legitimacy Checker
      </Typography>

      <TextField
        fullWidth
        multiline
        minRows={3}
        label="Enter website URLs (one per line)"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />

      <ColumnSelector columns={columns} setColumns={setColumns} />

      <Box mt={2} display="flex" justifyContent="center" gap={2}>
        <Button variant="contained" onClick={checkSites} disabled={loading}>
          {loading ? <CircularProgress size={20} /> : "Check"}
        </Button>

        <Button variant="outlined" onClick={() => setResults([])}>
          Reset
        </Button>

        <Button variant="outlined" color="success" onClick={exportToCSV} disabled={!results.length}>
          Export CSV
        </Button>
      </Box>

      {loading && <Skeleton height={80} sx={{ mt: 3 }} />}

      {!isMobile && results.length > 0 && (
        <Paper sx={{ mt: 4, p: 2 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {Object.keys(columns).map((k) => columns[k] && <TableCell key={k}>{k}</TableCell>)}
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((r) => (
                  <TableRow key={r.site}>
                    {columns.site && <TableCell>{r.site}</TableCell>}
                    {columns.status && <TableCell><StatusChip label={r.status} type="status" /></TableCell>}
                    {columns.risk && <TableCell><StatusChip label={r.risk} type="risk" /></TableCell>}
                    {columns.trustLevel && <TableCell><StatusChip label={r.trustLevel} type="trust" /></TableCell>}
                    {columns.securityLevel && <TableCell>{r.securityLevel}</TableCell>}
                    {columns.credibilityMismatch && <TableCell>{r.credibilityMismatch}</TableCell>}
                    {columns.publishedOn && <TableCell>{r.publishedOn}</TableCell>}
                    {columns.explanation && <TableCell>{r.explanation}</TableCell>}
                    {columns.browserNote && <TableCell>{r.browserNote}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Container>
  );
}
