"use client";

import { motion } from "framer-motion";
import type { Answer } from "@/data/questions";

export function BoardCard({
  answer,
  index,
  revealed,
}: {
  answer: Answer;
  index: number;
  revealed: boolean;
}) {
  return (
    <div className="relative h-28 [perspective:1000px] sm:h-36">
      <motion.div
        className="relative h-full w-full [transform-style:preserve-3d]"
        animate={{ rotateX: revealed ? 180 : 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="absolute inset-0 flex items-center justify-center rounded-md border-4 border-yellow-400 bg-blue-700 shadow-inner [backface-visibility:hidden]">
          <span className="text-5xl font-black text-white sm:text-6xl">{index + 1}</span>
        </div>
        <div className="absolute inset-0 flex items-center justify-between rounded-md border-4 border-yellow-400 bg-blue-950 px-4 text-white [backface-visibility:hidden] [transform:rotateX(180deg)] sm:px-7">
          <span className="text-xl font-black tracking-wide sm:text-2xl">{answer.text}</span>
          <span className="rounded border-2 border-yellow-300 bg-yellow-400 px-4 py-2 text-2xl font-black text-blue-950">
            {answer.points}
          </span>
        </div>
      </motion.div>
    </div>
  );
}
