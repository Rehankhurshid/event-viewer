import { useState, useRef, useEffect } from "react"
import { cn } from "../lib/utils"

interface ImageWithRatioProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    onDimensionsCalculated?: (width: number, height: number) => void
}

export function ImageWithRatio({ className, onDimensionsCalculated, ...props }: ImageWithRatioProps) {
    const [ratio, setRatio] = useState<string | null>(null)
    const [dimensions, setDimensions] = useState<string | null>(null)
    const imgRef = useRef<HTMLImageElement>(null)

    const updateDimensions = (img: HTMLImageElement) => {
        if (img.naturalWidth === 0) return; // Not loaded yet

        const r = img.naturalWidth / img.naturalHeight
        setRatio(r.toFixed(2))
        setDimensions(`${img.naturalWidth}x${img.naturalHeight}`)

        if (onDimensionsCalculated) {
            onDimensionsCalculated(img.naturalWidth, img.naturalHeight)
        }
    }

    const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        updateDimensions(e.currentTarget)
    }

    useEffect(() => {
        if (imgRef.current && imgRef.current.complete) {
            updateDimensions(imgRef.current)
        }
    }, [props.src])

    const isCorrectRatio = ratio && Math.abs(parseFloat(ratio) - 2.0) <= 0.05

    return (
        <div className="relative w-full h-full group">
            <img
                {...props}
                ref={imgRef}
                className={cn("w-full h-full object-cover", className)}
                onLoad={handleLoad}
            />
            {ratio && (
                <div
                    className={cn(
                        "absolute top-2 left-2 text-xs font-mono px-2 py-1 rounded backdrop-blur-sm border shadow-sm z-10 transition-colors",
                        isCorrectRatio
                            ? "bg-black/75 text-white border-white/20"
                            : "bg-rose-500/90 text-white border-rose-400/30"
                    )}
                >
                    <span className="font-bold">{ratio}</span>
                    <span className="hidden group-hover:inline ml-1 opacity-80">
                        ({dimensions})
                    </span>
                </div>
            )}
        </div>
    )
}
