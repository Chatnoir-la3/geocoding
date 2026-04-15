interface DisclaimerProps {
  type: "simulation" | "data" | "general";
}

const disclaimerMessages: Record<DisclaimerProps["type"], string> = {
  simulation:
    "本シミュレーションは概算であり、不動産鑑定評価ではありません。投資判断は専門家にご相談ください。",
  data: "データ出典: 国土交通省 不動産情報ライブラリ",
  general:
    "本情報は参考値です。正確な情報は各自治体窓口にてご確認ください。",
};

export function Disclaimer({ type }: DisclaimerProps) {
  return (
    <p className="border-t pt-2 mt-2 text-xs text-muted-foreground">
      {disclaimerMessages[type]}
    </p>
  );
}
