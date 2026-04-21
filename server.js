import express from 'express';
import cors from 'cors';
import https from 'https';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// 配置
const APP_ID = process.env.APP_ID || '1862954833036586';
const APP_SECRET = process.env.APP_SECRET || '0b6957498fc6a2d0c507821a474c5a9f268cbfec';
const API_BASE_URL_AD = 'https://ad.oceanengine.com/open_api';
const API_BASE_URL_API = 'https://api.oceanengine.com/open_api';

// 存储 (全局变量用于serverless)
if (!global.qianchuanState) {
  global.qianchuanState = {
    accessToken: process.env.ACCESS_TOKEN || '2583e764d2a9e6cf6c6a89063f0b5d0a372c3a4a',
    refreshToken: process.env.REFRESH_TOKEN || '578026b11965dc99fb575c68d8deb62241341b65',
    tokenExpiry: Date.now() + 24 * 60 * 60 * 1000,
    advertiserMapping: null,
    adsCache: {}
  };
}

// 使用原生https
function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const opt = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = https.request(opt, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });

    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function ensureToken() {
  const state = global.qianchuanState;
  if (!state.accessToken || Date.now() > state.tokenExpiry) {
    if (!state.refreshToken) return false;
    try {
      const body = JSON.stringify({
        app_id: APP_ID, secret: APP_SECRET, grant_type: 'refresh_token', refresh_token: state.refreshToken
      });
      const data = await fetchUrl(`${API_BASE_URL_AD}/oauth2/refresh_token/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body
      });
      if (data.code === 0) {
        state.accessToken = data.data.access_token;
        state.refreshToken = data.data.refresh_token;
        state.tokenExpiry = Date.now() + (data.data.expires_in - 300) * 1000;
        return true;
      }
      return false;
    } catch { return false; }
  }
  return true;
}

async function loadAdvertiserMapping() {
  const state = global.qianchuanState;
  if (!await ensureToken()) return;

  try {
    const data = await fetchUrl(`${API_BASE_URL_API}/oauth2/advertiser/get/`, {
      headers: { 'Access-Token': state.accessToken }
    });
    if (data.code !== 0) return;

    const shops = [];
    let totalQianchuan = 0;
    const shopAccounts = (data.data.list || []).filter(acc =>
      acc.account_type === 'PLATFORM_ROLE_SHOP_ACCOUNT' || acc.account_type === 'PLATFORM_ROLE_QIANCHUAN_ACCOUNT'
    );

    for (const shop of shopAccounts) {
      try {
        const qcData = await fetchUrl(
          `${API_BASE_URL_API}/v1.0/qianchuan/shop/advertiser/list/?shop_id=${shop.advertiser_id}`,
          { headers: { 'Access-Token': state.accessToken } }
        );
        if (qcData.code === 0 && (qcData.data.list || []).length > 0) {
          shops.push({
            shop_id: shop.advertiser_id,
            shop_name: shop.advertiser_name,
            qianchuan_ids: qcData.data.list,
            extra_permissions: qcData.data.adv_id_list || []
          });
          totalQianchuan += qcData.data.list.length;
        }
      } catch {}
    }
    state.advertiserMapping = { shops, totalQianchuan };
    console.log(`加载完成: ${shops.length} 个店铺, ${totalQianchuan} 个千川账户`);
  } catch (error) {
    console.error('加载账户映射失败:', error);
  }
}

// API路由
app.get('/api/advertiser-mapping', async (req, res) => {
  const state = global.qianchuanState;
  if (!state.advertiserMapping) await loadAdvertiserMapping();
  res.json(state.advertiserMapping || { shops: [], totalQianchuan: 0 });
});

app.get('/api/ads', async (req, res) => {
  const state = global.qianchuanState;
  const { advertiser_id, marketing_goal = 'LIVE_PROM_GOODS', page = 1, page_size = 20 } = req.query;

  if (!advertiser_id) return res.status(400).json({ error: 'advertiser_id is required' });
  if (!await ensureToken()) return res.status(401).json({ error: 'Token不可用' });

  try {
    const cacheKey = `${advertiser_id}_${marketing_goal}_${page}`;
    if (state.adsCache[cacheKey] && Date.now() - state.adsCache[cacheKey].timestamp < 60000) {
      return res.json(state.adsCache[cacheKey].data);
    }

    const url = `${API_BASE_URL_AD}/v1.0/qianchuan/ad/get/?advertiser_id=${advertiser_id}&page=${page}&page_size=${page_size}&filtering=${encodeURIComponent(JSON.stringify({ marketing_goal }))}`;
    const data = await fetchUrl(url, { headers: { 'Access-Token': state.accessToken, 'Content-Type': 'application/json' } });

    if (data.code === 0) {
      state.adsCache[cacheKey] = { data: data.data, timestamp: Date.now() };
      res.json(data.data);
    } else {
      res.status(400).json({ error: data.message });
    }
  } catch (error) {
    res.status(500).json({ error: '获取广告列表失败' });
  }
});

app.post('/api/refresh', async (req, res) => {
  const state = global.qianchuanState;
  if (!await ensureToken()) return res.status(401).json({ error: 'Token不可用' });
  await loadAdvertiserMapping();
  state.adsCache = {};
  res.json({ success: true, message: '数据已刷新' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 初始化
loadAdvertiserMapping();

app.listen(PORT, () => {
  console.log(`千川API服务运行在 http://0.0.0.0:${PORT}`);
});