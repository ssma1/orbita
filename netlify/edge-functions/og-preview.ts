export default async (request: Request, context: any) => {
    const url = new URL(request.url);
    const userAgent = request.headers.get("user-agent") || "";

    // Пропускаем статические файлы
    if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|json|woff|woff2|ttf|xml|txt)$/i)) {
        return context.next();
    }

    let id = null;
    let collection = null;

    // 1. Проверяем новый формат пути: /posts/ID
    const pathParts = url.pathname.split("/").filter(Boolean);
    if (pathParts.length >= 2 && VALID_COLLECTIONS.includes(pathParts[0])) {
        collection = pathParts[0];
        id = pathParts[1];
    }

    // 2. Проверяем старый формат: ?id=...&collection=...
    if (!id || !collection) {
        const paramId = url.searchParams.get("id");
        const paramCollection = url.searchParams.get("collection");
        if (paramId && paramCollection) {
            id = paramId;
            collection = paramCollection;
        }
    }

    const isBot = BOT_REGEX.test(userAgent);

    // Если это не бот или нет ID — отдаем стандартную страницу
    if (!id || !collection || !isBot) {
        return context.next();
    }

    try {
        // ЖЁСТКИЙ ТАЙМАУТ: если Firestore не ответит за 1.5 сек — пропускаем
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Timeout")), 1500)
        );
        
        const fetchPromise = (async () => {
            const docRef = doc(db, collection, id);
            const docSnap = await getDoc(docRef);
            return docSnap;
        })();

        const docSnap = await Promise.race([fetchPromise, timeoutPromise]) as any;

        if (!docSnap || !docSnap.exists()) {
            // Если документ не найден — НЕ отдаём заглушку с логотипом,
            // а пропускаем дальше, чтобы Telegram не закэшировал плохую карточку
            return context.next();
        }

        const data = docSnap.data();
        const title = data.title || "ОРБИТА — Космический Архив";
        
        let rawText = data.text || "";
        rawText = rawText.replace(/\[img\d+\]/g, '');
        rawText = rawText.replace(/<[^>]*>/g, '');
        rawText = rawText.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
        
        const description = rawText.trim().substring(0, 150) + (rawText.length > 150 ? "..." : "");
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
<body><h1>${escapeXml(title)}</h1><p>${escapeXml(description)}</p><img src="${escapeXml(imageUrl)}" alt="Cover"></body>
</html>`;

        return new Response(html, {
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-store"  // Запрещаем кэширование на стороне Netlify
            }
        });

    } catch (err) {
        // При любой ошибке или таймауте — НЕ отдаём заглушку, а пропускаем
        console.error("[OG] Error or Timeout:", err);
        return context.next();
    }
};
