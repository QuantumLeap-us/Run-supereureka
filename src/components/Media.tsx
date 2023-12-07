interface MediaItem {
  title: string;
  linkText: string;
  link: string;
}

export default function Media() {
  const mediaList: MediaItem[] = [];

  return (
    <div className="py-4">
      <div className="flex items-center justify-center gap-x-4 max-sm:flex-col">
        {mediaList.map(({ title, linkText, link }) => (
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
              {linkText}
            </Box>
          </div>
        ))}
      </div>
    </div>
  );
}
