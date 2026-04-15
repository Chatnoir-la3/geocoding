import { NextRequest, NextResponse } from "next/server";
import { fetchGeospatialData, fetchMultipleApis } from "@/lib/geospatial/api-client";
import { reverseGeocode } from "@/lib/geospatial/geocoder";
import { parseZoningData, calculateBuilding, suggestStructure } from "@/lib/simulation/building-calc";
import { estimateRent } from "@/lib/simulation/rent-estimator";
import { calculateRevenue } from "@/lib/simulation/revenue-calculator";
import { calculateRiskScore } from "@/lib/simulation/risk-scorer";
import { generateReportHtml } from "@/lib/report/pdf-generator";
import type { GeoJsonFeature } from "@/types/geospatial";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract land price per sqm from API 1 (地価公示) features.
 * Looks for common price-related property keys.
 */
function extractLandPrice(features: GeoJsonFeature[]): number | null {
  for (const f of features) {
    const props = f.properties;
    for (const key of Object.keys(props)) {
      if (/price|価格|地価/i.test(key)) {
        const val = Number(props[key]);
        if (Number.isFinite(val) && val > 0) return val;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// GET /api/report?lat=...&lon=...&siteArea=...
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const latStr = searchParams.get("lat");
  const lonStr = searchParams.get("lon");
  const siteAreaStr = searchParams.get("siteArea");

  // --- Validate params ---
  if (!latStr || !lonStr || !siteAreaStr) {
    return NextResponse.json(
      { error: "lat, lon, siteArea are required query parameters" },
      { status: 400 },
    );
  }

  const lat = Number(latStr);
  const lon = Number(lonStr);
  const siteArea = Number(siteAreaStr);

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(siteArea) || siteArea <= 0) {
    return NextResponse.json(
      { error: "lat, lon must be valid numbers and siteArea must be a positive number" },
      { status: 400 },
    );
  }

  try {
    // --- Step 1: Fetch zoning (API 6) and land price (API 1) in parallel ---
    const [zoningResult, landPriceResult] = await Promise.all([
      fetchGeospatialData(6, lat, lon),
      fetchGeospatialData(1, lat, lon),
    ]);

    // --- Step 2: Parse zoning data ---
    let zoningData: { floorAreaRatio: number; buildingCoverageRatio: number; zoneName: string } | null = null;
    for (const feature of zoningResult.features) {
      zoningData = parseZoningData(feature.properties);
      if (zoningData) break;
    }

    if (!zoningData) {
      return NextResponse.json(
        { error: "用途地域データを取得できませんでした。座標を確認してください。" },
        { status: 404 },
      );
    }

    // --- Step 3: Calculate building ---
    const structure = suggestStructure(zoningData.floorAreaRatio);
    const buildingResult = calculateBuilding({
      siteArea,
      floorAreaRatio: zoningData.floorAreaRatio,
      buildingCoverageRatio: zoningData.buildingCoverageRatio,
      structure,
    });

    // --- Step 4: Reverse geocode for address and prefCode ---
    const geoResult = await reverseGeocode(lat, lon);
    const address = geoResult?.address ?? `${lat}, ${lon}`;
    const prefCode = geoResult?.prefCode ?? "";

    // --- Step 5: Land price ---
    const landPricePerSqm = extractLandPrice(landPriceResult.features) ?? 100_000; // fallback
    const landPrice = landPricePerSqm * siteArea;

    // --- Step 6: Estimate rent ---
    const rentResult = estimateRent({
      lat,
      lon,
      totalFloorArea: buildingResult.totalFloorArea,
      structure,
      prefCode,
      landPricePerSqm,
    });

    // --- Step 7: Calculate revenue ---
    const revenueResult = calculateRevenue({
      annualRent: rentResult.annualRent,
      constructionCost: buildingResult.constructionCost,
      landPrice,
      totalFloorArea: buildingResult.totalFloorArea,
    });

    // --- Step 8: Fetch hazard data (API 18-25) and calculate risk ---
    const hazardApiIds = [18, 19, 20, 21, 22, 23, 24, 25];
    const hazardResults = await fetchMultipleApis(hazardApiIds, lat, lon);

    const hazardFeatures: Record<number, GeoJsonFeature[]> = {};
    for (const result of hazardResults) {
      hazardFeatures[result.apiId] = result.features;
    }

    const riskScore = calculateRiskScore(hazardFeatures);

    // --- Step 9: Generate HTML report ---
    const totalInvestment = buildingResult.constructionCost + landPrice;
    const html = generateReportHtml({
      address,
      lat,
      lon,
      zoning: {
        name: zoningData.zoneName,
        floorAreaRatio: zoningData.floorAreaRatio,
        buildingCoverageRatio: zoningData.buildingCoverageRatio,
      },
      building: {
        structure: buildingResult.structureName,
        totalFloorArea: buildingResult.totalFloorArea,
        floors: buildingResult.estimatedFloors,
        constructionCost: buildingResult.constructionCost,
      },
      rent: {
        monthlyRent: rentResult.monthlyRent,
        annualRent: rentResult.annualRent,
        method: rentResult.method,
        confidence: rentResult.confidence,
      },
      revenue: {
        grossYield: revenueResult.grossYield,
        netYield: revenueResult.netYield,
        noi: revenueResult.noi,
        cashFlow: revenueResult.cashFlow,
        dcr: revenueResult.dcr,
        irr5y: revenueResult.irr5y,
        irr10y: revenueResult.irr10y,
      },
      risk: {
        grade: riskScore.grade,
        overall: riskScore.overall,
        discountRate: riskScore.discountRate,
        factors: riskScore.factors,
        financingNote: riskScore.financingNote,
      },
      landPrice,
      totalInvestment,
      generatedAt: new Date().toISOString().split("T")[0],
    });

    // --- Step 10: Return HTML ---
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Report generation error:", error);
    return NextResponse.json(
      { error: `レポート生成に失敗しました: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 },
    );
  }
}
