export function Tabular({ children }: { children: string }) {
  const parts = children.split(/(\d)/);
  return (
    <>
      <span className="sr-only">{children}</span>
      <span aria-hidden="true">
        {parts.map((part, i) =>
          /^\d$/.test(part) ? (
            <span key={i} className="tnum">
              {part}
            </span>
          ) : (
            part
          ),
        )}
      </span>
    </>
  );
}
