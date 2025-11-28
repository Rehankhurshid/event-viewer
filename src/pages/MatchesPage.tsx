import { useEffect, useState } from "react"
import { Link } from "react-router-dom"

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
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch("/matches.json")
            .then(res => res.json())
            .then(data => setMatches(data))
            .catch(err => console.error("Failed to load matches", err))
            .finally(() => setLoading(false))
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
                            {matches.length} Items
                        </span>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8">
                {loading ? (
                    <div className="text-center py-20 text-gray-500">Loading matches...</div>
                ) : matches.length === 0 ? (
                    <div className="text-center py-20 text-gray-500">No matches found in matches.json</div>
                ) : (
                    <div className="grid grid-cols-1 gap-8">
                        {matches.map((match, idx) => (
                            <div key={idx} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                                    <h3 className="font-medium text-gray-900 truncate flex-1" title={match.webflow_name}>
                                        {match.webflow_name}
                                    </h3>
                                    <div className="flex items-center gap-4 text-sm text-gray-500">
                                        <span>Distance: {match.distance}</span>
                                        {match.webflow_ratio && (
                                            <span className={Math.abs(match.webflow_ratio - 2) > 0.05 ? "text-red-600 font-bold" : "text-green-600"}>
                                                Ratio: {match.webflow_ratio.toFixed(2)}
                                            </span>
                                        )}
                                        {match.status === "done" && (
                                            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Done</span>
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 p-4">
                                    {/* Webflow Image */}
                                    <div className="space-y-2">
                                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Webflow (Current)</div>
                                        <div className="aspect-[2/1] bg-gray-100 rounded-lg overflow-hidden border relative group">
                                            <img src={match.webflow_url} alt="Webflow" className="w-full h-full object-contain" />
                                            <a href={match.webflow_url} target="_blank" rel="noreferrer" className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                                Open Original
                                            </a>
                                        </div>
                                    </div>

                                    {/* Local Match */}
                                    <div className="space-y-2">
                                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Local Match: {match.local_file}</div>
                                        <div className="aspect-[2/1] bg-gray-100 rounded-lg overflow-hidden border relative group">
                                            <img src={`/images/${match.local_file}`} alt="Local" className="w-full h-full object-contain" />
                                            {/* Note: This assumes local images are in public/images, which might need adjustment if they are in canva_images */}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}
