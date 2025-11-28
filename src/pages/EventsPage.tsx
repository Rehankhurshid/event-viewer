import { useEffect, useState, useMemo, useCallback } from "react"
import { Link } from "react-router-dom"
import { fetchEvents, fetchCategories, updateEventImage, updateEventSwitch, uploadToImgBB, compressImage, type EventItem } from "../lib/api"
import { ImageWithRatio } from "../components/ImageWithRatio"

export function EventsPage() {
    console.log("EventsPage rendering...");

    const [events, setEvents] = useState<EventItem[]>([])
    const [categories, setCategories] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Edit State
    const [editingItem, setEditingItem] = useState<EventItem | null>(null)
    const [newUrl, setNewUrl] = useState("")
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false)

    // Sorting & Data State
    const [sortOption, setSortOption] = useState<"date" | "ratio" | "size">("date");
    const [viewMode, setViewMode] = useState<"grid" | "grouped">("grid");
    const [ratios, setRatios] = useState<Record<string, { ratio: number; width: number; height: number }>>({});
    const [hideCorrectRatios, setHideCorrectRatios] = useState(false);

    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);

    // Staging State
    const [showStaging, setShowStaging] = useState(false);
    const [stagingImages, setStagingImages] = useState<{ name: string, url: string }[]>([]);
    const [publicUrl, setPublicUrl] = useState("");

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch categories first
            const categoryItems = await fetchCategories();
            const categoryMap: Record<string, string> = {};
            categoryItems.forEach(item => {
                categoryMap[item.id] = item.fieldData.name;
            });
            setCategories(categoryMap);

            // Fetch events
            const data = await fetchEvents();
            setEvents(data);

            // Fetch ratios
            try {
                const response = await fetch("/ratios.json");
                if (response.ok) {
                    const ratioData = await response.json();
                    setRatios(ratioData);

                    // Default sort by ratio deviation if data exists
                    setSortOption("ratio");
                }
            } catch (e) {
                console.error("Failed to fetch ratios:", e);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        const fetchStaging = async () => {
            try {
                const res = await fetch("/images/list.json");
                if (res.ok) {
                    const files = await res.json();
                    setStagingImages(files);
                }
            } catch (e) {
                console.error("Failed to fetch staging images", e);
            }
        };
        fetchStaging();
    }, []);

    const sortedEvents = useMemo(() => {
        let filtered = [...events];

        // Filter out correct ratios if enabled
        if (hideCorrectRatios) {
            filtered = filtered.filter(e => {
                const r = ratios[e.id]?.ratio;
                // Keep if no ratio data OR if ratio is bad (diff > 0.05)
                return !r || Math.abs(r - 2) > 0.05;
            });
        }

        return filtered.sort((a, b) => {
            if (sortOption === "date") {
                return (
                    new Date(b.createdOn || b.lastUpdated || 0).getTime() -
                    new Date(a.createdOn || a.lastUpdated || 0).getTime()
                );
            }

            if (sortOption === "size") {
                const ratioA = ratios[a.id];
                const ratioB = ratios[b.id];

                // Sort by total pixels (width * height), descending
                const sizeA = ratioA ? (ratioA.width * ratioA.height) : 0;
                const sizeB = ratioB ? (ratioB.width * ratioB.height) : 0;

                return sizeB - sizeA;
            }

            // Sort by ratio deviation (default)
            const ratioA = ratios[a.id]?.ratio || 0;
            const ratioB = ratios[b.id]?.ratio || 0;

            // If no ratio data, push to bottom
            if (!ratioA) return 1;
            if (!ratioB) return -1;

            const diffA = Math.abs(ratioA - 2);
            const diffB = Math.abs(ratioB - 2);

            return diffB - diffA;
        });
    }, [events, ratios, sortOption, hideCorrectRatios]);

    const groupedEvents = useMemo(() => {
        if (viewMode !== "grouped") return {};

        const groups: Record<string, EventItem[]> = {};

        sortedEvents.forEach(event => {
            const r = ratios[event.id]?.ratio;
            const key = r ? r.toFixed(2) : "No Data";
            if (!groups[key]) groups[key] = [];
            groups[key].push(event);
        });

        return groups;
    }, [sortedEvents, ratios, viewMode]);

    const sortedGroupKeys = useMemo(() => {
        return Object.keys(groupedEvents).sort((a, b) => {
            if (a === "No Data") return 1;
            if (b === "No Data") return -1;
            const diffA = Math.abs(parseFloat(a) - 2);
            const diffB = Math.abs(parseFloat(b) - 2);
            return diffB - diffA;
        });
    }, [groupedEvents]);

    const handleEditClick = (event: EventItem) => {
        console.log("Edit clicked for:", event.id);
        setEditingItem(event);
        setNewUrl(event.fieldData["header-image"]?.url || "");
        setSelectedFile(null);
    };

    const handleBulkUpdateClick = () => {
        if (selectedIds.size === 0) return;
        // Use the first selected item as a "template" for the modal
        const firstId = Array.from(selectedIds)[0];
        const firstEvent = events.find(e => e.id === firstId);
        if (firstEvent) {
            setEditingItem(firstEvent); // Just to open the modal
            setNewUrl(""); // Clear URL for bulk update to avoid confusion
            setSelectedFile(null);
        }
    };

    const handleSave = async () => {
        if (!editingItem && selectedIds.size === 0) return;

        setIsSaving(true);
        try {
            let finalUrl = newUrl;

            // 1. Upload file if selected
            if (selectedFile) {
                // Compress/Convert to WebP first
                const compressedBlob = await compressImage(selectedFile);
                const uploadedUrl = await uploadToImgBB(compressedBlob);
                finalUrl = uploadedUrl;
            }

            if (!finalUrl) {
                alert("Please provide a URL or select a file.");
                setIsSaving(false);
                return;
            }

            // 2. Determine if this is a bulk update or single update
            const isBulkUpdate = isSelectionMode && selectedIds.size > 0;

            if (isBulkUpdate) {
                // Bulk Update
                const idsToUpdate = Array.from(selectedIds);
                console.log(`Bulk updating ${idsToUpdate.length} items with URL: ${finalUrl}`);

                await Promise.all(idsToUpdate.map(id => updateEventImage(id, finalUrl)));

                setSelectedIds(new Set());
                setIsSelectionMode(false);
                alert(`Successfully updated ${idsToUpdate.length} items!`);

            } else if (editingItem) {
                // Single update
                await updateEventImage(editingItem.id, finalUrl);
            }

            setEditingItem(null);
            setSelectedFile(null);
            setNewUrl("");
            loadData(); // Refresh data
        } catch (err) {
            console.error(err);
            alert("Failed to update image(s)");
        } finally {
            setIsSaving(false);
        }
    };

    const toggleSelection = (id: string) => {
        console.log("Toggling selection for:", id);
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleCardClick = (e: React.MouseEvent, id: string) => {
        if (isSelectionMode) {
            e.preventDefault();
            e.stopPropagation();
            toggleSelection(id);
        }
    };

    const handleToggleNoCanva = async (id: string, currentValue: boolean) => {
        // Optimistic update
        setEvents(prev => prev.map(e => e.id === id ? { ...e, fieldData: { ...e.fieldData, "no-canva-image": !currentValue } } : e));

        try {
            await updateEventSwitch(id, "no-canva-image", !currentValue);
        } catch (error: any) {
            console.error("Failed to update switch", error);
            // Revert on failure
            setEvents(prev => prev.map(e => e.id === id ? { ...e, fieldData: { ...e.fieldData, "no-canva-image": currentValue } } : e));
            alert(`Failed to update status: ${error.message}`);
        }
    };

    const copyStagingLink = (relativePath: string) => {
        if (!publicUrl) {
            alert("Please enter a Public Server URL first (e.g. from ngrok)")
            return
        }
        const base = publicUrl.replace(/\/$/, "")
        const fullUrl = `${base}${relativePath}`
        navigator.clipboard.writeText(fullUrl)
        alert("Copied to clipboard: " + fullUrl)
    }

    // Count issues
    const issueCount = events.filter((e) => {
        const r = ratios[e.id]?.ratio;
        return r && Math.abs(r - 2) > 0.05;
    }).length;

    // Handle paste event
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (!editingItem) return;

            const items = e.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf("image") !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        setSelectedFile(file);
                        // Create preview
                        const url = URL.createObjectURL(file);
                        setPreviewUrl(url);
                    }
                    break;
                }
            }
        };

        window.addEventListener("paste", handlePaste);
        return () => window.removeEventListener("paste", handlePaste);
    }, [editingItem]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-bold text-gray-800">News & Insights</h1>
                        <div className="flex gap-2 text-sm">
                            <span className="px-2 py-1 bg-gray-100 rounded-md text-gray-600">
                                {sortedEvents.length} / {events.length} Items
                            </span>
                            {issueCount > 0 && (
                                <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-md font-medium">
                                    {issueCount} Issues
                                </span>
                            )}
                            {isSelectionMode && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md font-medium">
                                    {selectedIds.size} Selected
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link to="/matches" className="px-3 py-1.5 text-sm font-medium rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors">
                            View Matches
                        </Link>
                        <div className="flex items-center bg-gray-100 rounded-lg p-1">
                            <button
                                onClick={() => setSortOption("date")}
                                className={`px-3 py-1.5 text-sm rounded-md transition-all ${sortOption === "date"
                                    ? "bg-white text-gray-900 shadow-sm"
                                    : "text-gray-500 hover:text-gray-700"
                                    }`}
                            >
                                Date
                            </button>
                            <button
                                onClick={() => setSortOption("ratio")}
                                className={`px-3 py-1.5 text-sm rounded-md transition-all ${sortOption === "ratio"
                                    ? "bg-white text-gray-900 shadow-sm"
                                    : "text-gray-500 hover:text-gray-700"
                                    }`}
                            >
                                Ratio Issue
                            </button>
                            <button
                                onClick={() => setSortOption("size")}
                                className={`px-3 py-1.5 text-sm rounded-md transition-all ${sortOption === "size"
                                    ? "bg-white text-gray-900 shadow-sm"
                                    : "text-gray-500 hover:text-gray-700"
                                    }`}
                            >
                                Image Size
                            </button>
                        </div>

                        <div className="h-6 w-px bg-gray-300 mx-1" />

                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={hideCorrectRatios}
                                onChange={(e) => setHideCorrectRatios(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                            />
                            Hide Correct Ratios
                        </label>

                        <div className="h-6 w-px bg-gray-300 mx-1" />

                        <div className="flex items-center bg-gray-100 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode("grid")}
                                className={`px-3 py-1.5 text-sm rounded-md transition-all ${viewMode === "grid"
                                    ? "bg-white text-gray-900 shadow-sm"
                                    : "text-gray-500 hover:text-gray-700"
                                    }`}
                            >
                                Grid
                            </button>
                            <button
                                onClick={() => setViewMode("grouped")}
                                className={`px-3 py-1.5 text-sm rounded-md transition-all ${viewMode === "grouped"
                                    ? "bg-white text-gray-900 shadow-sm"
                                    : "text-gray-500 hover:text-gray-700"
                                    }`}
                            >
                                Group by Ratio
                            </button>
                        </div>

                        <div className="h-6 w-px bg-gray-300 mx-1" />

                        <button
                            onClick={() => {
                                setIsSelectionMode(!isSelectionMode);
                                setSelectedIds(new Set()); // Clear selection when toggling
                            }}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${isSelectionMode
                                ? "bg-blue-50 border-blue-200 text-blue-700"
                                : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                                }`}
                        >
                            {isSelectionMode ? "Cancel Selection" : "Select Multiple"}
                        </button>

                        <button
                            onClick={() => setShowStaging(!showStaging)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${showStaging
                                ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                                : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                                }`}
                        >
                            {showStaging ? "Hide Staging" : "Show Staging"}
                        </button>

                        <button
                            onClick={loadData}
                            disabled={loading}
                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                            title="Refresh Data"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? "animate-spin" : ""}>
                                <path d="M23 4v6h-6"></path>
                                <path d="M1 20v-6h6"></path>
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-8">
                {loading && events.length === 0 ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-lg font-medium text-gray-500">Loading events...</div>
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center py-20 text-red-500">
                        Error: {error}
                    </div>
                ) : (
                    <>
                        {showStaging && (
                            <div className="mb-8 p-6 bg-indigo-50 rounded-xl border border-indigo-100">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-lg font-semibold text-indigo-900 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                                            <line x1="8" y1="21" x2="16" y2="21"></line>
                                            <line x1="12" y1="17" x2="12" y2="21"></line>
                                        </svg>
                                        Staging Gallery
                                    </h2>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Public Server URL (e.g. https://...ngrok-free.app)"
                                            className="px-3 py-1 text-sm border rounded w-64"
                                            value={publicUrl}
                                            onChange={(e) => setPublicUrl(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                    {stagingImages.length === 0 ? (
                                        <div className="col-span-full text-center py-10 text-gray-500">
                                            No images found in <code>public/images</code>. <br />
                                            Add images and run <code>python3 scan_staging.py</code>
                                        </div>
                                    ) : (
                                        stagingImages.map((img) => (
                                            <div key={img.name} className="border rounded-lg overflow-hidden shadow-sm group relative">
                                                <div className="aspect-[2/1] bg-gray-100 relative">
                                                    <img src={img.url} alt={img.name} className="w-full h-full object-contain" />
                                                </div>
                                                <div className="p-2 text-xs truncate font-mono bg-gray-50 border-t">
                                                    {img.name}
                                                </div>
                                                <button
                                                    onClick={() => copyStagingLink(img.url)}
                                                    className="absolute top-2 right-2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                                                >
                                                    Copy Link
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {viewMode === "grouped" ? (
                            <div className="flex gap-8">
                                {/* Sidebar */}
                                <div className="w-48 flex-shrink-0 sticky top-24 h-[calc(100vh-8rem)] overflow-y-auto pr-2">
                                    <h3 className="font-semibold text-gray-500 text-xs uppercase tracking-wider mb-4">Ratios</h3>
                                    <div className="space-y-1">
                                        {sortedGroupKeys.map(key => (
                                            <a
                                                key={key}
                                                href={`#group-${key}`}
                                                className="flex items-center justify-between px-3 py-2 text-sm rounded-md hover:bg-gray-100 text-gray-700 transition-colors group"
                                            >
                                                <span className="font-medium">{key}</span>
                                                <span className="bg-gray-100 text-gray-500 py-0.5 px-2 rounded-full text-xs group-hover:bg-white transition-colors">
                                                    {groupedEvents[key].length}
                                                </span>
                                            </a>
                                        ))}
                                    </div>
                                </div>

                                {/* Grouped Content */}
                                <div className="flex-1 space-y-12">
                                    {sortedGroupKeys.map(key => (
                                        <div key={key} id={`group-${key}`} className="scroll-mt-24">
                                            <div className="flex items-baseline gap-3 mb-6 border-b pb-2">
                                                <h2 className="text-2xl font-bold text-gray-900">Ratio: {key}</h2>
                                                <span className="text-gray-500 text-sm font-medium">
                                                    {groupedEvents[key].length} items
                                                </span>
                                                {key === "2.00" && (
                                                    <span className="ml-auto text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                                                        Target Ratio
                                                    </span>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                                {groupedEvents[key].map(event => (
                                                    <EventCard
                                                        key={event.id}
                                                        event={event}
                                                        isSelectionMode={isSelectionMode}
                                                        selectedIds={selectedIds}
                                                        handleCardClick={handleCardClick}
                                                        handleEditClick={handleEditClick}
                                                        handleToggleNoCanva={handleToggleNoCanva}
                                                        ratios={ratios}
                                                        categories={categories}
                                                        setRatios={setRatios}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {sortedEvents.map((event) => (
                                    <EventCard
                                        key={event.id}
                                        event={event}
                                        isSelectionMode={isSelectionMode}
                                        selectedIds={selectedIds}
                                        handleCardClick={handleCardClick}
                                        handleEditClick={handleEditClick}
                                        handleToggleNoCanva={handleToggleNoCanva}
                                        ratios={ratios}
                                        categories={categories}
                                        setRatios={setRatios}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </main>

            {/* Edit Modal */}
            {editingItem && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in duration-200">
                        <h2 className="text-xl font-bold mb-4">Update Image</h2>
                        <p className="text-gray-600 mb-4 text-sm">
                            {editingItem.fieldData.name}
                        </p>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Upload New Image (or Paste Ctrl+V)
                            </label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors bg-gray-50">
                                {previewUrl ? (
                                    <div className="relative group">
                                        <img
                                            src={previewUrl}
                                            alt="Preview"
                                            className="max-h-48 mx-auto rounded shadow-sm"
                                        />
                                        <button
                                            onClick={() => {
                                                setSelectedFile(null);
                                                setPreviewUrl(null);
                                            }}
                                            className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="flex justify-center text-gray-400">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                                                <span>Upload a file</span>
                                                <input
                                                    type="file"
                                                    className="sr-only"
                                                    accept="image/*"
                                                    onChange={handleFileSelect}
                                                />
                                            </label>
                                            <p className="pl-1">or drag and drop</p>
                                            <p className="text-xs text-gray-400 mt-1">PNG, JPG, GIF up to 10MB</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setEditingItem(null);
                                    setSelectedFile(null);
                                    setPreviewUrl(null);
                                }}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving || !selectedFile}
                                className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                            >
                                {isSaving ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Saving...
                                    </>
                                ) : (
                                    "Save Changes"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Action Bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-4 z-50 animate-in slide-in-from-bottom-4">
                    <span className="font-medium">{selectedIds.size} items selected</span>
                    <div className="h-4 w-px bg-gray-600"></div>
                    <button
                        onClick={handleBulkUpdateClick}
                        className="font-bold hover:text-gray-300 underline"
                    >
                        Update Image
                    </button>
                    <button
                        onClick={() => setSelectedIds(new Set())}
                        className="text-gray-400 hover:text-white ml-2"
                    >
                        Clear
                    </button>
                </div>
            )}
        </div>
    )
}


interface EventCardProps {
    event: EventItem;
    isSelectionMode: boolean;
    selectedIds: Set<string>;
    handleCardClick: (e: React.MouseEvent, id: string) => void;
    handleEditClick: (event: EventItem) => void;
    handleToggleNoCanva: (id: string, checked: boolean) => void;
    ratios: Record<string, { ratio: number; width: number; height: number }>;
    categories: Record<string, string>;
    setRatios: React.Dispatch<React.SetStateAction<Record<string, { ratio: number; width: number; height: number }>>>;
}

function EventCard({
    event,
    isSelectionMode,
    selectedIds,
    handleCardClick,
    handleEditClick,
    handleToggleNoCanva,
    ratios,
    categories,
    setRatios
}: EventCardProps) {
    return (
        <div
            onClick={(e) => handleCardClick(e, event.id)}
            className={`border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow relative group 
        ${event.fieldData["no-canva-image"] ? "opacity-60 bg-gray-50" : ""}
        ${isSelectionMode ? "cursor-pointer" : ""}
        ${selectedIds.has(event.id) ? "ring-2 ring-blue-500 bg-blue-50" : ""}
      `}
        >
            {isSelectionMode && (
                <div className="absolute top-2 left-2 z-30">
                    <input
                        type="checkbox"
                        checked={selectedIds.has(event.id)}
                        readOnly
                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                </div>
            )}

            {!isSelectionMode && (
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        handleEditClick(event)
                    }}
                    className="absolute top-2 right-2 z-20 bg-white/90 p-2 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                    title="Edit Image"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                    </svg>
                </button>
            )}
            <div className="aspect-[2/1] bg-gray-100 relative">
                {ratios[event.id]?.ratio && Math.abs(ratios[event.id].ratio - 2) <= 0.05 && (
                    <div className="absolute top-2 left-2 z-20 bg-green-500 text-white px-2 py-1 rounded-md text-xs font-bold shadow-sm flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        DONE
                    </div>
                )}
                {event.fieldData["header-image"]?.url ? (
                    <ImageWithRatio
                        src={event.fieldData["header-image"].url}
                        alt={event.fieldData["header-image"].alt || event.fieldData.name}
                        className="object-contain"
                        onDimensionsCalculated={(width, height) => {
                            const ratio = width / height;
                            // Only update if data is missing or different
                            const current = ratios[event.id];
                            if (!current || current.width !== width || current.height !== height) {
                                setRatios(prev => ({
                                    ...prev,
                                    [event.id]: { ratio, width, height }
                                }));
                            }
                        }}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                        No Image
                    </div>
                )}
            </div>
            <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                    {event.fieldData["article-types"] && categories[event.fieldData["article-types"]] && (
                        <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full font-medium">
                            {categories[event.fieldData["article-types"]]}
                        </span>
                    )}
                    <label
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <span className="text-[10px] uppercase font-bold text-gray-400">No Canva</span>
                        <input
                            type="checkbox"
                            checked={!!event.fieldData["no-canva-image"]}
                            onChange={(e) => handleToggleNoCanva(event.id, e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                        />
                    </label>
                </div>
                <h2 className="font-semibold text-lg line-clamp-2">
                    {event.fieldData.name}
                </h2>
                {ratios[event.id] && (
                    <div className="mt-2 text-xs text-gray-400 font-mono">
                        {ratios[event.id].width}x{ratios[event.id].height}
                    </div>
                )}
            </div>
        </div>
    );
}
