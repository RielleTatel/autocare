import {
  Wrench, RefreshCw, ChevronLeft, ChevronRight, ClipboardCheck, Camera, Image,
  ArrowUpDown, Check, ArrowUpRight, Droplet, Battery, Filter, CircleDot,
  Truck, ClipboardList, Banknote, Package, Trash2, AlertTriangle,
} from "lucide-react-native";
import { fieldTheme } from "../theme";

/**
 * The design system's icon set (`components/core/Icon.jsx`) is Lucide, chosen for
 * its 2px square-cap geometric construction. That file pins lucide-static 0.544.0
 * and addresses glyphs by kebab name; this map keeps those exact names so a name
 * lifted straight from a mockup resolves here.
 *
 * Icons are imported one by one rather than wholesale: Metro does not reliably
 * tree-shake the 1,778-icon barrel, so a namespace import pulls in the whole set.
 */
const GLYPHS = {
  "wrench": Wrench,
  "refresh-cw": RefreshCw,
  "alert-triangle": AlertTriangle,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "clipboard-check": ClipboardCheck,
  "camera": Camera,
  "image": Image,
  "arrow-up-down": ArrowUpDown,
  "check": Check,
  "arrow-up-right": ArrowUpRight,
  // Sync-queue and waste entity glyphs — these replace the emoji that stood in
  // for them (🛢️ 💧 🔋 🧽 🛞 🚚 📋 💵 📦).
  "droplet": Droplet,
  "battery": Battery,
  "filter": Filter,
  "circle-dot": CircleDot,
  "truck": Truck,
  "clipboard-list": ClipboardList,
  "banknote": Banknote,
  "package": Package,
  "trash-2": Trash2,
} as const;

export type IconName = keyof typeof GLYPHS;

/** DS size steps: 16 inline, 20 default, 22 leading, 24 card leading. Field
 *  leans on the larger steps for sunlight legibility. */
export type IconSize = 16 | 20 | 22 | 24;

export function Icon({
  name,
  size = 22,
  color = fieldTheme.colors.ink,
}: {
  name: IconName;
  size?: IconSize | number;
  color?: string;
}) {
  const Glyph = GLYPHS[name];
  return (
    // Decorative by system rule: an icon always sits beside its own text label
    // and is never the only signal for a status, so it stays out of the a11y
    // tree rather than duplicating that label to screen readers.
    <Glyph
      size={size}
      color={color}
      strokeWidth={2}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
