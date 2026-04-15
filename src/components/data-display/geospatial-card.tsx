"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "./data-table";
import { Disclaimer } from "./disclaimer";

interface ApiResultData {
  apiId: number;
  apiName: string;
  featureCount: number;
  error?: string;
  data?: Record<string, unknown>[];
}

export function GeospatialCard({ result }: { result: ApiResultData }) {
  if (result.error) {
    return (
      <Card className="border-destructive/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            {result.apiName}
            <Badge variant="destructive" className="text-xs">
              エラー
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-destructive">{result.error}</p>
        </CardContent>
      </Card>
    );
  }

  if (result.featureCount === 0) {
    return (
      <Card className="opacity-60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            {result.apiName}
            <Badge variant="secondary" className="text-xs">
              データなし
            </Badge>
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {result.apiName}
          <Badge variant="outline" className="text-xs">
            {result.featureCount}件
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {result.data && result.data.length > 0 && (
          <DataTable data={result.data} />
        )}
        <Disclaimer type="data" />
      </CardContent>
    </Card>
  );
}
