"use client";

import ImageToImageDemo from "@/components/ai-demo/ImageToImageDemo";
import ImageToVideoDemo from "@/components/ai-demo/ImageToVideoDemo";
import MultiTurnChatDemo from "@/components/ai-demo/MultiTurnChatDemo";
import SingleTurnChatDemo from "@/components/ai-demo/SingleTurnChatDemo";
import TextToImageDemo from "@/components/ai-demo/TextToImageDemo";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Film,
  ImageDown,
  ImageIcon,
  MessageSquare,
  MessagesSquare,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const navItems = [
  {
    id: "single-chat",
    name: "Single-turn Chat",
    icon: MessageSquare,
    color: "text-indigo-500",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/30",
    borderColor: "border-indigo-200 dark:border-indigo-800",
  },
  {
    id: "multi-chat",
    name: "Multi-turn Chat",
    icon: MessagesSquare,
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-800",
  },
  {
    id: "text-to-image",
    name: "Text to Image",
    icon: ImageIcon,
    color: "text-emerald-500",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    borderColor: "border-emerald-200 dark:border-emerald-800",
  },
  {
    id: "image-to-image",
    name: "Image to Image",
    icon: ImageDown,
    color: "text-purple-500",
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
    borderColor: "border-purple-200 dark:border-purple-800",
  },
  {
    id: "image-to-video",
    name: "Text/Image to Video",
    icon: Film,
    color: "text-rose-500",
    bgColor: "bg-rose-50 dark:bg-rose-950/30",
    borderColor: "border-rose-200 dark:border-rose-800",
  },
];

export default function AIDemo() {
  const [activeSection, setActiveSection] = useState(navItems[0].id);
  const sectionRefs = useRef<{ [key: string]: HTMLElement | null }>({});

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 150;

      for (const item of navItems) {
        const section = sectionRefs.current[item.id];
        if (section) {
          const { offsetTop, offsetHeight } = section;
          if (
            scrollPosition >= offsetTop &&
            scrollPosition < offsetTop + offsetHeight
          ) {
            setActiveSection(item.id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const section = sectionRefs.current[id];
    if (section) {
      window.scrollTo({
        top: section.offsetTop - 100,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="relative flex flex-col items-center">
      <div className="w-fit sticky top-20 z-30 backdrop-blur-xl bg-background/80 shadow-md rounded-full mb-16 mx-4">
        <div className="flex flex-nowrap overflow-x-auto gap-1 sm:gap-2 py-2 px-2 hide-scrollbar">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-full transition-all duration-300 whitespace-nowrap flex-shrink-0",
                activeSection === item.id
                  ? `${item.bgColor} ${item.color} shadow-sm`
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{item.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-24 w-full">
        {navItems.map((item) => (
          <motion.section
            key={item.id}
            id={item.id}
            ref={(el) => {
              sectionRefs.current[item.id] = el;
              return undefined;
            }}
            className={cn(
              "rounded-xl overflow-hidden border shadow-lg",
              item.borderColor
            )}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true, margin: "-100px" }}
          >
            <div className={cn("p-6", item.bgColor)}>
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "p-3 rounded-full bg-white/90 dark:bg-black/30 shadow-md",
                      item.color
                    )}
                  >
                    <item.icon className="h-7 w-7" />
                  </div>
                  <div>
                    <h2 className="text-2xl md:text-3xl font-bold">
                      {item.name}
                    </h2>
                    <p className="text-muted-foreground">
                      {getDescriptionForSection(item.id)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card p-6">
              <div className="max-w-4xl mx-auto">
                <DemoComponent id={item.id} />
              </div>
            </div>
          </motion.section>
        ))}
      </div>
    </div>
  );
}

function getDescriptionForSection(id: string): string {
  switch (id) {
    case "single-chat":
      return "Ask questions and get instant AI responses";
    case "multi-chat":
      return "Have extended conversations with context memory";
    case "text-to-image":
      return "Generate stunning images from text descriptions";
    case "image-analysis":
      return "Extract insights and information from images";
    case "image-to-image":
      return "Transform images with artistic styles and effects";
    case "image-to-video":
      return "Bring still images to life with realistic motion";
    case "text-to-video":
      return "Create videos directly from text descriptions";
    default:
      return "";
  }
}

function DemoComponent({ id }: { id: string }) {
  switch (id) {
    case "single-chat":
      return <SingleTurnChatDemo />;
    case "multi-chat":
      return <MultiTurnChatDemo />;
    case "text-to-image":
      return <TextToImageDemo />;
    case "image-to-image":
      return <ImageToImageDemo />;
    case "image-to-video":
      return <ImageToVideoDemo />;
    default:
      return null;
  }
}
