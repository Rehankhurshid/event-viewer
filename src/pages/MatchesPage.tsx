import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { fetchEvents, type EventItem } from "../lib/api"

interface MatchItem {
    webflow_id: string
    webflow_name: string
    webflow_url: string
    webflow_ratio?: number
    local_file: string
    distance: number
    status?: "done"
}

export function MatchesPage() {
    const [matches, setMatches] = useState<MatchItem[]>([])
    const [eventsMap, setEventsMap] = useState<Record<string, EventItem>>({})
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadData = async () => {
            try {
                const [matchesRes, eventsData] = await Promise.all([
                    fetch("/matches.json"),
                    fetchEvents()
                ]);

                const matchesData = await matchesRes.json();
                setMatches(matchesData);

                const map: Record<string, EventItem> = {};
                eventsData.forEach(e => {
                    map[e.id] = e;
                });
                setEventsMap(map);

            } catch (err) {
                console.error("Failed to load data", err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [])

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="text-gray-500 hover:text-gray-900 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m15 18-6-6 6-6" />
                            </svg>
                        </Link>
                        <h1 className="text-xl font-bold text-gray-900">Matches Review</h1>
                        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                            {matches.length} Potential Matches
                        </span>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8">
                {loading ? (
                    <div className="text-center py-20 text-gray-500">Loading matches and live data...</div>
                ) : matches.length === 0 ? (
                    <div className="text-center py-20 text-gray-500">No matches found in matches.json</div>
                ) : (
                    <div className="grid grid-cols-1 gap-8">
                        {matches.map((match, idx) => (
                            <MatchCard
                                key={idx}
                                match={match}
                                liveEvent={eventsMap[match.webflow_id]}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}

function MatchCard({ match, liveEvent }: { match: MatchItem, liveEvent?: EventItem }) {
    const [isVisible, setIsVisible] = useState(false); // Default hidden until checked
    const [currentRatio, setCurrentRatio] = useState<number | null>(null);

    // Use live URL if available, otherwise fallback to match JSON
    const imageUrl = liveEvent?.fieldData["header-image"]?.url || match.webflow_url;
    const name = liveEvent?.fieldData.name || match.webflow_name;

    useEffect(() => {
        if (!imageUrl) {
            setIsVisible(true); // Show if no image (weird case)
            return;
        }

        const img = new Image();
        img.src = imageUrl;
        img.onload = () => {
            const ratio = img.naturalWidth / img.naturalHeight;
            setCurrentRatio(ratio);

            // Hide if ratio is close to 2:1
            const isCorrect = Math.abs(ratio - 2) <= 0.05;
            setIsVisible(!isCorrect);
        };
        img.onerror = () => {
            setIsVisible(true); // Show on error
        };
    }, [imageUrl]);

    if (!isVisible) return null;

    return (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden animate-in fade-in duration-300">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                <h3 className="font-medium text-gray-900 truncate flex-1" title={name}>
                    {name}
                </h3>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>Distance: {match.distance}</span>
                    {currentRatio && (
                        <span className={Math.abs(currentRatio - 2) > 0.05 ? "text-red-600 font-bold" : "text-green-600"}>
                            Live Ratio: {currentRatio.toFixed(2)}
                        </span>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4 p-4">
                {/* Webflow Image */}
                <div className="space-y-2">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Webflow (Live)</div>
                    <div className="aspect-[2/1] bg-gray-100 rounded-lg overflow-hidden border relative group">
                        <img src={imageUrl} alt="Webflow" className="w-full h-full object-contain" />
                        <a href={imageUrl} target="_blank" rel="noreferrer" className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            Open Original
                        </a>
                    </div>
                </div>

                {/* Local Match */}
                <div className="space-y-2">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Local Match: {match.local_file}</div>
                    <div className="aspect-[2/1] bg-gray-100 rounded-lg overflow-hidden border relative group">
                        <img src={`/images/${match.local_file}`} alt="Local" className="w-full h-full object-contain" />
                    </div>
                </div>
            </div>
        </div>
    );
}
