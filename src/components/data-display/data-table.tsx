"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DataTableProps {
  data: Record<string, unknown>[];
}

/** 表示用にプロパティ名を短縮・翻訳する */
function formatKey(key: string): string {
  // 長すぎるキーは短縮
  if (key.length > 20) return key.substring(0, 20) + "…";
  return key;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") return value.toLocaleString("ja-JP");
  return String(value);
}

export function DataTable({ data }: DataTableProps) {
  if (data.length === 0) return null;

  // 全データから一意のキーを収集（最大8列まで）
  const allKeys = Array.from(
    new Set(data.flatMap((d) => Object.keys(d)))
  ).slice(0, 8);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {allKeys.map((key) => (
              <TableHead key={key} className="text-xs whitespace-nowrap">
                {formatKey(key)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.slice(0, 10).map((row, i) => (
            <TableRow key={i}>
              {allKeys.map((key) => (
                <TableCell key={key} className="text-xs">
                  {formatValue(row[key])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {data.length > 10 && (
        <p className="text-xs text-muted-foreground mt-1 text-right">
          …他 {data.length - 10} 件
        </p>
      )}
    </div>
  );
}
