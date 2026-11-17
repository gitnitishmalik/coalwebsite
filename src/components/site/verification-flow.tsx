"use client";

import { motion } from "motion/react";
import { Radar, ScanText, ShieldCheck, Rocket, UserCheck } from "lucide-react";

const STEPS = [
  { icon: Radar, title: "Collect", text: "Ministry releases, news outlets and FX are fetched automatically every day." },
  { icon: ScanText, title: "Extract", text: "Claude reads each release or uploaded price board and turns it into structured prices." },
  { icon: ShieldCheck, title: "Verify", text: "Two sources must agree, or the Ministry decree. Ranges, arithmetic and outliers are tested." },
  { icon: UserCheck, title: "Review", text: "The editor sees every flag in the admin panel and approves what goes live." },
  { icon: Rocket, title: "Publish", text: "Board, charts and the AI brief update together — with sources attached." },
];

export function VerificationFlow() {
  return (
    <div className="relative">
      <div className="absolute top-7 right-[10%] left-[10%] hidden h-0.5 bg-border lg:block" />
      <motion.div
        className="absolute top-7 left-[10%] hidden h-0.5 origin-left bg-gradient-to-r from-amber-500 to-orange-700 lg:block"
        style={{ right: "10%" }}
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 1.6, ease: "easeInOut" }}
      />
      <ol className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((s, i) => (
          <motion.li
            key={s.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ delay: 0.15 + i * 0.22, duration: 0.5 }}
            className="flex flex-col items-start gap-3 lg:items-center lg:text-center"
          >
            <span className="relative grid size-14 place-items-center rounded-2xl border bg-white shadow-sm">
              <s.icon className="size-6 text-primary" />
              <span className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-foreground font-mono text-[10px] font-bold text-background">
                {String(i + 1).padStart(2, "0")}
              </span>
            </span>
            <div>
              <div className="font-bold">{s.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
            </div>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
