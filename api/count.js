// CARDNA 診断人数カウンター（Vercel Function + Upstash Redis）
//   GET  /api/count → { count }        … トップの「これまでに◯人」表示用（60秒キャッシュ）
//   POST /api/count → { count, you }   … 診断完了時に +1（you = あなたは何人目か）

// ▼ カウンター設置前に診断した人数の目安。この数字だけ変えれば表示に上乗せされます
const OFFSET = 0;

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = "cardna:completed";
const LIMIT_PER_10MIN = 30; // 同じ回線から10分間に数えるのは30回まで（連打による水増し対策）

async function redis(commands) {
  const r = await fetch(REDIS_URL + "/pipeline",
