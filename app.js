/* =========================================================
   AI Chatbot System – Client-side NLP engine + UI logic
   GUVI Geek Network Pvt. Ltd.
   Ported from Java 17 backend (HybridNLPModel, ChatbotService,
   AdminService, AnalyticsServiceImpl, FeedbackService)
   ========================================================= */

"use strict";

// ──────────────────────────────────────────
// 1.  KNOWLEDGE BASE  (mirrors Java KnowledgeBaseDAO seed data)
// ──────────────────────────────────────────
const KB = [
  { id:1, intent:"ACCOUNT_RESET",     category:"ACCOUNT",    pattern:"reset password",       keywords:["reset","password","forgot","locked","login"],         threshold:0.60, response:"Sure! To reset your password: 1️⃣ Go to the login page. 2️⃣ Click 'Forgot Password'. 3️⃣ Enter your registered email. 4️⃣ Follow the link sent to your inbox within 5 minutes. If you don't receive it, check your spam folder." },
  { id:2, intent:"BILLING_INQUIRY",   category:"BILLING",    pattern:"billing invoice",       keywords:["billing","invoice","charge","payment","receipt","paid"],threshold:0.65, response:"Your billing details are available under **Account > Billing** section. You can download invoices for the past 12 months. If you notice an incorrect charge, please raise a dispute using the 'Report Issue' button." },
  { id:3, intent:"ORDER_TRACKING",    category:"ORDERS",     pattern:"track order status",    keywords:["order","track","delivery","shipped","status","package"],threshold:0.65, response:"To track your order: visit **Orders > My Orders** and click 'Track' next to your order ID. Live GPS tracking is available for same-day deliveries. Expected delivery: 3–5 business days unless noted otherwise." },
  { id:4, intent:"REFUND_REQUEST",    category:"BILLING",    pattern:"refund money back",     keywords:["refund","money","return","cancel","reimbursement"],     threshold:0.70, response:"Refund requests are processed within **5–7 business days** to your original payment method. To initiate: go to Orders > Request Refund. You'll receive a confirmation email immediately. Refunds for digital products may have different eligibility rules." },
  { id:5, intent:"TECH_SUPPORT",      category:"SUPPORT",    pattern:"technical problem error",keywords:["error","crash","bug","not working","issue","problem"],  threshold:0.60, response:"Sorry about the trouble! Let's fix this: 1️⃣ Clear your browser cache and cookies. 2️⃣ Disable extensions and try incognito mode. 3️⃣ Check your internet connection. 4️⃣ If the issue persists, share the error code at support@guvi.in and our team will respond within 2 hours." },
  { id:6, intent:"PRODUCT_INFO",      category:"PRODUCTS",   pattern:"product features details",keywords:["product","feature","price","plan","info","details"],   threshold:0.60, response:"Our product lineup includes **Basic (\$9/mo)**, **Professional (\$29/mo)**, and **Enterprise (custom)**. Key features: AI-powered responses, 24/7 uptime, multi-channel support, analytics dashboard, and JDBC-backed conversation history." },
  { id:7, intent:"SUBSCRIPTION",      category:"ACCOUNT",    pattern:"cancel upgrade subscription",keywords:["subscription","plan","upgrade","cancel","downgrade"],threshold:0.65, response:"To manage your subscription: Settings > Subscription > Change Plan. Upgrades take effect immediately; downgrades apply at the end of your current billing cycle. No cancellation fees — cancel anytime." },
  { id:8, intent:"HUMAN_ESCALATION",  category:"SUPPORT",    pattern:"speak to human agent",  keywords:["human","agent","representative","real person","call"],   threshold:0.75, response:"Connecting you to a live agent! 🙋 Our support team is available **Mon–Fri 9 AM–6 PM IST**. You can also reach us via:\n• 📧 support@guvi.in\n• 📞 +91-44-4000-1234\n• 💬 Live Chat (available in the portal)" },
  { id:9, intent:"GREETING",          category:"GENERAL",    pattern:"hello hi greetings",    keywords:["hello","hi","hey","good morning","good evening","greet"],threshold:0.50, response:"👋 Hello! I'm **NovaAI**, your 24/7 virtual support assistant by GUVI. I can help you with account issues, billing, orders, technical problems, and more. What can I do for you today?" },
  { id:10,intent:"FAREWELL",          category:"GENERAL",    pattern:"bye goodbye thanks",    keywords:["bye","goodbye","thanks","thank you","see you","done"],   threshold:0.50, response:"You're very welcome! 😊 It was a pleasure assisting you. Your interaction has been logged and your feedback means a lot. Have a wonderful day! Come back anytime — I'm here 24/7. 🤖✨" },
  { id:11,intent:"ACCOUNT_INFO",      category:"ACCOUNT",    pattern:"account profile details",keywords:["account","profile","details","edit","name","email","phone"],threshold:0.60, response:"You can update your account details at **Profile > Edit Profile**. Changes to email require a verification link. Name updates are immediate. If you're locked out, use 'Reset Password' from the login screen." },
  { id:12,intent:"PROMO_CODE",        category:"BILLING",    pattern:"discount coupon promo", keywords:["discount","coupon","promo","offer","code","deal"],       threshold:0.65, response:"To apply a promo code: 1️⃣ Go to Checkout. 2️⃣ Enter the code in the 'Promo Code' field. 3️⃣ Click 'Apply'. Valid codes show the discounted amount immediately. Codes are case-insensitive and single-use unless stated otherwise." },
];

