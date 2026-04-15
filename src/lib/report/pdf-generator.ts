/**
 * HTML-based property report generator.
 *
 * jsPDF does not support Japanese text without embedding fonts,
 * so we generate an HTML document that can be printed to PDF via
 * the browser's native print dialog.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportData {
  address: string;
  lat: number;
  lon: number;
  zoning: {
    name: string;
    floorAreaRatio: number;
    buildingCoverageRatio: number;
  };
  building: {
    structure: string;
    totalFloorArea: number;
    floors: number;
    constructionCost: number;
  };
  rent: {
    monthlyRent: number;
    annualRent: number;
    method: string;
    confidence: string;
  };
  revenue: {
    grossYield: number;
    netYield: number;
    noi: number;
    cashFlow: number;
    dcr: number;
    irr5y: number;
    irr10y: number;
  };
  risk?: {
    grade: string;
    overall: number;
    discountRate: number;
    factors: Array<{ category: string; score: number; description: string }>;
    financingNote: string;
  };
  landPrice: number;
  totalInvestment: number;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Format yen value as 万円 (10-thousand yen units). */
function toManYen(yen: number): string {
  return `${(yen / 10_000).toLocaleString("ja-JP", { maximumFractionDigits: 0 })}万円`;
}

/** Format ratio as percentage string. */
function toPercent(ratio: number, digits: number = 2): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** Format number with comma separators. */
function toNum(value: number, digits: number = 0): string {
  return value.toLocaleString("ja-JP", { maximumFractionDigits: digits });
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

const REPORT_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Hiragino Kaku Gothic ProN", "Meiryo", "Noto Sans JP", sans-serif;
    color: #1a1a1a;
    background: #fff;
    line-height: 1.6;
    padding: 40px;
    max-width: 800px;
    margin: 0 auto;
  }
  h1 {
    font-size: 22px;
    border-bottom: 3px solid #1a56db;
    padding-bottom: 8px;
    margin-bottom: 24px;
    color: #1a56db;
  }
  h2 {
    font-size: 16px;
    color: #1a56db;
    border-left: 4px solid #1a56db;
    padding-left: 10px;
    margin: 24px 0 12px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
    font-size: 14px;
  }
  th, td {
    border: 1px solid #d1d5db;
    padding: 8px 12px;
    text-align: left;
  }
  th {
    background: #f3f4f6;
    font-weight: 600;
    width: 40%;
    white-space: nowrap;
  }
  td { width: 60%; }
  .meta { font-size: 12px; color: #6b7280; margin-bottom: 16px; }
  .risk-grade {
    display: inline-block;
    font-size: 18px;
    font-weight: bold;
    padding: 2px 12px;
    border-radius: 4px;
    color: #fff;
  }
  .grade-A { background: #16a34a; }
  .grade-B { background: #2563eb; }
  .grade-C { background: #d97706; }
  .grade-D { background: #dc2626; }
  .disclaimer {
    margin-top: 32px;
    padding: 12px;
    background: #fef3c7;
    border: 1px solid #f59e0b;
    border-radius: 6px;
    font-size: 12px;
    color: #92400e;
  }
  .source {
    margin-top: 12px;
    font-size: 11px;
    color: #9ca3af;
  }
  @media print {
    body { padding: 20px; }
    h1 { font-size: 18px; }
    h2 { font-size: 14px; break-after: avoid; }
    table { break-inside: avoid; }
    .disclaimer { break-inside: avoid; }
  }
`;

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function buildBasicInfo(data: ReportData): string {
  return `
    <h2>基本情報</h2>
    <table>
      <tr><th>住所</th><td>${escapeHtml(data.address)}</td></tr>
      <tr><th>緯度</th><td>${data.lat.toFixed(6)}</td></tr>
      <tr><th>経度</th><td>${data.lon.toFixed(6)}</td></tr>
      <tr><th>作成日</th><td>${escapeHtml(data.generatedAt)}</td></tr>
    </table>`;
}

function buildZoning(data: ReportData): string {
  return `
    <h2>用途地域</h2>
    <table>
      <tr><th>用途地域</th><td>${escapeHtml(data.zoning.name)}</td></tr>
      <tr><th>容積率</th><td>${data.zoning.floorAreaRatio}%</td></tr>
      <tr><th>建蔽率</th><td>${data.zoning.buildingCoverageRatio}%</td></tr>
    </table>`;
}

function buildBuilding(data: ReportData): string {
  return `
    <h2>建築シミュレーション</h2>
    <table>
      <tr><th>構造</th><td>${escapeHtml(data.building.structure)}</td></tr>
      <tr><th>延床面積</th><td>${toNum(data.building.totalFloorArea, 1)} m&sup2;</td></tr>
      <tr><th>想定階数</th><td>${data.building.floors}階</td></tr>
      <tr><th>概算建築費</th><td>${toManYen(data.building.constructionCost)}</td></tr>
    </table>`;
}

function buildRent(data: ReportData): string {
  const methodLabel = data.rent.method === "direct" ? "取引事例比較法" : "収益還元法（間接推定）";
  const confidenceLabel =
    data.rent.confidence === "high" ? "高" : data.rent.confidence === "medium" ? "中" : "低";
  return `
    <h2>賃料推定</h2>
    <table>
      <tr><th>月額賃料</th><td>${toManYen(data.rent.monthlyRent)}</td></tr>
      <tr><th>年額賃料</th><td>${toManYen(data.rent.annualRent)}</td></tr>
      <tr><th>推定方法</th><td>${methodLabel}</td></tr>
      <tr><th>信頼度</th><td>${confidenceLabel}</td></tr>
    </table>`;
}

function buildRevenue(data: ReportData): string {
  return `
    <h2>収益シミュレーション</h2>
    <table>
      <tr><th>土地価格</th><td>${toManYen(data.landPrice)}</td></tr>
      <tr><th>総投資額</th><td>${toManYen(data.totalInvestment)}</td></tr>
      <tr><th>表面利回り（GPI/総投資）</th><td>${toPercent(data.revenue.grossYield)}</td></tr>
      <tr><th>実質利回り（NOI/総投資）</th><td>${toPercent(data.revenue.netYield)}</td></tr>
      <tr><th>NOI（純営業収益）</th><td>${toManYen(data.revenue.noi)}</td></tr>
      <tr><th>年間キャッシュフロー</th><td>${toManYen(data.revenue.cashFlow)}</td></tr>
      <tr><th>DCR（返済余力）</th><td>${data.revenue.dcr.toFixed(2)}</td></tr>
      <tr><th>IRR（5年）</th><td>${toPercent(data.revenue.irr5y)}</td></tr>
      <tr><th>IRR（10年）</th><td>${toPercent(data.revenue.irr10y)}</td></tr>
    </table>`;
}

function buildRisk(data: ReportData): string {
  if (!data.risk) return "";

  const factorRows = data.risk.factors
    .map(
      (f) =>
        `<tr><td>${escapeHtml(f.category)}</td><td>${f.score.toFixed(2)}</td><td>${escapeHtml(f.description)}</td></tr>`,
    )
    .join("");

  const factorTable =
    data.risk.factors.length > 0
      ? `<table>
           <tr><th style="width:20%">区分</th><th style="width:15%">減点</th><th style="width:65%">詳細</th></tr>
           ${factorRows}
         </table>`
      : "<p>該当するハザードリスクはありませんでした。</p>";

  return `
    <h2>リスク評価</h2>
    <table>
      <tr>
        <th>総合グレード</th>
        <td><span class="risk-grade grade-${data.risk.grade}">${data.risk.grade}</span>（スコア: ${data.risk.overall.toFixed(2)}）</td>
      </tr>
      <tr><th>売却ディスカウント率</th><td>${toPercent(data.risk.discountRate)}</td></tr>
      <tr><th>融資見通し</th><td>${escapeHtml(data.risk.financingNote)}</td></tr>
    </table>
    <h2>リスク要因詳細</h2>
    ${factorTable}`;
}

function buildDisclaimer(): string {
  return `
    <div class="disclaimer">
      <strong>免責事項:</strong>
      本レポートは公開データに基づく概算シミュレーションであり、不動産鑑定評価ではありません。
      実際の投資判断にあたっては、必ず専門家（不動産鑑定士・建築士・税理士等）にご相談ください。
      賃料推定・利回り計算は参考値であり、将来の収益を保証するものではありません。
    </div>
    <div class="source">
      出典: 国土交通省 不動産情報ライブラリ / 国土地理院ジオコーダ
    </div>`;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a self-contained HTML report that can be rendered in a browser
 * and printed to PDF via the browser's print dialog.
 */
export function generateReportHtml(data: ReportData): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>物件調査レポート - ${escapeHtml(data.address)}</title>
  <style>${REPORT_CSS}</style>
</head>
<body>
  <h1>物件調査レポート</h1>
  <p class="meta">Generated by 地理空間情報チャットUI</p>
  ${buildBasicInfo(data)}
  ${buildZoning(data)}
  ${buildBuilding(data)}
  ${buildRent(data)}
  ${buildRevenue(data)}
  ${buildRisk(data)}
  ${buildDisclaimer()}
</body>
</html>`;
}
