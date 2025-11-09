const express = require("express");
const cors = require("cors");
const multer = require("multer");
const xlsx = require("xlsx");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

// --------------------------
// 1. Setup upload folders
// --------------------------
const upload = multer({ dest: "uploads/" });
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("notes")) fs.mkdirSync("notes");

// --------------------------
// 2. Database setup (SQLite)
// --------------------------
const db = new sqlite3.Database("notes/axon_notes.db");
db.run(`
  CREATE TABLE IF NOT EXISTS notes (
    image_id TEXT PRIMARY KEY,
    note TEXT
  )
`);

// --------------------------
// 3. Upload Excel
// --------------------------
app.post("/upload-excel", upload.single("excel"), (req, res) => {
  const filePath = req.file.path;
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);
  res.json({ data });
});

// --------------------------
// 4. Notes (SQLite)
// --------------------------
app.post("/saveNote", (req, res) => {
  const { image_id, note } = req.body;

  db.run(
    `INSERT INTO notes (image_id, note) VALUES (?, ?)
     ON CONFLICT(image_id) DO UPDATE SET note=excluded.note`,
    [image_id, note],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    },
  );
});

app.get("/get-note/:id", (req, res) => {
  db.get(
    `SELECT note FROM notes WHERE image_id = ?`,
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ note: row ? row.note : "" });
    },
  );
});

// --------------------------
// 5. Log ALL changes cleanly
// --------------------------
app.post("/log-axon-change", (req, res) => {
  const { axon_id, image_name, oldType, newType, notes } = req.body;

  const logFile = "axon_changes.xlsx";
  const logRow = [
    {
      image_name: image_name,
      axon_id: axon_id,
      old_axon_type: oldType || "",
      new_axon_type: newType || "",
      notes: notes || "",
    },
  ];

  let workbook, worksheet;

  if (fs.existsSync(logFile)) {
    workbook = xlsx.readFile(logFile);
    worksheet = workbook.Sheets[workbook.SheetNames[0]];
    xlsx.utils.sheet_add_json(worksheet, logRow, {
      skipHeader: true,
      origin: -1,
    });
  } else {
    workbook = xlsx.utils.book_new();
    worksheet = xlsx.utils.json_to_sheet(logRow);
    xlsx.utils.book_append_sheet(workbook, worksheet, "Axon Changes");
  }

  xlsx.writeFile(workbook, logFile);
  res.json({ success: true });
});

app.get("/download-axon-changes", (req, res) => {
  const filePath = path.join(__dirname, "axon_changes.xlsx");

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("No changes logged yet.");
  }

  res.download(filePath, "axon_changes.xlsx");
});

app.get("/get-axon-type/:id", (req, res) => {
  const logFile = "axon_changes.xlsx";
  if (!fs.existsSync(logFile)) {
    return res.json({ type: "" });
  }

  const workbook = xlsx.readFile(logFile);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(worksheet);

  const axonEntries = data.filter(
    (row) => String(row.axon_id) === req.params.id,
  );

  if (axonEntries.length > 0) {
    const lastEntry = axonEntries[axonEntries.length - 1];
    res.json({ type: lastEntry["new axon type"] || "" });
  } else {
    res.json({ type: "" });
  }
});

// -------------------------
app.listen(5000, () =>
  console.log("✅ Backend running on http://localhost:5000"),
);