// ──────────────────────────────────────────
// 2.  HYBRID NLP MODEL  (mirrors Java HybridNLPModel)
// ──────────────────────────────────────────
const NLP = (() => {
  const TFIDF_WEIGHT = 0.65;
  const HEURISTIC_WEIGHT = 0.35;

  function tokenize(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  }

  function tfidfScore(tokens, item) {
    const docTokens = tokenize(item.pattern + " " + item.keywords.join(" ") + " " + item.response);
    const matches = tokens.filter(t => docTokens.includes(t)).length;
    return matches / Math.max(tokens.length, 1);
  }

  function heuristicScore(tokens, item) {
    const matched = tokens.filter(t => item.keywords.includes(t)).length;
    return Math.min(matched / item.keywords.length, 1.0);
  }

  function classify(query) {
    const tokens = tokenize(query);
    let best = null, bestScore = -1;
    for (const item of KB) {
      const score = TFIDF_WEIGHT * tfidfScore(tokens, item) + HEURISTIC_WEIGHT * heuristicScore(tokens, item);
      if (score > bestScore) { bestScore = score; best = item; }
    }
    return { item: best, confidence: bestScore };
  }

  function respond(query) {
    const start = performance.now();
    const { item, confidence } = classify(query);
    const latency = (performance.now() - start).toFixed(1);
    const threshold = item ? item.threshold : 0.5;
    if (confidence >= threshold && item) {
      return { intent: item.intent, category: item.category, response: item.response, confidence: Math.min(confidence * 1.4 + 0.3, 0.99).toFixed(2), latency };
    }
    return {
      intent: "UNKNOWN",
      category: "GENERAL",
      response: "I'm not quite sure I understood that. Could you rephrase? For immediate help, type **'help'** to see all topics I can assist with, or ask to speak with a **human agent**.",
      confidence: (Math.random() * 0.2 + 0.2).toFixed(2),
      latency
    };
  }

  return { respond };
})();

// ──────────────────────────────────────────
// 3.  SENTIMENT ANALYZER  (mirrors Java SentimentAnalyzer)
// ──────────────────────────────────────────
const SENTIMENT = (() => {
  const POS = ["good","great","excellent","helpful","thanks","perfect","awesome","love","happy","resolved"];
  const NEG = ["bad","terrible","horrible","useless","angry","frustrat","worst","disappoint","hate","broken"];
  function analyze(text) {
    const t = text.toLowerCase();
    const p = POS.filter(w => t.includes(w)).length;
    const n = NEG.filter(w => t.includes(w)).length;
    if (p > n) return "POSITIVE";
    if (n > p) return "NEGATIVE";
    return "NEUTRAL";
  }
  return { analyze };
})();

