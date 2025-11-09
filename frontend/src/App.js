import React, { useState, useEffect } from "react";
import axios from "axios";

export default function App() {
  const [excelData, setExcelData] = useState([]);
  const [rawImages, setRawImages] = useState([]);
  const [detectedImages, setDetectedImages] = useState([]);
  const [imagePairs, setImagePairs] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [zoomRaw, setZoomRaw] = useState(1);
  const [zoomDetected, setZoomDetected] = useState(1);

  const [selectedAxonType, setSelectedAxonType] = useState("");

  // ----------------------------
  // Upload Excel file
  // ----------------------------
  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("excel", file);

    try {
      setLoading(true);
      const res = await axios.post("http://localhost:5000/upload-excel", formData);
      setExcelData(res.data.data);
      setLoading(false);
    } catch (err) {
      console.error("Excel upload error:", err);
      setLoading(false);
    }
  };

  // ----------------------------
  const handleRawUpload = (e) => {
    const files = Array.from(e.target.files).filter((f) => f.type.startsWith("image/"));
    setRawImages(files);
  };

  const handleDetectedUpload = (e) => {
    const files = Array.from(e.target.files).filter((f) => f.type.startsWith("image/"));
    setDetectedImages(files);
  };

  // ----------------------------
  // Pair raw + detected images
  // ----------------------------
  useEffect(() => {
    if (!rawImages.length || !detectedImages.length) return;

    const pairs = rawImages
      .map((raw) => {
        const id = raw.name.split(".")[0];
        const detected = detectedImages.find((img) => img.name.startsWith(id));
        return detected ? { id, raw, detected } : null;
      })
      .filter(Boolean);

    setImagePairs(pairs);
    setCurrentIndex(0);
  }, [rawImages, detectedImages]);

  // ----------------------------
  // Load note for current pair
  // ----------------------------
  useEffect(() => {
    if (!imagePairs.length) return;

    const imgName = imagePairs[currentIndex].id;

    axios
      .get(`http://localhost:5000/get-note/${imgName}`)
      .then((res) => setNote(res.data.note))
      .catch(() => setNote(""));
  }, [currentIndex, imagePairs]);

  // ----------------------------
  // Save note + type + clean logging
  // ----------------------------
  const saveNote = async () => {
    if (!imagePairs.length) return;

    const pair = imagePairs[currentIndex];
    const imgNameFromFile = pair.id;

    // Find Excel metadata row
    const metadataRow = excelData.find(
      (row) => String(row.axon_id) === imgNameFromFile
    );

    if (!metadataRow) {
      alert("❌ axon_id not found in Excel for this image");
      return;
    }

    const axon_id = metadataRow.axon_id;
    const image_name = metadataRow.image_name;
    const oldType = metadataRow.axon_type;
    const newType = selectedAxonType || "";

    const noteText = note.trim();

    // Determine event
    let eventType = "";
    if (noteText && newType) eventType = "Type + Note Update";
    else if (noteText) eventType = "Note Update";
    else if (newType) eventType = "Type Update";
    else eventType = "Empty";

    // Always save note in DB
    await axios.post("http://localhost:5000/saveNote", {
      image_id: imgNameFromFile,
      note: noteText
    });

    // Logging rules:
    let logNote = noteText;
    let logNewType = newType;

    if (noteText && !newType) {
      logNewType = "";
    }
    if (newType && !noteText) {
      logNote = "";
    }

    await axios.post("http://localhost:5000/log-axon-change", {
      axon_id,
      image_name,
      oldType,
      newType: logNewType,
      notes: logNote,
      eventType
    });

    alert("✅ Saved!");
  };

  // ----------------------------
  // Navigation + Zoom
  // ----------------------------
  const nextImage = () =>
    setCurrentIndex((p) => Math.min(p + 1, imagePairs.length - 1));
  const prevImage = () =>
    setCurrentIndex((p) => Math.max(p - 1, 0));

  const pair = imagePairs[currentIndex];
  const metadataRow =
    excelData.find((row) => String(row.axon_id) === pair?.id) || null;

  // Zoom handlers
  const zoomInRaw = () => setZoomRaw((z) => Math.min(z + 0.2, 3));
  const zoomOutRaw = () => setZoomRaw((z) => Math.max(z - 0.2, 0.5));
  const resetZoomRaw = () => setZoomRaw(1);

  const zoomInDetected = () => setZoomDetected((z) => Math.min(z + 0.2, 3));
  const zoomOutDetected = () => setZoomDetected((z) => Math.max(z - 0.2, 0.5));
  const resetZoomDetected = () => setZoomDetected(1);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold text-center text-indigo-700 mb-10">
        🧠 Axon Review System
      </h1>

      {/* Upload Section */}
      <div className="flex flex-col md:flex-row gap-4 justify-center mb-10 bg-white shadow-md rounded-xl p-6">
        
        <div className="flex flex-col items-center w-full">
          <label className="text-sm font-medium">Excel File</label>
          <input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} className="border p-2 rounded w-full" />
        </div>

        <div className="flex flex-col items-center w-full">
          <label className="text-sm font-medium">Raw Images Folder</label>
          <input type="file" webkitdirectory="true" multiple onChange={handleRawUpload} className="border p-2 rounded w-full" />
        </div>

        <div className="flex flex-col items-center w-full">
          <label className="text-sm font-medium">Detected Images Folder</label>
          <input type="file" webkitdirectory="true" multiple onChange={handleDetectedUpload} className="border p-2 rounded w-full" />
        </div>

      </div>

      {loading && <p className="text-center text-gray-500">Loading Excel...</p>}

      {imagePairs.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">

          {/* Navigation */}
          <div className="flex justify-between items-center mb-6">
            <button onClick={prevImage} className="bg-gray-200 px-4 py-2 rounded">◀ Prev</button>
            <span>{currentIndex + 1} / {imagePairs.length}</span>
            <button onClick={nextImage} className="bg-gray-200 px-4 py-2 rounded">Next ▶</button>
          </div>

          {/* Raw + Detected Images */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

            {/* Raw */}
            <div className="flex flex-col items-center">
              <h2 className="text-lg font-semibold text-indigo-700 mb-2">Raw Image</h2>
              <div className="relative bg-gray-100 p-2 rounded border shadow-sm w-[400px] h-[400px] overflow-hidden flex items-center justify-center">
                <img
                  src={URL.createObjectURL(pair.raw)}
                  alt="raw"
                  style={{ transform: `scale(${zoomRaw})`, transition: "0.2s", transformOrigin: "center" }}
                  className="max-w-full max-h-full object-contain"
                />
                <div className="absolute bottom-2 right-2 bg-white rounded shadow flex flex-col">
                  <button onClick={zoomInRaw}>+</button>
                  <button onClick={resetZoomRaw}>100%</button>
                  <button onClick={zoomOutRaw}>-</button>
                </div>
              </div>
            </div>

            {/* Detected */}
            <div className="flex flex-col items-center">
              <h2 className="text-lg font-semibold text-indigo-700 mb-2">Detected Image</h2>
              <div className="relative bg-gray-100 p-2 rounded border shadow-sm w-[400px] h-[400px] overflow-hidden flex items-center justify-center">
                <img
                  src={URL.createObjectURL(pair.detected)}
                  alt="detected"
                  style={{ transform: `scale(${zoomDetected})`, transition: "0.2s", transformOrigin: "center" }}
                  className="max-w-full max-h-full object-contain"
                />
                <div className="absolute bottom-2 right-2 bg-white rounded shadow flex flex-col">
                  <button onClick={zoomInDetected}>+</button>
                  <button onClick={resetZoomDetected}>100%</button>
                  <button onClick={zoomOutDetected}>-</button>
                </div>
              </div>
            </div>

          </div>

          {/* Metadata + Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Metadata */}
            <div className="bg-gray-50 border rounded-xl p-4">
              <h2 className="text-lg font-semibold text-indigo-700 mb-3">📋 Excel Metadata</h2>

              {metadataRow ? (
                <div className="border bg-white p-3 rounded">
                  <p><strong>axon_id:</strong> {metadataRow.axon_id}</p>
                  <p><strong>image_name:</strong> {metadataRow.image_name}</p>
                  <p><strong>axon_type:</strong> {metadataRow.axon_type}</p>
                </div>
              ) : (
                <p className="text-gray-500">No metadata found.</p>
              )}

              {/* Type dropdown */}
              <div className="mt-4">
                <label className="text-sm">Select New Axon Type</label>
                <select
                  value={selectedAxonType}
                  onChange={(e) => setSelectedAxonType(e.target.value)}
                  className="border w-full p-2 rounded mt-1"
                >
                  <option value="">-- choose --</option>
                  <option value="mature">mature</option>
                  <option value="regrowth">regrowth</option>
                </select>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-gray-50 border rounded-xl p-4">
              <h2 className="text-lg font-semibold text-indigo-700 mb-3">📝 Notes</h2>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="border w-full p-2 rounded h-28"
              />
              <button onClick={saveNote} className="w-full mt-3 bg-indigo-600 text-white py-2 rounded">
                💾 Save Note
              </button>
            </div>

            {/* Download at end */}
            {currentIndex === imagePairs.length - 1 && (
              <div className="text-center mt-6">
                <button
                  onClick={() => window.location.href = "http://localhost:5000/download-axon-changes"}
                  className="bg-green-600 text-white py-3 px-6 rounded"
                >
                  📥 Download Axon Change Log
                </button>
              </div>
            )}

          </div>

        </div>
      )}
    </div>
  );
}
