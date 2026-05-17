import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

export function GlassCard({ className, children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn("glass rounded-2xl p-5", className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}