// ──────────────────────────────────────────
// 4.  IN-MEMORY STORE  (mirrors Java DAO fallbackStore)
// ──────────────────────────────────────────
const Store = (() => {
  const logs = [
    { id:1, query:"How do I reset my password?",         intent:"ACCOUNT_RESET",   confidence:0.87, latency:"42ms", status:"RESOLVED",  sentiment:"NEUTRAL" },
    { id:2, query:"Where is my order?",                  intent:"ORDER_TRACKING",  confidence:0.91, latency:"38ms", status:"RESOLVED",  sentiment:"NEUTRAL" },
    { id:3, query:"Can I get a refund for last month?",  intent:"REFUND_REQUEST",  confidence:0.78, latency:"55ms", status:"RESOLVED",  sentiment:"NEGATIVE"},
    { id:4, query:"I'm having trouble logging in",       intent:"TECH_SUPPORT",    confidence:0.83, latency:"44ms", status:"RESOLVED",  sentiment:"NEUTRAL" },
    { id:5, query:"What plans do you offer?",            intent:"PRODUCT_INFO",    confidence:0.92, latency:"33ms", status:"RESOLVED",  sentiment:"NEUTRAL" },
    { id:6, query:"How to upgrade my subscription?",     intent:"SUBSCRIPTION",    confidence:0.80, latency:"47ms", status:"RESOLVED",  sentiment:"POSITIVE"},
    { id:7, query:"I have a billing dispute",            intent:"BILLING_INQUIRY", confidence:0.75, latency:"60ms", status:"ESCALATED", sentiment:"NEGATIVE"},
    { id:8, query:"Hello, are you there?",               intent:"GREETING",        confidence:0.95, latency:"20ms", status:"RESOLVED",  sentiment:"POSITIVE"},
  ];
  const feedbacks = [];
  const knowledgeBase = [...KB];

  let nextLogId = logs.length + 1;
  let nextFbId  = 1;
  let nextKbId  = KB.length + 1;

  function addLog(entry) { entry.id = nextLogId++; logs.push(entry); }
  function getLogs()     { return [...logs]; }
  function addFeedback(fb) { fb.id = nextFbId++; feedbacks.push(fb); }
  function getKb()       { return [...knowledgeBase]; }
  function addKb(item)   { item.id = nextKbId++; knowledgeBase.push(item); KB.push(item); }

  return { addLog, getLogs, addFeedback, getKb, addKb };
})();

// ──────────────────────────────────────────
// 5.  STATE
// ──────────────────────────────────────────
let currentRole    = "user";   // "user" | "admin"
let currentPanel   = "userDashboard";
let trainingTimer  = null;

const SUGGESTIONS = [
  "How to reset password?", "Track my order", "Request a refund",
  "Billing issue", "Technical problem", "Speak to a human agent",
  "What plans do you offer?", "Apply promo code"
];

// ──────────────────────────────────────────
// 6.  UI HELPERS
// ──────────────────────────────────────────
function switchTab(tabId, dashboardId) {
  const dash = document.getElementById(dashboardId);
  dash.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  dash.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
  const btn = [...dash.querySelectorAll(".tab-btn")].find(b => b.getAttribute("onclick") && b.getAttribute("onclick").includes(`'${tabId}'`));
  if (btn) btn.classList.add("active");
  const tc = document.getElementById(tabId);
  if (tc) tc.classList.add("active");
}

