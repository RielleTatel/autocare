import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { bandForScore, vhsBands } from "@autocare/design-tokens";
import type { Band } from "@autocare/scoring";

const STAR = "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";

const BAND_LABEL: Record<Band, string> = {
  EXCELLENT: "Excellent", GOOD: "Good", FAIR: "Fair", NEEDS_ATTENTION: "Needs attention", CRITICAL: "Critical",
};

function starsForBand(band: Band): 1 | 2 | 3 | 4 | 5 {
  switch (band) {
    case "EXCELLENT": return 5;
    case "GOOD": return 4;
    case "FAIR": return 3;
    case "NEEDS_ATTENTION": return 2;
    case "CRITICAL": return 1;
  }
}

/** FR-114 star rating — a display transform over the score's band, never a
 *  second scoring system. Colored in the band fill; accessible label carries
 *  the count + band. */
export function StarRating({ score, band, size = 20 }: { score: number; band?: Band; size?: number }) {
  const bandKey = (band ?? (bandForScore(score) as Band)) as Band;
  const filled = starsForBand(bandKey);
  const color = vhsBands[bandKey].fill;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${filled} out of 5 stars — ${BAND_LABEL[bandKey]}`}
      style={{ flexDirection: "row", gap: 2 }}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Svg key={i} width={size} height={size} viewBox="0 0 24 24" testID={`star-${i}-${i <= filled ? "filled" : "empty"}`}>
          <Path d={STAR} fill={i <= filled ? color : "none"} stroke={color} strokeWidth={i <= filled ? 0 : 1.5} />
        </Svg>
      ))}
    </View>
  );
}
