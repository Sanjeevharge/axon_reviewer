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
      const res = await axios.post(
        "http://localhost:5000/upload-excel",
        formData,
      );
      setExcelData(res.data.data);
      setLoading(false);
    } catch (err) {
      console.error("Excel upload error:", err);
      setLoading(false);
    }
  };

  // ----------------------------
  const handleRawUpload = (e) => {
    const files = Array.from(e.target.files).filter((f) =>
      f.type.startsWith("image/"),
    );
    setRawImages(files);
  };

  const handleDetectedUpload = (e) => {
    const files = Array.from(e.target.files).filter((f) =>
      f.type.startsWith("image/"),
    );
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
      (row) => String(row.axon_id) === imgNameFromFile,
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
      note: noteText,
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
      eventType,
    });

    alert("✅ Saved!");
  };

  // ----------------------------
  // Navigation + Zoom
  // ----------------------------
  const nextImage = () =>
    setCurrentIndex((p) => Math.min(p + 1, imagePairs.length - 1));
  const prevImage = () => setCurrentIndex((p) => Math.max(p - 1, 0));

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
    <div className="min-h-screen bg-gray-100 text-gray-800">
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-6 py-4">
          <h1 className="text-3xl font-bold text-indigo-600">
            🧠 Axon Review System
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">
            Upload Files
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col">
              <label className="text-sm font-medium mb-2">Excel File</label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelUpload}
                className="file-input"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-medium mb-2">
                Raw Images Folder
              </label>
              <input
                type="file"
                webkitdirectory="true"
                multiple
                onChange={handleRawUpload}
                className="file-input"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-medium mb-2">
                Detected Images Folder
              </label>
              <input
                type="file"
                webkitdirectory="true"
                multiple
                onChange={handleDetectedUpload}
                className="file-input"
              />
            </div>
          </div>
        </div>

        {loading && (
          <p className="text-center text-gray-500">Loading Excel data...</p>
        )}

        {imagePairs.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            {/* Navigation */}
            <div className="flex justify-between items-center mb-6">
              <button onClick={prevImage} className="btn btn-secondary">
                ◀ Prev
              </button>
              <span className="text-lg font-medium">
                {currentIndex + 1} / {imagePairs.length}
              </span>
              <button onClick={nextImage} className="btn btn-secondary">
                Next ▶
              </button>
            </div>

            {/* Image Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {/* Raw Image */}
              <div className="flex flex-col items-center">
                <h2 className="text-xl font-semibold text-indigo-600 mb-3">
                  Raw Image
                </h2>
                <div className="relative w-full h-[400px] bg-gray-200 rounded-lg overflow-hidden shadow-inner">
                  <img
                    src={URL.createObjectURL(pair.raw)}
                    alt="raw"
                    style={{
                      transform: `scale(${zoomRaw})`,
                      transition: "transform 0.2s",
                    }}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-2 right-2 flex flex-col gap-1">
                    <button onClick={zoomInRaw} className="zoom-btn">
                      +
                    </button>
                    <button onClick={zoomOutRaw} className="zoom-btn">
                      -
                    </button>
                    <button onClick={resetZoomRaw} className="zoom-btn">
                      1x
                    </button>
                  </div>
                </div>
              </div>

              {/* Detected Image */}
              <div className="flex flex-col items-center">
                <h2 className="text-xl font-semibold text-indigo-600 mb-3">
                  Detected Image
                </h2>
                <div className="relative w-full h-[400px] bg-gray-200 rounded-lg overflow-hidden shadow-inner">
                  <img
                    src={URL.createObjectURL(pair.detected)}
                    alt="detected"
                    style={{
                      transform: `scale(${zoomDetected})`,
                      transition: "transform 0.2s",
                    }}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-2 right-2 flex flex-col gap-1">
                    <button onClick={zoomInDetected} className="zoom-btn">
                      +
                    </button>
                    <button onClick={zoomOutDetected} className="zoom-btn">
                      -
                    </button>
                    <button onClick={resetZoomDetected} className="zoom-btn">
                      1x
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Metadata & Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-gray-50 rounded-lg p-6 shadow-inner">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">
                  📋 Excel Metadata
                </h2>
                {metadataRow ? (
                  <div className="space-y-2">
                    <p>
                      <strong>Axon ID:</strong> {metadataRow.axon_id}
                    </p>
                    <p>
                      <strong>Image Name:</strong> {metadataRow.image_name}
                    </p>
                    <p>
                      <strong>Axon Type:</strong>{" "}
                      <span className="font-semibold text-indigo-600">
                        {metadataRow.axon_type}
                      </span>
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-500">
                    No metadata found for this image.
                  </p>
                )}
                <div className="mt-6">
                  <label className="block text-sm font-medium mb-2">
                    Select New Axon Type
                  </label>
                  <select
                    value={selectedAxonType}
                    onChange={(e) => setSelectedAxonType(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">-- Choose a type --</option>
                    <option value="mature">Mature</option>
                    <option value="regrowth">Regrowth</option>
                  </select>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6 shadow-inner">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">
                  📝 Notes
                </h2>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md h-32 resize-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter your notes here..."
                />
                <button
                  onClick={saveNote}
                  className="btn btn-primary w-full mt-4"
                >
                  💾 Save Note & Type
                </button>
              </div>
            </div>

            {/* Download Button */}
            {currentIndex === imagePairs.length - 1 && (
              <div className="text-center mt-8">
                <button
                  onClick={() =>
                    (window.location.href =
                      "http://localhost:5000/download-axon-changes")
                  }
                  className="btn btn-success"
                >
                  📥 Download Axon Change Log
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="bg-white shadow-inner mt-8">
        <div className="container mx-auto px-6 py-4 text-center text-gray-500">
          <p>&copy; 2025 Axon Review System. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