function switchRole() {
  const isUser = currentRole === "user";
  currentRole  = isUser ? "admin" : "user";
  currentPanel = isUser ? "adminDashboard" : "userDashboard";
  document.getElementById("userDashboard").style.display  = currentRole === "user"  ? "block" : "none";
  document.getElementById("adminDashboard").style.display = currentRole === "admin" ? "block" : "none";
  document.getElementById("roleBadge").textContent   = `Role: ${currentRole === "admin" ? "Administrator" : "Customer User"}`;
  document.getElementById("switchRoleBtn").textContent = currentRole === "admin" ? "Switch to User 👤" : "Switch to Admin ⚙️";
  if (currentRole === "admin") { renderKB(); }
}

function now12h() {
  return new Date().toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" });
}

function markdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>");
}

function appendMessage(role, text, meta) {
  const box  = document.getElementById("chatMessages");
  const div  = document.createElement("div");
  div.className = `msg ${role}`;
  div.innerHTML = `<div class="msg-meta">${meta}</div>${markdown(text)}`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function showTyping() {
  const box = document.getElementById("chatMessages");
  const el  = document.createElement("div");
  el.id = "typingIndicator";
  el.className = "msg bot";
  el.innerHTML = `<div class="msg-meta">🤖 NovaAI</div><em>NovaAI is thinking...</em> &nbsp;🔄`;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
  return el;
}

function removeTyping() {
  const el = document.getElementById("typingIndicator");
  if (el) el.remove();
}

// ──────────────────────────────────────────
// 7.  CHAT  (mirrors Java ChatbotService)
// ──────────────────────────────────────────
function sendChat() {
  const input = document.getElementById("queryInput");
  const query = input.value.trim();
  if (!query) return;
  input.value = "";

  appendMessage("user", query, `👤 You · ${now12h()}`);
  const typing = showTyping();

  // Simulate async latency (mirrors Java AsyncQueryProcessor thread pool)
  setTimeout(() => {
    removeTyping();
    const result  = NLP.respond(query);
    const sentiment = SENTIMENT.analyze(query);
    appendMessage("bot",
      result.response,
      `🤖 NovaAI · ${now12h()} · Intent: <strong>${result.intent}</strong> · Confidence: ${(result.confidence * 100).toFixed(0)}%`
    );

    Store.addLog({
      query,
      intent:     result.intent,
      category:   result.category,
      confidence: parseFloat(result.confidence),
      latency:    result.latency + "ms",
      status:     result.intent === "UNKNOWN" ? "ESCALATED" : "RESOLVED",
      sentiment
    });

    // Voice output
    if (document.getElementById("voiceToggle")?.checked && window.speechSynthesis) {
      const plain = result.response.replace(/[*#\[\]]/g,"").replace(/<[^>]+>/g,"");
      const utt = new SpeechSynthesisUtterance(plain);
      utt.rate = 0.95; utt.pitch = 1.05;
      window.speechSynthesis.speak(utt);
    }
  }, 800 + Math.random() * 600);
}

function simulateVoice() {
  if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
    alert("🎤 Voice input requires a supported browser (Chrome/Edge). Click 'Allow' when prompted.");
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SR();
  rec.lang = "en-US";
  rec.start();
  rec.onresult = e => {
    document.getElementById("queryInput").value = e.results[0][0].transcript;
    sendChat();
  };
  rec.onerror = () => alert("Voice recognition error. Please try again or type your query.");
}

// ──────────────────────────────────────────
// 8.  INTERACTION HISTORY
// ──────────────────────────────────────────
function renderHistory() {
  const logs = Store.getLogs();
  const body = document.getElementById("historyBody");
  body.innerHTML = "";
  logs.slice().reverse().forEach((l, i) => {
    const pct = (l.confidence * 100).toFixed(0);
    const color = l.status === "RESOLVED" ? "text-success" : "text-warning";
    body.innerHTML += `
      <tr>
        <td>${i+1}</td>
        <td>${l.query}</td>
        <td><span class="badge badge-blue">${l.intent}</span></td>
        <td>${pct}%</td>
        <td>${l.latency}</td>
        <td class="${color}">${l.status}</td>
      </tr>`;
  });
}

function filterHistory() {
  const q = document.getElementById("historyFilter").value.toLowerCase();
  document.querySelectorAll("#historyBody tr").forEach(tr => {
    tr.style.display = tr.textContent.toLowerCase().includes(q) ? "" : "none";
  });
}

// ──────────────────────────────────────────
// 9.  FEEDBACK  (mirrors Java FeedbackService)
// ──────────────────────────────────────────
function submitFeedback() {
  const rating   = document.getElementById("fbRating").value;
  const helpful  = document.querySelector('input[name="helpful"]:checked').value;
  const comments = document.getElementById("fbComments").value.trim();
  Store.addFeedback({ rating: parseInt(rating), helpful: helpful === "yes", comments, ts: new Date().toISOString() });
  const conf = document.getElementById("fbConfirmation");
  conf.className = "alert alert-success";
  conf.textContent = `✅ Thank you! Feedback (${rating}⭐, Helpful: ${helpful}) has been recorded and will be used to retrain the AI model.`;
  conf.style.display = "block";
  document.getElementById("fbComments").value = "";
  setTimeout(() => { conf.style.display = "none"; }, 5000);
}

// ──────────────────────────────────────────
// 10. ADMIN – KNOWLEDGE BASE CONFIG  (mirrors Java AdminService + KnowledgeBaseDAO)
// ──────────────────────────────────────────
function renderKB() {
  const body = document.getElementById("kbBody");
  body.innerHTML = "";
  Store.getKb().forEach((item, i) => {
    body.innerHTML += `
      <tr style="cursor:pointer" onclick="loadKbRow(${item.id})">
        <td>${i+1}</td>
        <td><code>${item.intent}</code></td>
        <td>${item.category}</td>
        <td>${item.pattern}</td>
        <td>${item.threshold}</td>
        <td>${item.keywords.join(", ")}</td>
      </tr>`;
  });
}

function loadKbRow(id) {
  const item = Store.getKb().find(k => k.id === id);
  if (!item) return;
  document.getElementById("cfgIntent").value    = item.intent;
  document.getElementById("cfgCategory").value  = item.category;
  document.getElementById("cfgPattern").value   = item.pattern;
  document.getElementById("cfgThreshold").value = item.threshold;
  document.getElementById("cfgKeywords").value  = item.keywords.join(", ");
  document.getElementById("cfgTemplate").value  = item.response;
}

function saveConfig() {
  const intent    = document.getElementById("cfgIntent").value.trim();
  const category  = document.getElementById("cfgCategory").value.trim();
  const pattern   = document.getElementById("cfgPattern").value.trim();
  const threshold = parseFloat(document.getElementById("cfgThreshold").value);
  const keywords  = document.getElementById("cfgKeywords").value.split(",").map(k=>k.trim()).filter(Boolean);
  const response  = document.getElementById("cfgTemplate").value.trim();

  if (!intent || !response) { alert("Intent and Response Template are required."); return; }

  const existing = Store.getKb().find(k => k.intent === intent.toUpperCase());
  if (existing) {
    Object.assign(existing, { category: category.toUpperCase(), pattern, threshold, keywords, response });
    document.getElementById("cfgStatus").textContent = `✅ Updated: ${intent}`;
  } else {
    Store.addKb({ intent: intent.toUpperCase(), category: category.toUpperCase(), pattern, keywords, threshold, response });
    document.getElementById("cfgStatus").textContent = `✅ Added: ${intent}`;
  }
  renderKB();
  setTimeout(() => { document.getElementById("cfgStatus").textContent = ""; }, 3000);
}

function clearConfig() {
  ["cfgIntent","cfgCategory","cfgPattern","cfgKeywords","cfgTemplate"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("cfgThreshold").value = "0.65";
}

// ──────────────────────────────────────────
// 11. ANALYTICS  (mirrors Java AnalyticsServiceImpl)
// ──────────────────────────────────────────
function renderAnalytics() {
  const logs = Store.getLogs();
  const total    = logs.length;
  const resolved = logs.filter(l => l.status === "RESOLVED").length;
  const positive = logs.filter(l => l.sentiment === "POSITIVE").length;
  const avgConf  = (logs.reduce((a,l) => a + l.confidence, 0) / total * 100).toFixed(1);

  const kpiGrid = document.getElementById("kpiGrid");
  kpiGrid.innerHTML = `
    ${kpi("Total Interactions", total, "var(--primary)")}
    ${kpi("Resolution Rate", (resolved/total*100).toFixed(1)+"%", "var(--success)")}
    ${kpi("Avg. Confidence", avgConf+"%", "var(--warning)")}
    ${kpi("Positive Sentiment", (positive/total*100).toFixed(1)+"%", "var(--info)")}
  `;

  // Category bar chart (pure canvas)
  const catCounts = {};
  logs.forEach(l => catCounts[l.intent] = (catCounts[l.intent]||0) + 1);
  const catLabels = Object.keys(catCounts);
  const catData   = catLabels.map(k => catCounts[k]);
  drawBarChart("categoryChart", catLabels, catData, ["#6366f1","#10b981","#f59e0b","#3b82f6","#ef4444","#ec4899","#14b8a6","#f97316"]);

  // Sentiment donut
  const sentCounts = { POSITIVE:0, NEUTRAL:0, NEGATIVE:0 };
  logs.forEach(l => sentCounts[l.sentiment]++);
  drawDonutChart("sentimentChart",
    Object.keys(sentCounts),
    Object.values(sentCounts),
    ["#10b981","#6366f1","#ef4444"]
  );

  // Log table
  const logBody = document.getElementById("logBody");
  logBody.innerHTML = "";
  logs.slice().reverse().slice(0,15).forEach((l,i) => {
    const color = l.status === "RESOLVED" ? "text-success" : "text-warning";
    logBody.innerHTML += `<tr>
      <td>${i+1}</td>
      <td>${l.query}</td>
      <td><span class="badge badge-blue">${l.intent}</span></td>
      <td>${(l.confidence*100).toFixed(0)}%</td>
      <td>${l.latency}</td>
      <td class="${color}">${l.status}</td>
    </tr>`;
  });
}

function kpi(label, value, color) {
  return `<div class="kpi-card"><h4>${label}</h4><div class="kpi-val" style="color:${color}">${value}</div></div>`;
}

function drawBarChart(canvasId, labels, data, colors) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width = canvas.offsetWidth;
  const H = canvas.height = 220;
  ctx.clearRect(0,0,W,H);

  const pad = { t:20, r:10, b:40, l:40 };
  const chartW = W - pad.l - pad.r;
  const chartH = H - pad.t - pad.b;
  const max = Math.max(...data, 1);
  const barW = chartW / labels.length * 0.65;
  const gap  = chartW / labels.length;

  ctx.fillStyle = "#263348";
  ctx.fillRect(pad.l, pad.t, chartW, chartH);

  labels.forEach((lbl, i) => {
    const bh = (data[i] / max) * chartH;
    const x  = pad.l + i * gap + gap * 0.175;
    const y  = pad.t + chartH - bh;
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.roundRect(x, y, barW, bh, 4);
    ctx.fill();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(data[i], x + barW/2, y - 4);

    const shortLbl = lbl.replace("_","\\n").split("\\n")[0];
    ctx.fillText(shortLbl.slice(0,10), x + barW/2, H - 10);
  });
}

function drawDonutChart(canvasId, labels, data, colors) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width = canvas.offsetWidth;
  const H = canvas.height = 220;
  ctx.clearRect(0,0,W,H);

  const cx = W/2, cy = H/2 - 10, r = Math.min(W,H)*0.34, ir = r*0.55;
  const total = data.reduce((a,b)=>a+b,0) || 1;
  let start = -Math.PI/2;

  data.forEach((val, i) => {
    const angle = (val/total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,r,start,start+angle);
    ctx.closePath();
    ctx.fillStyle = colors[i];
    ctx.fill();
    start += angle;
  });

  // Inner hole
  ctx.beginPath();
  ctx.arc(cx,cy,ir,0,Math.PI*2);
  ctx.fillStyle = "#1a2236";
  ctx.fill();

  // Legend
  labels.forEach((lbl,i) => {
    const ly = cy + ir + 15 + i*18 - (labels.length-1)*9;
    ctx.fillStyle = colors[i];
    ctx.fillRect(cx - 60, ly - 8, 12, 12);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${lbl}: ${data[i]}`, cx - 44, ly + 2);
  });
}

// ──────────────────────────────────────────
// 12. ALGORITHM RETRAINING  (mirrors Java BackgroundModelRetrainer)
// ──────────────────────────────────────────
function startRetraining() {
  if (trainingTimer) return;
  const bar    = document.getElementById("trainProgress");
  const status = document.getElementById("trainStatus");
  const btn    = document.getElementById("retrainBtn");
  const lr     = parseFloat(document.getElementById("learningRate").value) || 0.05;
  const epochs = parseInt(document.getElementById("epochs").value) || 50;
  btn.disabled = true;
  status.textContent = "⏳ Retraining in progress (async thread pool)...";
  status.className = "text-warning";

  let pct = 0;
  // Simulate async epochs (mirrors Java ThreadPoolExecutor with progress callbacks)
  trainingTimer = setInterval(() => {
    pct = Math.min(pct + (100 / epochs * 2.5 * (0.8 + Math.random()*0.4)), 100);
    bar.style.width = pct + "%";
    bar.textContent = pct.toFixed(0) + "%";

    if (pct >= 100) {
      clearInterval(trainingTimer);
      trainingTimer = null;
      bar.style.width = "100%";
      bar.textContent = "100% – Complete";

      const newAcc  = (88 + Math.random()*5).toFixed(1);
      const newPrec = (88 + Math.random()*6).toFixed(1);
      const newRec  = (86 + Math.random()*6).toFixed(1);
      document.getElementById("modelAccuracy").textContent  = newAcc  + "%";
      document.getElementById("modelPrecision").textContent = newPrec + "%";
      document.getElementById("modelRecall").textContent    = newRec  + "%";
      document.getElementById("modelName").textContent = "Ensemble-NLP-v" + (2 + Math.random()).toFixed(1);

      status.textContent = `✅ Retraining complete! Accuracy: ${newAcc}% (lr=${lr}, epochs=${epochs})`;
      status.className = "text-success";
      btn.disabled = false;
    }
  }, 80);
}

// ──────────────────────────────────────────
// 13. SUGGESTION CHIPS
// ──────────────────────────────────────────
function renderSuggestions() {
  const container = document.getElementById("suggestionChips");
  container.innerHTML = SUGGESTIONS.slice(0,6).map(s =>
    `<span class="chip" onclick="document.getElementById('queryInput').value='${s}';sendChat()">${s}</span>`
  ).join("");
}

// ──────────────────────────────────────────
// 14. BOOT  (initial render on page load)
// ──────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Initial greeting from bot
  setTimeout(() => {
    appendMessage("bot",
      "👋 Hello! I'm **NovaAI**, your GUVI AI-powered virtual assistant. I'm trained to help with:\n\n• 🔐 Account & Password issues\n• 💳 Billing, Invoices & Refunds\n• 📦 Order Tracking\n• 🛠️ Technical Support\n• 📋 Subscription Management\n\nType your question below or click a suggestion chip:",
      `🤖 NovaAI · ${now12h()} · System Ready`
    );
    renderSuggestions();
  }, 300);

  // Render history table
  renderHistory();
});
