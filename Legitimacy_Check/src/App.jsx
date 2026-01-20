// App.jsx
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
  Card,
  CardContent,
  Divider,
  useMediaQuery,
  Chip,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useTheme } from "@mui/material/styles";

/* ---------- Color Helpers ---------- */
const getColor = (value, type) => {
  if (!value) return "default";
  const v = value.toUpperCase();

  if (type === "status") {
    if (v === "REAL") return "success";
    if (v === "SUSPICIOUS") return "warning";
    if (v === "FAKE") return "error";
  }

  if (type === "risk") {
    if (v === "LOW") return "success";
    if (v === "MEDIUM") return "warning";
    if (v === "HIGH") return "error";
  }

  if (type === "trust") {
    if (v === "HIGH") return "success";
    if (v === "MEDIUM") return "warning";
    if (v === "LOW") return "error";
  }

  return "default";
};

const StatusChip = ({ label, type }) => (
  <Chip
    label={label}
    color={getColor(label, type)}
    size="small"
    sx={{ fontWeight: 600 }}
  />
);

/* ---------- Column Selector ---------- */
function ColumnSelector({ columns, setColumns }) {
  const [anchorEl, setAnchorEl] = useState(null);

  return (
    <Box mt={2}>
      <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
        <MenuIcon />
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {Object.keys(columns).map((key) => (
          <MenuItem key={key}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={columns[key]}
                  onChange={(e) =>
                    setColumns((prev) => ({ ...prev, [key]: e.target.checked }))
                  }
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

/* ---------- MAIN APP ---------- */
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
    securityLevel: false,
    credibilityMismatch: false,
    publishedOn: true,
    explanation: true,
    browserNote: false,
  });

  const [selected, setSelected] = useState([]);
  const [menuAnchor, setMenuAnchor] = useState(null);

  /* ---------- Selection ---------- */
  const isSelected = (site) => selected.includes(site);

  const handleSelectAll = (e) => {
    setSelected(e.target.checked ? results.map((r) => r.site) : []);
  };

  const handleSelectOne = (site) => {
    setSelected((prev) =>
      prev.includes(site) ? prev.filter((s) => s !== site) : [...prev, site],
    );
  };

  /* ---------- Bulk Actions ---------- */
  const deleteSelected = () => {
    setResults((prev) => prev.filter((r) => !selected.includes(r.site)));
    setSelected([]);
    setMenuAnchor(null);
  };

  const clearSelection = () => {
    setSelected([]);
    setMenuAnchor(null);
  };

  /* ---------- API Call ---------- */
  const checkSites = async () => {
    if (!input.trim()) return;

    setLoading(true);
    const urls = input
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);

    const responses = await Promise.all(
      urls.map((url) =>
        fetch("http://localhost:5000/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls: [url] }),
        }).then((r) => r.json()),
      ),
    );

    setResults((prev) => {
      const newData = responses.map((r) => r[0]);
      const map = new Map(prev.map((p) => [p.site, p]));
      newData.forEach((n) => map.set(n.site, n));
      return Array.from(map.values());
    });

    setInput("");
    setSelected([]);
    setLoading(false);
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
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
      </Box>

      {loading && <Skeleton height={80} sx={{ mt: 3 }} />}

      {/* ================= MOBILE BULK ACTION BAR ================= */}
      {isMobile && selected.length > 0 && (
        <Paper
          elevation={3}
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            p: 1.5,
            mb: 2,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography fontWeight={600}>{selected.length} selected</Typography>

          <Box display="flex" gap={1}>
            <Button
              size="small"
              color="error"
              variant="contained"
              onClick={deleteSelected}
            >
              Delete
            </Button>

            <Button size="small" variant="outlined" onClick={clearSelection}>
              Clear
            </Button>
          </Box>
        </Paper>
      )}

      {/* ================= MOBILE VIEW ================= */}
      {isMobile && results.length > 0 && (
        <Box mt={3}>
          {results.map((r) => (
            <Card key={r.site} sx={{ mb: 2 }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between">
                  <Typography fontWeight={600}>{r.site}</Typography>
                  <Checkbox
                    checked={isSelected(r.site)}
                    onChange={() => handleSelectOne(r.site)}
                  />
                </Box>

                <Divider sx={{ my: 1 }} />

                {Object.keys(columns).map(
                  (k) =>
                    columns[k] && (
                      <Box
                        key={k}
                        sx={{
                          mb: 0.5,
                          display: "flex",
                          gap: 1,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {k}:
                        </Typography>

                        {k === "status" && (
                          <StatusChip label={r.status} type="status" />
                        )}
                        {k === "risk" && (
                          <StatusChip label={r.risk} type="risk" />
                        )}
                        {k === "trustLevel" && (
                          <StatusChip label={r.trustLevel} type="trust" />
                        )}

                        {!["status", "risk", "trustLevel"].includes(k) && (
                          <Typography variant="body2">{r[k]}</Typography>
                        )}
                      </Box>
                    ),
                )}
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* ================= DESKTOP VIEW ================= */}
      {!isMobile && results.length > 0 && (
        <Box mt={4}>
          <Paper sx={{ p: 2 }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Box display="flex" alignItems="center">
                        <Checkbox
                          indeterminate={
                            selected.length > 0 &&
                            selected.length < results.length
                          }
                          checked={
                            results.length > 0 &&
                            selected.length === results.length
                          }
                          onChange={handleSelectAll}
                        />
                        <IconButton
                          size="small"
                          onClick={(e) => setMenuAnchor(e.currentTarget)}
                        >
                          <MoreVertIcon />
                        </IconButton>
                        <Menu
                          anchorEl={menuAnchor}
                          open={Boolean(menuAnchor)}
                          onClose={() => setMenuAnchor(null)}
                        >
                          <MenuItem
                            disabled={!selected.length}
                            onClick={deleteSelected}
                          >
                            Delete Selected
                          </MenuItem>
                          <MenuItem
                            disabled={!selected.length}
                            onClick={clearSelection}
                          >
                            Clear Selection
                          </MenuItem>
                        </Menu>
                      </Box>
                    </TableCell>

                    {Object.keys(columns).map(
                      (k) => columns[k] && <TableCell key={k}>{k}</TableCell>,
                    )}
                  </TableRow>
                </TableHead>

                <TableBody>
                  {results.map((r) => (
                    <TableRow key={r.site} selected={isSelected(r.site)}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={isSelected(r.site)}
                          onChange={() => handleSelectOne(r.site)}
                        />
                      </TableCell>

                      {columns.site && <TableCell>{r.site}</TableCell>}

                      {columns.status && (
                        <TableCell>
                          <StatusChip label={r.status} type="status" />
                        </TableCell>
                      )}
                      {columns.risk && (
                        <TableCell>
                          <StatusChip label={r.risk} type="risk" />
                        </TableCell>
                      )}
                      {columns.trustLevel && (
                        <TableCell>
                          <StatusChip label={r.trustLevel} type="trust" />
                        </TableCell>
                      )}
                      {columns.securityLevel && (
                        <TableCell>{r.securityLevel}</TableCell>
                      )}
                      {columns.credibilityMismatch && (
                        <TableCell>{r.credibilityMismatch}</TableCell>
                      )}
                      {columns.publishedOn && (
                        <TableCell>{r.publishedOn}</TableCell>
                      )}
                      {columns.explanation && (
                        <TableCell>{r.explanation}</TableCell>
                      )}
                      {columns.browserNote && (
                        <TableCell>{r.browserNote}</TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}
    </Container>
  );
}
