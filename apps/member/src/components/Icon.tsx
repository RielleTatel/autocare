import {
  House, User, CarFront, CalendarDays, CalendarPlus, ChevronLeft, ChevronRight,
  Share2, TrendingUp, ListTree, Plus, MapPin, Phone, Camera, TriangleAlert,
  BatteryWarning, Disc3, Fuel, CircleQuestionMark, Eye, EyeOff, Wrench,
} from "lucide-react-native";
import { theme } from "../theme";

/**
 * The design system's icon set (`components/core/Icon.jsx`) is Lucide, chosen for
 * its 2px square-cap geometric construction. That file pins lucide-static 0.544.0
 * and addresses glyphs by kebab name; this map keeps those exact names so a name
 * lifted straight from a mockup resolves here.
 *
 * Icons are imported one by one rather than re-exported wholesale: Metro does not
 * reliably tree-shake the 1,778-icon barrel, so a namespace import would pull the
 * whole set into the bundle.
 */
const GLYPHS = {
  "house": House,
  "user": User,
  "car-front": CarFront,
  "calendar-days": CalendarDays,
  "calendar-plus": CalendarPlus,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "share-2": Share2,
  "trending-up": TrendingUp,
  "list-tree": ListTree,
  "plus": Plus,
  "map-pin": MapPin,
  "phone": Phone,
  "camera": Camera,
  "triangle-alert": TriangleAlert,
  "battery-warning": BatteryWarning,
  "disc-3": Disc3,
  "fuel": Fuel,
  // Renamed upstream after the version the design system pinned; keep the DS
  // name as the public one so mockup code ports across unchanged.
  "circle-help": CircleQuestionMark,
  "eye": Eye,
  "eye-off": EyeOff,
  "wrench": Wrench,
} as const;

export type IconName = keyof typeof GLYPHS;

/** DS size steps: 16 inline, 20 default, 22 tab bar, 24 card leading. */
export type IconSize = 16 | 20 | 22 | 24;

export function Icon({
  name,
  size = 20,
  color = theme.colors.ink,
}: {
  name: IconName;
  size?: IconSize | number;
  color?: string;
}) {
  const Glyph = GLYPHS[name];
  return (
    // Decorative by system rule: an icon always sits beside its own text label
    // and is never the only signal for a status, so it stays out of the a11y
    // tree rather than duplicating the label to screen readers.
    <Glyph
      size={size}
      color={color}
      strokeWidth={2}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
