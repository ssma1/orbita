import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

const firebaseConfig = {
    apiKey: "AIzaSyBYOyzTnpv6RH9sGziwzf2tJTW5ifuEyqY",
    authDomain: "orbita1917.firebaseapp.com",
    projectId: "orbita1917",
    storageBucket: "orbita1917.firebasestorage.app",
    messagingSenderId: "1085452844318",
    appId: "1:1085452844318:web:dfee91a234981b58619d0f",
    measurementId: "G-HY2LRW1Q8T"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const BOT_REGEX = /telegrambot|twitterbot|facebookexternalhit|whatsapp|discordbot|vkshare|linkedinbot|yandexbot|googlebot|bingbot|applebot|slackbot|skypeuripreview/i;

export default async (request: Request, context: any) => {
    const url = new URL(request.url);
    const userAgent = request.headers.get("user-agent") || "";

    if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|json|woff|woff2|ttf|xml|txt)$/i)) {
        return context.next();
    }

    // Поддержка как /?id=...&collection=..., так и /posts/ID
    let id = url.searchParams.get("id");
    let collection = url.searchParams.get("collection");

    if (!id) {
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length >= 2) {
            collection = parts[0];
            id = parts[1];
        }
    }

    const isBot = BOT_REGEX.test(userAgent);

    if (!id || !collection || !isBot) {
        return context.next();
    }

    try {
        const docRef = doc(db, collection, id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            return context.next();
        }

        const data = docSnap.data();
        const title = data.title || "ОРБИТА";
        const description = (data.text || "").replace(/<[^>]*>/g, '').substring(0, 200);
        const imageUrl = data.mediaUrl || (data.mediaUrls && data.mediaUrls[0]) || "https://i.ibb.co/sdwwQJcF/IMG-20261102-232112-037.png";

        const html = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>${escapeXml(title)} — ОРБИТА</title>
    <meta name="description" content="${escapeXml(description)}">
    <meta property="og:site_name" content="ОРБИТА">
    <meta property="og:type" content="article">
    <meta property="og:title" content="${escapeXml(title)} — ОРБИТА">
    <meta property="og:description" content="${escapeXml(description)}">
    <meta property="og:image" content="${escapeXml(imageUrl)}">
    <meta property="og:image:secure_url" content="${escapeXml(imageUrl)}">
    <meta property="og:url" content="${url.href}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeXml(title)} — ОРБИТА">
    <meta name="twitter:description" content="${escapeXml(description)}">
    <meta name="twitter:image" content="${escapeXml(imageUrl)}">
</head>
<body>
    <h1>${escapeXml(title)}</h1>
    <p>${escapeXml(description)}</p>
    <img src="${escapeXml(imageUrl)}" alt="Cover">
</body>
</html>`;

        return new Response(html, {
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "public, max-age=300, s-maxage=300"
            }
        });

    } catch (err) {
        console.error("[OG] Generator Error:", err);
        return context.next();
    }
};

function escapeXml(unsafe: string) {
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}
