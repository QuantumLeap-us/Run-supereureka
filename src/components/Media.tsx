import { Box } from "@mui/material";
import Link from "next/link";
export default function Media() {
  const mediaList = [
    {
      title: "Space Exploration",
      linkText: "NASA",
      link: "https://www.nasa.gov",
      emoji: "🚀", 
    },
    {
      title: "网络监控",
      linkText: "CYBERTHREAT",
      link: "https://cybermap.kaspersky.com/cn",
      emoji: "💣", 
    },
    // 可以继续添加更多有趣的条目
  ];

  return (
    <div className="py-4">
      <div className="flex items-center justify-center gap-x-4 max-sm:flex-col">
        {mediaList.map(({ title, linkText, link, emoji }) => (
          <div key={title} className="flex items-center gap-2 text-xl">
            <span>{title}:</span>
            <Box
              component={Link}
              href={link}
              className="hover:underline"
              sx={{
                color: "primary.main",
              }}
            >
              {linkText} {emoji}
            </Box>
          </div>
        ))}
      </div>

      <div className="text-center">
        打赏地址☕️: 0x891b2CD306E519b0Bc372906f0CEdb399B09AFc0
      </div>
    </div>
  );
}
