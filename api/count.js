// CARDNA 診断人数カウンター（Vercel Function + Upstash Redis）
//   GET  /api/count → { count }        … トップの「これまでに◯人」表示用（60秒キャッシュ）
//   POST /api/count → { count, you }   … 診断完了時に +1（you = あなたは何人目か）

// ▼ カウンター設置前に診断した人数の目安。この数字だけ変えれば表示に上乗せされます
const OFFSET = 10504;

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = "cardna:completed";
const LIMIT_PER_10MIN = 30; // 同じ回線から10分間に数えるのは30回まで（連打による水増し対策）

async function redis(commands) {
  const r = await fetch(REDIS_URL + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + REDIS_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error("redis " + r.status);
  return (await r.json()).map(function (x) { return x.result; });
}

module.exports = async function (req, res) {
  try {
    if (!REDIS_URL || !REDIS_TOKEN) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(503).json({ error: "not configured" });
    }
    if (req.method === "POST") {
      res.setHeader("Cache-Control", "no-store");
      const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
      const rl = "cardna:rl:" + ip + ":" + Math.floor(Date.now() / 600000);
      const hits = (await redis([["INCR", rl], ["EXPIRE", rl, "900"]]))[0];
      if (hits > LIMIT_PER_10MIN) {
        const cur = (await redis([["GET", KEY]]))[0];
        return res.status(200).json({ count: OFFSET + Number(cur || 0), you: null });
      }
      const n = (await redis([["INCR", KEY]]))[0];
      return res.status(200).json({ count: OFFSET + n, you: OFFSET + n });
    }
    const cur = (await redis([["GET", KEY]]))[0];
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=600");
    return res.status(200).json({ count: OFFSET + Number(cur || 0) });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(500).json({ error: "count unavailable" });
  }
};
