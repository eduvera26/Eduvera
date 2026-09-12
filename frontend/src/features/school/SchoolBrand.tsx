import "./school-brand.css";

export function SchoolBrand({ name, className = "" }: { name: string; className?: string }) {
  const crest = name.split(/\s+/).filter(Boolean).map((word) => word[0]).join("").slice(0, 3).toUpperCase();
  return (
    <div className={`school-brand ${className}`.trim()} aria-label={name}>
      <span className="school-brand__crest" aria-hidden="true">{crest}</span>
      <span className="school-brand__name">{name}</span>
    </div>
  );
}
