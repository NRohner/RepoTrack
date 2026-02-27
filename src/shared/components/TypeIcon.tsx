import { VscBug } from "react-icons/vsc";
import { HiOutlineSparkles } from "react-icons/hi2";
import { GoTools } from "react-icons/go";
import { LuClipboardList } from "react-icons/lu";
import type { IssueType } from "@/lib/types";

interface TypeIconProps {
  type: IssueType;
  className?: string;
}

export function TypeIcon({ type, className = "w-4 h-4" }: TypeIconProps) {
  switch (type) {
    case "bug":
      return <VscBug className={`text-red-500 ${className}`} />;
    case "feature":
      return <HiOutlineSparkles className={`text-purple-500 ${className}`} />;
    case "improvement":
      return <GoTools className={`text-amber-500 ${className}`} />;
    case "task":
      return <LuClipboardList className={`text-blue-500 ${className}`} />;
  }
}
