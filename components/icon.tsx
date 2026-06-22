import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGauge,
  faUserGroup,
  faChalkboard,
  faCalendarCheck,
  faPenToSquare,
  faFileExcel,
  faFileLines,
  faChartColumn,
  faMoneyBillWave,
  faUserTie,
  faCalendarDays,
  faGear,
  faRightFromBracket,
  faBars,
  faXmark,
  faDownload,
  faUpload,
  faPaperclip,
  faPrint,
  faTriangleExclamation,
  faPlus,
  faIdCard,
  faChartLine,
  faTableList,
  faUserShield,
  faToggleOn,
  faToggleOff,
  faFloppyDisk,
  faTrash,
  faEye,
  faEyeSlash,
  faPencil,
  faClockRotateLeft,
  faCopy,
  faCheck,
  faKey,
  faRotate,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";

// Central icon set — only these ship in the bundle (tree-shaken SVG, no CDN
// request, no webfont download), which keeps the app light on slow connections.
const ICONS = {
  dashboard: faGauge,
  students: faUserGroup,
  classes: faChalkboard,
  attendance: faCalendarCheck,
  scores: faPenToSquare,
  excel: faFileExcel,
  reports: faFileLines,
  analytics: faChartColumn,
  fees: faMoneyBillWave,
  staff: faUserTie,
  timetable: faCalendarDays,
  settings: faGear,
  signout: faRightFromBracket,
  menu: faBars,
  close: faXmark,
  download: faDownload,
  upload: faUpload,
  attach: faPaperclip,
  print: faPrint,
  warning: faTriangleExclamation,
  plus: faPlus,
  card: faIdCard,
  trend: faChartLine,
  list: faTableList,
  shield: faUserShield,
  toggleOn: faToggleOn,
  toggleOff: faToggleOff,
  save: faFloppyDisk,
  trash: faTrash,
  eye: faEye,
  "eye-slash": faEyeSlash,
  pencil: faPencil,
  history: faClockRotateLeft,
  copy: faCopy,
  check: faCheck,
  key: faKey,
  refresh: faRotate,
} satisfies Record<string, IconDefinition>;

export type IconName = keyof typeof ICONS;

export default function Icon({
  name,
  className,
  fixedWidth = false,
}: {
  name: IconName;
  className?: string;
  fixedWidth?: boolean;
}) {
  return <FontAwesomeIcon icon={ICONS[name]} className={className} fixedWidth={fixedWidth} />;
}
