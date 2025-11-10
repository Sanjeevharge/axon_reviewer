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

  const [axonTypeChanges, setAxonTypeChanges] = useState({});

  useEffect(() => {
    axios.get("http://localhost:5000/get-all-axon-changes").then((res) => {
      const changes = res.data.data.reduce((acc, change) => {
        acc[change.axon_id] = change.new_axon_type;
        return acc;
      }, {});
      setAxonTypeChanges(changes);
    });
  }, []);

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

    if (metadataRow) {
      setSelectedAxonType(axonTypeChanges[metadataRow.axon_id] || "");
    }
  }, [currentIndex, imagePairs, axonTypeChanges, metadataRow]);

  // ----------------------------
  // Save note + type + clean logging
  // ----------------------------
  const [notification, setNotification] = useState(null);

  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  const [showUpload, setShowUpload] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // A new save function that handles both note and type changes
  const handleSave = async () => {
    if (!imagePairs.length) return;
    setIsSaving(true);

    const pair = imagePairs[currentIndex];
    const imgNameFromFile = pair.id;

    const metadataRow = excelData.find(
      (row) => String(row.axon_id) === imgNameFromFile,
    );

    if (!metadataRow) {
      showNotification("❌ Axon ID not found in Excel for this image");
      setIsSaving(false);
      return;
    }

    // Save note to the database
    await axios.post("http://localhost:5000/saveNote", {
      image_id: imgNameFromFile,
      note: note.trim(),
    });

    // Log the change to the Excel file
    await axios.post("http://localhost:5000/log-axon-change", {
      axon_id: metadataRow.axon_id,
      image_name: metadataRow.image_name,
      oldType: metadataRow.axon_type,
      newType: selectedAxonType,
      notes: note.trim(),
    });

    setAxonTypeChanges({
      ...axonTypeChanges,
      [metadataRow.axon_id]: selectedAxonType,
    });

    showNotification("✅ Changes saved successfully!");
    setIsSaving(false);
  };

  return (
    <div className="h-screen w-screen flex flex-col font-sans bg-white text-black">
      {notification && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-3 rounded-full shadow-lg z-50 slide-up">
          {notification}
        </div>
      )}

      <header className="flex-shrink-0 border-b border-gray-200">
        <div className="container mx-auto px-4 py-2 flex items-center justify-between">
          <h1 className="text-lg font-bold">🧠 Axon Review</h1>
          <div className="flex items-center gap-3">
            {imagePairs.length > 0 && (
              <>
                <span className="text-sm font-medium">
                  {currentIndex + 1} / {imagePairs.length}
                </span>
                <button
                  onClick={prevImage}
                  className="btn btn-secondary text-xs"
                >
                  ◀ Prev
                </button>
                <button
                  onClick={nextImage}
                  className="btn btn-secondary text-xs"
                >
                  Next ▶
                </button>
              </>
            )}
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="btn btn-secondary text-xs"
            >
              {showUpload ? "Hide Upload" : "Show Upload"}
            </button>
          </div>
        </div>
      </header>

      {showUpload && (
        <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200 p-4 fade-in">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">
                Excel File
              </label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelUpload}
                className="file-input"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">
                Raw Images
              </label>
              <input
                type="file"
                webkitdirectory="true"
                multiple
                onChange={handleRawUpload}
                className="file-input"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">
                Detected Images
              </label>
              <input
                type="file"
                webkitdirectory="true"
                multiple
                onChange={handleDetectedUpload}
                className="file-input"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">
                Download Log
              </label>
              <button
                onClick={() =>
                  (window.location.href =
                    "http://localhost:5000/download-axon-changes")
                }
                className="btn btn-secondary w-full"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-grow flex overflow-hidden">
        {loading && (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-gray-500">Loading Excel data...</p>
          </div>
        )}

        {!loading && imagePairs.length === 0 && (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <p>Please upload your files to begin reviewing.</p>
          </div>
        )}

        {imagePairs.length > 0 && (
          <div className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-px bg-gray-200">
            {/* Raw Image */}
            <div className="bg-white flex flex-col p-3">
              <h2 className="text-base font-bold mb-2">Raw Image</h2>
              <div className="flex-grow relative bg-gray-100 rounded-md overflow-auto">
                <img
                  src={URL.createObjectURL(pair.raw)}
                  alt="raw"
                  style={{
                    transform: `scale(${zoomRaw})`,
                    transformOrigin: "top left",
                  }}
                  className="block"
                />
              </div>
              <div className="flex-shrink-0 pt-2 flex items-center justify-end gap-2">
                <button onClick={zoomInRaw} className="zoom-btn text-xs">
                  +
                </button>
                <button onClick={zoomOutRaw} className="zoom-btn text-xs">
                  -
                </button>
                <button onClick={resetZoomRaw} className="zoom-btn text-xs">
                  1x
                </button>
              </div>
            </div>

            {/* Detected Image */}
            <div className="bg-white flex flex-col p-3">
              <h2 className="text-base font-bold mb-2">Detected Image</h2>
              <div className="flex-grow relative bg-gray-100 rounded-md overflow-auto">
                <img
                  src={URL.createObjectURL(pair.detected)}
                  alt="detected"
                  style={{
                    transform: `scale(${zoomDetected})`,
                    transformOrigin: "top left",
                  }}
                  className="block"
                />
              </div>
              <div className="flex-shrink-0 pt-2 flex items-center justify-end gap-2">
                <button onClick={zoomInDetected} className="zoom-btn text-xs">
                  +
                </button>
                <button onClick={zoomOutDetected} className="zoom-btn text-xs">
                  -
                </button>
                <button
                  onClick={resetZoomDetected}
                  className="zoom-btn text-xs"
                >
                  1x
                </button>
              </div>
            </div>

            {/* Metadata & Notes */}
            <div className="bg-white flex flex-col p-3">
              <div className="flex-grow flex flex-col gap-3">
                <div>
                  <h2 className="text-base font-bold mb-1">Metadata</h2>
                  <div className="bg-gray-50 rounded-md p-2 text-xs space-y-1 border border-gray-200">
                    {metadataRow ? (
                      <>
                        <p>
                          <strong>Axon ID:</strong> {metadataRow.axon_id}
                        </p>
                        <p>
                          <strong>Image Name:</strong> {metadataRow.image_name}
                        </p>
                        <p>
                          <strong>Original Type:</strong>{" "}
                          {metadataRow.axon_type}
                        </p>
                        {axonTypeChanges[metadataRow.axon_id] && (
                          <p>
                            <strong>New Type:</strong>{" "}
                            {axonTypeChanges[metadataRow.axon_id]}
                          </p>
                        )}
                      </>
                    ) : (
                      <p>No metadata found.</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Select New Axon Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSelectedAxonType("mature")}
                      className={`btn text-sm w-full ${
                        selectedAxonType === "mature"
                          ? "btn-primary"
                          : "btn-secondary"
                      }`}
                    >
                      Mature
                    </button>
                    <button
                      onClick={() => setSelectedAxonType("regrowth")}
                      className={`btn text-sm w-full ${
                        selectedAxonType === "regrowth"
                          ? "btn-primary"
                          : "btn-secondary"
                      }`}
                    >
                      Regrowth
                    </button>
                  </div>
                </div>
                <div className="flex-grow flex flex-col">
                  <label className="block text-xs font-semibold mb-1">
                    Notes
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full flex-grow p-2 border border-gray-300 rounded-md resize-none text-sm"
                    placeholder="Enter notes..."
                  />
                </div>
                <button
                  onClick={handleSave}
                  className="btn btn-primary w-full"
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
