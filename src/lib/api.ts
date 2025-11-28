import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}


const COLLECTION_ID = "65d710d7dfaa8125ae566cd9" // News & Insights
const CATEGORY_COLLECTION_ID = "65d710d7dfaa8125ae566c6e" // Article Types
const TOKEN = import.meta.env.VITE_WEBFLOW_TOKEN

export interface CategoryItem {
    id: string
    fieldData: {
        name: string
    }
}

export interface EventItem {
    id: string
    createdOn?: string
    lastUpdated?: string
    fieldData: {
        name: string
        "header-image"?: {
            url: string
            alt?: string | null
        }
        "article-types"?: string // Reference ID
        "no-canva-image"?: boolean
    }
}

export async function fetchEvents(): Promise<EventItem[]> {
    if (!TOKEN) {
        throw new Error("API Token not found")
    }

    const allItems: EventItem[] = []
    let offset = 0
    const limit = 100
    let hasMore = true

    while (hasMore) {
        const response = await fetch(
            `/api/v2/collections/${COLLECTION_ID}/items?limit=${limit}&offset=${offset}`,
            {
                headers: {
                    Authorization: `Bearer ${TOKEN}`,

                },
            }
        )

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Failed to fetch events: ${response.status} ${response.statusText} - ${errorText}`)
        }

        const data = await response.json()
        const items = data.items || []
        allItems.push(...items)

        if (items.length < limit) {
            hasMore = false
        } else {
            offset += limit
        }
    }

    return allItems
}

export async function fetchCategories(): Promise<CategoryItem[]> {
    if (!TOKEN) {
        throw new Error("API Token not found")
    }

    const response = await fetch(`/api/v2/collections/${CATEGORY_COLLECTION_ID}/items`, {
        headers: {
            Authorization: `Bearer ${TOKEN}`,
            "accept-version": "1.0.0",
        },
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to fetch categories: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    return data.items
}

export async function updateEventImage(itemId: string, imageUrl: string): Promise<void> {
    if (!TOKEN) {
        throw new Error("API Token not found")
    }

    const response = await fetch(`/api/v2/collections/${COLLECTION_ID}/items/${itemId}`, {
        method: "PATCH",
        headers: {
            Authorization: `Bearer ${TOKEN}`,
            "accept-version": "1.0.0",
            "content-type": "application/json",
        },
        body: JSON.stringify({
            fieldData: {
                "header-image": {
                    url: imageUrl
                }
            }
        })
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to update image: ${error}`)
    }
}

export async function updateEventSwitch(itemId: string, field: string, value: boolean): Promise<void> {
    if (!TOKEN) {
        throw new Error("API Token not found")
    }

    const response = await fetch(`/api/v2/collections/${COLLECTION_ID}/items/${itemId}`, {
        method: "PATCH",
        headers: {
            Authorization: `Bearer ${TOKEN}`,
            "content-type": "application/json",
        },
        body: JSON.stringify({
            fieldData: {
                [field]: value
            }
        })
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to update switch: ${error}`)
    }
}

const IMGBB_KEY = import.meta.env.VITE_IMGBB_KEY

const TINYPNG_KEY = import.meta.env.VITE_TINYPNG_KEY

export async function compressImage(file: File): Promise<Blob> {
    if (!TINYPNG_KEY) {
        console.warn("TinyPNG API Key not found. Skipping compression.")
        return file
    }

    // 1. Upload to TinyPNG
    const response = await fetch("/tinify/shrink", {
        method: "POST",
        headers: {
            Authorization: `Basic ${btoa(`api:${TINYPNG_KEY}`)}`,
        },
        body: file,
    })

    if (!response.ok) {
        const error = await response.json()
        throw new Error(`TinyPNG Error: ${error.message || response.statusText}`)
    }

    const data = await response.json()
    const outputUrl = data.output.url

    // 2. Convert to WebP (using the output URL)
    // We need to send a request to the output URL with conversion options.
    // Since the output URL is absolute (api.tinify.com/...), we need to proxy it too or use the /tinify prefix if we can construct the path.
    // The output URL is like https://api.tinify.com/output/..., so we can replace https://api.tinify.com with /tinify

    const proxyOutputUrl = outputUrl.replace("https://api.tinify.com", "/tinify")

    const convertResponse = await fetch(proxyOutputUrl, {
        method: "POST",
        headers: {
            Authorization: `Basic ${btoa(`api:${TINYPNG_KEY}`)}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            convert: { type: "image/webp" },
        }),
    })

    if (!convertResponse.ok) {
        const error = await convertResponse.json()
        throw new Error(`TinyPNG Convert Error: ${error.message || convertResponse.statusText}`)
    }

    // 3. Get the result
    const blob = await convertResponse.blob()
    return blob
}

export async function uploadToImgBB(file: File | Blob): Promise<string> {
    if (!IMGBB_KEY) {
        throw new Error("ImgBB API Key not found. Please add VITE_IMGBB_KEY to .env")
    }

    const formData = new FormData()
    formData.append("image", file)

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
        method: "POST",
        body: formData,
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to upload image: ${error}`)
    }

    const data = await response.json()
    return data.data.url
}
