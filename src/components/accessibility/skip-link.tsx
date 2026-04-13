export function SkipToMainLink() {
  return (
    <a
      href="#main-content"
      className="absolute top-4 left-[-9999px] z-[200] rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-md outline-none ring-offset-background transition-none focus:left-4 focus:ring-2 focus:ring-ring focus:ring-offset-2"
      onClick={(e) => {
        e.preventDefault();
        const el = document.getElementById("main-content");
        el?.focus({ preventScroll: true });
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
    >
      Skip to main content
    </a>
  );
}
