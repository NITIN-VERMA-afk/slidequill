import React from "react";
import {
  TrendingUp,
  TrendingDown,
  BarChart2,
  PieChart,
  Users,
  Target,
  Shield,
  CheckCircle2,
  Award,
  Zap,
  Globe,
  DollarSign,
  Briefcase,
  Clock,
  Activity,
  Cpu,
  Layers,
  Compass,
  Rocket,
  Search,
  Star,
  Heart,
  FileText,
  Settings,
  Lock,
  Cloud,
  Database,
  Calendar,
  Flag,
  Lightbulb,
  type LucideProps,
} from "lucide-react";

export const ICON_MAP: Record<string, React.FC<LucideProps>> = {
  TrendingUp,
  TrendingDown,
  BarChart2,
  PieChart,
  Users,
  Target,
  Shield,
  CheckCircle2,
  Award,
  Zap,
  Globe,
  DollarSign,
  Briefcase,
  Clock,
  Activity,
  Cpu,
  Layers,
  Compass,
  Rocket,
  Search,
  Star,
  Heart,
  FileText,
  Settings,
  Lock,
  Cloud,
  Database,
  Calendar,
  Flag,
  Lightbulb,
};

interface SlideIconProps {
  name?: string;
  className?: string;
  size?: number | string;
  style?: React.CSSProperties;
}

export function SlideIcon({ name, className, size = "1em", style }: SlideIconProps) {
  if (!name || !ICON_MAP[name]) return null;
  const Component = ICON_MAP[name];
  return <Component className={className} size={size} style={style} />;
}
